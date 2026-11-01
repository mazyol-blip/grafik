/* 72S Canlı — veri katmanı (tarayıcı + Node ortak). Hesaplama s72.js'deki calc72S ile yapılır. */
(function (root) {
  'use strict';
  var calc = (typeof calc72S === 'function') ? calc72S : require('./s72.js').calc72S;

  var TF = {
    '1h': { bn: '1h', by: '60', ms: 3600e3, label: '1S' },
    '4h': { bn: '4h', by: '240', ms: 4 * 3600e3, label: '4S' },
    '1d': { bn: '1d', by: 'D', ms: 864e5, label: '1G' }
  };

  // Mazlum'un "Future" listesi. name = ekranda görünen, tk = borsadaki sembol, ex = BN (Binance USDT-M) / BY (Bybit linear)
  var DEFAULT_SYMBOLS = [
    'BTCUSDT', 'MASKUSDT', 'POPCATUSDT', 'THETAUSDT', 'DYDXUSDT', 'SOLUSDT', 'ETHUSDT', 'DOGEUSDT', 'XRPUSDT',
    'NEIROUSDT', 'JTOUSDT', 'PNUTUSDT', 'ACTUSDT', 'XLMUSDT', 'COREUSDT', 'COMPUSDT', 'APTUSDT', 'LINKUSDT',
    'ENSUSDT', 'CATUSDT', 'MOODENGUSDT', 'SUIUSDT', 'AGLDUSDT', 'HBARUSDT', 'TRUMPUSDT', 'AVAXUSDT', 'CHZUSDT', 'ZECUSDT'
  ].map(function (n) {
    if (n === 'COREUSDT') return { name: n, tk: n, ex: 'BY' };
    if (n === 'CATUSDT') return { name: n, tk: '1000CATUSDT', ex: 'BN' };
    return { name: n, tk: n, ex: 'BN' };
  });

  var EX_NAME = { BN: 'Binance USDT-M', BY: 'Bybit Perp' };

  function FetchError(kind, status, msg) {
    var e = new Error(msg || kind);
    e.kind = kind; e.status = status;
    return e;
  }

  function getJSON(url, timeoutMs) {
    timeoutMs = timeoutMs || 15000;
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, timeoutMs) : null;
    return fetch(url, ctl ? { signal: ctl.signal, cache: 'no-store' } : { cache: 'no-store' })
      .then(function (r) {
        return r.text().then(function (txt) {
          var j = null;
          try { j = JSON.parse(txt); } catch (e) { /* yok */ }
          if (!r.ok) {
            var code = j && j.code;
            if (code === -1121) throw FetchError('symbol', r.status);
            throw FetchError('http', r.status, (j && j.msg) || txt.slice(0, 120));
          }
          if (j === null) throw FetchError('parse', r.status);
          return j;
        });
      }, function (err) {
        if (err && err.name === 'AbortError') throw FetchError('timeout');
        throw FetchError('network', 0, String(err && err.message || err));
      })
      .finally(function () { if (timer) clearTimeout(timer); });
  }

  // Hata nesnesini Türkçe, anlaşılır bir metne çevirir
  function errorText(err, ex) {
    var src = EX_NAME[ex] || 'Borsa';
    if (!err) return 'Bilinmeyen hata';
    switch (err.kind) {
      case 'symbol': return src + ': sembol bulunamadı';
      case 'timeout': return src + ': zaman aşımı (yanıt gelmedi)';
      case 'network': return src + ': bağlantı kurulamadı (internet ya da borsa erişimi)';
      case 'parse': return src + ': geçersiz yanıt';
      case 'bybit': return src + ': ' + (err.message || 'hata');
      case 'empty': return src + ': veri boş geldi';
      case 'http':
        if (err.status === 451 || err.status === 403) return src + ': bu konumdan erişim engellendi (HTTP ' + err.status + ')';
        if (err.status === 429 || err.status === 418) return src + ': istek sınırı aşıldı, biraz bekleyin (HTTP ' + err.status + ')';
        if (err.status >= 500) return src + ': sunucu hatası (HTTP ' + err.status + ')';
        return src + ': HTTP ' + err.status;
    }
    return src + ': ' + (err.message || 'hata');
  }

  function klinesURL(sym, tf, limit) {
    var T = TF[tf];
    if (sym.ex === 'BY') {
      return 'https://api.bybit.com/v5/market/kline?category=linear&symbol=' + encodeURIComponent(sym.tk) +
        '&interval=' + T.by + '&limit=' + Math.min(limit, 1000);
    }
    return 'https://fapi.binance.com/fapi/v1/klines?symbol=' + encodeURIComponent(sym.tk) +
      '&interval=' + T.bn + '&limit=' + Math.min(limit, 1500);
  }

  function decimalsOf(rows) {
    var m = 0, from = Math.max(0, rows.length - 300);
    for (var i = from; i < rows.length; i++) {
      for (var k = 1; k <= 4; k++) {
        var p = String(rows[i][k]).replace(/0+$/, '').split('.')[1];
        if (p && p.length > m) m = p.length;
      }
    }
    return m;
  }

  // Ham satırlar: [açılışZamanıMs, open, high, low, close, ...] (artan zaman)
  function toOHLC(rows) {
    var o = { t: [], o: [], h: [], l: [], c: [], dp: decimalsOf(rows) };
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      o.t.push(+r[0]); o.o.push(+r[1]); o.h.push(+r[2]); o.l.push(+r[3]); o.c.push(+r[4]);
    }
    return o;
  }

  function fetchKlines(sym, tf, limit) {
    limit = limit || 1500;
    return getJSON(klinesURL(sym, tf, limit)).then(function (j) {
      var rows;
      if (sym.ex === 'BY') {
        if (!j || j.retCode !== 0) {
          var msg = j && j.retMsg || 'hata';
          if (/symbol/i.test(msg)) throw FetchError('symbol');
          throw FetchError('bybit', 0, msg);
        }
        rows = (j.result && j.result.list || []).slice().reverse();
      } else {
        rows = j;
      }
      if (!Array.isArray(rows) || rows.length === 0) throw FetchError('empty');
      return toOHLC(rows);
    });
  }

  // 72S hesaplaması (s72.js / calc72S, varsayılan ayarlar: mult 3 → gri bantlar = HMA ± 2×3×ATR(40))
  function compute(o) { return calc(o); }

  // Son ve bir önceki mumun bantlara teması
  function summarize(o, r) {
    var N = o.c.length, i = N - 1, p = i - 1;
    var price = o.c[i], top = r.top[i], bot = r.bot[i];
    var ok = isFinite(top) && isFinite(bot);
    var s = {
      t: o.t[i], price: price, top: top, bot: bot, hma: r.hma[i], dp: o.dp, n: N, warm: ok,
      distUp: ok ? (top - price) / price * 100 : NaN,
      distLo: ok ? (price - bot) / price * 100 : NaN,
      upNow: ok && o.h[i] >= top,
      loNow: ok && o.l[i] <= bot,
      upPrev: p >= 0 && isFinite(r.top[p]) && o.h[p] >= r.top[p],
      loPrev: p >= 0 && isFinite(r.bot[p]) && o.l[p] <= r.bot[p],
      tPrev: p >= 0 ? o.t[p] : NaN
    };
    s.up = s.upNow || s.upPrev;
    s.lo = s.loNow || s.loPrev;
    return s;
  }

  // Kullanıcının eklediği sembolü borsada bul: Binance → Binance 1000x → Bybit → Bybit 1000x
  function resolveSymbol(input) {
    var n = String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!n) return Promise.reject(FetchError('symbol'));
    if (!/USDT$/.test(n)) n += 'USDT';
    var cands = [{ tk: n, ex: 'BN' }];
    if (!/^1000/.test(n)) cands.push({ tk: '1000' + n, ex: 'BN' });
    cands.push({ tk: n, ex: 'BY' });
    if (!/^1000/.test(n)) cands.push({ tk: '1000' + n, ex: 'BY' });
    var lastErr = null;
    function next(k) {
      if (k >= cands.length) return Promise.reject(lastErr && lastErr.kind !== 'symbol' ? lastErr : FetchError('symbol'));
      var c = { name: n, tk: cands[k].tk, ex: cands[k].ex };
      return fetchKlines(c, '4h', 2).then(function () { return c; }, function (e) { lastErr = e; return next(k + 1); });
    }
    return next(0);
  }

  var api = {
    TF: TF, DEFAULT_SYMBOLS: DEFAULT_SYMBOLS, EX_NAME: EX_NAME,
    getJSON: getJSON, klinesURL: klinesURL, fetchKlines: fetchKlines, toOHLC: toOHLC,
    compute: compute, summarize: summarize, resolveSymbol: resolveSymbol, errorText: errorText
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.L72 = api;
})(typeof window !== 'undefined' ? window : this);
