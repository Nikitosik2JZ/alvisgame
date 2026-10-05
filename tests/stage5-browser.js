// Development-only in-browser integration harness; excluded from the production build.
import { game } from '../src/main.js';
import { gameState as state } from '../src/state/GameState.js';
import { GameState } from '../src/state/GameState.js';
import { TRANSPORTS, transportFor } from '../src/config/transportConfig.js';
import { EVENTS } from '../src/data/events.js';
import { ORDER_TYPES } from '../src/config/economyConfig.js';
import { platformService } from '../src/services/PlatformService.js';

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const run = parent.document.querySelector('#run'), result = parent.document.querySelector('#result'), log = parent.document.querySelector('#log');
let scene;
const check = (condition, message) => { if (!condition) throw new Error(message); log.textContent += `PASS: ${message}\n`; };
const click = selector => document.querySelector(selector).click();
const position = (x, y) => { scene.player.setPosition(x, y); scene.player.body.reset(x, y); };
const key = async (name, ms) => { scene.player.keys[name].isDown = true; await wait(ms); scene.player.keys[name].isDown = false; await wait(50); };
const forceOrder = type => {
  const t = transportFor(state.getSnapshot().equippedTransport), weights = Object.entries(t.orderWeights);
  const total = weights.reduce((sum, [, w]) => sum + w, 0); let before = 0;
  for (const [id, weight] of weights) { if (id === type) break; before += weight; }
  let draws = 0; scene.orders.order = null;
  scene.orders.random = () => [0, 0, (before + t.orderWeights[type] / 2) / total, 0][draws++] ?? 0;
  scene.orders.generate(); check(scene.orders.order.type === type, `${t.id}: generated ${type}`);
};
const complete = async () => {
  scene.orders.accept(); position(scene.orders.order.restaurant.x, scene.orders.order.restaurant.y); await wait(60); click('#interact');
  for (const customer of scene.orders.order.customers) { position(customer.x, customer.y); await wait(60); click('#interact'); }
  check(scene.orders.order.status === 'DELIVERED', 'pickup and all delivery zones complete the order');
};
async function moveTo(x, y) {
  for (const [axis, goal, positive, negative] of [['x', x, 'D', 'A'], ['y', y, 'S', 'W']]) {
    const start = scene.player[axis], increasing = goal > start;
    scene.player.keys[increasing ? positive : negative].isDown = true;
    const until = performance.now() + 12000;
    while (Math.abs(scene.player[axis] - goal) > 8 && (increasing ? scene.player[axis] < goal : scene.player[axis] > goal)) {
      if (performance.now() > until) throw new Error(`Route stuck: ${axis} ${scene.player[axis]} -> ${goal}`);
      await wait(16);
    }
    scene.player.clearInput(); await wait(30);
  }
}
async function verify() {
  const backup = await platformService.loadSave();
  try {
    const errors = [];
    const error = e => errors.push(e.message); window.addEventListener('error', error);
    state.loadSaveData({}); scene.deliveryEvents.random = () => .99;
    position(1200, 1000);
    check(state.getSnapshot().movementSpeed === 160, 'existing walking baseline');
    click('#open-garage'); click('[data-transport="MOPED"]');
    check(document.querySelector('#garage-feedback').textContent.includes('уровень 6'), 'moped below level rejected');
    state.update({ xp: 1000, money: 8999 }); click('[data-transport="MOPED"]');
    check(document.querySelector('#garage-feedback').textContent.includes('Не хватает'), 'moped insufficient money rejected');
    state.update({ money: 12500 }); state.purchaseItem('bicycle'); click('[data-transport="MOPED"]');
    check(state.getSnapshot().equippedTransport === 'MOPED' && scene.player.speed === 340, 'garage purchase equips moped immediately');
    check(!document.querySelector('#transport-celebration').hidden, 'moped celebration opens');
    check(document.querySelector('#garage-items').hidden && document.querySelector('#garage-dialog').getBoundingClientRect().height >= Math.min(400, innerHeight - 24), 'celebration is large and excludes background cards');
    click('#celebration-go');
    check(!state.purchaseTransport('MOPED').ok, 'duplicate moped purchase rejected');
    click('#open-garage'); click('[data-transport="BICYCLE"]'); click('[data-transport="MOPED"]'); click('[data-transport="WALKING"]'); click('[data-transport="MOPED"]');
    check(state.getSnapshot().equippedTransport === 'MOPED', 'bicycle / moped / walking switches');
    click('[data-transport="CAR"]'); check(document.querySelector('#garage-feedback').textContent.includes('уровень 10'), 'car below level rejected');
    state.update({ xp: 2700, money: 28000 }); click('[data-transport="CAR"]');
    check(state.getSnapshot().equippedTransport === 'CAR' && scene.player.speed === 420, 'car purchase equips immediately'); click('#celebration-go');
    state.update({ money: 1500 }); state.purchaseItem('old-shoes'); state.purchaseItem('thermobag');
    for (const t of TRANSPORTS) {
      result.textContent = `Checking ${t.id} physics and controls…`;
      scene.orders.order = null; state.equipTransport(t.id);
      check(scene.player.texture.key === t.visual.texture, `${t.id}: distinct visual`);
      check(scene.player.body.width === 22 && scene.player.body.height === 24, `${t.id}: friendly collision body`);
      position(1200, 1000); const start = scene.player.x; await key('D', 250);
      check(scene.player.x > start + 20, `${t.id}: desktop movement`);
      position(1200, 1000);
      scene.player.touch.add('right'); await wait(150);
      scene.player.touch.delete('right'); await wait(30);
      check(scene.player.x > 1210, `${t.id}: mobile direction movement`);
      position(530, 600); await key('D', 250); check(scene.player.x <= 554.5, `${t.id}: building collision`);
      position(810, 800); await key('W', 600); check(scene.player.y < 750, `${t.id}: narrow passage between buildings`);
      forceOrder('STANDARD'); scene.orders.accept(); position(1200, 1000);
      const restaurant = scene.orders.order.restaurant;
      await moveTo(1200, restaurant.y); await moveTo(restaurant.x, restaurant.y); await wait(50); click('#interact');
      check(scene.orders.order.status === 'PICKED_UP', `${t.id}: physical pickup route`);
      const customer = scene.orders.order.customer;
      await moveTo(1200, restaurant.y); await moveTo(1200, customer.y); await moveTo(customer.x, customer.y); await wait(50); click('#interact');
      check(scene.orders.order.status === 'DELIVERED', `${t.id}: physical delivery route and camera`);
      for (const type of t.allowedOrderTypes) { forceOrder(type); await complete(); }
      forceOrder('STANDARD'); scene.orders.accept();
      click('#open-garage'); click(`[data-transport="${t.id === 'WALKING' ? 'MOPED' : 'WALKING'}"]`);
      check(document.querySelector('#garage-feedback').textContent.includes('СНАЧАЛА ЗАВЕРШИТЕ'), `${t.id}: active-order switching blocked in garage`);
      const pausedPos = scene.player.x; await key('D', 100); check(scene.player.x === pausedPos, 'modal blocks movement'); click('#garage-dialog [data-close]');
      for (const event of EVENTS.filter(e => e.id === 'rain' || e.requirements?.transports?.includes(t.id))) {
        scene.deliveryEvents.pending = event; scene.deliveryEvents.negativeStreak = 0; scene.deliveryEvents.lastId = null;
        scene.deliveryEvents.trigger(event.trigger); check(Boolean(scene.deliveryEvents.active), `${t.id}: event ${event.id} eligible and visible`);
        check(document.querySelector('#event-dialog').open, 'event popup open');
        if (event.id === 'rain') {
          scene.deliveryEvents.modifiers.items.delete('green');
          check(scene.deliveryEvents.modifiers.items.get('rain').transportValues[t.id] === t.weatherModifier, `${t.id}: configured rain penalty`);
        }
        click('#event-buttons button');
        if (event.choices) click('#event-buttons button');
        scene.deliveryEvents.modifiers.items.clear();
      }
      scene.orders.order.deadline = performance.now() - 1; await wait(60);
      check(scene.orders.order.status === 'FAILED' && state.equipTransport(t.id).ok, 'failure unlocks transport');
      const loaded = new GameState(); loaded.loadSaveData(await platformService.loadSave());
      check(loaded.getSnapshot().equippedTransport === t.id, `${t.id}: automatic local save roundtrip`);
    }
    scene.orders.order = null; state.update({ money: 3000 }); state.unlockDistrict('center'); state.equipTransport('CAR');
    click('#open-districts');
    [...document.querySelectorAll('#district-list button')].find(b => b.textContent === 'ВЫБРАТЬ').click(); await wait(300);
    scene = game.scene.getScene('GameScene'); scene.deliveryEvents.random = () => .99;
    check(state.getSnapshot().selectedDistrict === 'center' && scene.player.texture.key === 'courier-car', 'district restart preserves vehicle and listeners');
    click('#open-profile');
    check(document.querySelector('#profile-details').textContent.includes('Профи доставки'), 'career title follows ownership');
    click('#profile-dialog [data-close]');
    check(document.querySelector('#transport-goal').textContent.includes('Весь транспорт'), 'final progression goal');
    state.loadSaveData({ version: 1, transport: 'BICYCLE', xp: 250, money: 100 });
    check(scene.player.texture.key === 'courier-bicycle' && state.getSnapshot().ownedTransports.includes('BICYCLE'), 'legacy transport-only save restores actual bicycle gameplay');
    check(errors.length === 0, `no runtime errors: ${errors.join(', ')}`); window.removeEventListener('error', error);
    result.textContent = 'PASS — all Stage 5 browser integration checks';
  } finally {
    scene.orders.order = null;
    state.loadSaveData(backup || {});
    scene.scene.restart();
  }
}
if (import.meta.env.DEV) {
  while (!(scene = game.scene.getScene('GameScene'))?.orders?.order) await wait(50);
  run.disabled = false; result.textContent = 'Ready — checks restore the original save afterward';
  run.onclick = async () => {
    run.disabled = true; log.textContent = '';
    try { await verify(); } catch (e) { result.textContent = `FAIL: ${e.message}`; log.textContent += `${e.stack}\n`; console.error(e); }
    finally { run.disabled = false; }
  };
}
