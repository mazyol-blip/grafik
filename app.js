/* 72S Canlı — arayüz. Veri: data.js (L72), hesap: s72.js (calc72S), grafik: TradingView Lightweight Charts */
(function () {
  'use strict';
  var LC = window.LightweightCharts;
  var TZ = 'Europe/Istanbul';
  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem('l72s.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('l72s.' + k, JSON.stringify(v)); } catch (e) { /* dolu/kapalı */ } }
  };
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  // ---------- Biçimlendirme (Türkçe) ----------
  var nfCache = {};
  function fmtNum(v, dp) {
    if (!isFinite(v)) return '—';
    dp = Math.max(0, Math.min(10, dp | 0));
    var f = nfCache[dp] || (nfCache[dp] = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: dp, maximumFractionDigits: dp }));
    return f.format(v);
  }
  var pctF = new Intl.NumberFormat('tr-TR', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function fmtPct(v) { return isFinite(v) ? pctF.format(v / 100) : '—'; }
  var clockF = new Intl.DateTimeFormat('tr-TR', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  var dtF = new Intl.DateTimeFormat('tr-TR', { timeZone: TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  function clock(ms) { return clockF.format(new Date(ms)); }
  function bandDp(dp) { return Math.max(2, dp); }

  // Grafik saatleri: Lightweight Charts UTC gösterir; zamanı İstanbul ofsetiyle kaydırıyoruz
  var offCache = {};
  var offF = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' });
  function tzOffsetSec(ms) {
    var key = Math.floor(ms / 36e5);
    if (offCache[key] !== undefined) return offCache[key];
    var p = {}; offF.formatToParts(new Date(ms)).forEach(function (x) { p[x.type] = x.value; });
    var asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute);
    var off = Math.round((asUTC - Math.floor(ms / 6e4) * 6e4) / 1000);
    offCache[key] = off; return off;
  }
  function chartTime(ms) { return Math.floor(ms / 1000) + tzOffsetSec(ms); }
  var tY = new Intl.DateTimeFormat('tr-TR', { timeZone: 'UTC', year: 'numeric' });
  var tM = new Intl.DateTimeFormat('tr-TR', { timeZone: 'UTC', month: 'short' });
  var tD = new Intl.DateTimeFormat('tr-TR', { timeZone: 'UTC', day: 'numeric', month: 'short' });
  var tH = new Intl.DateTimeFormat('tr-TR', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' });
  var tFull = new Intl.DateTimeFormat('tr-TR', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' });

  // ---------- Durum ----------
  var syms = LS.get('syms', null);
  if (!Array.isArray(syms) || !syms.length) syms = L72.DEFAULT_SYMBOLS.slice();
  var state = {
    view: LS.get('view', 'ozet'),
    sort: LS.get('sort', 'touch'),
    scope: LS.get('scope', 'all'), // 'fav' = yalnızca Listem, 'all' = tüm Binance Futures
    sym: LS.get('sym', 'BTCUSDT'),
    tf: LS.get('tf', '4h'),
    q: '', showN: 0,
    lastOk: 0
  };
  if (!L72.TF[state.tf]) state.tf = '4h';
  if (state.scope !== 'fav') state.scope = 'all';

  // Tüm Binance Futures sembolleri: exchangeInfo'dan, localStorage'da günlük önbellek (l72s.allSyms = {ts, names})
  var ALL_TTL = 864e5;
  var allCache = LS.get('allSyms', null);
  if (!allCache || !Array.isArray(allCache.names)) allCache = { ts: 0, names: [] };
  var others = [], allErr = null, allLoading = false;
  function rebuildOthers() { others = L72.otherSymbols(syms, allCache.names); }
  rebuildOthers();

  function findIn(list, name) { for (var i = 0; i < list.length; i++) if (list[i].name === name) return list[i]; return null; }
  function isFav(name) { return !!findIn(syms, name); }
  function findSym(name) { return findIn(syms, name) || findIn(others, name); }
  function activeSyms() { return state.scope === 'all' ? syms.concat(others) : syms.slice(); }
  if (!findSym(state.sym)) state.sym = syms[0].name;
  function saveSyms() { LS.set('syms', syms); rebuildOthers(); }
  function markOk() { state.lastOk = Date.now(); updHeader(); }

  function updHeader() {
    var el = $('updText');
    var errs = 0, tot = 0;
    activeSyms().forEach(function (s) { var x = sum[s.name]; if (x) { tot++; if (x.err) errs++; } });
    if (!state.lastOk) {
      el.textContent = (tot && errs === tot) ? 'Veri alınamadı' : 'Yükleniyor…';
      el.classList.toggle('bad', tot > 0 && errs === tot);
      return;
    }
    el.textContent = 'Son güncelleme: ' + clock(state.lastOk);
    el.classList.toggle('bad', tot > 0 && errs > tot / 2);
  }

  // ---------- Sekmeler ----------
  function showView(v) {
    if (['ozet', 'grafik', 'ayar'].indexOf(v) < 0) v = 'ozet';
    state.view = v; LS.set('view', v);
    ['ozet', 'grafik', 'ayar'].forEach(function (k) { $('view-' + k).classList.toggle('hidden', k !== v); });
    document.querySelectorAll('.tabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.view === v); });
    if (v === 'ozet') renderSummary();
    if (v !== 'grafik') closePicker();
    if (v === 'grafik') { ensureChart(); if (!cur.o || cur.key !== chartKey()) loadChart(true); else loadChart(false); wsConnect(); }
    else wsClose();
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('.tabs button').forEach(function (b) { b.addEventListener('click', function () { showView(b.dataset.view); }); });

  // ---------- Grafik ----------
  var chart = null, sC, sH, sT, sB, mk;
  var cur = { key: '', o: null, r: null, req: 0, err: null, fetchedAt: 0, idx: {} };
  function chartKey() { var s = findSym(state.sym); return s ? s.ex + ':' + s.tk + ':' + state.tf : ''; }

  function ensureChart() {
    if (chart) return;
    chart = LC.createChart($('chart'), {
      autoSize: true,
      layout: { background: { type: 'solid', color: '#0d1117' }, textColor: '#aab4c0', fontSize: 11, attributionLogo: false },
      grid: { vertLines: { color: 'rgba(255,255,255,0.04)' }, horzLines: { color: 'rgba(255,255,255,0.05)' } },
      rightPriceScale: { borderColor: '#1f2a37', scaleMargins: { top: 0.12, bottom: 0.08 } },
      timeScale: {
        borderColor: '#1f2a37', timeVisible: true, secondsVisible: false, rightOffset: 4,
        tickMarkFormatter: function (t, type) {
          var d = new Date(t * 1000);
          if (type === 0) return tY.format(d);
          if (type === 1) return tM.format(d);
          if (type === 2) return tD.format(d);
          return tH.format(d);
        }
      },
      crosshair: { mode: 0 },
      localization: { locale: 'tr-TR', timeFormatter: function (t) { return tFull.format(new Date(t * 1000)); } }
    });
    sC = chart.addSeries(LC.CandlestickSeries, { upColor: '#26a69a', downColor: '#ef5350', borderVisible: false, wickUpColor: '#26a69a', wickDownColor: '#ef5350' });
    var band = { color: 'rgba(170,177,187,0.85)', lineWidth: 2, priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: false };
    sT = chart.addSeries(LC.LineSeries, band);
    sB = chart.addSeries(LC.LineSeries, band);
    sH = chart.addSeries(LC.LineSeries, { color: '#f0b90b', lineWidth: 3, priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: false });
    mk = LC.createSeriesMarkers(sC, []);
    chart.subscribeCrosshairMove(function (p) {
      if (!cur.o) return;
      var i = (p && p.time !== undefined && cur.idx[p.time] !== undefined) ? cur.idx[p.time] : -1;
      renderLegend(i);
    });
  }

  function setPriceFormat(dp) {
    var pf = { type: 'custom', minMove: Math.pow(10, -dp), formatter: function (v) { return fmtNum(v, dp); } };
    var bf = { type: 'custom', minMove: Math.pow(10, -dp), formatter: function (v) { return fmtNum(v, bandDp(dp)); } };
    sC.applyOptions({ priceFormat: pf }); sT.applyOptions({ priceFormat: bf }); sB.applyOptions({ priceFormat: bf }); sH.applyOptions({ priceFormat: bf });
  }

  function pt(o, r, i) {
    var t = chartTime(o.t[i]);
    return {
      c: { time: t, open: o.o[i], high: o.h[i], low: o.l[i], close: o.c[i] },
      h: isFinite(r.hma[i]) ? { time: t, value: r.hma[i] } : { time: t },
      t: isFinite(r.top[i]) ? { time: t, value: r.top[i] } : { time: t },
      b: isFinite(r.bot[i]) ? { time: t, value: r.bot[i] } : { time: t }
    };
  }

  function buildMarkers(o, r) {
    var m = [];
    for (var i = 0; i < o.t.length; i++) {
      var t = chartTime(o.t[i]);
      if (isFinite(r.top[i]) && o.h[i] >= r.top[i]) m.push({ time: t, position: 'aboveBar', color: '#ef5350', shape: 'arrowDown', size: 1 });
      if (isFinite(r.bot[i]) && o.l[i] <= r.bot[i]) m.push({ time: t, position: 'belowBar', color: '#26a69a', shape: 'arrowUp', size: 1 });
    }
    return m;
  }

  function renderChart(full, fromIdx) {
    var o = cur.o, r = cur.r, N = o.t.length;
    cur.idx = {};
    for (var i = 0; i < N; i++) cur.idx[chartTime(o.t[i])] = i;
    if (full) {
      var C = [], H = [], T = [], B = [];
      for (var j = 0; j < N; j++) { var p = pt(o, r, j); C.push(p.c); H.push(p.h); T.push(p.t); B.push(p.b); }
      setPriceFormat(o.dp);
      sC.setData(C); sH.setData(H); sT.setData(T); sB.setData(B); cur.sLast = C.length ? C[C.length - 1].time : 0;
      var vis = state.tf === '1d' ? 160 : 140;
      chart.timeScale().setVisibleLogicalRange({ from: N - vis, to: N + 3 });
    } else {
      for (var k = Math.max(0, fromIdx); k < N; k++) {
        var q = pt(o, r, k), hist = q.c.time < cur.sLast; // son mumdan eski mumlar "historical update" ister
        sC.update(q.c, hist); sH.update(q.h, hist); sT.update(q.t, hist); sB.update(q.b, hist);
        if (q.c.time > cur.sLast) cur.sLast = q.c.time;
      }
    }
    mk.setMarkers(buildMarkers(o, r));
    renderLegend(-1);
  }

  function renderLegend(i) {
    var o = cur.o, r = cur.r; if (!o) { $('legend').innerHTML = ''; return; }
    var last = o.t.length - 1; if (i < 0) i = last;
    var dp = o.dp, bdp = bandDp(dp), s = findSym(state.sym);
    var html = '<div class="ttl">' + esc(state.sym) + (s && s.tk !== s.name ? ' <span class="g">(' + esc(s.tk) + ')</span>' : '') +
      ' · ' + L72.TF[state.tf].label + ' · <span class="g">' + esc(L72.EX_NAME[s ? s.ex : 'BN']) + '</span></div>';
    html += '<div>A ' + fmtNum(o.o[i], dp) + ' Y ' + fmtNum(o.h[i], dp) + ' D ' + fmtNum(o.l[i], dp) + ' K ' + fmtNum(o.c[i], dp) + '</div>';
    html += '<div><span class="h">HMA+ ' + fmtNum(r.hma[i], bdp) + '</span> · <span class="g">Üst ' + fmtNum(r.top[i], bdp) + ' · Alt ' + fmtNum(r.bot[i], bdp) + '</span></div>';
    if (i === last && isFinite(r.top[i])) {
      var c = o.c[i];
      html += '<div class="g">Üste ' + fmtPct((r.top[i] - c) / c * 100) + ' · Alta ' + fmtPct((c - r.bot[i]) / c * 100) + '</div>';
    } else if (i !== last) {
      html += '<div class="g">' + dtF.format(new Date(o.t[i])) + '</div>';
    }
    $('legend').innerHTML = html;
  }

  function chartMsg(text, isErr, retry) {
    var el = $('chartMsg');
    if (!text) { el.classList.add('hidden'); el.innerHTML = ''; return; }
    el.classList.remove('hidden'); el.classList.toggle('err', !!isErr);
    el.innerHTML = '<div>' + esc(text) + '</div>' + (retry ? '<button type="button" class="btn" id="retryChart">Tekrar dene</button>' : '');
    if (retry) $('retryChart').onclick = function () { loadChart(true); };
  }

  function renderChartStat() {
    var parts = [];
    var live = ws && wsGotMsg && ws.readyState === 1;
    var left = live ? '<span class="live">Canlı</span>' : '<span class="off">Canlı akış yok (yenileme ~20 sn)</span>';
    if (cur.fetchedAt) parts.push('Son güncelleme: ' + clock(cur.lastTick || cur.fetchedAt));
    if (cur.err) parts.push('<span style="color:#ffb4ab">' + esc(cur.err) + '</span>');
    $('chartStat').innerHTML = '<span>' + left + '</span><span>' + parts.join(' · ') + '</span>';
  }

  function loadChart(full) {
    var s = findSym(state.sym); if (!s) return;
    ensureChart();
    var key = chartKey(), req = ++cur.req;
    if (key !== cur.key) { full = true; cur.key = key; cur.o = null; cur.r = null; cur.err = null; cur.fetchedAt = 0; cur.lastTick = 0; $('legend').innerHTML = ''; chartMsg('Yükleniyor… ' + s.name + ' ' + L72.TF[state.tf].label, false); }
    return L72.fetchKlines(s, state.tf, 1500).then(function (o) {
      if (req !== cur.req) return;
      var r = L72.compute(o);
      var prevLast = cur.o ? cur.o.t[cur.o.t.length - 1] : null;
      var from = -1;
      if (!full && prevLast !== null) { from = o.t.indexOf(prevLast); if (from < 0 || o.t.length - from > 5) full = true; }
      cur.key = key; cur.o = o; cur.r = r; cur.err = null; cur.fetchedAt = Date.now(); cur.lastTick = 0;
      chartMsg(null);
      renderChart(!!full || prevLast === null, from);
      markOk(); renderChartStat();
    }, function (e) {
      if (req !== cur.req) return;
      cur.err = L72.errorText(e, s.ex);
      if (!cur.o) chartMsg('Veri alınamadı. ' + cur.err, true, true);
      else cur.err = 'Güncellenemedi: ' + cur.err + ' (grafik ' + clock(cur.fetchedAt) + ' verisi)';
      renderChartStat();
    });
  }

  // ---------- Canlı mum (websocket) ----------
  var ws = null, wsKey = '', wsGotMsg = false, wsTry = 0, wsTimer = null, wsPing = null, wsWatch = null, liveT = null, lastMsgAt = 0;
  function wsClose() {
    wsKey = ''; clearTimeout(wsTimer); clearInterval(wsPing); clearInterval(wsWatch);
    if (ws) { try { ws.onclose = null; ws.close(); } catch (e) { /* */ } }
    ws = null; wsGotMsg = false;
  }
  function wsConnect() {
    if (!('WebSocket' in window)) return;
    var s = findSym(state.sym); if (!s) return;
    var key = chartKey();
    if (ws && wsKey === key) return;
    wsClose(); wsKey = key;
    var tf = L72.TF[state.tf], url;
    if (s.ex === 'BN') {
      // Binance yeni yol (/market/ws) çalışmazsa eski yol (/ws) denenir
      url = 'wss://fstream.binance.com/' + (wsTry % 2 === 0 ? 'market/ws/' : 'ws/') + s.tk.toLowerCase() + '@kline_' + tf.bn;
    } else {
      url = 'wss://stream.bybit.com/v5/public/linear';
    }
    var sock;
    try { sock = new WebSocket(url); } catch (e) { return wsRetry(key); }
    ws = sock; wsGotMsg = false; lastMsgAt = Date.now();
    sock.onopen = function () {
      if (s.ex === 'BY') {
        sock.send(JSON.stringify({ op: 'subscribe', args: ['kline.' + tf.by + '.' + s.tk] }));
        wsPing = setInterval(function () { try { sock.send('{"op":"ping"}'); } catch (e) { /* */ } }, 20000);
      }
    };
    sock.onmessage = function (ev) {
      if (wsKey !== key) return;
      var j; try { j = JSON.parse(ev.data); } catch (e) { return; }
      var bar = null;
      if (s.ex === 'BN' && j && j.k) bar = { t: +j.k.t, o: +j.k.o, h: +j.k.h, l: +j.k.l, c: +j.k.c };
      if (s.ex === 'BY' && j && j.topic && j.data && j.data[0]) { var d = j.data[0]; bar = { t: +d.start, o: +d.open, h: +d.high, l: +d.low, c: +d.close }; }
      if (!bar) return;
      lastMsgAt = Date.now();
      if (!wsGotMsg) { wsGotMsg = true; wsTry = 0; renderChartStat(); }
      applyLive(bar);
    };
    sock.onclose = function () { if (wsKey === key) { ws = null; renderChartStat(); wsRetry(key); } };
    sock.onerror = function () { /* onclose gelecek */ };
    clearInterval(wsWatch);
    wsWatch = setInterval(function () { if (wsKey === key && Date.now() - lastMsgAt > 90000) { try { sock.close(); } catch (e) { /* */ } } }, 30000);
  }
  function wsRetry(key) {
    clearInterval(wsPing); clearInterval(wsWatch);
    wsTry++;
    var delay = Math.min(60000, 2000 * Math.pow(2, Math.min(5, Math.floor(wsTry / 2))));
    wsTimer = setTimeout(function () { if (wsKey === key && state.view === 'grafik') { wsKey = ''; ws = null; wsConnect(); } }, delay);
  }
  function applyLive(bar) {
    var o = cur.o; if (!o || cur.key !== wsKey) return;
    var N = o.t.length, lastT = o.t[N - 1];
    if (bar.t < lastT) return;
    if (bar.t === lastT) { o.o[N - 1] = bar.o; o.h[N - 1] = bar.h; o.l[N - 1] = bar.l; o.c[N - 1] = bar.c; }
    else if (bar.t - lastT === L72.TF[state.tf].ms) { o.t.push(bar.t); o.o.push(bar.o); o.h.push(bar.h); o.l.push(bar.l); o.c.push(bar.c); }
    else { loadChart(false); return; } // boşluk var: REST ile tazele
    if (liveT) return;
    liveT = setTimeout(function () {
      liveT = null; if (!cur.o) return;
      cur.r = L72.compute(cur.o); cur.lastTick = Date.now();
      renderChart(false, cur.o.t.length - 2);
      renderChartStat();
    }, 1000);
  }

  // ---------- Sembol / zaman dilimi seçimi (aramalı seçici) ----------
  var PICK_MAX = 250;
  function symSub(s) { return (s.tk !== s.name ? ' <small>' + esc(s.tk) + '</small>' : '') + (s.ex === 'BY' ? ' <small>Bybit</small>' : ''); }
  function renderSymSel() {
    var s = findSym(state.sym);
    $('symBtnTxt').innerHTML = esc(state.sym) + (s ? symSub(s) : '') + (isFav(state.sym) ? ' <span class="favmark">★</span>' : '');
    if (!$('picker').classList.contains('hidden')) renderPicker();
  }
  function normQ(v) { return String(v || '').trim().toUpperCase().replace(/[\s\-_\/]/g, ''); }
  function matchList(list, q) {
    if (!q) return list.slice();
    var a = [], b = [];
    list.forEach(function (s) {
      var n = s.name.toUpperCase(), t = s.tk.toUpperCase();
      if (n.indexOf(q) === 0 || t.indexOf(q) === 0 || t.indexOf('1000' + q) === 0) a.push(s);
      else if (n.indexOf(q) >= 0 || t.indexOf(q) >= 0) b.push(s);
    });
    return a.concat(b);
  }
  function pickRow(s) {
    var x = sum[s.name], st = x && x.s, tag = '';
    if (st && st.up) tag += '<span class="tag up">▲</span>';
    if (st && st.lo) tag += '<span class="tag lo">▼</span>';
    var fav = isFav(s.name);
    return '<div class="prow' + (s.name === state.sym ? ' cur' : '') + '" data-name="' + esc(s.name) + '"><span class="pn">' + esc(s.name) + symSub(s) + ' ' + tag + '</span>' +
      '<button type="button" class="star' + (fav ? ' on' : '') + '" data-star="' + esc(s.name) + '" aria-label="' + esc(s.name) + (fav ? ' Listemden çıkar' : ' Listeme ekle') + '">' + (fav ? '★' : '☆') + '</button></div>';
  }
  function renderPicker() {
    var q = normQ($('symQ').value);
    var f = matchList(syms, q), o = matchList(others, q), html = '';
    html += '<div class="pgrp">★ Listem (' + f.length + (q ? '/' + syms.length : '') + ')</div>';
    html += f.length ? f.map(pickRow).join('') : '<div class="pempty">Listemde eşleşen yok</div>';
    html += '<div class="pgrp">Binance Futures — diğerleri (' + o.length + (q ? '/' + others.length : '') + ')</div>';
    if (!others.length) html += '<div class="pempty">' + (allLoading ? 'Sembol listesi yükleniyor…' : 'Sembol listesi alınamadı' + (allErr ? ': ' + esc(allErr) : '')) + '</div>';
    else if (!o.length) html += '<div class="pempty">Eşleşen sembol yok</div>';
    else {
      html += o.slice(0, PICK_MAX).map(pickRow).join('');
      if (o.length > PICK_MAX) html += '<div class="pempty">… ' + (o.length - PICK_MAX) + ' sembol daha. Daraltmak için yazın.</div>';
    }
    $('pickList').innerHTML = html;
  }
  function openPicker() {
    $('picker').classList.remove('hidden'); $('symQ').value = ''; renderPicker();
    $('pickList').scrollTop = 0;
    setTimeout(function () { try { $('symQ').focus({ preventScroll: true }); } catch (e) { /* */ } }, 50);
  }
  function closePicker() { $('picker').classList.add('hidden'); }
  function toggleFav(name) {
    var msg = null;
    if (isFav(name)) {
      if (syms.length <= 1) msg = 'Listede en az bir sembol kalmalı.';
      else if (window.confirm(name + ' Listemden çıkarılsın mı?')) syms = syms.filter(function (s) { return s.name !== name; });
    } else {
      var s = findSym(name); if (s) syms.push({ name: s.name, tk: s.tk, ex: s.ex });
    }
    if (msg) { toast(msg); return; }
    saveSyms(); delete meta[name];
    renderSymList(); renderSymSel(); renderPicker(); dirty(); pump();
  }
  $('symBtn').addEventListener('click', openPicker);
  $('pickClose').addEventListener('click', closePicker);
  $('symQ').addEventListener('input', renderPicker);
  $('symQ').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { var r = $('pickList').querySelector('.prow'); if (r) { closePicker(); selectChart(r.dataset.name, null); } }
    if (e.key === 'Escape') closePicker();
  });
  $('pickList').addEventListener('click', function (e) {
    var st = e.target.closest('button[data-star]'); if (st) { toggleFav(st.dataset.star); return; }
    var row = e.target.closest('.prow'); if (!row) return;
    closePicker(); selectChart(row.dataset.name, null);
  });
  function renderTf() { document.querySelectorAll('#tfSeg button').forEach(function (b) { b.classList.toggle('on', b.dataset.tf === state.tf); }); }
  function selectChart(name, tf) {
    if (name) { state.sym = name; LS.set('sym', name); }
    if (tf) { state.tf = tf; LS.set('tf', tf); }
    renderSymSel(); renderTf();
    if (state.view === 'grafik') { loadChart(true); wsConnect(); }
  }
  document.querySelectorAll('#tfSeg button').forEach(function (b) { b.addEventListener('click', function () { selectChart(null, b.dataset.tf); }); });

  // ---------- Özet tablo ----------
  // Çok sembol (Tümü ≈ 565) için: en fazla CONC paralel istek, Binance ağırlık bütçesi (kayan 60 sn pencere),
  // 429/418'de bekleme, Listem önce; ekran en fazla ~1,5 sn'de bir ve yalnızca Özet açıkken çizilir.
  var sum = {}; // name -> {s, at, err}
  var meta = {}; // name -> {due, busy}
  var CONC = 5, WEIGHT_BUDGET = 1500, FAV_LIMIT = 1500, ALL_LIMIT = 499;
  var FAV_EVERY = 60000, ALL_EVERY = 180000;
  var inflight = 0, wlog = [], pausedUntil = 0, pumpT = null, pumpAt = 0;
  var PAGE = 120;

  function limitFor(sym) { return isFav(sym.name) ? FAV_LIMIT : ALL_LIMIT; }
  function usedWeight(now) {
    while (wlog.length && wlog[0][0] <= now - 60000) wlog.shift();
    var u = 0; for (var i = 0; i < wlog.length; i++) u += wlog[i][1];
    return u;
  }
  function schedulePump(ms) {
    ms = Math.max(50, ms | 0);
    var at = Date.now() + ms;
    if (pumpT && pumpAt <= at) return;
    clearTimeout(pumpT); pumpAt = at;
    pumpT = setTimeout(function () { pumpT = null; pump(); }, ms);
  }
  function pickNext(now) {
    // gizli sekmede yalnızca Listem (uyarılar için) yenilenir
    var list = document.hidden ? syms : activeSyms(), best = null, bestKey = Infinity, nextDue = Infinity;
    for (var i = 0; i < list.length; i++) {
      var sym = list[i], m = meta[sym.name] || (meta[sym.name] = { due: 0, busy: false });
      if (m.busy) continue;
      if (m.due > now) { if (m.due < nextDue) nextDue = m.due; continue; }
      var key = (isFav(sym.name) ? 0 : 1e15) + m.due; // Listem önce, sonra en çok geciken
      if (key < bestKey) { bestKey = key; best = sym; }
    }
    return { sym: best, nextDue: nextDue };
  }
  function pump() {
    while (inflight < CONC) {
      var now = Date.now();
      if (now < pausedUntil) { schedulePump(pausedUntil - now); return; }
      var p = pickNext(now);
      if (!p.sym) { if (isFinite(p.nextDue)) schedulePump(p.nextDue - now); return; }
      var sym = p.sym, w = sym.ex === 'BN' ? L72.klinesWeight(limitFor(sym)) : 0;
      if (w && usedWeight(now) + w > WEIGHT_BUDGET) { schedulePump(wlog[0][0] + 60000 - now + 100); return; }
      if (w) wlog.push([now, w]);
      run(sym);
    }
  }
  function run(sym) {
    var m = meta[sym.name] || (meta[sym.name] = { due: 0 });
    m.busy = true; inflight++;
    updateOne(sym).then(function () {
      inflight--; m.busy = false;
      m.due = Date.now() + (isFav(sym.name) ? FAV_EVERY : ALL_EVERY);
      dirty(); updHeader(); pump();
    });
  }

  function updateOne(sym) {
    return L72.fetchKlines(sym, '4h', limitFor(sym)).then(function (o) {
      var r = L72.compute(o), s = L72.summarize(o, r);
      sum[sym.name] = { s: s, at: Date.now(), err: null };
      markOk(); checkAlerts(sym, s);
    }, function (e) {
      var prev = sum[sym.name] || {};
      sum[sym.name] = { s: prev.s || null, at: prev.at || 0, err: L72.errorText(e, sym.ex) };
      if (sym.ex === 'BN' && e && e.kind === 'http' && (e.status === 429 || e.status === 418)) {
        pausedUntil = Math.max(pausedUntil, Date.now() + (e.status === 418 ? 180000 : 65000)); // istek sınırı: bekle
      }
    });
  }

  var renderT = null, lastRender = 0;
  function dirty() {
    if (renderT) return;
    var wait = Math.max(0, 1500 - (Date.now() - lastRender));
    renderT = setTimeout(function () { renderT = null; if (state.view === 'ozet' && !document.hidden) renderSummary(); }, wait);
  }
  function refreshNow() {
    var list = activeSyms();
    list.forEach(function (s) { var m = meta[s.name]; if (m) m.due = 0; });
    pump();
  }
  $('refreshAll').addEventListener('click', function () { refreshNow(); if (state.view === 'grafik') loadChart(false); });

  function sortVal(x, mode) {
    var s = x && x.s;
    if (!s || !s.warm) return Infinity;
    if (mode === 'up') return s.distUp;
    if (mode === 'lo') return s.distLo;
    if (mode === 'near') return Math.min(s.distUp, s.distLo);
    if (mode === 'touch') return (s.up || s.lo) ? -1e9 + Math.min(s.distUp, s.distLo) : Math.min(s.distUp, s.distLo);
    return 0;
  }
  function rowHTML(sym) {
    var x = sum[sym.name], s = x && x.s, cls = 'srow', tags = '';
    if (s && s.up) { cls += ' t-up'; tags += '<span class="tag up">▲ Üst ' + (s.upNow ? '(şimdi)' : '(önceki mum)') + '</span>'; }
    if (s && s.lo) { cls += ' t-lo'; tags += '<span class="tag lo">▼ Alt ' + (s.loNow ? '(şimdi)' : '(önceki mum)') + '</span>'; }
    var sub = (isFav(sym.name) && state.scope === 'all' ? '<small class="favmark">★</small>' : '') + symSub(sym).replace(/^ /, '');
    var h = '<div class="' + cls + '" role="listitem" data-name="' + esc(sym.name) + '">';
    h += '<div class="sname">' + esc(sym.name) + sub + tags + '</div>';
    h += '<div class="sprice">' + (s ? fmtNum(s.price, s.dp) : (x && x.err ? '—' : '…')) + '</div>';
    if (s && s.warm) {
      var bdp = bandDp(s.dp);
      h += '<div class="sbands"><span>Üst <b>' + fmtNum(s.top, bdp) + '</b> <span class="' + (Math.abs(s.distUp) < 1 ? 'near' : '') + '">' + fmtPct(s.distUp) + '</span></span>' +
        '<span>Alt <b>' + fmtNum(s.bot, bdp) + '</b> <span class="' + (Math.abs(s.distLo) < 1 ? 'near' : '') + '">' + fmtPct(s.distLo) + '</span></span></div>';
    } else if (s) {
      h += '<div class="sbands"><span>Bantlar için yeterli mum yok (' + s.n + ' mum)</span></div>';
    } else if (!x) {
      h += '<div class="sbands"><span>Yükleniyor…</span></div>';
    }
    if (x && x.err) h += '<div class="serr">⚠ ' + esc(x.err) + (s ? ' · gösterilen veri ' + clock(x.at) : '') + '</div>';
    return h + '</div>';
  }
  function renderSummary() {
    lastRender = Date.now();
    clearTimeout(renderT); renderT = null;
    var mode = state.sort, all = activeSyms();
    var list = matchList(all, normQ(state.q));
    if (mode === 'az') list.sort(function (a, b) { return a.name.localeCompare(b.name, 'tr'); });
    else if (mode !== 'list') {
      // eşit değerlerde liste sırası korunur (Listem önce)
      var pos = {}; list.forEach(function (s, k) { pos[s.name] = k; });
      list.sort(function (a, b) { return (sortVal(sum[a.name], mode) - sortVal(sum[b.name], mode)) || (pos[a.name] - pos[b.name]); });
    }
    var errs = 0, ok = 0, touches = 0, done = 0;
    all.forEach(function (sym) {
      var x = sum[sym.name], s = x && x.s;
      if (x) done++;
      if (x && x.err) errs++; else if (s) ok++;
      if (s && (s.up || s.lo)) touches++;
    });
    var n = Math.min(list.length, state.showN || PAGE);
    var html = list.slice(0, n).map(rowHTML).join('');
    if (!list.length) html = '<div class="muted pempty">' + (state.q ? 'Aramayla eşleşen sembol yok.' : 'Sembol yok.') + '</div>';
    if (list.length > n) html += '<button type="button" class="btn small more" id="sumMore">Daha fazla göster (' + n + '/' + list.length + ')</button>';
    $('sumList').innerHTML = html;
    var tot = all.length;
    // ilerleme
    var pr = $('sumProg'), busy = done < tot;
    pr.innerHTML = '<span>' + done + '/' + tot + ' yüklendi' + (Date.now() < pausedUntil ? ' · istek sınırı, bekleniyor…' : '') +
      (state.scope === 'all' && allLoading && !others.length ? ' · sembol listesi alınıyor…' : '') + '</span>' +
      '<span class="bar"><i style="width:' + (tot ? Math.round(done / tot * 100) : 0) + '%"></i></span>';
    pr.classList.toggle('done', !busy);
    $('sumFoot').textContent = 'Güncel: ' + ok + '/' + tot + (errs ? ' · Hata: ' + errs : '') + ' · Temas: ' + touches +
      (state.scope === 'all' ? ' · Listem ~60 sn, diğerleri ~3 dk\'da bir yenilenir' : ' · Her sembol ~60 sn\'de bir yenilenir');
    var be = $('sumErr');
    var firstErr = null; all.forEach(function (sym) { var x = sum[sym.name]; if (!firstErr && x && x.err) firstErr = x.err; });
    if (errs && errs >= Math.max(2, Math.ceil(done / 2))) { be.classList.remove('hidden'); be.textContent = 'Borsalara ulaşılamıyor: ' + firstErr + '. Gösterilen değerler eski olabilir; hatalı satırlarda veri yoktur.'; }
    else be.classList.add('hidden');
  }
  $('sumList').addEventListener('click', function (e) {
    if (e.target.id === 'sumMore') { state.showN = (state.showN || PAGE) + PAGE; renderSummary(); return; }
    var row = e.target.closest('.srow'); if (!row) return;
    state.sym = row.dataset.name; LS.set('sym', state.sym);
    renderSymSel(); showView('grafik');
  });
  if (!$('sortSel').querySelector('option[value="' + state.sort + '"]')) state.sort = 'touch';
  $('sortSel').value = state.sort;
  $('sortSel').addEventListener('change', function () { state.sort = this.value; LS.set('sort', state.sort); state.showN = 0; renderSummary(); });
  function renderScope() { document.querySelectorAll('#scopeSeg button').forEach(function (b) { b.classList.toggle('on', b.dataset.scope === state.scope); }); }
  document.querySelectorAll('#scopeSeg button').forEach(function (b) {
    b.addEventListener('click', function () {
      state.scope = b.dataset.scope; LS.set('scope', state.scope); state.showN = 0;
      renderScope(); renderSummary(); updHeader(); pump();
    });
  });
  var qT = null;
  $('sumQ').addEventListener('input', function () {
    var v = this.value; clearTimeout(qT);
    qT = setTimeout(function () { state.q = v; state.showN = 0; renderSummary(); }, 200);
  });

  // ---------- Uyarılar (bildirim / ses) ----------
  var seen = LS.get('seen', {});
  (function prune() { var lim = Date.now() - 4 * 864e5; for (var k in seen) if (seen[k] < lim) delete seen[k]; })();
  var pending = [], flushT = null, audioCtx = null;
  var cfg = { sound: LS.get('sound', false), notif: LS.get('notif', false), alertAll: LS.get('alertAll', false) };

  function checkAlerts(sym, s) {
    // Listem her zaman; diğer semboller yalnızca "Tümü" açıkken ve ayar açıksa uyarı verir
    if (!isFav(sym.name) && !(cfg.alertAll && state.scope === 'all')) return;
    var found = [];
    if (s.upNow) found.push([sym.name + '|U|' + s.t, 'üst', 'şimdiki']);
    else if (s.upPrev) found.push([sym.name + '|U|' + s.tPrev, 'üst', 'önceki']);
    if (s.loNow) found.push([sym.name + '|L|' + s.t, 'alt', 'şimdiki']);
    else if (s.loPrev) found.push([sym.name + '|L|' + s.tPrev, 'alt', 'önceki']);
    var changed = false;
    found.forEach(function (f) {
      if (seen[f[0]]) return;
      seen[f[0]] = Date.now(); changed = true;
      pending.push(sym.name + ' ' + f[1] + ' banda değdi (' + f[2] + ' 4S mum, fiyat ' + fmtNum(s.price, s.dp) + ')');
    });
    if (changed) { LS.set('seen', seen); clearTimeout(flushT); flushT = setTimeout(flushAlerts, 2500); }
  }
  function flushAlerts() {
    if (!pending.length) return;
    var lines = pending.splice(0), MAXL = 6;
    var shown = lines.length > MAXL ? lines.slice(0, MAXL).concat(['… ve ' + (lines.length - MAXL) + ' temas daha (Özet\'te "Temas edenler önce")']) : lines;
    toast('🔔 ' + shown.join(' · '));
    if (cfg.sound) beep();
    if (cfg.notif) notify('72S bant teması' + (lines.length > 1 ? ' (' + lines.length + ')' : ''), shown.join('\n'));
  }
  function toast(text) {
    var t = $('toast'); t.textContent = text; t.classList.remove('hidden');
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.add('hidden'); }, 9000);
  }
  $('toast').addEventListener('click', function () { this.classList.add('hidden'); });
  function unlockAudio() {
    try {
      if (!audioCtx) { var AC = window.AudioContext || window.webkitAudioContext; if (AC) audioCtx = new AC(); }
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) { /* */ }
  }
  document.addEventListener('pointerdown', function () { if (cfg.sound) unlockAudio(); }, { passive: true });
  function beep() {
    unlockAudio(); if (!audioCtx) return;
    var t0 = audioCtx.currentTime;
    [880, 660, 880].forEach(function (f, k) {
      var o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(audioCtx.destination);
      var st = t0 + k * 0.22; g.gain.setValueAtTime(0.0001, st); g.gain.exponentialRampToValueAtTime(0.35, st + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, st + 0.2);
      o.start(st); o.stop(st + 0.21);
    });
    if (navigator.vibrate) try { navigator.vibrate([150, 80, 150]); } catch (e) { /* */ }
  }
  var swReg = null;
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('sw.js').then(function (r) { swReg = r; }, function () { /* yok */ });
  }
  function notify(title, body) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    var opt = { body: body, icon: 'icon-192.png', badge: 'icon-192.png', tag: '72s-temas', renotify: true };
    if (swReg && swReg.showNotification) { swReg.showNotification(title, opt).catch(function () { /* */ }); return; }
    try { new Notification(title, opt); } catch (e) { /* Android Chrome yalnızca service worker ile izin verir */ }
  }
  function renderNotif() {
    var st = $('notifState'), btn = $('notifBtn');
    if (!('Notification' in window)) {
      st.textContent = 'Bu tarayıcı bildirim desteklemiyor. iPhone\'da: Paylaş → Ana Ekrana Ekle, sonra uygulamayı oradan açın. Sesli uyarı yine çalışır.';
      btn.disabled = true; $('notifChk').disabled = true;
    } else {
      var p = Notification.permission;
      st.textContent = p === 'granted' ? 'İzin verildi' : p === 'denied' ? 'İzin reddedildi (tarayıcı ayarlarından açabilirsiniz)' : 'Henüz izin istenmedi';
      btn.disabled = p !== 'default';
      $('notifChk').disabled = p !== 'granted';
    }
    $('soundChk').checked = !!cfg.sound;
    $('alertAllChk').checked = !!cfg.alertAll;
    $('notifChk').checked = !!cfg.notif && !$('notifChk').disabled;
  }
  $('notifBtn').addEventListener('click', function () {
    unlockAudio(); cfg.sound = true; LS.set('sound', true);
    if (!('Notification' in window)) return renderNotif();
    var done = function (p) { if (p === 'granted') { cfg.notif = true; LS.set('notif', true); } renderNotif(); };
    var r = Notification.requestPermission(done);
    if (r && r.then) r.then(done);
  });
  $('soundChk').addEventListener('change', function () { cfg.sound = this.checked; LS.set('sound', cfg.sound); if (cfg.sound) unlockAudio(); });
  $('notifChk').addEventListener('change', function () { cfg.notif = this.checked; LS.set('notif', cfg.notif); });
  $('alertAllChk').addEventListener('change', function () { cfg.alertAll = this.checked; LS.set('alertAll', cfg.alertAll); });
  $('testAlert').addEventListener('click', function () {
    unlockAudio(); toast('🔔 Deneme uyarısı (gerçek bir temas değildir)');
    if (cfg.sound) beep();
    if (cfg.notif) notify('72S deneme', 'Bildirimler çalışıyor (deneme).');
  });

  // ---------- Sembol yönetimi ----------
  function renderSymList() {
    $('symList').innerHTML = syms.map(function (s) {
      return '<li>' + esc(s.name) + (s.tk !== s.name ? ' <small>' + esc(s.tk) + '</small>' : '') + (s.ex === 'BY' ? ' <small>Bybit</small>' : '') +
        '<button type="button" data-del="' + esc(s.name) + '" aria-label="' + esc(s.name) + ' sil">×</button></li>';
    }).join('');
  }
  $('symList').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-del]'); if (!b) return;
    var n = b.dataset.del;
    if (syms.length <= 1) { $('addMsg').textContent = 'Listede en az bir sembol kalmalı.'; return; }
    if (!window.confirm(n + ' listeden çıkarılsın mı?')) return;
    syms = syms.filter(function (s) { return s.name !== n; }); saveSyms(); delete meta[n];
    if (!findSym(state.sym)) { state.sym = syms[0].name; LS.set('sym', state.sym); }
    renderSymList(); renderSymSel(); renderSummary(); pump();
  });
  $('addForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var v = $('addInp').value.trim(); if (!v) return;
    var msg = $('addMsg'); msg.textContent = 'Aranıyor…';
    var n = v.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (n && !/USD[TC]$/.test(n)) n += 'USDT';
    if (n && isFav(n)) { msg.textContent = n + ' zaten listede.'; return; }
    // önce Binance Futures listesinde ara (ağ isteği gerekmez); yoksa borsalarda dene
    var known = findIn(others, n), k1000 = !known && !/^1000/.test(n) ? findIn(others, '1000' + n) : null;
    var found = known ? Promise.resolve({ name: n, tk: known.tk, ex: 'BN' }) :
      k1000 ? Promise.resolve({ name: n, tk: k1000.tk, ex: 'BN' }) : L72.resolveSymbol(v);
    found.then(function (s) {
      if (isFav(s.name)) { msg.textContent = s.name + ' zaten listede.'; return; }
      syms.push(s); saveSyms(); $('addInp').value = ''; delete meta[s.name];
      msg.textContent = s.name + ' eklendi (' + L72.EX_NAME[s.ex] + (s.tk !== s.name ? ', ' + s.tk : '') + ').';
      renderSymList(); renderSymSel(); renderSummary(); pump();
    }, function (err) {
      msg.textContent = err && err.kind === 'symbol' ? 'Bulunamadı: Binance USDT-M ve Bybit vadelide bu sembol yok.' : 'Eklenemedi: ' + L72.errorText(err, 'BN');
    });
  });
  $('resetSyms').addEventListener('click', function () {
    if (!window.confirm('Sembol listesi varsayılana dönsün mü? Eklediğiniz semboller silinir.')) return;
    syms = L72.DEFAULT_SYMBOLS.slice(); saveSyms(); meta = {};
    if (!findSym(state.sym)) state.sym = syms[0].name;
    renderSymList(); renderSymSel(); renderSummary(); pump();
  });

  // ---------- Tüm sembol listesi (exchangeInfo) ----------
  function renderAllInfo() {
    var el = $('allInfo'); if (!el) return;
    el.textContent = allCache.names.length
      ? 'Binance Futures (USDT-M, sürekli kontrat): ' + allCache.names.length + ' sembol · liste ' + dtF.format(new Date(allCache.ts)) + ' tarihli' + (allErr ? ' · son yenileme başarısız: ' + allErr : '')
      : (allLoading ? 'Binance Futures sembol listesi alınıyor…' : 'Binance Futures sembol listesi alınamadı' + (allErr ? ': ' + allErr : '') + '. Yalnızca Listem gösteriliyor.');
  }
  function loadAll(force) {
    if (allLoading) return;
    if (!force && allCache.names.length && Date.now() - allCache.ts < ALL_TTL) return;
    allLoading = true; renderAllInfo();
    L72.fetchAllSymbols().then(function (names) {
      allCache = { ts: Date.now(), names: names }; allErr = null;
      LS.set('allSyms', allCache);
    }, function (e) {
      allErr = L72.errorText(e, 'BN'); // önbellekteki (ya da yalnızca varsayılan) liste kullanılmaya devam eder
    }).then(function () {
      allLoading = false; rebuildOthers();
      if (!findSym(state.sym)) state.sym = syms[0].name;
      var saved = LS.get('sym', null); if (saved && saved !== state.sym && findSym(saved) && !cur.o) state.sym = saved;
      renderAllInfo(); renderSymSel(); dirty(); updHeader(); pump();
    });
  }
  $('allRefresh').addEventListener('click', function () { loadAll(true); });

  // ---------- Başlat ----------
  setInterval(function () { if (state.view === 'grafik' && !document.hidden) { loadChart(false); wsConnect(); } }, 20000);
  setInterval(updHeader, 15000);
  setInterval(function () { loadAll(false); }, 3600e3); // günlük yenileme (saatte bir kontrol)
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) return;
    if (state.view === 'grafik') { loadChart(false); wsConnect(); }
    if (state.view === 'ozet') renderSummary();
    loadAll(false); pump();
  });
  renderSymSel(); renderTf(); renderScope(); renderSymList(); renderNotif(); renderAllInfo(); renderSummary();
  showView(state.view);
  loadAll(false);
  pump();
  window.__l72 = { state: state, sum: sum, cur: cur, meta: meta, get syms() { return syms; }, get others() { return others; }, usedWeight: function () { return usedWeight(Date.now()); } }; // test/tanılama için
})();
