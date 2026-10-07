const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const errors = [];
  const capture = page => { page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); };
  try {
    const dev = await browser.newPage(); capture(dev);
    await dev.goto(process.env.GAME_URL || 'http://127.0.0.1:5174'); await dev.waitForSelector('#objective:not(:empty)');
    await dev.evaluate(async () => {
      const { game } = await import(document.querySelector('script[src*="/src/main.js"]').src); window.scene = game.scene.getScene('GameScene');
      clearInterval(scene.company.timer); scene.company.random = () => .5;
    });
    const state = () => dev.evaluate(() => scene.orders.state.getSnapshot());
    await dev.keyboard.press('Alt+c'); await dev.keyboard.press('Alt+h');
    assert.equal((await state()).employees.length, 1);
    const old = (await state()).companyCandidates[0].id; await dev.keyboard.press('Alt+r'); assert.notEqual((await state()).companyCandidates[0].id, old);
    await dev.keyboard.press('Alt+p'); assert.equal((await state()).companyReputation, 50);
    await dev.keyboard.press('Alt+l'); assert.equal((await state()).employees[0].level, 2);
    await dev.keyboard.press('Alt+u'); assert.equal((await state()).officeLevel, 2);
    for (const [key, category] of [['Alt+1', 'POSITIVE'], ['Alt+2', 'NEGATIVE'], ['Alt+3', 'CHOICE']]) {
      await dev.keyboard.press(key); await dev.waitForSelector('#company-event-dialog[open]');
      assert.equal(await dev.evaluate(() => scene.company.events.active.event.category), category);
      const buttons = dev.locator('#company-event-buttons button');
      if (category === 'CHOICE') await buttons.last().click();
      await dev.click('#company-event-buttons button');
      // Recovery and negative protection are part of normal debug eligibility.
      await dev.evaluate(() => { scene.company.accrue(300000); scene.company.events.pending = null; });
    }
    await dev.evaluate(() => { scene.company.events.isBlocked = () => true; });
    const income = (await state()).companyLifetimeEarnings; await dev.keyboard.press('Alt+t'); assert.ok((await state()).companyLifetimeEarnings > income);
    const balance = (await state()).companyBalance; await dev.keyboard.press('Alt+m'); assert.ok((await state()).companyBalance >= balance + 10000);
    await dev.click('#open-company'); await dev.locator('#company-name').focus();
    const before = await state();
    for (const key of ['Alt+m', 'Alt+r', 'Alt+p', 'Alt+l', 'Alt+u', 'Alt+t']) await dev.keyboard.press(key);
    const after = await state(); assert.equal(after.companyReputation, before.companyReputation); assert.equal(after.companyBalance, before.companyBalance);
    assert.deepEqual(after.companyCandidates, before.companyCandidates); assert.equal(after.officeLevel, before.officeLevel);
    await dev.click('#company-dialog [data-close]'); await dev.evaluate(() => { scene.company.events.pending = null; });
    await dev.keyboard.press('Alt+o'); await dev.waitForSelector('#company-offline:not([hidden])'); assert.ok((await state()).companyBalance > balance);
    await dev.close(); console.log('PASS Stage 7 development shortcuts, typing guards and offline shortcut');

    const production = await browser.newPage(); capture(production);
    await production.addInitScript(() => localStorage.setItem('courier-empire-save-v1', JSON.stringify({ version: 5, money: 1234, xp: 250 })));
    await production.goto(process.env.PREVIEW_URL || 'http://127.0.0.1:5176'); await production.waitForSelector('#objective:not(:empty)');
    for (const key of ['F2', 'F3', 'Alt+c', 'Alt+m', 'Alt+h', 'Alt+o', 'Alt+r', 'Alt+p', 'Alt+l', 'Alt+u', 'Alt+t', 'Alt+1', 'Alt+2', 'Alt+3']) await production.keyboard.press(key);
    assert.equal(await production.locator('#money').textContent(), '1234 ₽'); assert.equal(await production.locator('#level').textContent(), '3');
    await production.click('#open-company'); assert.ok(await production.locator('#company-locked').isVisible());
    assert.equal(await production.locator('#company-business').isVisible(), false); await production.close();
    console.log('PASS production excludes old and Stage 7 shortcuts');

    const offline = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true }); capture(offline);
    const saved = { version: 6, money: 1000, xp: 3850, companyUnlocked: true, companyName: 'Продакшен доставка', companyLevel: 1,
      employees: [{ id: 'courier-1', name: 'Саша', level: 1, efficiency: 1, baseIncome: 100, assignedTransport: null, status: 'WORKING', totalEarned: 0 }],
      companyVehicles: [], companyBalance: 0, lastCompanyUpdateTimestamp: Date.now() - 3600000 };
    await offline.addInitScript(data => localStorage.setItem('courier-empire-save-v1', JSON.stringify(data)), saved);
    await offline.goto(process.env.PREVIEW_URL || 'http://127.0.0.1:5176'); await offline.waitForSelector('#company-offline:not([hidden])');
    let stored = await offline.evaluate(() => JSON.parse(localStorage.getItem('courier-empire-save-v1')));
    assert.equal(stored.version, 9); assert.ok(stored.companyBalance >= 5036 && stored.companyBalance <= 5040);
    assert.ok(stored.employees[0].level > 1); assert.equal(stored.companyStats.negativeEvents, 0); assert.equal(stored.companyStats.employeeFailures, 0);
    await offline.click('#company-offline-collect'); assert.match(await offline.locator('#company-summary').textContent(), /1 \/ 2/);
    assert.ok(Number((await offline.locator('#money').textContent()).replace(/\D/g, '')) >= 6036);
    await offline.click('[data-company-view="employees"]'); assert.equal(await offline.locator('[data-candidate]').count(), 3);
    const original = await offline.locator('[data-candidate]').first().getAttribute('data-candidate');
    await offline.click('#company-refresh'); assert.notEqual(await offline.locator('[data-candidate]').first().getAttribute('data-candidate'), original);
    await offline.locator('[data-candidate] button').first().click(); assert.equal(await offline.locator('[data-employee]').count(), 2);
    await offline.locator('[data-employee] summary').first().click(); assert.match(await offline.locator('[data-employee-detail]').first().textContent(), /Опыт/);
    await offline.click('[data-company-view="upgrades"]'); assert.equal(await offline.locator('[data-upgrade]').count(), 4);
    await offline.close(); console.log('PASS production mobile migration/offline XP/candidates/hiring/details/upgrades');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
