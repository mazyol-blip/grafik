// Node testi: sitenin veri yolu (data.js → fetchKlines → compute) ile /workspace/s72.js'in doğrudan sonucu aynı mı?
// Çalıştır: node test/band-check.js   (Node 18+, fapi.binance.com erişimi gerekir)
const path = require('path');
const L72 = require('../data.js');
const ref = require(process.env.S72_REF || path.join(__dirname, '..', 's72.js')).calc72S;
(async () => {
  const sym = L72.DEFAULT_SYMBOLS.find(s => s.name === 'AVAXUSDT');
  // 1) Sitenin yolu
  const o = await L72.fetchKlines(sym, '4h', 1500);
  const r = L72.compute(o);
  const s = L72.summarize(o, r);
  // 2) Bağımsız yol: ham fetch + referans calc72S, aynı mumlar
  const raw = await (await fetch('https://fapi.binance.com/fapi/v1/klines?symbol=AVAXUSDT&interval=4h&limit=1500')).json();
  // canlı mum iki istek arasında değişmiş olabilir → sadece ortak zaman aralığını, kapanmış mumlarla karşılaştır
  const t0 = o.t[0], keep = raw.filter(x => +x[0] >= t0 && +x[0] <= o.t[o.t.length - 1]);
  const q = { t: keep.map(x => +x[0]), o: keep.map(x => +x[1]), h: keep.map(x => +x[2]), l: keep.map(x => +x[3]), c: keep.map(x => +x[4]) };
  const rr = ref(q);
  let n = 0, maxd = 0;
  for (let i = 0; i < q.t.length - 1; i++) { // son (canlı) mum hariç
    for (const k of ['hma', 'top', 'bot']) {
      const a = r[k][i], b = rr[k][i];
      if (isFinite(a) || isFinite(b)) { n++; maxd = Math.max(maxd, Math.abs(a - b)); }
    }
  }
  const N = o.t.length, iso = t => new Date(t).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
  console.log('mum sayısı:', N, '| ilk:', iso(o.t[0]), '| son:', iso(o.t[N - 1]));
  console.log('karşılaştırılan değer:', n, '| en büyük fark:', maxd, maxd === 0 ? '→ BİREBİR AYNI' : '→ FARK VAR');
  // TradingView ile doğrulanmış anlık görüntüdeki mum (31 Eki 2026 23:00 TSİ = 20:00 UTC)
  const ts = Date.UTC(2026, 9, 31, 20), i = o.t.indexOf(ts);
  if (i >= 0) console.log('31.10 23:00 TSİ mumu → HMA', r.hma[i].toFixed(4), 'ÜST(gri)', r.top[i].toFixed(4), 'ALT(gri)', r.bot[i].toFixed(4), 'kapanış', o.c[i], 'periyot', r.len[i]);
  for (const j of [N - 3, N - 2, N - 1]) console.log(iso(o.t[j]), 'K', o.c[j], 'HMA', r.hma[j].toFixed(4), 'ÜST', r.top[j].toFixed(4), 'ALT', r.bot[j].toFixed(4), '| ref ÜST', rr.top[j] !== undefined ? rr.top[j].toFixed(4) : '-', 'ALT', rr.bot[j] !== undefined ? rr.bot[j].toFixed(4) : '-');
  console.log('özet:', JSON.stringify({ fiyat: s.price, ust: +s.top.toFixed(4), alt: +s.bot.toFixed(4), ustUzaklik: +s.distUp.toFixed(2), altUzaklik: +s.distLo.toFixed(2), ustTemas: s.up, altTemas: s.lo }));
  process.exit(maxd === 0 ? 0 : 1);
})().catch(e => { console.error('HATA', e.kind, e.status, e.message); process.exit(2); });
