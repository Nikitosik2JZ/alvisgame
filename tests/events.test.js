import test from 'node:test';
import assert from 'node:assert/strict';
import { GameState } from '../src/state/GameState.js';
import { OrderManager } from '../src/managers/OrderManager.js';
import { EventManager } from '../src/managers/EventManager.js';
import { TemporaryModifiers } from '../src/managers/TemporaryModifiers.js';
import { EVENTS } from '../src/data/events.js';
import { ORDER_TYPES, reputationTier } from '../src/config/economyConfig.js';
import { restaurants, customers } from '../src/world/deliveryLocations.js';
import { xpForLevel, BALANCE } from '../src/config/gameBalance.js';
import { transportFor } from '../src/config/transportConfig.js';

function setup(type = 'STANDARD', district = 'residential') {
  let time = 0;
  const state = new GameState(); state.update({ xp: 450 });
  if (type === 'DOUBLE' || type === 'LARGE') {
    const transport = transportFor(type === 'LARGE' ? 'CAR' : 'BICYCLE');
    state.update({ xp: xpForLevel(transport.requiredLevel), money: transport.purchasePrice }); state.purchaseTransport(transport.id);
  }
  if (district === 'center') { state.update({ money: 3000 }); state.unlockDistrict('center'); state.selectDistrict('center'); }
  if (type === 'ELITE') {
    state.update({ xp: xpForLevel(12), reputation: 60, money: 18000 });
    state.unlockDistrict('elite'); state.selectDistrict('elite');
  }
  const roll = { STANDARD: 0, URGENT: .7, FRAGILE: .9, DOUBLE: .99, LARGE: .99 }[type];
  let calls = 0;
  const orders = new OrderManager({ state, restaurants, customers, now: () => time, random: () => ++calls === 3 ? roll : 0 });
  orders.generate(type === 'ELITE' ? { forcedType: 'ELITE' } : {});
  const events = new EventManager(state, orders, () => .99, () => time);
  orders.accept(); orders.interact(orders.order.restaurant);
  return { state, orders, events, advance: ms => { time += ms; orders.update(); } };
}
const show = (events, id, choice = 0, resume = () => {}) => {
  events.active = { event: EVENTS.find(e => e.id === id), resume };
  const result = events.resolve(choice); events.finish(); return result;
};

test('all order types preserve pickup, deadline and single final payment; double has two distinct stops', () => {
  for (const type of Object.keys(ORDER_TYPES)) {
    const { state, orders } = setup(type);
    assert.equal(orders.order.type, type);
    const order = orders.order;
    orders.interact(order.customer);
    if (type === 'DOUBLE') {
      assert.equal(state.getSnapshot().money, 0); assert.equal(order.deliveredCount, 1);
      assert.notEqual(order.customers[0].id, order.customers[1].id);
      orders.interact(order.customer);
    }
    assert.equal(order.status, 'DELIVERED'); assert.equal(state.getSnapshot().money, order.reward);
    assert.equal(orders.interact(order.customer), false);
  }
});

test('district purchase requires both level and money, costs once, and roundtrips with demand/old saves', () => {
  const state = new GameState(); state.update({ money: 5000 }); assert.equal(state.unlockDistrict('center'), false);
  state.update({ xp: 450, money: 2999 }); assert.equal(state.unlockDistrict('center'), false);
  state.update({ money: 3000 }); assert.equal(state.unlockDistrict('center'), true);
  assert.equal(state.getSnapshot().money, 0); assert.equal(state.unlockDistrict('center'), false);
  state.selectDistrict('center'); state.setDemand(3);
  const saved = state.getSaveData(), restored = new GameState(); restored.loadSaveData(saved);
  assert.deepEqual(restored.getSaveData(), saved);
  assert.equal(saved.version, 8); assert.equal('active' in saved, false);
  restored.loadSaveData({ version: 2, money: 20, reputation: 50 });
  assert.equal(restored.getSnapshot().selectedDistrict, 'residential'); assert.equal(restored.getSnapshot().demandBonusOrders, 0);
  restored.loadSaveData({ unlockedDistricts: ['nonsense', 'toString', '__proto__'], selectedDistrict: 'center', demandBonusOrders: Infinity });
  assert.deepEqual(restored.getSnapshot().unlockedDistricts, ['residential']);
});

test('center payout/XP multiply matching standard route', () => {
  const center = setup('STANDARD', 'center'), meters = center.orders.order.distance;
  const money = Math.min(BALANCE.maxReward, Math.max(BALANCE.minReward, Math.round(BALANCE.baseReward + meters * BALANCE.moneyPerMeter)));
  const xp = Math.min(BALANCE.maxXP, Math.max(BALANCE.baseXP, Math.round(BALANCE.baseXP + meters * BALANCE.xpPerMeter)));
  assert.equal(center.orders.order.reward, Math.round(money * 1.3));
  assert.equal(center.orders.order.xpReward, Math.round(xp * 1.15));
});

test('fines clamp money and display nominal and actual deduction; support reputation tiers use configured chances', () => {
  const { state, events } = setup(); state.update({ money: 100 });
  assert.match(show(events, 'cola'), /250 ₽\nСписано: 100 ₽\nБаланс исчерпан/);
  assert.equal(state.getSnapshot().money, 0); assert.equal(state.getSnapshot().reputation, -2);
  for (const [rep, roll, win] of [[0, .09, true], [0, .11, false], [20, .24, true], [20, .26, false], [50, .44, true], [50, .46, false]]) {
    state.update({ money: 1000, reputation: rep }); events.random = () => roll;
    const result = show(events, 'cola'); assert.equal(result.includes('Штраф отменён'), win);
  }
  assert.deepEqual([0,20,50,100].map(v => reputationTier(v).name), ['Новичок','Надёжный курьер','Любимчик клиентов','Легенда доставки']);
});

test('negative streak, cooldown, no-repeat, bicycle and equipment requirements', () => {
  const { state, events } = setup();
  show(events, 'entrance'); show(events, 'barrier');
  for (const event of EVENTS.filter(e => e.category === 'NEGATIVE')) assert.equal(events.eligible(event), false);
  events.debug('POSITIVE'); assert.equal(events.active.event.category, 'POSITIVE'); events.resolve(); events.finish();
  assert.equal(events.negativeStreak, 0);
  show(events, 'cola'); assert.equal(events.eligible(EVENTS.find(e => e.id === 'cola')), false);
  for (let i=0; i<4; i++) show(events, 'green');
  assert.equal(events.eligible(EVENTS.find(e => e.id === 'cola')), false);
  show(events, 'green');
  assert.equal(events.eligible(EVENTS.find(e => e.id === 'cola')), true);
  assert.equal(events.eligible(EVENTS.find(e => e.id === 'puncture')), false);
  events.orders.order.status = 'DELIVERED'; // Vehicle changes now require finishing the active order.
  state.update({ money: 3500 }); state.purchaseTransport('BICYCLE');
  assert.equal(events.eligible(EVENTS.find(e => e.id === 'puncture')), true);
  events.lastId = 'green'; events.debug('POSITIVE'); assert.notEqual(events.active.event.id, 'green'); events.resolve(); events.finish();
  const food = EVENTS.find(e => e.id === 'soup'), green = EVENTS.find(e => e.id === 'green');
  events.random = () => .3; events.negativeStreak = 0;
  assert.equal(events.weighted([food, green]).id, 'soup');
  state.update({ money: 1200 }); state.purchaseItem('thermobag');
  assert.equal(events.weighted([food, green]).id, 'green');
});

test('choice consequences, expiry caused by stairs, fries both branches, delivery continuation runs once', () => {
  const { state, orders, events, advance } = setup();
  events.random = () => 0;
  assert.match(show(events, 'fries', 1), /картошку/); assert.equal(state.getSnapshot().reputation, -5);
  events.random = () => .99; assert.match(show(events, 'fries', 1), /без свидетелей/);
  show(events, 'fries', 0); assert.equal(state.getSnapshot().reputation, -4);
  const before = orders.order.deadline;
  show(events, 'silent', 0); assert.equal(orders.order.deadline, before - 15000);
  assert.match(show(events, 'lift', 1), /Без штрафов/);
  advance(orders.remainingSeconds() * 1000 - 1000);
  show(events, 'lift', 0, () => orders.completeStop());
  assert.equal(orders.order.status, 'FAILED'); assert.equal(state.getSnapshot().money, 0);
  const next = setup(); next.events.pending = EVENTS.find(e => e.id === 'silent');
  next.orders.interact(next.orders.order.customer); assert.equal(next.orders.order.status, 'PICKED_UP');
  assert.equal(next.orders.interact(next.orders.order.customer), false);
  next.events.resolve(1); const rep = next.state.getSnapshot().reputation;
  assert.equal(next.events.resolve(1), undefined); assert.equal(next.state.getSnapshot().reputation, rep);
  next.events.finish(); const money = next.state.getSnapshot().money; next.events.finish();
  assert.equal(next.state.getSnapshot().money, money); assert.equal(next.orders.order.status, 'DELIVERED');
});

test('demand applies to next three successes, failure does not consume it; close-order generation', () => {
  const { state, orders, events, advance } = setup(); show(events, 'demand'); orders.interact(orders.order.customer);
  assert.equal(state.getSnapshot().demandBonusOrders, 3);
  for (let i = 3; i > 0; i--) {
    advance(3000); orders.accept(); orders.interact(orders.order.restaurant);
    const money = state.getSnapshot().money, base = orders.order.reward;
    orders.interact(orders.order.customer);
    assert.equal(state.getSnapshot().money - money, base + Math.round(base * .25));
    assert.equal(state.getSnapshot().demandBonusOrders, i - 1);
  }
  state.setDemand(2); advance(3000); orders.accept(); advance(200000); assert.equal(state.getSnapshot().demandBonusOrders, 2);
  show(events, 'close'); advance(3000);
  const restaurant = orders.order.restaurant;
  assert.equal(orders.order.customer.id, [...customers].sort((a,b) => Math.hypot(a.x-restaurant.x,a.y-restaurant.y)-Math.hypot(b.x-restaurant.x,b.y-restaurant.y))[0].id);
});

test('temporary duplicate effects refresh instead of stacking, expire, and never enter saves', () => {
  let now=0; const modifiers = new TemporaryModifiers(() => now);
  modifiers.add('green', 1.15, 30); modifiers.add('green', 1.15, 30); assert.equal(modifiers.speed(), 1.15);
  now=30000; assert.equal(modifiers.speed(), 1);
  modifiers.add('puncture', .65, 25, 'BICYCLE'); assert.equal(modifiers.speed('WALKING'), 1); assert.equal(modifiers.speed('BICYCLE'), .65);
  const { events, state } = setup(); for(let i=0;i<7;i++) show(events,'green');
  assert.equal(events.history.length, 5); assert.equal('modifiers' in state.getSaveData(), false);
});

test('positive ranges, high reputation tips, food deduction and modal pause remain explicit', () => {
  const { events, orders, state, advance } = setup();
  events.random = () => 0; show(events, 'generous'); assert.equal(state.getSnapshot().money, 100);
  show(events, 'big-tips'); assert.equal(state.getSnapshot().money, 900);
  show(events, 'thanks'); assert.equal(state.getSnapshot().reputation, 3);
  state.update({ reputation: 100 }); show(events, 'generous'); assert.equal(state.getSnapshot().money, 1015);
  show(events, 'favorite'); assert.equal(state.getSnapshot().money, 1215); assert.equal(state.getSnapshot().reputation, 102);
  show(events, 'soup'); assert.equal(orders.order.paymentPenalty, -.3);
  events.pending = EVENTS.find(e => e.id === 'silent'); orders.interact(orders.order.customer);
  const seconds = orders.remainingSeconds(); advance(120000);
  assert.equal(orders.remainingSeconds(), seconds); assert.equal(orders.order.status, 'PICKED_UP');
  events.resolve(1); events.finish(); assert.equal(orders.order.status, 'DELIVERED');
});

test('configured probability buckets and fragile protection are deterministic', () => {
  const { events } = setup();
  for (const [roll, rarity] of [[.1,'COMMON'],[.22,'UNCOMMON'],[.26,'RARE'],[.29,'VERY_RARE'],[.8,null]]) {
    events.random = () => roll; events.prepare(); assert.equal(events.pending?.rarity || null, rarity);
  }
  for (const bag of [false, true]) {
    const { events, orders, state } = setup('FRAGILE');
    if (bag) { state.update({ money:1200 }); state.purchaseItem('thermobag'); }
    events.random=()=>.04; events.trigger('customer');
    assert.equal(Boolean(events.active), !bag);
  }
});
