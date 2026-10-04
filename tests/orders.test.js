import test from 'node:test';
import assert from 'node:assert/strict';
import { GameState } from '../src/state/GameState.js';
import { OrderManager, ORDER_STATUS } from '../src/managers/OrderManager.js';
import { restaurants, customers } from '../src/world/deliveryLocations.js';
import { xpForLevel, BALANCE } from '../src/config/gameBalance.js';
import { ORDER_TYPES } from '../src/config/economyConfig.js';

function setup() {
  let time = 0;
  const state = new GameState();
  const manager = new OrderManager({ restaurants, customers, state, now: () => time, random: () => 0 });
  manager.generate();
  return { state, manager, advance: (ms) => { time += ms; manager.update(); } };
}

test('explicit acceptance, proximity, single reward, and next offer', () => {
  const { state, manager, advance } = setup();
  const first = manager.order;
  advance(300000);
  assert.equal(first.status, ORDER_STATUS.AVAILABLE);
  assert.equal(manager.interact(first.restaurant), false);
  assert.equal(manager.accept(), true);
  assert.equal(manager.accept(), false);
  assert.equal(manager.interact({ x: 1200, y: 1000 }), false);
  assert.equal(manager.interact(first.restaurant), true);
  assert.equal(first.status, ORDER_STATUS.PICKED_UP);
  assert.equal(manager.interact(first.customer), true);
  assert.equal(first.status, ORDER_STATUS.DELIVERED);
  assert.equal(manager.interact(first.customer), false);
  assert.deepEqual(state.getSnapshot(), { ...new GameState().getSnapshot(), money: first.reward, xp: first.xpReward, reputation: first.reputationReward });
  advance(BALANCE.nextOrderDelay);
  assert.equal(manager.order.status, ORDER_STATUS.AVAILABLE);
  assert.notEqual(manager.order.id, first.id);
});

test('expiry before pickup and after pickup; deadline beats delivery', () => {
  for (const pickup of [false, true]) {
    const { state, manager, advance } = setup();
    manager.accept();
    if (pickup) manager.interact(manager.order.restaurant);
    advance(manager.order.deliveryTime * 1000);
    assert.equal(manager.interact(manager.order.customer), false);
    assert.equal(manager.order.status, ORDER_STATUS.FAILED);
    assert.deepEqual(state.getSnapshot(), { ...new GameState().getSnapshot(), reputation: -2 });
    advance(1000);
    assert.equal(state.getSnapshot().reputation, -2);
    advance(BALANCE.nextOrderDelay);
    assert.equal(manager.order.status, ORDER_STATUS.AVAILABLE);
  }
});

test('XP boundaries, multi-level reward, serialization and invalid save data', () => {
  const state = new GameState();
  for (const level of [1, 2, 3, 4, 25]) {
    state.update({ xp: xpForLevel(level) });
    assert.equal(state.getSnapshot().level, level);
    if (level > 1) {
      state.update({ xp: xpForLevel(level) - 1 });
      assert.equal(state.getSnapshot().level, level - 1);
    }
  }
  state.loadSaveData({ xp: 90, level: 99, money: 5, reputation: -8 });
  state.addRewards({ reward: 180, xpReward: 400, reputationReward: 3 });
  assert.equal(state.getSnapshot().level, 4);
  const restored = new GameState();
  assert.equal(restored.loadSaveData(state.getSaveData()), true);
  assert.deepEqual(restored.getSaveData(), state.getSaveData());
  assert.equal(restored.loadSaveData(null), false);
  restored.loadSaveData({ money: NaN, xp: -10, reputation: Infinity });
  assert.deepEqual(restored.getSnapshot(), new GameState().getSnapshot());
});

test('all restaurant/customer pairs stay within prototype balance ranges', () => {
  for (let r = 0; r < restaurants.length; r++) for (let c = 0; c < customers.length; c++) {
    let pick = 0;
    const manager = new OrderManager({ restaurants, customers, state: new GameState(), random: () => pick++ === 0 ? (r + 0.5) / restaurants.length : (c + 0.5) / customers.length });
    manager.generate();
    const order = manager.order;
    const type = ORDER_TYPES[order.type];
    assert.ok(order.reward >= Math.round(BALANCE.minReward * type.money) && order.reward <= Math.round(BALANCE.maxReward * type.money));
    assert.ok(order.xpReward >= Math.round(BALANCE.baseXP * type.xp) && order.xpReward <= Math.round(BALANCE.maxXP * type.xp));
    assert.ok(order.reputationReward >= 1 + type.reputation && order.reputationReward <= 4 + type.reputation);
    assert.ok(order.deliveryTime >= 60 * type.timer && order.deliveryTime <= 120 * type.timer);
  }
});
