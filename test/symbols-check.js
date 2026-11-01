// Node testi: exchangeInfo ayrıştırma (gerçek API) + Listem/diğerleri birleştirme + ağırlık hesabı
// Çalıştır: node test/symbols-check.js   (Node 18+, fapi.binance.com erişimi gerekir)
const assert = require('assert');
const L72 = require('../data.js');
(async () => {
  // 1) Sahte yanıtla ayrıştırma kuralları
  const fake = { symbols: [
    { symbol: 'BTCUSDT', status: 'TRADING', contractType: 'PERPETUAL', quoteAsset: 'USDT' },
    { symbol: 'BTCUSDC', status: 'TRADING', contractType: 'PERPETUAL', quoteAsset: 'USDC' },
    { symbol: 'AAAUSDT', status: 'TRADING', contractType: 'PERPETUAL', quoteAsset: 'USDT' },
    { symbol: 'OLDUSDT', status: 'SETTLING', contractType: 'PERPETUAL', quoteAsset: 'USDT' },
    { symbol: 'BTCUSDT_261225', status: 'TRADING', contractType: 'CURRENT_QUARTER', quoteAsset: 'USDT' },
    { symbol: 'CATUSDT', status: 'TRADING', contractType: 'TRADIFI_PERPETUAL', quoteAsset: 'USDT' },
    { symbol: 'BTCUSDT', status: 'TRADING', contractType: 'PERPETUAL', quoteAsset: 'USDT' }
  ] };
  assert.deepStrictEqual(L72.parseExchangeInfo(fake), ['AAAUSDT', 'BTCUSDT', 'BTCUSDC']);
  assert.throws(() => L72.parseExchangeInfo({}));
  assert.deepStrictEqual([1, 99, 100, 499, 500, 1000, 1001, 1500].map(L72.klinesWeight), [1, 1, 2, 2, 5, 5, 10, 10]);

  // 2) Gerçek API
  const t0 = Date.now();
  const names = await L72.fetchAllSymbols();
  const raw = await (await fetch(L72.EXINFO_URL)).json();
  const expect = raw.symbols.filter(s => s.status === 'TRADING' && s.contractType === 'PERPETUAL').map(s => s.symbol);
  console.log('exchangeInfo: toplam kontrat', raw.symbols.length, '| işlemde PERPETUAL', expect.length, '| ayrıştırılan', names.length, '|', Date.now() - t0, 'ms');
  assert.strictEqual(names.length, expect.length);
  assert.deepStrictEqual([...names].sort(), [...expect].sort());
  const usdt = raw.symbols.filter(s => s.status === 'TRADING' && s.contractType === 'PERPETUAL' && s.quoteAsset === 'USDT').map(s => s.symbol);
  usdt.forEach(n => assert(names.includes(n), n));
  const q = {}; raw.symbols.filter(s => names.includes(s.symbol)).forEach(s => { q[s.quoteAsset] = (q[s.quoteAsset] || 0) + 1; });
  console.log('teminat dağılımı:', JSON.stringify(q), '| ilk 5:', names.slice(0, 5).join(','), '| JSON boyutu (önbellek):', JSON.stringify({ ts: Date.now(), names }).length, 'bayt');

  // 3) Listem + diğerleri
  const favs = L72.DEFAULT_SYMBOLS;
  const others = L72.otherSymbols(favs, names);
  const allNames = favs.map(s => s.name).concat(others.map(s => s.name));
  assert.strictEqual(new Set(allNames).size, allNames.length, 'tekrar eden ad var');
  assert(!others.some(s => s.tk === '1000CATUSDT'), '1000CATUSDT zaten CATUSDT (Listem) olarak var');
  assert(!others.some(s => s.name === 'CATUSDT'));
  assert.strictEqual(favs.find(s => s.name === 'CATUSDT').tk, '1000CATUSDT');
  assert.strictEqual(favs.find(s => s.name === 'COREUSDT').ex, 'BY');
  const missing = favs.filter(s => s.ex === 'BN' && !names.includes(s.tk)).map(s => s.name);
  console.log('Listem:', favs.length, '| diğer:', others.length, '| toplam seçilebilir:', allNames.length, '| Binance listesinde olmayan Listem (BN):', missing.length ? missing : 'yok');

  // 4) Özet yükü: Listem 1500 mum (ağırlık 10), diğerleri 499 mum (ağırlık 2)
  const w = favs.filter(s => s.ex === 'BN').length * L72.klinesWeight(1500) + others.length * L72.klinesWeight(499);
  console.log('tam tur Binance ağırlığı:', w, '(sınır 2400/dk; uygulama bütçesi 1500/dk)');

  // 5) Örnek diğer semboller gerçekten veri döndürüyor mu (ASCII olmayan ad dahil)
  const sample = [others[0], others[Math.floor(others.length / 2)], others[others.length - 1]].concat(others.filter(s => /[^\x00-\x7f]/.test(s.name)).slice(0, 1));
  for (const s of sample) {
    const o = await L72.fetchKlines(s, '4h', 499);
    const sm = L72.summarize(o, L72.compute(o));
    console.log(' ', s.name, 'mum', o.t.length, 'fiyat', sm.price, sm.warm ? 'üst ' + sm.top.toPrecision(6) + ' alt ' + sm.bot.toPrecision(6) : '(bant için yeterli mum yok)');
  }
  console.log('TAMAM');
})().catch(e => { console.error('HATA', e && (e.stack || e)); process.exit(1); });
