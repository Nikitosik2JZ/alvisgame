const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const base = process.env.GAME_URL || 'http://127.0.0.1:5178';
const artifacts = path.join(process.cwd(), 'artifacts', 'stage10');
const key = 'courier-empire-save-v1';
const seed = { version: 9, money: 111111, xp: 6000, reputation: 100, completedOrders: 25,
  ownedItems: ['thermobag'], equippedItems: { BAG: 'thermobag' }, ownedTransports: ['WALKING', 'BICYCLE', 'MOPED', 'CAR'], equippedTransport: 'CAR',
  unlockedDistricts: ['residential', 'center', 'industrial', 'elite', 'business'], companyUnlocked: true, companyLevel: 2,
  companyBalance: 5000, companyName: 'Старая компания', employees: [{ id: 'courier-1', name: 'Саша', level: 3 }] };
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
        await page.waitForFunction(async () => { const { game } = await import(document.querySelector('script[src*="/src/main.js"]').src); window.scene = game.scene.getScene('GameScene'); return !!scene?.orders?.order; });
        await page.evaluate(() => { scene.deliveryEvents.random = () => .99; scene.company.events.nextAt = Infinity; });
        if (await page.locator('#company-dialog[open]').count()) await page.click('#company-dialog [data-close]');
      };
      const snapshot = () => page.evaluate(() => scene.orders.state.getSnapshot());
      const open = async id => { if (!await page.locator(`#open-${id}`).isVisible()) await page.click('#open-menu'); await page.click(`#open-${id}`); };
      const close = async id => page.click(`#${id}-dialog [data-close]`);
      const delivery = async (type = 'STANDARD') => {
        await page.evaluate(type => { scene.orders.order = null; scene.orders.generate({ forcedType: type }); }, type);
        await page.click('#accept-order');
        await page.evaluate(() => { scene.deliveryEvents.pending = null; const t = scene.orders.getTarget(); scene.player.setPosition(t.x, t.y); });
        await page.waitForTimeout(80); await page.keyboard.press('e');
        while (await page.evaluate(() => scene.orders.order.status === 'PICKED_UP')) {
          await page.evaluate(() => { const t = scene.orders.getTarget(); scene.player.setPosition(t.x, t.y); });
          await page.waitForTimeout(80); await page.keyboard.press('e');
        }
        assert.equal(await page.evaluate(() => scene.orders.order.status), 'DELIVERED');
      };
      await page.goto(base); await ready(); const initial = await snapshot();
      assert.equal(initial.money, seed.money); assert.equal(initial.completedOrders, seed.completedOrders); assert.equal(initial.dailyTasks.length, 3); assert.ok(initial.rotatingChallenge);
      await open('tasks'); await page.click('[data-task-action="intro"]'); assert.equal((await snapshot()).tasksIntroductionSeen, true);
      const beforeBonus = (await snapshot()).money; await page.click('[data-task-action="bonus"]'); assert.equal((await snapshot()).money, beforeBonus + 1500);
      assert.equal(await page.locator('[data-task-action="bonus"]').isDisabled(), true);
      const beforeProgress = (await snapshot()).dailyTasks[0].currentProgress; await page.keyboard.press('w'); assert.equal((await snapshot()).dailyTasks[0].currentProgress, beforeProgress);
      await page.evaluate(() => courierDebug.tasks.completeAll());
      const firstId = (await snapshot()).dailyTasks[0].id, beforeClaim = (await snapshot()).money;
      await page.click(`[data-task-action="daily:${firstId}"]`); assert.equal((await snapshot()).money, beforeClaim + 350); assert.equal(await page.locator(`[data-task-action="daily:${firstId}"]`).isDisabled(), true);
      await page.locator('[data-task-action="completion"]').scrollIntoViewIfNeeded(); await page.click('[data-task-action="completion"]');
      assert.equal((await snapshot()).money, beforeClaim + 350 + 700); assert.equal(await page.locator('[data-task-action="completion"]').isDisabled(), true);
      await page.screenshot({ path: path.join(artifacts, `${viewport.width}-daily.png`) });
      await page.click('[data-task-view="challenges"]'); await page.click('[data-task-action="accept-session"]');
      await close('tasks'); await page.evaluate(() => courierDebug.tasks.setStreak(4));
      const beforeDelivery = await snapshot(); await delivery(); const afterDelivery = await snapshot();
      const payout = await page.evaluate(() => ({ base: scene.orders.order.reward, streak: scene.orders.state.values.currentDeliveryStreak }));
      assert.equal(payout.streak, 5); assert.equal(afterDelivery.money - beforeDelivery.money, payout.base + Math.round(payout.base * .1) + Math.round(payout.base * .05));
      assert.equal(afterDelivery.completedOrders, beforeDelivery.completedOrders + 1); assert.ok(afterDelivery.achievements.includes('streak-five'));
      await delivery('DOUBLE'); assert.equal((await snapshot()).currentDeliveryStreak, 6); await delivery('URGENT');
      await open('tasks'); await page.click('[data-task-view="challenges"]'); assert.equal(await page.locator('[data-task-action="session:session-series"]').isEnabled(), true);
      const beforeSessionClaim = (await snapshot()).money; await page.click('[data-task-action="session:session-series"]'); assert.equal((await snapshot()).money, beforeSessionClaim + 120);
      assert.equal(await page.locator('[data-task-action="accept-session"]').count(), 0);
      await page.evaluate(() => courierDebug.tasks.completeRotating()); const rotatingId = (await snapshot()).rotatingChallenge.id;
      await page.locator(`[data-task-action="rotating:${rotatingId}"]`).scrollIntoViewIfNeeded(); await page.click(`[data-task-action="rotating:${rotatingId}"]`);
      assert.equal(await page.locator(`[data-task-action="rotating:${rotatingId}"]`).isDisabled(), true);
      await page.screenshot({ path: path.join(artifacts, `${viewport.width}-challenges.png`) });
      await page.click('[data-task-view="streak"]'); assert.match(await page.locator('#tasks-content').textContent(), /Лучший результат: 7/);
      await page.screenshot({ path: path.join(artifacts, `${viewport.width}-streak.png`) });
      const layout = await page.evaluate(() => {
        const d = document.querySelector('#tasks-dialog'), c = d.querySelector('.modal-content'), r = d.getBoundingClientRect(), close = d.querySelector('[data-close]').getBoundingClientRect();
        return { fits: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight, overflow: c.scrollWidth > c.clientWidth + 1, closeVisible: close.top >= 0 && close.bottom <= innerHeight, scrolls: c.scrollHeight > c.clientHeight };
      });
      assert.equal(layout.fits, true); assert.equal(layout.overflow, false); assert.equal(layout.closeVisible, true);
      await close('tasks'); await page.reload(); await ready(); const restored = await snapshot();
      assert.equal(restored.currentDeliveryStreak, 7); assert.ok(restored.dailyTaskCompletionBonusClaimed); assert.equal(restored.rotatingChallenge.claimed, true);
      assert.equal(await page.evaluate(id => scene.orders.state.tasks.claim(id).ok, firstId), false); assert.equal(await page.evaluate(() => courierDebug.tasks.claimBonus().ok), false);
      await open('tasks'); assert.equal(await page.locator('[data-task-action="intro"]').count(), 0); await close('tasks');
      const claimedDate = restored.lastDailyBonusClaimDate; await page.evaluate(() => courierDebug.tasks.nextDay()); assert.notEqual((await snapshot()).dailyTaskDate, claimedDate);
      await open('tasks'); assert.equal(await page.locator('[data-task-action="bonus"]').isEnabled(), true); await page.click('[data-task-action="bonus"]'); await close('tasks');
      const beforeFail = await snapshot(); await page.evaluate(() => { scene.orders.order = null; scene.orders.generate(); scene.orders.accept(); scene.deliveryEvents.pending = null; scene.orders.order.deadline = scene.orders.now() - 1; scene.orders.update(); });
      const failed = await snapshot(); assert.equal(failed.currentDeliveryStreak, 0); assert.equal(failed.bestDeliveryStreak, 7); assert.equal(failed.failedOrders, beforeFail.failedOrders + 1);
      await open('progress'); await page.click('[data-progress-view="records"]'); assert.match(await page.locator('#progress-content').textContent(), /Лучшая серия доставок/); await close('progress');
      await open('company'); assert.match(await page.locator('#company-display-name').textContent(), /Старая компания/); await close('company');
      const oldStreak = (await snapshot()).bestDeliveryStreak; await page.evaluate(() => courierDebug.switchDistrict('center'));
      await page.waitForTimeout(700); await ready(); assert.equal((await snapshot()).bestDeliveryStreak, oldStreak); assert.ok((await snapshot()).dailyTasks.length === 3);
      console.log(`PASS ${viewport.width}x${viewport.height}: old save, daily/login/completion claims, session, rotating, Double, streak payout/failure, notifications, records, mobile dialog, reload and district restart`);
      await page.close();
    }
    if (process.env.PREVIEW_URL) for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
      const page = await browser.newPage({ viewport, hasTouch: viewport.width < 1000 });
      page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      await page.addInitScript(({ seed, key }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(seed)); }, { seed, key });
      const ready = async () => { await page.waitForSelector('#objective:not(:empty)'); if (await page.locator('#company-dialog[open]').count()) await page.click('#company-dialog [data-close]'); };
      const open = async () => { if (!await page.locator('#open-tasks').isVisible()) await page.click('#open-menu'); await page.click('#open-tasks'); };
      await page.goto(process.env.PREVIEW_URL); await ready(); assert.equal(await page.evaluate(() => typeof courierDebug), 'undefined'); await open(); await page.click('[data-task-action="intro"]'); await page.click('[data-task-action="bonus"]');
      const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key); assert.equal(saved.version, 11); assert.equal(saved.money, seed.money + 1500); assert.equal(saved.dailyTasks.length, 3);
      await page.reload(); await ready(); await open(); assert.equal(await page.locator('[data-task-action="bonus"]').isDisabled(), true); assert.equal(await page.locator('[data-task-action="intro"]').count(), 0);
      await page.click('[data-task-view="challenges"]'); assert.ok(await page.locator('[data-task-action="accept-session"]').isVisible()); await page.click('[data-task-action="later-session"]');
      await page.screenshot({ path: path.join(artifacts, `${viewport.width}-production.png`) }); await page.close(); console.log(`PASS production ${viewport.width}x${viewport.height}: UI, migration, bonus persistence, session decline, debug excluded`);
    }
    assert.deepEqual(errors, []); console.log('PASS no browser runtime/console errors');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
