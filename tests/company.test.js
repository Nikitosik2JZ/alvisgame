import test from 'node:test';
import assert from 'node:assert/strict';
import { GameState } from '../src/state/GameState.js';
import { CompanyManager } from '../src/managers/CompanyManager.js';
import { COMPANY } from '../src/config/companyConfig.js';
import { xpForLevel } from '../src/config/gameBalance.js';
import { careerTitle } from '../src/config/transportConfig.js';

function fixture(open = true) {
  let wall = 1800000000000, monotonic = 0;
  const state = new GameState();
  const company = new CompanyManager(state, { wallNow: () => wall, now: () => monotonic, random: () => 0 });
  state.update({ money: 200000, xp: xpForLevel(COMPANY.unlockLevel) });
  if (open) assert.equal(company.openCompany('Быстрая доставка').ok, true);
  return { state, company, advance(ms) { wall += ms; monotonic += ms; }, wallShift(ms) { wall += ms; } };
}

test('opening requires BOTH level and money, debits once and normalizes names', () => {
  const { state, company } = fixture(false);
  state.update({ xp: xpForLevel(COMPANY.unlockLevel - 1) });
  assert.equal(company.openCompany('Тест').ok, false); assert.equal(state.values.money, 200000);
  state.update({ xp: xpForLevel(COMPANY.unlockLevel), money: COMPANY.unlockPrice - 1 });
  assert.equal(company.openCompany('Тест').ok, false); assert.equal(state.values.companyUnlocked, false);
  state.update({ money: COMPANY.unlockPrice });
  assert.equal(company.openCompany('  Доставка\n' + 'я'.repeat(30)).ok, true);
  assert.equal(state.values.money, 0); assert.equal(Array.from(state.values.companyName).length, 20);
  assert.equal(company.openCompany('Дубликат').ok, false); assert.equal(state.values.money, 0);
  company.rename('   '); assert.equal(state.values.companyName, COMPANY.defaultName);
  company.rename('<img src=x>'); assert.equal(state.values.companyName, '<img src=x>');
});

test('closed company rejects every business transaction', () => {
  const { state, company } = fixture(false), before = state.getSaveData();
  for (const action of [() => company.hire(), () => company.buyVehicle('BICYCLE'), () => company.assignVehicle('a'), () => company.collect(), () => company.upgrade(), () => company.rename('X')]) assert.equal(action().ok, false);
  assert.deepEqual(state.getSaveData(), before);
});

test('hiring charges personal money, enforces capacity and starts walking work', () => {
  const { state, company } = fixture(); state.update({ money: COMPANY.hireCost - 1 });
  assert.equal(company.hire().ok, false); assert.equal(state.values.employees.length, 0);
  state.update({ money: COMPANY.hireCost * 3 });
  assert.equal(company.hire().ok, true); assert.equal(company.hire({ name: 'Аня' }).ok, true);
  const money = state.values.money; assert.equal(company.hire().ok, false); assert.equal(state.values.money, money);
  assert.equal(state.values.companyStats.employeesHired, 2);
  assert.equal(new Set(state.values.employees.map(e => e.id)).size, 2);
  assert.equal(state.values.employees[0].status, 'WORKING'); assert.equal(state.values.employees[0].assignedTransport, null);
  assert.equal(company.incomeRate(), 200);
});

test('company fleet stays separate from personal ownership and money is validated', () => {
  const { state, company } = fixture(); state.purchaseTransport('CAR'); state.purchaseTransport('BICYCLE');
  const personal = state.getSnapshot().ownedTransports; assert.deepEqual(state.values.companyVehicles, []);
  state.update({ money: 2999 }); assert.equal(company.buyVehicle('BICYCLE').ok, false);
  assert.equal(company.buyVehicle('CAR').ok, false);
  state.update({ money: 11000 }); assert.equal(company.buyVehicle('BICYCLE').ok, true); assert.equal(company.buyVehicle('MOPED').ok, true);
  assert.equal(state.values.money, 0); assert.deepEqual(state.values.ownedTransports, personal);
  assert.equal(state.values.companyVehicles.length, 2);
});

test('assignment is exclusive, can be released and reassigned; rates reflect transport', () => {
  const { state, company } = fixture(); company.hire(); company.hire(); company.buyVehicle('BICYCLE'); company.buyVehicle('MOPED');
  const [first, second] = state.values.employees, [bicycle, moped] = state.values.companyVehicles;
  assert.equal(company.assignVehicle('unknown', bicycle.id).ok, false);
  assert.equal(company.assignVehicle(first.id, 'CAR').ok, false);
  assert.equal(company.assignVehicle(first.id, bicycle.id).ok, true); assert.equal(company.employeeRate(first), 180);
  assert.equal(company.assignVehicle(second.id, bicycle.id).ok, false);
  assert.equal(company.assignVehicle(first.id, null).ok, true); assert.equal(company.employeeRate(first), 100);
  assert.equal(company.assignVehicle(second.id, bicycle.id).ok, true);
  assert.equal(company.assignVehicle(first.id, moped.id).ok, true); assert.equal(company.incomeRate(), 480);
  first.efficiency = 0.5; assert.equal(company.employeeRate(first), 150);
  first.status = 'IDLE'; assert.equal(company.employeeRate(first), 0);
});

test('live income is elapsed-time based, fractional credit survives collection and saves', () => {
  const a = fixture(), b = fixture(); a.company.hire(); b.company.hire();
  const before = a.state.values.money;
  for (let i = 0; i < 60; i++) { a.advance(1000); a.company.tick(); }
  b.advance(60000); b.company.tick();
  assert.equal(a.state.values.companyBalance, 100); assert.equal(b.state.values.companyBalance, 100);
  assert.equal(a.state.values.money, before); assert.equal(a.state.values.companyLifetimeEarnings, 100);
  assert.equal(Math.round(a.state.values.employees[0].totalEarned), 100);
  assert.equal(a.company.collect().amount, 100); assert.equal(a.state.values.companyBalance, 0);
  assert.equal(a.state.values.money, before + 100); assert.equal(a.state.values.companyStats.totalIncomeCollected, 100);
  assert.equal(a.state.values.totalMoneyEarned, 0); assert.equal(a.company.collect().ok, false);
  a.advance(1000); a.company.tick(); assert.equal(a.state.values.companyBalance, 1);
  a.company.collect(); assert.ok(a.state.values.companyIncomeRemainder > 0.66);
  const loaded = new GameState(); loaded.loadSaveData(a.state.getSaveData());
  assert.equal(loaded.values.companyIncomeRemainder, a.state.values.companyIncomeRemainder);
  a.advance(59000); a.company.tick(); assert.equal(a.state.values.companyBalance, 99);
});

test('rate-changing mutations settle preceding time using the old rate', () => {
  const { state, company, advance } = fixture(); company.hire(); company.buyVehicle('BICYCLE');
  advance(60000); company.assignVehicle(state.values.employees[0].id, state.values.companyVehicles[0].id);
  assert.equal(state.values.companyBalance, 100);
  advance(60000); company.hire(); assert.equal(state.values.companyBalance, 280);
  advance(60000); company.tick(); assert.equal(state.values.companyBalance, 560);
});

test('monotonic live clock ignores wall-clock jumps and duplicate ticks', () => {
  const { state, company, advance, wallShift } = fixture(); company.hire();
  wallShift(86400000); company.tick(); assert.equal(state.values.companyBalance, 0);
  advance(60000); company.tick(); company.tick(); assert.equal(state.values.companyBalance, 100);
  wallShift(-86400000); company.tick(); assert.equal(state.values.companyBalance, 100);
});

test('storage caps live income at two hours, collection opens room without backlog', () => {
  const { state, company, advance } = fixture(); company.hire();
  advance(4 * 3600000); company.tick(); assert.equal(state.values.companyBalance, 12000);
  const total = state.values.companyLifetimeEarnings;
  advance(3600000); company.tick(); assert.equal(state.values.companyLifetimeEarnings, total);
  company.collect(); company.tick(); assert.equal(state.values.companyBalance, 0);
  advance(60000); company.tick(); assert.equal(state.values.companyBalance, 100);
});

test('offline earnings use saved timestamp, credit once and respect two-hour cap plus storage', () => {
  const { state, company, advance } = fixture(); company.hire(); advance(60000); company.tick();
  const saved = JSON.parse(JSON.stringify(state.getSaveData()));
  const loaded = new GameState(); loaded.loadSaveData(saved);
  let wall = saved.lastCompanyUpdateTimestamp + 3600000;
  const offline = new CompanyManager(loaded, { wallNow: () => wall, now: () => 0 });
  assert.equal(offline.resumeOffline(), 6000); assert.equal(loaded.values.companyBalance, 6100);
  assert.equal(offline.resumeOffline(), 0); assert.equal(loaded.values.companyBalance, 6100);
  const reloaded = new GameState(); reloaded.loadSaveData(loaded.getSaveData());
  assert.equal(new CompanyManager(reloaded, { wallNow: () => wall, now: () => 0 }).resumeOffline(), 0);
  loaded.loadSaveData(saved); wall += 30 * 86400000;
  assert.equal(offline.resumeOffline(), 11900); assert.equal(loaded.values.companyBalance, 12000);
  assert.equal(loaded.values.companyLifetimeEarnings, 12000);
});

test('invalid, missing, negative, string and future timestamps grant no offline income', () => {
  const { state, company } = fixture(); company.hire();
  for (const timestamp of [undefined, null, 0, -1, NaN, Infinity, '1800000000000', 1900000000000, 1800000000000.5]) {
    const loaded = new GameState(); loaded.loadSaveData({ ...state.getSaveData(), lastCompanyUpdateTimestamp: timestamp });
    const manager = new CompanyManager(loaded, { wallNow: () => 1800000000000, now: () => 0 });
    assert.equal(manager.resumeOffline(), 0, String(timestamp)); assert.equal(loaded.values.companyBalance, 0);
    assert.equal(loaded.values.lastCompanyUpdateTimestamp, 1800000000000);
  }
});

test('upgrades charge correct prices, increase slots and update career titles', () => {
  const { state, company } = fixture(); assert.equal(careerTitle(state.getSnapshot()), 'Предприниматель');
  state.update({ money: 14999 }); assert.equal(company.upgrade().ok, false);
  state.update({ money: 55000 }); assert.equal(company.upgrade().ok, true); assert.equal(state.values.money, 40000);
  assert.equal(careerTitle(state.getSnapshot()), 'Владелец службы доставки');
  for (let i = 0; i < 4; i++) company.hire(); assert.equal(company.hire().ok, false);
  state.update({ money: 40000 }); assert.equal(company.upgrade().ok, true); assert.equal(state.values.money, 0);
  assert.equal(careerTitle(state.getSnapshot()), 'Курьерский босс'); assert.equal(company.upgrade().ok, false);
  state.update({ money: 5000 }); company.hire(); company.hire(); assert.equal(state.values.employees.length, 6); assert.equal(company.hire().ok, false);
});

test('version 6 company data roundtrips and snapshots do not expose mutable nested data', () => {
  const { state, company, advance } = fixture(); company.hire(); company.buyVehicle('MOPED');
  company.assignVehicle(state.values.employees[0].id, state.values.companyVehicles[0].id); advance(60000); company.tick(); company.collect(); company.upgrade();
  const saved = JSON.parse(JSON.stringify(state.getSaveData())), loaded = new GameState(); loaded.loadSaveData(saved);
  assert.equal(saved.version, 6); assert.deepEqual(loaded.getSaveData(), saved);
  const snapshot = state.getSnapshot(); snapshot.employees[0].name = 'Changed'; snapshot.companyVehicles[0].type = 'CAR'; snapshot.companyStats.employeesHired = 1000; snapshot.companyLog.push('fake');
  assert.deepEqual(state.getSaveData(), saved);
});

test('old saves have safe company defaults and retain personal systems', () => {
  const state = new GameState();
  for (const version of [1, 2, 3, 4, 5]) {
    state.loadSaveData({ version, money: 1234, xp: 250, transport: 'BICYCLE', ownedItems: ['thermobag'], completedOrders: 7 });
    assert.equal(state.values.companyUnlocked, false); assert.equal(state.values.companyBalance, 0);
    assert.deepEqual(state.values.employees, []); assert.deepEqual(state.values.companyVehicles, []);
    assert.equal(state.values.money, 1234); assert.equal(state.values.equippedTransport, 'BICYCLE'); assert.equal(state.values.completedOrders, 7);
  }
});

test('malformed company saves discard invalid fleet, duplicate IDs and shared assignments', () => {
  const { state, company } = fixture(); company.hire(); company.hire(); company.buyVehicle('BICYCLE');
  const save = state.getSaveData(), vehicle = save.companyVehicles[0];
  save.companyName = {}; save.companyBalance = Infinity; save.companyLifetimeEarnings = -100; save.companyIncomeRemainder = NaN;
  save.companyStats = { employeesHired: -1, totalIncomeCollected: 'no' }; save.companyLog = [null, {}, 'ok'];
  save.companyVehicles.push(vehicle, { id: '__proto__', type: 'CAR' }, null);
  save.employees.forEach(e => { e.assignedTransport = vehicle.id; }); save.employees.push(save.employees[0], null);
  const loaded = new GameState(); assert.equal(loaded.loadSaveData(save), true);
  assert.equal(loaded.values.companyVehicles.length, 1); assert.equal(loaded.values.employees.length, 2);
  assert.equal(loaded.values.employees.filter(e => e.assignedTransport).length, 1);
  assert.equal(loaded.values.companyName, COMPANY.defaultName); assert.equal(loaded.values.companyBalance, 0);
  assert.equal(loaded.values.companyStats.employeesHired, 2); assert.deepEqual(loaded.values.companyLog, ['ok']);
  loaded.loadSaveData({ companyUnlocked: 'true', employees: save.employees }); assert.deepEqual(loaded.values.employees, []);
  assert.equal(loaded.loadSaveData([]), false); assert.equal(loaded.loadSaveData(null), false);
});

test('activity log is last five only and ordinary courier gameplay continues', () => {
  const { state, company, advance } = fixture(); company.hire();
  for (let i = 0; i < 6; i++) { advance(COMPANY.activityIntervalMs); company.tick(); company.collect(); }
  assert.equal(state.values.companyLog.length, 5);
  const money = state.values.money; state.addRewards({ reward: 300, xpReward: 40, reputationReward: 2, distance: 500 });
  assert.equal(state.values.money, money + 300); assert.equal(state.values.completedOrders, 1);
  assert.equal(state.values.totalMoneyEarned, 300); assert.equal(state.values.companyStats.employeesHired, 1);
});
