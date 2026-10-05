import test from 'node:test';
import assert from 'node:assert/strict';
import { GameState } from '../src/state/GameState.js';
import { ShopManager } from '../src/managers/ShopManager.js';
import { calculateDeliveryReward } from '../src/managers/DeliveryRewards.js';
import { OrderManager } from '../src/managers/OrderManager.js';
import { restaurants, customers } from '../src/world/deliveryLocations.js';
import { BALANCE } from '../src/config/gameBalance.js';

test('purchases validate funds, prerequisite, level and duplicate ownership atomically', () => {
  const state = new GameState();
  const shop = new ShopManager(state);
  const unchanged = state.getSaveData();
  assert.match(shop.purchase('old-shoes').reason, /Не хватает/);
  assert.match(shop.purchase('good-shoes').reason, /Сначала/);
  assert.match(shop.purchase('bicycle').reason, /Предмет не найден/);
  assert.deepEqual(state.getSaveData(), unchanged);
  assert.equal(shop.getItemState('bicycle').status, 'LOCKED');
  state.update({ money: 300 });
  assert.equal(shop.purchase('old-shoes').ok, true);
  assert.equal(state.getSnapshot().money, 0);
  const after = state.getSaveData();
  assert.equal(shop.purchase('old-shoes').ok, false);
  assert.deepEqual(state.getSaveData(), after);
  state.update({ money: 899 });
  assert.equal(shop.purchase('good-shoes').ok, false);
  state.update({ money: 900 });
  assert.equal(shop.purchase('good-shoes').ok, true);
});

test('one equipment slot replaces bonuses, preserves ownership, and updates subscribers immediately', () => {
  const state = new GameState();
  const shop = new ShopManager(state);
  let latest;
  state.subscribe(snapshot => { latest = snapshot; });
  state.update({ money: 1200 });
  shop.purchase('old-shoes');
  assert.equal(latest.movementSpeed, 168);
  shop.purchase('good-shoes');
  assert.equal(latest.movementSpeed, 176);
  assert.deepEqual(latest.ownedItems, ['old-shoes', 'good-shoes']);
  assert.equal(shop.getItemState('old-shoes').status, 'OWNED');
  assert.equal(shop.getItemState('good-shoes').status, 'EQUIPPED');
  shop.equip('old-shoes');
  assert.equal(latest.movementSpeed, 168);
  assert.equal(shop.equip('thermobag').ok, false);
  // Snapshot consumers cannot mutate centralized equipment or ownership.
  latest.ownedItems.push('bicycle'); latest.equippedItems.SHOES = 'good-shoes';
  assert.equal(state.getSnapshot().movementSpeed, 168);
  assert.equal(state.getSnapshot().ownedItems.includes('bicycle'), false);
});

test('bicycle requires level and money, equips immediately, and ignores shoe bonuses', () => {
  const state = new GameState();
  state.update({ money: 10000 });
  assert.equal(state.purchaseTransport('BICYCLE').ok, false);
  state.update({ xp: 250, money: 3499 });
  assert.match(state.purchaseTransport('BICYCLE').reason, /Не хватает/);
  state.update({ money: 4700 });
  state.purchaseItem('old-shoes'); state.purchaseItem('good-shoes');
  assert.equal(state.purchaseTransport('BICYCLE').ok, true);
  assert.equal(state.getSnapshot().money, 0);
  assert.equal(state.getSnapshot().transport, 'BICYCLE');
  assert.equal(state.getSnapshot().movementSpeed, 250);
  state.equipTransport('WALKING');
  assert.equal(state.getSnapshot().movementSpeed, 176);
  assert.equal(state.getSnapshot().transport, 'WALKING');
  state.equipTransport('BICYCLE');
  assert.equal(state.getSnapshot().movementSpeed, 250);
});

test('thermobag increases only successful delivery payment once, including while cycling', () => {
  let now = 0;
  const state = new GameState();
  state.update({ money: 4700, xp: 250 });
  state.purchaseItem('thermobag'); state.purchaseTransport('BICYCLE');
  assert.deepEqual(calculateDeliveryReward(200, state.getSnapshot()), { baseReward: 200, modifiers: [{ id: 'thermobag', name: 'Термосумка', amount: 20 }], total: 220 });
  const manager = new OrderManager({ state, restaurants, customers, now: () => now, random: () => 0 });
  manager.generate(); manager.accept();
  const base = manager.order.reward;
  assert.equal(state.getSnapshot().money, 0);
  manager.interact(manager.order.restaurant); manager.interact(manager.order.customer);
  assert.equal(state.getSnapshot().money, base + Math.round(base * .1));
  assert.equal(manager.order.reward, base);
  assert.equal(manager.interact(manager.order.customer), false);
  const before = state.getSnapshot();
  now += BALANCE.nextOrderDelay; manager.update(); manager.accept();
  manager.interact(manager.order.restaurant);
  now += manager.order.deliveryTime * 1000; manager.update();
  assert.equal(manager.order.status, 'FAILED');
  assert.equal(state.getSnapshot().money, before.money);
  assert.equal(state.getSnapshot().xp, before.xp);
  assert.equal(state.getSnapshot().reputation, before.reputation - 2);
  state.unequipCategory('BAG');
  assert.equal(calculateDeliveryReward(200, state.getSnapshot()).total, 200);
});

test('versioned saves roundtrip progression, migrate old saves and reject malformed equipment', () => {
  const state = new GameState();
  state.update({ money: 8000, xp: 300 });
  for (const id of ['old-shoes', 'good-shoes', 'thermobag']) state.purchaseItem(id);
  state.purchaseTransport('BICYCLE');
  const restored = new GameState();
  restored.loadSaveData(JSON.parse(JSON.stringify(state.getSaveData())));
  assert.deepEqual(restored.getSaveData(), state.getSaveData());
  restored.loadSaveData({ money: 100, xp: 100, level: 99, reputation: -2 });
  assert.equal(restored.getSnapshot().level, 2);
  assert.equal(restored.getSnapshot().movementSpeed, 160);
  assert.deepEqual(restored.getSnapshot().ownedItems, []);
  restored.loadSaveData({ ownedItems: ['bicycle', 'bicycle', 'unknown', 'thermobag', null], equippedItems: { SHOES: 'bicycle', BAG: 'good-shoes', TRANSPORT: 'bicycle' }, movementSpeed: 9999 });
  assert.deepEqual(restored.getSnapshot().ownedItems, ['thermobag']);
  assert.ok(restored.getSnapshot().ownedTransports.includes('BICYCLE'));
  assert.equal('TRANSPORT' in restored.getSnapshot().equippedItems, false);
  assert.equal(restored.getSnapshot().equippedItems.SHOES, null);
  assert.equal(restored.getSnapshot().equippedItems.BAG, null);
  assert.equal(restored.getSnapshot().movementSpeed, 250);
  restored.loadSaveData({ ownedItems: ['bicycle'], transport: 'BICYCLE' });
  assert.equal(restored.getSnapshot().transport, 'BICYCLE');
});

test('representative economy reaches first shoes in two deliveries and full bicycle path within 24', () => {
  const state = new GameState();
  const rewards = [];
  for (let r = 0; r < restaurants.length; r++) for (let c = 0; c < customers.length; c++) {
    let pick = 0;
    const manager = new OrderManager({ state, restaurants, customers, random: () => pick++ === 0 ? (r + .5) / restaurants.length : (c + .5) / customers.length });
    manager.generate(); rewards.push(manager.order);
  }
  const average = Math.round(rewards.reduce((sum, order) => sum + order.reward, 0) / rewards.length);
  const xp = Math.round(rewards.reduce((sum, order) => sum + order.xpReward, 0) / rewards.length);
  const path = ['old-shoes', 'good-shoes', 'thermobag', 'bicycle'];
  let firstUpgrade;
  for (let delivery = 1; delivery <= 24 && path.length; delivery++) {
    state.addRewards({ reward: calculateDeliveryReward(average, state.getSnapshot()).total, xpReward: xp, reputationReward: 1 });
    if ((path[0] === 'bicycle' ? state.purchaseTransport('BICYCLE') : state.purchaseItem(path[0])).ok) {
      if (!firstUpgrade) firstUpgrade = delivery;
      path.shift();
    }
  }
  assert.equal(firstUpgrade, 2);
  assert.equal(path.length, 0);
  assert.equal(state.getSnapshot().transport, 'BICYCLE');
});
