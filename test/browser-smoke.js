// Tarayıcı duman testi: npx http-server veya 'python3 -m http.server 8765' ile klasörü sunun, sonra: npm i playwright-core && node test/browser-smoke.js
// CHROME yolu: CHROME=/usr/bin/google-chrome (varsayılan). FULL=0 → tüm sembollerin yüklenmesini beklemez.
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'tr-TR', timezoneId: 'Europe/Istanbul' });
  const p = await ctx.newPage();
  const errs = [], fails = [];
  let kl = 0, ei = 0, maxPar = 0, par = 0, s429 = 0;
  p.on('pageerror', e => errs.push('pageerror@' + new Date().toISOString().slice(11,19) + ' ' + e.stack.split('\n').slice(0,6).join(' | ')));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  p.on('request', r => { if (/klines/.test(r.url())) { kl++; par++; maxPar = Math.max(maxPar, par); } if (/exchangeInfo/.test(r.url())) ei++; });
  const done = r => { if (/klines/.test(r.url())) par--; };
  p.on('requestfinished', done);
  p.on('requestfailed', r => { done(r); fails.push(r.url() + ' ' + (r.failure() && r.failure().errorText)); });
  p.on('response', r => { if (r.status() === 429 || r.status() === 418) s429++; });
  // uzun görevler (donma) ölçümü
  await p.addInitScript(() => { window.__lt = []; try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__lt.push(e.duration))).observe({ type: 'longtask', buffered: true }); } catch (e) {} });
  const t0 = Date.now();
  await p.goto('http://localhost:8765/', { waitUntil: 'load' });
  await p.waitForFunction(() => window.__l72 && window.__l72.others.length > 400, null, { timeout: 60000 });
  console.log('sembol: Listem', await p.evaluate(() => window.__l72.syms.length), '+ diğer', await p.evaluate(() => window.__l72.others.length), '| kapsam', await p.evaluate(() => window.__l72.state.scope));
  await p.waitForFunction(() => window.__l72.syms.every(s => window.__l72.sum[s.name]), null, { timeout: 90000 });
  console.log('Listem yüklendi:', ((Date.now() - t0) / 1000).toFixed(1), 'sn |', await p.textContent('#sumProg'));
  await p.screenshot({ path: '/tmp/ozet-erken.png' });
  if (process.env.FULL !== '0') {
    let maxW = 0;
    const iv = setInterval(async () => { try { maxW = Math.max(maxW, await p.evaluate(() => window.__l72.usedWeight())); } catch (e) {} }, 1000);
    await p.waitForFunction(() => { const l = window.__l72; return l.syms.concat(l.others).every(s => l.sum[s.name]); }, null, { timeout: 240000, polling: 2000 });
    clearInterval(iv);
    console.log('Tümü yüklendi:', ((Date.now() - t0) / 1000).toFixed(1), 'sn |', await p.textContent('#sumProg'), '| klines istek', kl, '| en çok paralel', maxPar, '| en yüksek ağırlık/dk', maxW, '| 429/418', s429);
    const st = await p.evaluate(() => { const l = window.__l72, a = l.syms.concat(l.others); let e = 0, w = 0, c = 0, t = 0; const ex = []; a.forEach(s => { const x = l.sum[s.name]; if (x.err) { e++; if (ex.length < 3) ex.push(s.name + ': ' + x.err); } else if (x.s.warm) { w++; if (x.s.up || x.s.lo) t++; } else c++; }); return { hata: e, ornek: ex, sicak: w, yetersizMum: c, temas: t }; });
    console.log('durum:', JSON.stringify(st));
    await p.waitForTimeout(2000);
  }
  const lt = await p.evaluate(() => window.__lt);
  console.log('uzun görev (>50ms):', lt.length, '| en uzun', lt.length ? Math.round(Math.max(...lt)) + ' ms' : '-');
  console.log('ilk satırlar:', (await p.$$eval('.srow .sname', e => e.slice(0, 5).map(x => x.textContent))).join(' | '));
  console.log('foot:', await p.textContent('#sumFoot'));
  await p.screenshot({ path: '/tmp/ozet.png' });
  // arama + Listem kapsamı
  await p.fill('#sumQ', 'pepe'); await p.waitForTimeout(1800);
  console.log('ara "pepe":', (await p.$$eval('.srow', e => e.map(x => x.dataset.name))).join(','));
  await p.fill('#sumQ', ''); await p.click('#scopeSeg button[data-scope="fav"]'); await p.waitForTimeout(500);
  console.log('Listem satır:', await p.$$eval('.srow', e => e.length), '|', await p.textContent('#sumProg'));
  await p.click('#scopeSeg button[data-scope="all"]'); await p.waitForTimeout(500);
  // grafik
  await p.click('.srow[data-name="AVAXUSDT"]');
  await p.waitForFunction(() => window.__l72.cur.o && window.__l72.cur.o.t.length > 1000, null, { timeout: 30000 });
  await p.waitForTimeout(6000);
  console.log('legend:', await p.textContent('#legend'));
  console.log('stat:', await p.textContent('#chartStat'));
  console.log('logo görünür mü:', await p.evaluate(() => { const a = document.getElementById('tv-attr-logo'); return a ? getComputedStyle(a).display !== 'none' : 'yok'; }));
  await p.screenshot({ path: '/tmp/grafik.png' });
  await p.click('#tfSeg button[data-tf="1d"]'); await p.waitForTimeout(3000);
  console.log('1d legend:', await p.textContent('#legend'));
  await p.click('#tfSeg button[data-tf="4h"]');
  // seçici: Bybit (Listem)
  await p.click('#symBtn'); await p.fill('#symQ', 'core'); await p.waitForTimeout(300);
  await p.screenshot({ path: '/tmp/picker.png' });
  await p.click('.prow[data-name="COREUSDT"] .pn'); await p.waitForTimeout(6000);
  console.log('core legend:', await p.textContent('#legend')); console.log('core stat:', await p.textContent('#chartStat'));
  // seçici: CAT → 1000CATUSDT, diğerlerinden biri
  await p.click('#symBtn'); await p.fill('#symQ', 'cat'); await p.waitForTimeout(300);
  console.log('ara "cat":', (await p.$$eval('.prow', e => e.map(x => x.dataset.name))).join(','));
  await p.click('#symBtn').catch(() => {});
  await p.fill('#symQ', 'wld'); await p.waitForTimeout(300);
  await p.click('.prow[data-name="WLDUSDT"] .pn'); await p.waitForTimeout(6000);
  console.log('wld legend:', await p.textContent('#legend')); console.log('wld stat:', await p.textContent('#chartStat'));
  await p.screenshot({ path: '/tmp/wld.png' });
  // yıldız ile Listem'e ekle
  await p.click('#symBtn'); await p.fill('#symQ', 'wld'); await p.waitForTimeout(300);
  await p.click('.prow[data-name="WLDUSDT"] .star'); await p.waitForTimeout(300);
  console.log('WLD Listem:', await p.evaluate(() => window.__l72.syms.some(s => s.name === 'WLDUSDT')), '| diğerlerinde:', await p.evaluate(() => window.__l72.others.some(s => s.name === 'WLDUSDT')));
  await p.click('#pickClose');
  await p.click('.tabs button[data-view="ayar"]');
  await p.fill('#addInp', 'wif'); await p.click('#addForm button'); await p.waitForTimeout(2000);
  console.log('add:', await p.textContent('#addMsg'));
  console.log('allInfo:', await p.textContent('#allInfo'));
  await p.screenshot({ path: '/tmp/ayar.png', fullPage: true });
  // önbellek: yeniden yüklemede exchangeInfo tekrar istenmemeli
  const eiBefore = ei; await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(3000);
  console.log('exchangeInfo istek sayısı: ilk', eiBefore, '| yenilemeden sonra', ei, '| önbellek', await p.evaluate(() => JSON.parse(localStorage.getItem('l72s.allSyms')).names.length));
  console.log('ERRORS:', errs.length ? errs : 'yok'); console.log('FAILED REQ:', fails.length ? fails.slice(0, 10) : 'yok');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
