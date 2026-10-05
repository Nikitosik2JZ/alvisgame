const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const errors = [];
  const capture = page => { page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); };
  try {
    const dev = await browser.newPage(); capture(dev);
    await dev.goto(process.env.GAME_URL || 'http://127.0.0.1:5174'); await dev.waitForSelector('#objective:not(:empty)');
    await dev.keyboard.press('Alt+c'); await dev.keyboard.press('Alt+h');
    await dev.evaluate(async () => {
      const { game } = await import(document.querySelector('script[src*="/src/main.js"]').src); window.scene = game.scene.getScene('GameScene');
      clearInterval(scene.company.timer);
    });
    assert.equal(await dev.evaluate(() => scene.orders.state.values.companyUnlocked), true);
    assert.equal(await dev.evaluate(() => scene.orders.state.values.employees.length), 1);
    await dev.keyboard.press('Alt+o'); await dev.waitForSelector('#company-offline:not([hidden])');
    assert.ok((await dev.locator('#company-offline-earned').textContent()).includes('6 000'));
    await dev.click('#company-offline-collect'); await dev.click('#company-dialog [data-close]');
    const before = await dev.evaluate(() => scene.orders.state.values.companyBalance);
    await dev.keyboard.press('Alt+m'); assert.equal(await dev.evaluate(() => scene.orders.state.values.companyBalance), before + 10000);
    await dev.click('#open-company'); await dev.locator('#company-name').focus();
    await dev.keyboard.press('Alt+m'); assert.equal(await dev.evaluate(() => scene.orders.state.values.companyBalance), before + 10000, 'typing suppresses cheats');
    await dev.close(); console.log('PASS development company shortcuts and text-input guard');

    const production = await browser.newPage(); capture(production);
    await production.addInitScript(() => localStorage.setItem('courier-empire-save-v1', JSON.stringify({ version: 5, money: 1234, xp: 250 })));
    await production.goto(process.env.PREVIEW_URL || 'http://127.0.0.1:5176'); await production.waitForSelector('#objective:not(:empty)');
    for (const key of ['F2', 'F3', 'Alt+c', 'Alt+m', 'Alt+h', 'Alt+o']) await production.keyboard.press(key);
    assert.equal(await production.locator('#money').textContent(), '1234 ₽'); assert.equal(await production.locator('#level').textContent(), '3');
    await production.click('#open-company'); assert.ok(await production.locator('#company-locked').isVisible());
    assert.equal(await production.locator('#company-business').isVisible(), false); await production.close();
    console.log('PASS production build excludes all old and company cheats');

    const offline = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true }); capture(offline);
    const saved = { version: 6, money: 1000, xp: 3850, companyUnlocked: true, companyName: 'Продакшен доставка', companyLevel: 1,
      employees: [{ id: 'courier-1', name: 'Саша', level: 1, efficiency: 1, baseIncome: 100, assignedTransport: null, status: 'WORKING', totalEarned: 0 }],
      companyVehicles: [], companyBalance: 0, lastCompanyUpdateTimestamp: Date.now() - 3600000 };
    await offline.addInitScript(data => localStorage.setItem('courier-empire-save-v1', JSON.stringify(data)), saved);
    await offline.goto(process.env.PREVIEW_URL || 'http://127.0.0.1:5176'); await offline.waitForSelector('#company-offline:not([hidden])');
    assert.match(await offline.locator('#company-offline-earned').textContent(), /6.?00\d/);
    await offline.click('#company-offline-collect'); assert.match(await offline.locator('#company-summary').textContent(), /1 \/ 2/);
    assert.ok(Number((await offline.locator('#money').textContent()).replace(/\D/g, '')) >= 7000);
    assert.equal(await offline.locator('#company-balance').textContent(), '0 ₽');
    await offline.close(); console.log('PASS production mobile company load, offline popup and collection');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
