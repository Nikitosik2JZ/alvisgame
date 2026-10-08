const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const artifacts = process.env.ARTIFACT_DIR || 'artifacts/hud-navigation';

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const errors = [];
  fs.mkdirSync(artifacts, { recursive: true });
  try {
    for (const language of ['ru', 'en']) for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1366, height: 768 }]) {
      const page = await browser.newPage({ viewport, hasTouch: viewport.width < 1000 });
      page.on('pageerror', e => errors.push(e.message));
      const url = new URL(process.env.GAME_URL || 'http://127.0.0.1:5174');
      url.searchParams.set('lang', language);
      await page.goto(url.href);
      await page.waitForSelector('#objective:not(:empty)');
      if (await page.locator('[data-tutorial-skip]').isVisible()) await page.click('[data-tutorial-skip]');
      await page.evaluate(async language => {
        const runtime = await import(document.querySelector('script[src*="/src/main.js"]').src);
        while (!runtime.game?.scene.getScene('GameScene')?.orders?.order) await new Promise(resolve => setTimeout(resolve, 50));
        const { game, lifecycle } = runtime;
        window.runtime = runtime;
        window.s = game.scene.getScene('GameScene'); window.life = lifecycle;
        const { localization } = await import('/src/services/LocalizationService.js');
        localization.initialize(language); localization.translateDocument();
        s.deliveryEvents.random = () => .99;
        s.cameras.main.stopFollow(); s.cameras.main.setScroll(600, 400);
      }, language);
      if (await page.locator('[data-tutorial-skip]').isVisible()) await page.click('[data-tutorial-skip]');
      const collapsed = () => page.locator('.hud').evaluate(el => el.classList.contains('collapsed'));
      const expectCollapsed = () => page.waitForFunction(() => document.querySelector('.hud').classList.contains('collapsed'));
      const expand = async () => {
        if (await collapsed()) await page.click('#toggle-hud');
        // Independent fixtures do not inherit the previous manual-inspection lease.
        await page.evaluate(() => { s.hudUI.manualNavigation.baseline = null; });
        await page.waitForTimeout(120);
      };
      const fixture = async (mode, status = 'ACCEPTED') => page.evaluate(({ mode, status }) => {
        const c = s.cameras.main, h = document.querySelector('.hud').getBoundingClientRect();
        const canvas = s.game.canvas.getBoundingClientRect();
        const point = (x, y) => {
          const p = c.matrix.applyInverse((x - canvas.left) * s.scale.width / canvas.width, (y - canvas.top) * s.scale.height / canvas.height);
          return { x: p.x + c.scrollX, y: p.y + c.scrollY, name: 'Navigation test' };
        };
        const player = point(canvas.left + canvas.width * .65, canvas.top + canvas.height * .65);
        s.player.setPosition(player.x, player.y); s.player.clearInput();
        let x = h.left + Math.min(100, h.width / 2), y = h.top + Math.min(90, h.height / 2);
        if (mode === 'left') y = h.bottom + 25;
        if (mode === 'right') { x = canvas.right - 90; y = canvas.top + canvas.height * .65; }
        if (mode === 'arrow') { x = canvas.left - canvas.width * 5; y = canvas.top - canvas.height * 5; }
        const target = point(x, y);
        if (mode === 'left') s.player.y = target.y;
        s.orders.order = null; s.orders.generate({ forcedType: 'STANDARD' });
        s.orders.order.restaurant = target;
        s.orders.order.customer = target;
        s.orders.order.customers = [target, { ...target, x: target.x + 1 }];
        s.orders.order.status = status === 'ACCEPTED' ? 'AVAILABLE' : status;
        if (status === 'ACCEPTED') s.orders.accept();
        s.orders.order.deadline = life.now() + 600000;
        s.deliveryEvents.pending = null;
        s.orders.emit('navigation test');
      }, { mode, status });

      // I: idle state, and C: clearly visible target to the right.
      await fixture('right', 'AVAILABLE'); await expand();
      await page.waitForTimeout(250); assert.equal(await collapsed(), false);
      await fixture('right'); await page.waitForTimeout(250); assert.equal(await collapsed(), false);
      await page.evaluate(() => {
        window.boundsReads = 0;
        window.restoreBounds = [document.querySelector('.hud'), s.game.canvas].map(el => {
          const original = el.getBoundingClientRect;
          el.getBoundingClientRect = function () { window.boundsReads++; return original.call(this); };
          return () => { el.getBoundingClientRect = original; };
        });
      });
      await page.waitForTimeout(400);
      assert.ok(await page.evaluate(() => window.boundsReads <= 2), 'navigation reuses bounds; at most one settling layout measurement');
      await page.evaluate(() => window.restoreBounds.forEach(restore => restore()));
      // A/B: upper-left and directly left, including the edge of the ring.
      await fixture('upper-left'); await expectCollapsed();
      for (const id of ['money', 'level', 'reputation', 'toggle-hud']) assert.equal(await page.locator(`#${id}`).isVisible(), true);
      assert.equal(await page.locator('h1').isVisible(), false);
      await page.screenshot({ path: path.join(artifacts, `${language}-${viewport.width}x${viewport.height}-collapsed.png`) });
      // F: moving away never expands the HUD.
      await fixture('right'); await page.waitForTimeout(250); assert.equal(await collapsed(), true);
      await fixture('right', 'AVAILABLE'); await expand(); await fixture('left'); await expectCollapsed();
      // G: actual user expansion remains usable, including beyond the grace period at rest.
      await page.click('#toggle-hud');
      await page.waitForTimeout(2000); assert.equal(await collapsed(), false);
      assert.equal(await page.evaluate(() => s.player.movementInput.pointer), null);
      await page.evaluate(() => { s.player.x += 40; }); await expectCollapsed();
      // D/H: real pickup and double-stop manager transitions select the current target.
      await fixture('right', 'AVAILABLE'); await expand(); await fixture('right');
      await page.evaluate(() => {
        const c = s.cameras.main, p = c.matrix.applyInverse(100, 90);
        const hidden = { x: p.x + c.scrollX, y: p.y + c.scrollY, name: 'Customer' };
        s.orders.order.customer = hidden; s.orders.order.customers = [hidden, hidden];
        s.orders.interact(s.orders.order.restaurant);
      });
      await expectCollapsed(); assert.equal(await page.evaluate(() => s.orders.order.status), 'PICKED_UP');
      await fixture('right', 'AVAILABLE'); await expand(); await fixture('right', 'PICKED_UP');
      await page.evaluate(() => {
        const c = s.cameras.main, p = c.matrix.applyInverse(100, 90);
        s.orders.order.customers[1] = { x: p.x + c.scrollX, y: p.y + c.scrollY, name: 'Next customer' };
        s.orders.order.deliveredCount = 0; s.orders.completeStop();
      });
      await expectCollapsed(); assert.equal(await page.evaluate(() => s.orders.getTarget() === s.orders.order.customers[1]), true);
      // E: camera follow carries a previously visible marker into the HUD; zoomed arrow too.
      await fixture('right', 'AVAILABLE'); await expand(); await fixture('right');
      await page.evaluate(() => {
        const c = s.cameras.main, t = s.orders.getTarget();
        t.x = 1000; t.y = 700;
        s.player.setPosition(t.x + c.width * .35, t.y + c.height * .35);
        c.startFollow(s.player, true, 1, 1);
      });
      await expectCollapsed();
      await page.evaluate(() => s.cameras.main.stopFollow());
      await fixture('right', 'AVAILABLE'); await expand();
      await page.evaluate(() => s.cameras.main.setZoom(1.5)); await page.waitForTimeout(120);
      await fixture('arrow'); await expectCollapsed();
      await page.evaluate(() => s.cameras.main.setZoom(1));
      // Resize/orientation and scene restart preserve the chosen compact state.
      await page.setViewportSize({ width: viewport.height, height: viewport.width });
      await page.waitForTimeout(150); assert.equal(await collapsed(), true);
      await page.setViewportSize(viewport);
      await page.evaluate(() => s.scene.restart());
      await page.waitForTimeout(300);
      await page.evaluate(() => { window.s = window.runtime.game.scene.getScene('GameScene'); });
      if (await page.locator('[data-tutorial-skip]').isVisible()) await page.click('[data-tutorial-skip]');
      assert.equal(await collapsed(), true);
      // Existing mobile and desktop controls still drive the courier.
      await page.evaluate(() => { s.orders.order = null; s.player.setPosition(1200, 1000); });
      if (viewport.width < 1000) {
        const j = await page.locator('#joystick').boundingBox();
        const session = await page.context().newCDPSession(page);
        await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: j.x + j.width / 2, y: j.y + j.height / 2, id: 1 }] });
        await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: j.x + j.width - 5, y: j.y + j.height / 2, id: 1 }] });
        await page.waitForTimeout(100);
        assert.ok(await page.evaluate(() => s.player.body.velocity.x > 0), JSON.stringify(await page.evaluate(() => ({ paused: life.paused, reasons: [...life.reasons || []], blocked: s.player.inputBlocked, pointer: s.player.movementInput.pointer, vector: s.player.movementInput.vector }))));
        await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else {
        for (const key of ['d', 'ArrowRight']) {
          await page.keyboard.down(key); await page.waitForTimeout(100);
          assert.ok(await page.evaluate(() => s.player.body.velocity.x > 0)); await page.keyboard.up(key);
        }
      }
      await page.evaluate(() => {
        s.deliveryEvents.random = () => .99;
        s.orders.order = null; s.orders.generate({ forcedType: 'STANDARD' }); s.orders.accept();
        const target = s.orders.getTarget(); s.player.setPosition(target.x, target.y);
      });
      await page.waitForSelector('#interact:not([hidden])');
      if (viewport.width < 1000) await page.tap('#interact');
      else await page.keyboard.press('e');
      await page.waitForTimeout(150);
      assert.equal(await page.evaluate(() => s.orders.order.status), 'PICKED_UP');
      await page.evaluate(() => { const target = s.orders.getTarget(); s.player.setPosition(target.x, target.y); });
      await page.waitForSelector('#interact:not([hidden])');
      if (viewport.width < 1000) await page.tap('#interact');
      else await page.keyboard.press('e');
      await page.waitForTimeout(150);
      assert.equal(await page.evaluate(() => s.orders.order.status), 'DELIVERED');
      await page.click('#open-menu');
      assert.equal(await page.evaluate(() => s.player.inputBlocked), true);
      assert.equal(await page.evaluate(() => s.player.body.velocity.length()), 0);
      await page.click('#menu-dialog [data-close]');
      await page.evaluate(() => {
        s.orders.order = null;
        s.orders.state.values.unlockedDistricts.push('center');
        if (!s.districtUI.switchTo('center')) throw Error('District switch rejected');
      });
      await page.waitForFunction(() => document.querySelector('#district-transition') === null);
      await page.waitForTimeout(300);
      assert.equal(await page.evaluate(() => s.orders.order.district), 'center');
      assert.equal(await collapsed(), true);
      await page.close(); console.log(`PASS A–I, zoom, follow, resize, restart, controls: ${language} ${viewport.width}x${viewport.height}`);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
