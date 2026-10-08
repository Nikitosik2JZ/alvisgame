import test from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '../src/config/gameBalance.js';
import { GameState } from '../src/state/GameState.js';
import { ShopManager } from '../src/managers/ShopManager.js';
import { OrderManager } from '../src/managers/OrderManager.js';
import { EventManager } from '../src/managers/EventManager.js';
import { EVENTS } from '../src/data/events.js';
import { restaurants, customers } from '../src/world/deliveryLocations.js';

test('shop APIs reject every vehicle without touching ownership or money', () => {
  const state = new GameState();
  state.update({money:100000,xp:10000});
  const shop = new ShopManager(state), before = state.getSaveData();
  for (const id of ['bicycle','BICYCLE','MOPED','CAR','WALKING']) {
    assert.equal(shop.purchase(id).ok,false);
    assert.equal(shop.equip(id).ok,false);
  }
  assert.deepEqual(state.getSaveData(),before);
  assert.equal(state.purchaseTransport('BICYCLE').ok,true);
  assert.deepEqual(state.getSnapshot().ownedItems,[]);
  assert.equal('TRANSPORT' in state.getSnapshot().equippedItems,false);
});

test('double delivery counts one completed order, full route and payout; failure counts once', () => {
  let now = 0;
  const state = new GameState();
  state.update({money:BALANCE.bicyclePrice,xp:250});state.purchaseTransport('BICYCLE');
  let calls = 0;
  const orders = new OrderManager({state,restaurants,customers,now:()=>now,random:()=>++calls===3?.99:0});
  orders.generate();assert.equal(orders.order.type,'DOUBLE');orders.accept();
  orders.interact(orders.order.restaurant);orders.interact(orders.order.customer);
  assert.equal(state.getSnapshot().completedOrders,0);
  assert.equal(state.getSnapshot().totalMoneyEarned,0);
  orders.interact(orders.order.customer);orders.interact(orders.order.customer);
  assert.equal(state.getSnapshot().completedOrders,1);
  assert.equal(state.getSnapshot().totalMoneyEarned,orders.order.reward);
  assert.equal(state.getSnapshot().totalDistanceDelivered,orders.order.distance);
  orders.generate();orders.accept();now+=orders.order.deliveryTime*1000+1;
  orders.update();orders.update();
  assert.equal(state.getSnapshot().failedOrders,1);
  assert.equal(state.getSnapshot().completedOrders,1);
});

test('event tips and actual fines count once; purchases and debug credits are excluded', () => {
  const state = new GameState();
  const orders = new OrderManager({state,restaurants,customers,random:()=>0});
  const events = new EventManager(state,orders,()=>.99);
  state.update({money:17});
  events.active={event:EVENTS.find(e=>e.id==='cola'),pausedAt:0};
  events.resolve();events.resolve();
  assert.equal(state.getSnapshot().totalFinesPaid,17);
  assert.equal(state.getSnapshot().money,0);
  events.active={event:EVENTS.find(e=>e.id==='generous'),pausedAt:0};
  events.resolve();events.resolve();
  const s=state.getSnapshot();
  assert.ok(s.totalTipsEarned>0);
  assert.equal(s.totalMoneyEarned,s.totalTipsEarned);
  state.update({money:1000});state.purchaseItem('old-shoes');
  assert.equal(state.getSnapshot().totalMoneyEarned,s.totalMoneyEarned);
  assert.equal(state.getSnapshot().totalFinesPaid,17);
});

test('statistics roundtrip, default to zero in old saves and reject invalid values', () => {
  const state = new GameState();
  state.addRewards({reward:200,xpReward:20,reputationReward:1,distance:120});
  state.applyEventMoney(50,true);state.applyEventMoney(-35);state.failOrder(2);
  const restored = new GameState();restored.loadSaveData(JSON.parse(JSON.stringify(state.getSaveData())));
  assert.deepEqual(restored.getSaveData(),state.getSaveData());
  restored.loadSaveData({version:4,ownedItems:['bicycle','thermobag'],equippedItems:{TRANSPORT:'bicycle',BAG:'thermobag'}});
  const old=restored.getSnapshot();
  assert.deepEqual(old.ownedItems,['thermobag']);assert.ok(old.ownedTransports.includes('BICYCLE'));
  for(const key of ['completedOrders','failedOrders','totalMoneyEarned','totalTipsEarned','totalFinesPaid','totalDistanceDelivered']) assert.equal(old[key],0);
  restored.loadSaveData({completedOrders:-3,failedOrders:NaN,totalMoneyEarned:'800',totalTipsEarned:Infinity,totalFinesPaid:3.9});
  assert.equal(restored.getSnapshot().completedOrders,0);assert.equal(restored.getSnapshot().failedOrders,0);
  assert.equal(restored.getSnapshot().totalMoneyEarned,0);assert.equal(restored.getSnapshot().totalTipsEarned,0);
  assert.equal(restored.getSnapshot().totalFinesPaid,3);
});
