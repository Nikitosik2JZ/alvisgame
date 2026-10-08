import test from 'node:test';
import assert from 'node:assert/strict';
import { GameState } from '../src/state/GameState.js';
import { OrderManager } from '../src/managers/OrderManager.js';
import { EventManager, fragileDamageRisk } from '../src/managers/EventManager.js';
import { transportFor, TRANSPORTS, careerTitle, nextTransportGoal } from '../src/config/transportConfig.js';
import { ORDER_TYPES } from '../src/config/economyConfig.js';
import { EVENT_BALANCE as B } from '../src/config/eventBalance.js';
import { xpForLevel } from '../src/config/gameBalance.js';
import { EVENTS } from '../src/data/events.js';
import { restaurants, customers } from '../src/world/deliveryLocations.js';

function setup(transport = 'WALKING') {
  let time = 0;
  const state = new GameState();
  state.update({ xp: xpForLevel(10), money: TRANSPORTS.reduce((n,t) => n + t.purchasePrice, 0) + 20000 });
  for (const t of TRANSPORTS.slice(1)) state.purchaseTransport(t.id);
  state.equipTransport(transport);
  const orders = new OrderManager({ state, restaurants, customers, now: () => time, random: () => 0 });
  const events = new EventManager(state, orders, () => .99, () => time);
  return { state, orders, events, advance: ms => { time += ms; orders.update(); } };
}
function forceOrder(orders, type, routeRoll = .5) {
  const s = orders.state.getSnapshot(), t = transportFor(s.equippedTransport);
  const entries = Object.entries(t.orderWeights).filter(([id]) => s.level >= ORDER_TYPES[id].level);
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let before = 0;
  for (const [id, weight] of entries) { if (id === type) break; before += weight; }
  const roll = (before + t.orderWeights[type] / 2) / total;
  let draws = 0;
  orders.random = () => [0, routeRoll, roll, 0][draws++] ?? 0;
  orders.order = null; orders.generate();
  assert.equal(orders.order.type, type);
}

test('vehicle purchases reject level, money, duplicates and unknown IDs without mutation', () => {
  for (const t of TRANSPORTS.slice(1)) {
    const state = new GameState(); state.update({ money: 50000000 });
    const before = state.getSaveData();
    assert.match(state.purchaseTransport(t.id).reason, /Требуется уровень/);
    assert.deepEqual(state.getSaveData(), before);
    state.update({ xp: xpForLevel(t.requiredLevel), money: t.purchasePrice - 1 });
    assert.match(state.purchaseTransport(t.id).reason, /Не хватает денег/);
    state.update({ money: t.purchasePrice });
    assert.equal(state.purchaseTransport(t.id).ok, true);
    assert.equal(state.getSnapshot().money, 0);
    assert.equal(state.getSnapshot().movementSpeed, t.movementSpeed);
    assert.equal(state.getSnapshot().equippedTransport, t.id);
    const after = state.getSaveData();
    assert.equal(state.purchaseTransport(t.id).ok, false);
    assert.equal(state.purchaseTransport('__proto__').ok, false);
    assert.deepEqual(state.getSaveData(), after);
  }
});

test('all switching paths are free, preserve ownership and block during both active order phases', () => {
  const { state, orders, advance } = setup('CAR');
  const money = state.getSnapshot().money, owned = state.getSnapshot().ownedTransports;
  for (const id of ['BICYCLE', 'MOPED', 'WALKING', 'MOPED', 'CAR']) assert.equal(state.equipTransport(id).ok, true);
  assert.equal(state.getSnapshot().money, money); assert.deepEqual(state.getSnapshot().ownedTransports, owned);
  forceOrder(orders, 'LARGE'); orders.accept();
  for (const phase of ['ACCEPTED', 'PICKED_UP']) {
    assert.equal(orders.order.status, phase);
    assert.match(state.equipTransport('WALKING').reason, /СНАЧАЛА ЗАВЕРШИТЕ/);
    assert.equal(state.unequipCategory('TRANSPORT'), false);
    assert.equal(state.equipItem('bicycle').ok, false);
    if (phase === 'ACCEPTED') orders.interact(orders.order.restaurant);
  }
  orders.interact(orders.order.customer);
  assert.equal(state.equipTransport('WALKING').ok, true);
  advance(3000); orders.accept(); advance(200000);
  assert.equal(state.equipTransport('MOPED').ok, true);
  const s = new GameState(); s.update({ money: 9000, xp: xpForLevel(6) });
  const o = new OrderManager({ state: s, restaurants, customers, random: () => 0 }); o.generate(); o.accept();
  assert.equal(s.purchaseTransport('MOPED').ok, false); assert.equal(s.getSnapshot().money, 9000);
});

test('transport pools gate Large and Double, increase urgency and choose longer routes', () => {
  const distances = [];
  for (const t of TRANSPORTS) {
    const { state, orders } = setup(t.id);
    let total = 0;
    for (let i = 0; i < 100; i++) {
      let draws = 0; orders.random = () => [0, (i + .5) / 100, (i + .5) / 100, 0][draws++] ?? 0;
      orders.order = null; orders.generate();
      assert.ok(t.allowedOrderTypes.includes(orders.order.type));
      assert.ok(orders.order.type !== 'LARGE' || t.id === 'CAR');
      total += orders.order.distance;
    }
    distances.push(total / 100);
    assert.equal(state.getSnapshot().equippedTransport, t.id);
  }
  assert.ok(distances[1] >= distances[0]); assert.ok(distances[2] > distances[1]); assert.ok(distances[3] > distances[2]);
  assert.ok(transportFor('MOPED').orderWeights.URGENT > transportFor('BICYCLE').orderWeights.URGENT);
  const { state, orders } = setup('CAR'); forceOrder(orders, 'LARGE');
  state.equipTransport('WALKING'); assert.notEqual(orders.order.type, 'LARGE');
  assert.equal(orders.order.status, 'AVAILABLE'); assert.equal(orders.accept(), true);
});

test('every eligible type delivers once with configured reward, XP and timer on each transport', () => {
  for (const t of TRANSPORTS) for (const type of t.allowedOrderTypes) {
    const { state, orders } = setup(t.id); forceOrder(orders, type);
    const order = orders.order, before = state.getSnapshot();
    orders.accept(); orders.interact(order.restaurant);
    for (const customer of order.customers) orders.interact(customer);
    assert.equal(order.status, 'DELIVERED');
    assert.equal(state.getSnapshot().money, before.money + order.reward);
    assert.equal(state.getSnapshot().xp, before.xp + order.xpReward);
    assert.equal(orders.interact(order.customer), false);
    if (type === 'DOUBLE') assert.equal(order.deliveredCount, 2);
    if (type === 'LARGE') {
      assert.equal(order.requiredTransport, 'CAR');
      assert.ok(order.reward >= 150 * ORDER_TYPES.LARGE.money);
      assert.ok(order.deliveryTime >= 60 * ORDER_TYPES.LARGE.timer);
      assert.ok(order.xpReward >= 15 * ORDER_TYPES.LARGE.xp);
    }
  }
});

test('residential walking excludes the farthest client; Center broadens that pool', () => {
  const { state, orders } = setup();
  let call = 0; orders.random = () => [0, .999, 0][call++] ?? 0;
  orders.generate();
  const restaurant = orders.order.restaurant;
  const farthest = [...customers].sort((a, b) => Math.hypot(a.x - restaurant.x, a.y - restaurant.y) - Math.hypot(b.x - restaurant.x, b.y - restaurant.y)).at(-1);
  assert.notEqual(orders.order.customer.id, farthest.id);
  state.unlockDistrict('center'); state.selectDistrict('center');
  call = 0; orders.order = null; orders.generate(); assert.equal(orders.order.customer.id, farthest.id);
});

test('weather adapts on switching, transport effects expire, eligibility and Center weights apply', () => {
  const { state, orders, events, advance } = setup();
  const resolve = id => { events.active = { event: EVENTS.find(e => e.id === id), resume: () => {} }; events.resolve(); events.finish(); };
  resolve('rain');
  for (const t of TRANSPORTS) {
    state.equipTransport(t.id); assert.equal(events.modifiers.speed(t.id), t.weatherModifier);
    for (const e of EVENTS.filter(e => e.requirements?.transports)) {
      events.negativeStreak = 0;
      assert.equal(events.eligible(e), e.requirements.transports.includes(t.id));
    }
  }
  advance(B.rainDuration * 1000); assert.equal(events.modifiers.speed('CAR'), 1);
  resolve('traffic'); assert.equal(events.modifiers.speed('CAR'), B.trafficSpeed); assert.equal(events.modifiers.speed('MOPED'), 1);
  advance(B.trafficDuration * 1000); assert.equal(events.modifiers.speed('CAR'), 1);
  orders.generate(); orders.accept();
  const deadline = orders.order.deadline; resolve('parking'); assert.equal(orders.order.deadline, deadline - B.parkingTime * 1000);
  resolve('car-large'); assert.equal(state.getSnapshot().largeOrderBoost, B.largeOrderBoost);
  orders.order.status = 'DELIVERED'; state.equipTransport('MOPED');
  forceOrder(orders, 'URGENT'); assert.equal(state.getSnapshot().largeOrderBoost, B.largeOrderBoost);
  orders.order.status = 'DELIVERED'; state.equipTransport('CAR'); orders.order = null; orders.generate();
  assert.equal(state.getSnapshot().largeOrderBoost, 0);
  assert.ok(transportFor('CAR').eventModifiers.parking.center > 1);
});

test('fragile protection composes with thermobag and a positive minimum risk', () => {
  for (const t of TRANSPORTS) {
    const { state } = setup(t.id);
    assert.equal(fragileDamageRisk(state.getSnapshot()), B.fragileDamageRisk * t.fragileModifier);
    state.purchaseItem('thermobag');
    assert.equal(fragileDamageRisk(state.getSnapshot()), Math.max(B.fragileMinimumRisk, B.fragileDamageRisk * t.fragileModifier * B.bagRisk));
    assert.ok(fragileDamageRisk(state.getSnapshot()) >= B.fragileMinimumRisk);
  }
});

test('version 5 roundtrips all vehicles, equipment, milestones and safe legacy migration', () => {
  for (const id of ['MOPED', 'CAR']) {
    const { state } = setup(id); state.purchaseItem('thermobag'); state.markTransportMilestone('MOPED'); state.setLargeOrderBoost(B.largeOrderBoost);
    const loaded = new GameState(); loaded.loadSaveData(JSON.parse(JSON.stringify(state.getSaveData())));
    assert.deepEqual(loaded.getSaveData(), state.getSaveData());
    assert.equal(loaded.markTransportMilestone('MOPED'), false);
  }
  for (const old of [{ transport: 'BICYCLE' }, { ownedItems: ['bicycle'], equippedItems: { TRANSPORT: 'bicycle' } }]) {
    const state = new GameState(); state.loadSaveData(old);
    assert.deepEqual(state.getSnapshot().ownedTransports, ['WALKING', 'BICYCLE']);
    assert.equal(state.getSnapshot().movementSpeed, 250);
  }
  const state = new GameState();
  state.loadSaveData({ ownedTransports: ['__proto__', 'CAR', 'CAR', null], equippedTransport: 'MOPED', transportMilestones: ['CAR', 'nonsense'], movementSpeed: 999 });
  assert.deepEqual(state.getSnapshot().ownedTransports, ['WALKING', 'CAR']); assert.equal(state.getSnapshot().equippedTransport, 'WALKING');
  const snapshot = state.getSnapshot(); snapshot.ownedTransports.push('MOPED'); snapshot.transportMilestones.push('MOPED');
  assert.deepEqual(state.getSnapshot().transportMilestones, ['CAR']);
});

test('career follows permanent ownership and goals advance independently of equipped transport', () => {
  const state = new GameState(); state.update({ money: 50000000, xp: xpForLevel(10) });
  state.values.completedOrders = 15; state.refresh();
  const expected = ['Пеший курьер', 'Велокурьер', 'Велокурьер', 'Автокурьер'];
  for (const t of TRANSPORTS) {
    if (t.id !== 'WALKING') state.purchaseTransport(t.id);
    assert.equal(careerTitle(state.getSnapshot()), expected[TRANSPORTS.indexOf(t)]);
    assert.equal(nextTransportGoal(state.getSnapshot())?.id, TRANSPORTS[TRANSPORTS.indexOf(t) + 1]?.id);
    state.equipTransport('WALKING'); assert.equal(careerTitle(state.getSnapshot()), expected[TRANSPORTS.indexOf(t)]);
  }
});
