const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const base = process.env.GAME_URL || 'http://127.0.0.1:5175';
const artifacts = process.env.ARTIFACT_DIR || path.join(process.cwd(), 'artifacts', 'stage9');
const key = 'courier-empire-save-v1';
const seed = { version: 8, money: 111111, xp: 6000, reputation: 100, completedOrders: 25, failedOrders: 3, totalMoneyEarned: 10000,
  totalDistanceDelivered: 9000, ownedItems: ['thermobag'], equippedItems: { BAG: 'thermobag' },
  ownedTransports: ['WALKING','BICYCLE','MOPED','CAR'], equippedTransport: 'CAR', unlockedDistricts: ['residential','center','industrial','elite','business'],
  companyUnlocked: true, companyLevel: 2, companyName: 'Старая компания', companyBalance: 5000, companyLifetimeEarnings: 10000,
  employees: Array.from({ length: 4 }, (_, i) => ({ id: `courier-${i + 1}`, name: 'Саша', level: 3, totalEarned: 500 })),
  districtStats: { residential: { completedOrders: 50, bestDeliveryReward: 300 } } };

(async () => {
  fs.mkdirSync(artifacts, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const errors = [];
  try {
    for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 844, height: 390 }]) {
      const page = await browser.newPage({ viewport, hasTouch: viewport.width < 1000 });
      page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      await page.addInitScript(({ seed, key }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(seed)); }, { seed, key });
      const ready = async () => {
        await page.waitForSelector('#objective:not(:empty)');
        await page.waitForFunction(async () => { const { game } = await import(document.querySelector('script[src*="/src/main.js"]').src); window.scene = game.scene.getScene('GameScene'); return Boolean(scene?.orders?.order); });
        await page.evaluate(() => { scene.deliveryEvents.random = () => .99; });
        if (await page.locator('#company-dialog[open]').count()) await page.click('#company-dialog [data-close]');
      };
      await page.goto(base); await ready();
      const snapshot = () => page.evaluate(() => scene.orders.state.getSnapshot());
      const open = async id => { if (!await page.locator(`#open-${id}`).isVisible()) await page.click('#open-menu'); await page.click(`#open-${id}`); };
      const close = async id => page.click(`#${id}-dialog [data-close]`);
      const migrated = await snapshot();
      assert.equal(migrated.money, seed.money); assert.equal(migrated.completedOrders, 25); assert.equal(migrated.failedOrders, 3);
      assert.equal(migrated.employees.length, 4); assert.equal(migrated.legacyPoints, 0); assert.ok(migrated.achievements.includes('garage'));
      await open('progress');
      assert.equal(await page.locator('[data-progress-view]').count(), 4);
      assert.equal(await page.locator('.progress-card').count(), 10);
      assert.match(await page.locator('#progress-summary').textContent(), /32/);
      assert.match(await page.locator('#progress-content').textContent(), /ГЛАВНАЯ ЦЕЛЬ/);
      const pos = await page.evaluate(() => ({ x: scene.player.x, y: scene.player.y }));
      await page.keyboard.down('d'); await page.waitForTimeout(200); await page.keyboard.up('d');
      assert.deepEqual(await page.evaluate(() => ({ x: scene.player.x, y: scene.player.y })), pos);
      await page.locator('[data-claim="entrepreneur"]').click(); assert.equal((await snapshot()).legacyPoints, 1);
      assert.equal(await page.locator('[data-claim="entrepreneur"]').isDisabled(), true);
      await page.selectOption('#progress-title-select', 'career:king');
      await page.click('[data-progress-view="achievements"]');
      await page.click('[data-category="СЕКРЕТНЫЕ"]');
      assert.equal(await page.locator('.progress-card').count(), 3);
      assert.match(await page.locator('[data-progress-id="honest"]').textContent(), /\?\?\?/);
      assert.doesNotMatch(await page.locator('[data-progress-id="honest"]').textContent(), /Картошка под охраной/);
      await page.evaluate(() => {
        const state = scene.orders.state;
        state.progression.event({ rarity: 'COMMON', bad: false, friesHonest: true });
      });
      assert.match(await page.locator('[data-progress-id="honest"]').textContent(), /Картошка под охраной/);
      await page.click('[data-category="ДОСТАВКИ"]');
      await page.evaluate(() => courierDebug.progression.unlockAchievement('machine'));
      assert.equal(await page.locator('#achievement-toast').isVisible(), true);
      await page.locator('[data-claim="machine"]').click(); assert.equal((await snapshot()).legacyPoints, 2);
      await page.click('[data-progress-view="legacy"]'); await page.locator('[data-legacy="business"] button').click();
      assert.equal((await snapshot()).legacyPoints, 0); assert.equal(await page.locator('[data-legacy="business"] button').isDisabled(), true);
      assert.equal(await page.locator('[data-legacy="city"] button').isDisabled(), true);
      await page.evaluate(() => courierDebug.progression.addLegacy(3)); await page.locator('[data-legacy="city"] button').click();
      assert.ok((await snapshot()).legacyUpgrades.includes('city')); assert.equal((await snapshot()).movementSpeed, Math.round(migrated.movementSpeed * 1.03));
      await page.screenshot({ path: path.join(artifacts, `${viewport.width}-legacy.png`) });
      await close('progress'); await open('profile'); assert.match(await page.locator('#profile-details').textContent(), /Король города/); await close('profile');
      await page.reload(); await ready();
      assert.ok((await snapshot()).claimedCareerRewards.includes('entrepreneur')); assert.ok((await snapshot()).claimedAchievementRewards.includes('machine'));
      assert.ok((await snapshot()).legacyUpgrades.includes('business')); assert.equal((await snapshot()).selectedTitle, 'career:king');
      await open('progress'); await page.click('[data-progress-view="records"]');
      assert.match(await page.locator('#progress-content').textContent(), /Сотрудников одновременно/);
      await page.screenshot({ path: path.join(artifacts, `${viewport.width}-records.png`) });
      await page.click('[data-progress-view="career"]');
      await page.evaluate(() => courierDebug.progression.testMagnate());
      assert.equal(await page.locator('#magnate-celebration').isVisible(), true);
      const endgame = await snapshot(); assert.ok(endgame.careerMilestones.includes('magnate')); assert.equal(endgame.money, seed.money + 1500);
      assert.equal(endgame.employees.length, 8); assert.equal(endgame.magnateCelebrationSeen, true);
      await page.click('#magnate-continue'); await page.locator('[data-claim="magnate"]').click(); assert.equal((await snapshot()).legacyPoints, 5);
      await close('progress'); await open('progress'); assert.equal(await page.locator('#magnate-celebration').isVisible(), false);
      await page.screenshot({ path: path.join(artifacts, `${viewport.width}-career.png`) });
      await page.click('[data-progress-view="achievements"]'); await page.click('[data-category="КОМПАНИЯ"]');
      await page.screenshot({ path: path.join(artifacts, `${viewport.width}-achievements.png`) });
      const layout = await page.evaluate(() => {
        const dialog = document.querySelector('#progress-dialog'), content = dialog.querySelector('.modal-content');
        const rect = dialog.getBoundingClientRect(), close = dialog.querySelector('[data-close]').getBoundingClientRect();
        return { fits: rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight,
          overflow: content.scrollWidth > content.clientWidth + 1, closeVisible: close.top >= 0 && close.bottom <= innerHeight };
      });
      assert.equal(layout.fits, true); assert.equal(layout.overflow, false); assert.equal(layout.closeVisible, true);
      await close('progress');
      await page.evaluate(() => { scene.orders.order = null; scene.orders.random = () => .9; scene.orders.generate({ forcedType: 'STANDARD' }); });
      await page.click('#accept-order');
      await page.evaluate(() => { scene.deliveryEvents.pending = null; const target = scene.orders.getTarget(); scene.player.setPosition(target.x, target.y); });
      await page.waitForTimeout(100); await page.keyboard.press('e');
      await page.evaluate(() => { const target = scene.orders.getTarget(); scene.player.setPosition(target.x, target.y); });
      await page.waitForTimeout(100); await page.keyboard.press('e');
      assert.equal(await page.evaluate(() => scene.orders.order.status), 'DELIVERED');
      const completed = await snapshot(); assert.equal(completed.completedOrders, endgame.completedOrders + 1);
      assert.ok(completed.personalRecords.fastestDeliverySeconds > 0); assert.ok(completed.totalMoneyEarned > endgame.totalMoneyEarned);
      await open('company'); assert.match(await page.locator('#company-display-name').textContent(), /Старая компания/); await close('company');
      await open('districts'); assert.equal(await page.locator('[data-district]').count(), 5); await page.click('#district-dialog [data-close]');
      await page.reload(); await ready(); assert.equal((await snapshot()).magnateCelebrationSeen, true);
      await open('progress'); assert.equal(await page.locator('#magnate-celebration').isVisible(), false);
      assert.equal(await page.evaluate(() => scene.orders.state.progression.claim('magnate', true).ok), false);
      console.log(`PASS ${viewport.width}x${viewport.height}: old save, tabs, secrets, notifications, claims, legacy, titles, Magnate, records, input, save/reload, company and districts`);
      await page.close();
    }
    if (process.env.PREVIEW_URL) for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
      const page = await browser.newPage({ viewport, hasTouch: viewport.width < 1000 });
      page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      const productionSeed = { ...seed, xp: 10450, completedOrders: 100, totalMoneyEarned: 500000, companyLifetimeEarnings: 1000000,
        companyLevel: 4, employees: Array.from({ length: 8 }, (_, i) => ({ id: `courier-${i + 1}`, name: 'Саша' })) };
      await page.addInitScript(({ seed, key }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(seed)); }, { seed: productionSeed, key });
      const ready = async () => {
        await page.waitForSelector('#objective:not(:empty)');
        await page.waitForTimeout(200);
        if (await page.locator('#company-dialog[open]').count()) await page.click('#company-dialog [data-close]');
      };
      const open = async () => { if (!await page.locator('#open-progress').isVisible()) await page.click('#open-menu'); await page.click('#open-progress'); };
      await page.goto(process.env.PREVIEW_URL); await ready(); assert.equal(await page.evaluate(() => typeof courierDebug), 'undefined');
      for (const shortcut of ['F2', 'F3', 'Control+Alt+n', 'Alt+c']) await page.keyboard.press(shortcut);
      assert.equal(await page.locator('#money').textContent(), `${seed.money} ₽`);
      await open(); assert.equal(await page.locator('#magnate-celebration').isVisible(), true);
      await page.click('#magnate-continue'); await page.locator('[data-claim="magnate"]').click();
      await page.click('[data-progress-view="legacy"]'); await page.locator('[data-legacy="experience"] button').click();
      const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
      assert.equal(saved.version, 9); assert.equal(saved.legacyPoints, 4); assert.equal(saved.magnateCelebrationSeen, true);
      assert.ok(saved.legacyUpgrades.includes('experience')); assert.equal(saved.employees.length, 8);
      await page.screenshot({ path: path.join(artifacts, `${viewport.width}-production.png`) });
      await page.reload(); await ready(); await open(); assert.equal(await page.locator('#magnate-celebration').isVisible(), false);
      assert.equal(await page.locator('[data-claim="magnate"]').isDisabled(), true);
      await page.click('[data-progress-view="legacy"]'); assert.equal(await page.locator('[data-legacy="experience"] button').isDisabled(), true);
      await page.close(); console.log(`PASS production ${viewport.width}x${viewport.height}: migration, Magnate, claims, legacy persistence and debug excluded`);
    }
    assert.deepEqual(errors, []); console.log('PASS: no browser runtime/console errors');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
