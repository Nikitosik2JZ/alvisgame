import test from 'node:test';
import assert from 'node:assert/strict';
import { GameState } from '../src/state/GameState.js';
import { CompanyManager } from '../src/managers/CompanyManager.js';
import { COMPANY, companyLevel, employeeXpRequired, companyRank } from '../src/config/companyConfig.js';
import { COMPANY_EVENTS, COMPANY_EVENT_BALANCE as B } from '../src/data/companyEvents.js';
import { xpForLevel } from '../src/config/gameBalance.js';
import { careerTitle } from '../src/config/transportConfig.js';

function fixture(open = true, random = () => .5) {
  let wall = 1800000000000, monotonic = 0;
  const state = new GameState();
  const company = new CompanyManager(state, { wallNow: () => wall, now: () => monotonic, random });
  state.update({ money: 2000000, xp: xpForLevel(COMPANY.unlockLevel) });
  if (open) assert.equal(company.openCompany('Быстрая доставка').ok, true);
  return { state, company, advance(ms) { wall += ms; monotonic += ms; }, wallShift(ms) { wall += ms; },
    hire() { if (!company.candidate()) company.refreshCandidates(true); return company.hire().employee; } };
}
const near = (actual, expected, epsilon = .00001) => assert.ok(Math.abs(actual - expected) < epsilon, `${actual} != ${expected}`);
function trigger(f, id, choice = 0) {
  const events = f.company.events;
  events.pending = null; assert.ok(events.debug(null, id), `queue ${id}`);
  events.onShow = () => {}; events.update(); assert.equal(events.active.event.id, id);
  const result = events.resolve(choice); if (result.ok) events.finish(); return result;
}

test('opening validates level/funds, charges once and treats names as text', () => {
  const f = fixture(false), { state, company } = f;
  state.update({ xp: xpForLevel(COMPANY.unlockLevel - 1) }); assert.equal(company.openCompany('x').ok, false);
  state.update({ xp: xpForLevel(COMPANY.unlockLevel), money: COMPANY.unlockPrice - 1 }); assert.equal(company.openCompany('x').ok, false);
  state.update({ money: COMPANY.unlockPrice }); assert.ok(company.openCompany(' \n' + 'я'.repeat(30)).ok);
  assert.equal(state.values.money, 0); assert.equal(Array.from(state.values.companyName).length, COMPANY.nameLimit);
  assert.equal(company.openCompany('again').ok, false); company.rename('<b>Текст</b>'); assert.equal(state.values.companyName, '<b>Текст</b>');
  company.rename(' '); assert.equal(state.values.companyName, COMPANY.defaultName);
});

test('closed company rejects business actions without mutation', () => {
  const { state, company } = fixture(false), before = state.getSaveData();
  for (const action of [() => company.hire(), () => company.refreshCandidates(), () => company.buyVehicle('CAR'),
    () => company.assignVehicle('a'), () => company.collect(), () => company.upgrade(), () => company.upgradeBranch('routing'), () => company.rename('X')]) assert.equal(action().ok, false);
  assert.deepEqual(state.getSaveData(), before); assert.equal(company.events.debug('POSITIVE'), false);
});

test('three distinct archetypes per generation, bounded stats and every archetype can be hired', () => {
  const seen = new Set();
  for (const roll of [0, .4, .8]) {
    const f = fixture(true, () => roll), s = f.state.values;
    assert.equal(s.companyCandidates.length, 3); assert.equal(new Set(s.companyCandidates.map(c => c.archetype)).size, 3);
    for (const candidate of [...s.companyCandidates]) {
      const config = COMPANY.archetypes[candidate.archetype]; seen.add(candidate.archetype);
      assert.equal(candidate.price, config.cost);
      for (const key of ['efficiency', 'reliability', 'speed']) assert.ok(candidate[key] >= COMPANY.statRanges[key][0] && candidate[key] <= COMPANY.statRanges[key][1]);
      if (s.employees.length === companyLevel(s.officeLevel).slots) f.company.upgrade();
      const money = s.money, result = f.company.hire(candidate.id); assert.ok(result.ok);
      assert.equal(s.money, money - candidate.price); assert.equal(result.employee.archetype, candidate.archetype);
      assert.equal(result.employee.efficiency, candidate.efficiency); assert.equal(result.employee.status, 'WORKING');
      assert.equal(f.company.hire(candidate.id).ok, false, 'candidate consumed once');
    }
  }
  assert.equal(seen.size, 5);
});

test('refresh is first free, then 300, atomic on low money and persists without reload rerolls', () => {
  const f = fixture(), s = f.state.values, money = s.money, original = s.companyCandidates.map(c => c.id);
  assert.ok(f.company.refreshCandidates().ok); assert.equal(s.money, money);
  assert.notDeepEqual(s.companyCandidates.map(c => c.id), original); assert.ok(f.company.refreshCandidates().ok); assert.equal(s.money, money - COMPANY.refreshCost);
  f.state.update({ money: COMPANY.refreshCost - 1 }); const before = f.state.getSaveData();
  assert.equal(f.company.refreshCandidates().ok, false); assert.deepEqual(f.state.getSaveData(), before);
  const loaded = new GameState(); loaded.loadSaveData(before); new CompanyManager(loaded);
  assert.deepEqual(loaded.values.companyCandidates, before.companyCandidates); assert.equal(loaded.values.candidateRefreshes, 2);
  // An exhausted list also stays empty across reload; refresh still has its saved price.
  loaded.values.companyCandidates = []; const saved = loaded.getSaveData(); loaded.loadSaveData(saved); new CompanyManager(loaded);
  assert.deepEqual(loaded.values.companyCandidates, []);
});

test('capacity/funds/unknown candidate reject hiring without charges', () => {
  const f = fixture(), s = f.state.values, price = f.company.candidate().price;
  f.state.update({ money: price - 1 }); assert.equal(f.company.hire().ok, false); assert.equal(s.employees.length, 0);
  f.state.update({ money: 100000 }); f.hire(); f.hire(); const before = s.money;
  assert.equal(f.company.hire().ok, false); assert.equal(s.money, before); assert.equal(s.companyStats.employeesHired, 2);
  f.company.upgrade(); assert.equal(f.company.hire('invalid').ok, false);
});

test('fleet including car is separate, assignment exclusive, release/reassignment free', () => {
  const f = fixture(), s = f.state.values; f.hire(); f.hire();
  f.state.purchaseTransport('CAR'); const personal = [...s.ownedTransports];
  assert.deepEqual(s.companyVehicles, []);
  f.state.update({ money: 24999 }); assert.equal(f.company.buyVehicle('CAR').ok, false);
  f.state.update({ money: 100000 }); for (const type of ['BICYCLE', 'MOPED', 'CAR']) assert.ok(f.company.buyVehicle(type).ok);
  assert.deepEqual(s.ownedTransports, personal); const [a, b] = s.employees, car = s.companyVehicles[2];
  const walking = f.company.employeeRate(a); const money = s.money;
  assert.ok(f.company.assignVehicle(a.id, car.id).ok); near(f.company.employeeRate(a) / walking,
    COMPANY.transportMultipliers.CAR * (1 + (a.speed - 1) * COMPANY.transportSpeedInfluence.CAR) / (1 + (a.speed - 1) * COMPANY.transportSpeedInfluence.WALKING));
  assert.equal(f.company.assignVehicle(b.id, car.id).ok, false); assert.equal(f.company.assignVehicle(a.id, 'CAR').ok, false);
  assert.ok(f.company.assignVehicle(a.id).ok); assert.ok(f.company.assignVehicle(b.id, car.id).ok); assert.equal(s.money, money);
  assert.equal(f.company.assignVehicle('invalid').ok, false);
});

test('elapsed-time income and simulation are invariant to tick partition and fractional rubles survive collection', () => {
  const a = fixture(), b = fixture(); a.hire(); b.hire(); const money = a.state.values.money;
  for (let i = 0; i < 600; i++) { a.advance(1000); a.company.tick(); }
  b.advance(600000); b.company.tick();
  for (const key of ['companyBalance', 'companyIncomeRemainder', 'companyReputation']) near(a.state.values[key], b.state.values[key]);
  for (const key of Object.keys(a.state.values.employees[0])) {
    const actual = a.state.values.employees[0][key], expected = b.state.values.employees[0][key];
    if (typeof actual === 'number') near(actual, expected); else assert.equal(actual, expected);
  }
  assert.equal(a.state.values.money, money);
  const earned = a.state.values.companyBalance, remainder = a.state.values.companyIncomeRemainder;
  assert.equal(a.company.collect().amount, earned); assert.equal(a.state.values.money, money + earned);
  near(a.state.values.companyIncomeRemainder, remainder); assert.equal(a.company.collect().ok, false);
  assert.equal(a.state.values.totalMoneyEarned, 0); assert.equal(a.state.values.companyStats.totalIncomeCollected, earned);
  const restored = new GameState(); restored.loadSaveData(a.state.getSaveData()); near(restored.values.companyIncomeRemainder, remainder);
});

test('rate-changing purchases settle preceding time at the old rate', () => {
  const f = fixture(), reference = fixture(); f.hire(); reference.hire(); f.company.buyVehicle('CAR');
  f.advance(60000); reference.advance(60000); reference.company.tick();
  f.company.assignVehicle(f.state.values.employees[0].id, f.state.values.companyVehicles[0].id);
  assert.equal(f.state.values.companyBalance, reference.state.values.companyBalance);
  f.advance(60000); reference.advance(60000); f.company.tick(); reference.company.tick();
  assert.ok(f.state.values.companyBalance > reference.state.values.companyBalance);
});

test('monotonic income ignores wall-clock jumps and duplicate ticks', () => {
  const f = fixture(); f.hire(); f.wallShift(86400000); f.company.tick(); assert.equal(f.state.values.companyBalance, 0);
  f.advance(60000); f.company.tick(); const balance = f.state.values.companyBalance;
  f.company.tick(); f.wallShift(-86400000); f.company.tick(); assert.equal(f.state.values.companyBalance, balance);
});

test('stable two-hour storage cap, collection reopens storage without backlog', () => {
  const f = fixture(); f.hire(); const s = f.state.values, e = s.employees[0]; e.level = 10; e.reliability = 1.2; s.companyReputation = 1000;
  const cap = f.company.storageLimit(); f.advance(4 * 3600000); f.company.tick(); assert.equal(s.companyBalance, cap);
  const total = s.companyLifetimeEarnings; f.advance(3600000); f.company.tick(); assert.equal(s.companyLifetimeEarnings, total);
  f.company.collect(); f.company.tick(); assert.equal(s.companyBalance, 0); f.advance(60000); f.company.tick(); assert.ok(s.companyBalance > 0);
});

test('XP is awarded on simulated work, training accelerates it and level 10 caps growth', () => {
  const a = fixture(), b = fixture(); a.hire(); b.hire(); b.company.upgradeBranch('training');
  a.advance(1000); a.company.tick(); assert.equal(a.state.values.employees[0].currentXp, 0);
  a.advance(599000); b.advance(600000); a.company.tick(); b.company.tick();
  assert.ok(b.state.values.employees[0].currentXp > a.state.values.employees[0].currentXp);
  const e = a.state.values.employees[0], before = a.company.employeeEfficiency(e);
  a.company.addXp(e, 1000000); assert.equal(e.level, 10); assert.equal(e.currentXp, 0);
  assert.ok(a.company.employeeEfficiency(e) > before); const rate = a.company.employeeRate(e);
  a.company.addXp(e, 1000000); assert.equal(a.company.employeeRate(e), rate);
});

test('reliability reduces mathematical failures, total statistics agree, income accounts for expected loss', () => {
  const a = fixture(), b = fixture(); a.hire(); b.hire();
  for (const f of [a, b]) { f.state.values.employees[0].level = 10; f.company.buyVehicle('CAR'); f.company.assignVehicle(f.state.values.employees[0].id, f.state.values.companyVehicles[0].id); }
  a.state.values.employees[0].reliability = .8; b.state.values.employees[0].reliability = 1.2;
  assert.ok(a.company.employeeRate(a.state.values.employees[0]) < b.company.employeeRate(b.state.values.employees[0]));
  a.advance(7200000); b.advance(7200000); a.company.tick(); b.company.tick();
  assert.ok(a.state.values.companyStats.employeeFailures > b.state.values.companyStats.employeeFailures);
  assert.equal(a.state.values.companyStats.employeeFailures, a.state.values.employees[0].failedDeliveries);
  assert.equal(a.state.values.companyStats.employeeDeliveries, a.state.values.employees[0].successfulDeliveries);
});

test('four offices charge configured costs and grow slots; career additionally requires a team and lifetime earnings', () => {
  const f = fixture(), s = f.state.values; assert.equal(careerTitle(s), 'Предприниматель');
  f.state.update({ money: 14999 }); assert.equal(f.company.upgrade().ok, false); f.state.update({ money: 1000000 });
  for (const next of COMPANY.levels.slice(1)) {
    const before = s.money; assert.ok(f.company.upgrade().ok); assert.equal(s.officeLevel, next.level);
    assert.equal(s.companyLevel, next.level); assert.equal(s.money, before - next.price); assert.equal(careerTitle(s), 'Предприниматель');
  }
    for (let i = 0; i < 12; i++) assert.ok(f.hire());
    assert.equal(careerTitle(s), 'Владелец службы доставки');
    s.companyLifetimeEarnings = 250000; f.state.refresh(); assert.equal(careerTitle(s), 'Курьерский босс');
  const money = s.money; assert.equal(f.company.hire().ok, false); assert.equal(f.company.upgrade().ok, false); assert.equal(s.money, money);
});

test('all upgrade branches have three bounded levels, validate funds and recalculate effects', () => {
  const f = fixture(); f.hire(); const s = f.state.values;
  assert.equal(f.company.upgradeBranch('__proto__').ok, false);
  for (const [key, config] of Object.entries(COMPANY.upgrades)) {
    for (let level = 0; level < 3; level++) {
      const rate = f.company.incomeRate(), money = s.money;
      assert.ok(f.company.upgradeBranch(key).ok); assert.equal(s.money, money - config.costs[level]); assert.equal(s.companyUpgrades[key], level + 1);
      assert.ok(f.company.incomeRate() > rate); // training also earns the small upgrade reputation bonus
    }
    assert.equal(f.company.upgradeBranch(key).ok, false);
  }
  const fresh = fixture(); fresh.state.update({ money: 0 }); assert.equal(fresh.company.upgradeBranch('dispatch').ok, false);
});

test('reputation gains/losses clamp at zero, improves candidates and income modestly, ranks separate from player XP', () => {
  const a = fixture(), b = fixture(); a.hire(); b.hire(); const level = b.state.values.level;
  b.company.reputation(1000000); assert.ok(b.company.incomeRate() > a.company.incomeRate());
  assert.ok(b.company.incomeRate() / a.company.incomeRate() <= 1.051);
  a.company.refreshCandidates(true); b.company.refreshCandidates(true);
  assert.ok(b.company.candidate().efficiency > a.company.candidate().efficiency);
  assert.equal(companyRank(b.state.values.companyReputation).name, 'Крупный оператор'); assert.equal(b.state.values.level, level);
  b.company.reputation(-2000000); assert.equal(b.state.values.companyReputation, 0);
});

test('every positive event credits company only, bounded temporary bonuses expire', () => {
  for (const event of COMPANY_EVENTS.filter(e => e.category === 'POSITIVE')) {
    const f = fixture(); f.hire(); const s = f.state.values, personal = s.money, rate = f.company.incomeRate();
    assert.ok(trigger(f, event.id).ok); assert.equal(s.money, personal); assert.equal(s.companyStats.positiveEvents, 1);
    if (event.effects.money) assert.equal(s.companyBalance, event.effects.money);
    if (event.effects.companyIncome || event.effects.employeeIncome) assert.ok(f.company.incomeRate() > rate);
    f.company.accrue(300000); assert.equal(s.companyEffects.length, 0);
  }
});

test('negative events never make money negative, protect small ledger and prevent consecutive negatives/illness', () => {
  for (const event of COMPANY_EVENTS.filter(e => e.category === 'NEGATIVE')) {
    const f = fixture(); f.hire(); if (event.vehicle) { f.company.buyVehicle('CAR'); f.company.assignVehicle(f.state.values.employees[0].id, f.state.values.companyVehicles[0].id); }
    f.state.update({ money: 0 }); f.state.values.companyBalance = 10;
    assert.ok(trigger(f, event.id).ok); assert.equal(f.state.values.money, 0); assert.ok(f.state.values.companyBalance >= 9);
    assert.equal(f.company.events.debug('NEGATIVE'), false);
    assert.equal(f.company.events.debug(null, 'illness'), false);
    if (event.id === 'illness') f.company.accrue(event.effects.duration * 1000);
    assert.ok(f.company.events.debug('POSITIVE'));
  }
});

test('illness and humorous pause recover in active time and survive reload without offline countdown', () => {
  const f = fixture(); f.hire(); trigger(f, 'illness'); const s = f.state.values, e = s.employees[0];
  assert.equal(e.status, 'TEMPORARILY_UNAVAILABLE'); assert.equal(f.company.employeeRate(e), 0);
  f.company.accrue(60000); assert.equal(e.status, 'TEMPORARILY_UNAVAILABLE');
  const loaded = new GameState(); loaded.loadSaveData(f.state.getSaveData()); const manager = new CompanyManager(loaded);
  const activeTime = loaded.values.companyActiveTimeMs; manager.accrue(3600000, true);
  assert.equal(loaded.values.companyActiveTimeMs, activeTime); assert.equal(loaded.values.employees[0].status, 'TEMPORARILY_UNAVAILABLE');
  manager.accrue(120000); assert.equal(loaded.values.employees[0].status, 'WORKING'); assert.ok(manager.incomeRate() > 0);
  const funny = fixture(); funny.hire(); trigger(funny, 'shawarma'); funny.company.accrue(45000);
  assert.equal(funny.state.values.employees[0].status, 'WORKING'); assert.ok(funny.state.values.companyLog.includes('Нашёлся. Просто обедал.'));
});

test('all four choice events resolve both branches, insufficient voluntary payments stay pending and duplicate choices do nothing', () => {
  for (const event of COMPANY_EVENTS.filter(e => e.category === 'CHOICE')) for (const index of [0, 1]) {
    const f = fixture(); f.hire(); const money = f.state.values.money;
    assert.ok(trigger(f, event.id, index).ok); assert.ok(f.state.values.money <= money);
  }
  const f = fixture(); f.hire(); f.state.update({ money: 0 });
  const result = trigger(f, 'coffee'); assert.equal(result.ok, false); assert.equal(f.company.events.active.resolved, false);
  assert.ok(f.company.events.resolve(1).ok); const saved = f.state.getSaveData();
  assert.equal(f.company.events.resolve(0).ok, false); assert.deepEqual(f.state.getSaveData(), saved);
  assert.equal(f.company.events.resolve(20).ok, false);
});

test('dispute succeeds/fails at 50%, bonus is capped and urgent risk expires', () => {
  for (const roll of [.1, .9]) {
    const f = fixture(true, () => roll); f.hire(); f.state.values.companyBalance = 10000;
    trigger(f, 'broken-choice', 1); assert.equal(f.state.values.companyBalance, roll < .5 ? 10000 : 8500);
    assert.equal(f.state.values.companyStats.negativeEvents, roll < .5 ? 0 : 1);
  }
  const f = fixture(); f.hire(); const e = f.state.values.employees[0];
  for (let i = 0; i < 5; i++) { trigger(f, 'raise-choice'); trigger(f, 'praise'); }
  near(e.permanentEfficiencyBonus, COMPANY.permanentBonusCap);
  const before = f.company.failureChance(e); trigger(f, 'urgent-choice'); assert.ok(f.company.failureChance(e) > before);
  f.company.accrue(180000); assert.equal(f.company.effect('risk'), 0);
});

test('events wait behind modals, are rare, keep one queued event and reliability reduces damage weight', () => {
  const f = fixture(); f.hire(); const events = f.company.events; let shown = 0; events.onShow = () => shown++;
  events.isBlocked = () => true; events.advance(B.intervalMs[0] - 1); assert.equal(events.pending, null);
  events.advance(B.intervalMs[1]); assert.ok(events.pending); events.update(); assert.equal(shown, 0);
  const pending = events.pending; events.advance(10000000); assert.equal(events.pending, pending);
  events.isBlocked = () => false; events.update(); assert.equal(shown, 1);
  const damaged = COMPANY_EVENTS.find(e => e.id === 'damaged'), e = f.state.values.employees[0];
  e.reliability = .8; const low = events.weight(damaged, e); e.reliability = 1.2; assert.ok(events.weight(damaged, e) < low);
});

test('a queued business event cannot show in a hidden game', () => {
  const f = fixture(); f.hire(); const events = f.company.events; let shown = 0;
  events.onShow = () => shown++; assert.ok(events.debug('POSITIVE'));
  f.company.hidden = true; events.update(); assert.equal(shown, 0); assert.ok(events.pending);
  f.company.hidden = false; events.update(); assert.equal(shown, 1);
});

test('offline capped predictable starting-rate income, XP, no negative fines/events and no duplicate credit', () => {
  const f = fixture(); f.hire(); const saved = f.state.getSaveData(), loaded = new GameState(); loaded.loadSaveData(saved);
  let wall = saved.lastCompanyUpdateTimestamp + 3600000, calls = 0;
  const manager = new CompanyManager(loaded, { wallNow: () => wall, now: () => 0, random: () => { calls++; return .5; } });
  const expected = manager.employeeRate(loaded.values.employees[0], loaded.values, true) * COMPANY.archetypes[loaded.values.employees[0].archetype].offline * 60;
  assert.equal(manager.resumeOffline(), Math.floor(expected)); assert.equal(calls, 0); assert.ok(loaded.values.employees[0].level > 1);
  assert.equal(loaded.values.companyStats.employeeFailures, 0); assert.equal(loaded.values.companyStats.negativeEvents, 0);
  assert.equal(manager.events.pending, null); assert.equal(loaded.values.companyActiveTimeMs, 0);
  const balance = loaded.values.companyBalance; assert.equal(manager.resumeOffline(), 0); assert.equal(loaded.values.companyBalance, balance);
  loaded.loadSaveData(saved); wall += 30 * 86400000; const before = manager.employeeRate(loaded.values.employees[0], loaded.values, true);
  assert.equal(manager.resumeOffline(), Math.floor(before * COMPANY.archetypes[loaded.values.employees[0].archetype].offline * 120));
  const again = new GameState(); again.loadSaveData(loaded.getSaveData()); assert.equal(new CompanyManager(again, { wallNow: () => wall }).resumeOffline(), 0);
});

test('workaholic has greater offline efficiency with identical other stats', () => {
  const a = fixture(), b = fixture(); a.hire(); b.hire();
  for (const f of [a, b]) { const e = f.state.values.employees[0]; e.efficiency = e.reliability = e.speed = 1; }
  a.state.values.employees[0].archetype = 'ROOKIE'; b.state.values.employees[0].archetype = 'WORKAHOLIC';
  a.company.accrue(3600000, true); b.company.accrue(3600000, true);
  assert.ok(b.state.values.companyBalance > a.state.values.companyBalance);
  assert.ok(b.state.values.employees[0].successfulDeliveries > a.state.values.employees[0].successfulDeliveries);
});

test('invalid/missing/future timestamps give no income and reset safely', () => {
  const f = fixture(); f.hire();
  for (const timestamp of [undefined, null, 0, -1, NaN, Infinity, '1800000000000', 1900000000000, 1800000000000.5]) {
    const loaded = new GameState(); loaded.loadSaveData({ ...f.state.getSaveData(), lastCompanyUpdateTimestamp: timestamp });
    const manager = new CompanyManager(loaded, { wallNow: () => 1800000000000, now: () => 0 });
    assert.equal(manager.resumeOffline(), 0); assert.equal(loaded.values.companyBalance, 0); assert.equal(loaded.values.lastCompanyUpdateTimestamp, 1800000000000);
  }
});

test('version 9 roundtrips all nested data and snapshots cannot mutate company values', () => {
  const f = fixture(); f.hire(); f.company.buyVehicle('CAR'); f.company.upgrade(); f.company.upgradeBranch('routing');
  f.advance(61500); f.company.tick(); trigger(f, 'good-day');
  const saved = JSON.parse(JSON.stringify(f.state.getSaveData())), loaded = new GameState(); loaded.loadSaveData(saved);
  assert.equal(saved.version, 9); assert.deepEqual(loaded.getSaveData(), saved);
  const snapshot = f.state.getSnapshot(); snapshot.employees[0].name = 'X'; snapshot.companyCandidates[0].price = 0;
  snapshot.companyVehicles[0].type = 'X'; snapshot.companyUpgrades.routing = 99; snapshot.companyStats.employeeFailures = 999;
  snapshot.companyEffects[0].value = 99; snapshot.companyEventState.lastId = 'X'; snapshot.companyLog.push('fake');
  assert.deepEqual(f.state.getSaveData(), saved);
});

test('Stage 6 employees/fleet/ledger migrate with neutral stats, third office retains all six employees', () => {
  const state = new GameState(), save = { version: 6, money: 1234, xp: 3850, companyUnlocked: true, companyName: 'Старая компания', companyLevel: 3,
    companyBalance: 6200, companyLifetimeEarnings: 8000, companyStats: { employeesHired: 6, totalIncomeCollected: 1800 },
    companyVehicles: [{ id: 'vehicle-1', type: 'MOPED' }], employees: Array.from({ length: 6 }, (_, i) => ({ id: `courier-${i + 1}`, name: 'Саша',
      level: 1, efficiency: 1, baseIncome: 100, assignedTransport: i === 0 ? 'vehicle-1' : null, status: 'WORKING', totalEarned: 1000 })) };
  assert.ok(state.loadSaveData(save)); assert.equal(state.values.employees.length, 6); assert.equal(state.values.officeLevel, 3);
  assert.equal(state.values.companyBalance, 6200); assert.equal(state.values.companyStats.totalIncomeCollected, 1800);
  const e = state.values.employees[0]; assert.equal(e.archetype, 'ROOKIE'); assert.equal(e.speed, 1); assert.equal(e.reliability, 1);
  assert.equal(e.assignedTransport, 'vehicle-1'); assert.equal(e.totalEarned, 1000); assert.equal(e.currentXp, 0);
  new CompanyManager(state); assert.equal(state.values.companyCandidates.length, 3); assert.equal(state.values.money, 1234);
});

test('pre-company saves retain personal equipment/transport/statistics and default business fields', () => {
  const state = new GameState();
  for (const version of [1, 2, 3, 4, 5]) {
    state.loadSaveData({ version, money: 1234, xp: 250, transport: 'BICYCLE', ownedItems: ['thermobag'], completedOrders: 7 });
    assert.equal(state.values.companyUnlocked, false); assert.deepEqual(state.values.employees, []); assert.equal(state.values.money, 1234);
    assert.equal(state.values.equippedTransport, 'BICYCLE'); assert.equal(state.values.completedOrders, 7);
  }
});

test('malformed saves sanitize all new fields, duplicates and exclusivity', () => {
  const f = fixture(); f.hire(); f.hire(); f.company.buyVehicle('CAR'); const saved = f.state.getSaveData();
  saved.companyBalance = Infinity; saved.companyLifetimeEarnings = -5; saved.companyReputation = NaN; saved.officeLevel = 200;
  saved.companyUpgrades = { dispatch: Infinity, routing: 200 }; saved.companyEffects = [{ kind: 'risk', value: Infinity, until: 999999 }];
  saved.companyVehicles.push(saved.companyVehicles[0], { id: '__proto__', type: 'CAR' }, null);
  saved.employees.forEach(e => { e.assignedTransport = 'vehicle-1'; e.level = 200; e.currentXp = Infinity; e.reliability = 99; e.workRemainder = Infinity; });
  saved.employees.push(saved.employees[0], null); saved.companyCandidates.push(null); saved.companyLog = [null, {}, 'ok'];
  const state = new GameState(); assert.ok(state.loadSaveData(saved));
  assert.equal(state.values.companyVehicles.length, 1); assert.equal(state.values.employees.length, 2);
  assert.equal(state.values.employees.filter(e => e.assignedTransport).length, 1); assert.equal(state.values.employees[0].level, 10);
  assert.equal(state.values.employees[0].currentXp, 0); assert.equal(state.values.employees[0].reliability, 1.2);
  assert.equal(state.values.companyBalance, 0); assert.deepEqual(state.values.companyEffects, []); assert.deepEqual(state.values.companyLog, ['ok']);
  assert.equal(state.values.companyUpgrades.routing, 3); assert.equal(state.loadSaveData(null), false);
});

test('bounded activity log and personal delivery counters remain independent', () => {
  const f = fixture(); f.hire(); for (let i = 0; i < 30; i++) f.company.log(`log ${i}`);
  assert.equal(f.state.values.companyLog.length, COMPANY.logLimit);
  const money = f.state.values.money; f.state.addRewards({ reward: 300, xpReward: 40, reputationReward: 2, distance: 500 });
  assert.equal(f.state.values.money, money + 300); assert.equal(f.state.values.completedOrders, 1);
  assert.equal(f.state.values.totalMoneyEarned, 300); assert.equal(f.state.values.companyStats.employeesHired, 1);
});
