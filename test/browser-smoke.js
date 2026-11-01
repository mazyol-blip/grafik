// Tarayıcı duman testi: npx http-server veya 'python3 -m http.server 8765' ile klasörü sunun, sonra: npm i playwright-core && node test/browser-smoke.js
// CHROME yolu: CHROME=/usr/bin/google-chrome (varsayılan)
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'tr-TR', timezoneId: 'Europe/Istanbul' });
  const p = await ctx.newPage();
  const errs = [], fails = [];
  p.on('pageerror', e => errs.push('pageerror@' + new Date().toISOString().slice(11,19) + ' ' + e.stack.split('\n').slice(0,6).join(' | ')));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  p.on('requestfailed', r => fails.push(r.url() + ' ' + (r.failure() && r.failure().errorText)));
  await p.goto('http://localhost:8765/', { waitUntil: 'load' });
  await p.waitForFunction(() => window.__l72 && Object.keys(window.__l72.sum).length >= 28, null, { timeout: 90000 });
  const st = await p.evaluate(() => { const s = window.__l72.sum; return Object.keys(s).map(k => k + ':' + (s[k].err ? 'ERR ' + s[k].err : (s[k].s.warm ? 'ok' : 'cold') + (s[k].s.up ? ' UP' : '') + (s[k].s.lo ? ' LO' : ''))); });
  console.log(st.join(' | '));
  console.log('header:', await p.textContent('#updText'));
  await p.screenshot({ path: '/tmp/ozet.png' });
  await p.click('.srow[data-name="AVAXUSDT"]');
  await p.waitForFunction(() => window.__l72.cur.o && window.__l72.cur.o.t.length > 1000, null, { timeout: 30000 });
  await p.waitForTimeout(6000);
  console.log('T', new Date().toISOString().slice(11,19));console.log('legend:', await p.textContent('#legend'));
  console.log('stat:', await p.textContent('#chartStat'));
  await p.screenshot({ path: '/tmp/grafik.png' });
  await p.click('#tfSeg button[data-tf="1d"]'); await p.waitForTimeout(3000);
  console.log('1d legend:', await p.textContent('#legend'));
  await p.selectOption('#symSel', 'COREUSDT'); await p.waitForTimeout(5000);
  console.log('core legend:', await p.textContent('#legend')); console.log('core stat:', await p.textContent('#chartStat'));
  await p.screenshot({ path: '/tmp/core.png' });
  await p.click('.tabs button[data-view="ayar"]');
  await p.fill('#addInp', 'wif'); await p.click('#addForm button'); await p.waitForTimeout(4000);
  console.log('add:', await p.textContent('#addMsg'));
  await p.screenshot({ path: '/tmp/ayar.png', fullPage: true });
  console.log('ERRORS:', errs.length ? errs : 'yok'); console.log('FAILED REQ:', fails.length ? fails : 'yok');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
