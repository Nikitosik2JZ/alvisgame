// Local UI regression checks; ad callbacks below are explicitly SDK contract mocks.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const assert = require('node:assert/strict');
const fs = require('node:fs'); fs.mkdirSync('artifacts/gameplay-ux', { recursive: true });
const base = process.env.GAME_URL || 'http://127.0.0.1:5178';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const errors = [];
  try {
    for (const language of ['ru', 'en']) for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
      const context = await browser.newContext({ viewport, hasTouch: viewport.width < 1000 });
      const page = await context.newPage();
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      const ready = async () => {
        await page.waitForSelector('#objective:not(:empty)');
        await page.evaluate(async language => {
          const m = await import('/src/main.js');
          window.scene = m.game.scene.getScene('GameScene'); window.life = m.lifecycle; window.platform = m.platformService;
          const { localization } = await import('/src/services/LocalizationService.js'); localization.initialize(language);
          localization.translateDocument(document); scene.orders.emit('generated');
          scene.deliveryEvents.random = () => .99;
        }, language);
        await page.waitForFunction(() => !life.paused);
      };
      const complete = async () => page.evaluate(() => {
        scene.orders.order = null; scene.orders.generate({ forcedType: 'STANDARD' });
        scene.orders.accept(); scene.deliveryEvents.pending = null;
        scene.orders.interact(scene.orders.getTarget()); scene.orders.interact(scene.orders.getTarget());
      });
      await page.goto(base); await ready();
      await page.keyboard.press('F5'); await page.waitForTimeout(150); await ready();
      assert.equal(await page.locator('#event-dialog[open]').count(), 0);
      await page.reload(); await ready(); assert.equal(await page.locator('#event-dialog[open]').count(), 0);
      // Unaccepted offer and active-order reload preserve the existing no-active-order persistence policy.
      await page.click('#accept-order'); await page.reload(); await ready();
      assert.equal(await page.evaluate(() => scene.orders.order.status), 'AVAILABLE');
      assert.equal(await page.locator('#event-dialog[open]').count(), 0);
      const before = await page.evaluate(() => scene.orders.state.values.money);
      await complete(); assert.equal(await page.evaluate(() => life.paused || scene.player.inputBlocked), false);
      assert.ok(await page.evaluate(before => scene.orders.state.values.money > before, before));
      assert.equal(await page.locator('#continue-delivery').count(), 0);
      assert.equal(await page.locator('#rewarded-delivery').isVisible(), true);
      assert.equal(await page.evaluate(() => {
        const panel = document.querySelector('#order-panel').getBoundingClientRect();
        const b = document.querySelector('#rewarded-delivery').getBoundingClientRect();
        const j = document.querySelector('#joystick').getBoundingClientRect();
        return b.top >= panel.top && b.bottom <= panel.bottom && b.bottom <= innerHeight &&
          !(b.left < j.right && b.right > j.left && b.top < j.bottom && b.bottom > j.top);
      }), true, 'Ad action fits the compact panel and does not cover joystick');
      await page.screenshot({ path: `artifacts/gameplay-ux/${language}-${viewport.width}x${viewport.height}-result.png` });
      await page.evaluate(() => scene.player.setPosition(600, 660));
      const start = await page.evaluate(() => ({ x: scene.player.x, y: scene.player.y }));
      if (viewport.width === 1280) {
        await page.keyboard.down('d'); await page.waitForTimeout(120); await page.keyboard.up('d');
        await page.keyboard.down('ArrowDown'); await page.waitForTimeout(120); await page.keyboard.up('ArrowDown');
      } else {
        const j = await page.locator('#joystick').boundingBox();
        await page.mouse.move(j.x + j.width / 2, j.y + j.height / 2); await page.mouse.down();
        await page.mouse.move(j.x + j.width - 5, j.y + j.height / 2); await page.waitForTimeout(160); await page.mouse.up();
      }
      assert.ok(await page.evaluate(start => Math.hypot(scene.player.x - start.x, scene.player.y - start.y) > 2, start), 'Immediate movement');
      await page.waitForFunction(() => scene.orders.order.status === 'AVAILABLE');
      assert.equal(await page.locator('#rewarded-delivery').isVisible(), false);
      assert.equal(await page.evaluate(() => scene.orders.state.values.deliveryAdBonus), null);
      await complete(); await page.click('#rewarded-delivery');
      assert.match(await page.locator('#ad-feedback').innerText(), language === 'ru' ? /РЕКЛАМА СЕЙЧАС НЕДОСТУПНА/ : /UNAVAILABLE/i);
      assert.equal(await page.evaluate(() => life.paused), false);
      assert.equal(await page.locator('#rewarded-delivery').isEnabled(), true);
      await page.reload(); await ready();
      assert.equal(await page.evaluate(() => scene.orders.state.values.deliveryAdBonus), null);
      // SDK callback contracts: onRewarded only, exactly once, close/error resume central pause.
      for (const outcome of ['reward', 'close', 'error']) {
        await complete();
        const before = await page.evaluate(() => scene.orders.state.values.money);
        const bonus = await page.evaluate(() => scene.orders.state.values.deliveryAdBonus.amount);
        await page.evaluate(outcome => {
          platform.sdk = { adv: { showRewardedVideo({ callbacks }) { window.adCallbacks = callbacks; callbacks.onOpen(); } } };
        }, outcome);
        await page.click('#rewarded-delivery');
        assert.equal(await page.evaluate(() => life.reasons.has('ADVERTISEMENT') && scene.player.inputBlocked), true);
        await page.evaluate(outcome => {
          if (outcome === 'reward') { adCallbacks.onRewarded(); adCallbacks.onRewarded(); }
          if (outcome === 'error') adCallbacks.onError(); else adCallbacks.onClose();
        }, outcome);
        await page.waitForFunction(() => !life.paused);
        assert.equal(await page.evaluate(() => scene.orders.state.values.money), before + (outcome === 'reward' ? bonus : 0));
        assert.equal(await page.locator('#rewarded-delivery').isVisible(), outcome !== 'reward');
      }
      // All event categories still display inside a real accepted order.
      await page.evaluate(async () => {
        const { EVENTS } = await import('/src/data/events.js');
        scene.orders.order = null; scene.orders.generate(); scene.orders.accept();
        for (const category of ['POSITIVE', 'NEGATIVE', 'CHOICE']) {
          scene.deliveryEvents.negativeStreak = 0; scene.deliveryEvents.lastId = null;
          if (!scene.deliveryEvents.debug(category)) throw Error('Missing valid event ' + category);
          if (!scene.deliveryEvents.active.resolved) scene.deliveryEvents.resolve(0);
          scene.eventUI.dialog.close(); scene.deliveryEvents.finish(); life.set('MENU:EVENT', false);
        }
      });
      console.log(`PASS ${language} ${viewport.width}x${viewport.height}: reload, controls, expiry, unavailable, SDK reward/close/error, events`);
      await context.close();
    }
    // Real elapsed idle interval, no delivery event allowed.
    const p = await browser.newPage(); await p.goto(base); await p.waitForSelector('#objective:not(:empty)');
    await p.waitForTimeout(31000); assert.equal(await p.locator('#event-dialog[open]').count(), 0); await p.close();
    assert.deepEqual(errors, []); console.log('PASS 31-second idle, no console/runtime errors');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });

