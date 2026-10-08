import test from 'node:test';
import assert from 'node:assert/strict';
import { GameState } from '../src/state/GameState.js';
import { OrderManager } from '../src/managers/OrderManager.js';
import { EventManager } from '../src/managers/EventManager.js';
import { CompanyManager } from '../src/managers/CompanyManager.js';
import { DISTRICTS, districtMastery, emptyDistrictStats, companyDistrictBonus, ELITE_ORDERS, eliteOrdersEligible } from '../src/config/districtConfig.js';
import { TRANSPORTS, careerTitle } from '../src/config/transportConfig.js';
import { BALANCE, xpForLevel } from '../src/config/gameBalance.js';
import { districtDeliveryLocations } from '../src/world/deliveryLocations.js';
import { districtLayout, WORLD } from '../src/world/districtLayouts.js';
import { EVENTS } from '../src/data/events.js';
import { EVENT_BALANCE as B } from '../src/config/eventBalance.js';

const ids = Object.keys(DISTRICTS);
function stateIn(id, reputation = 100) {
  const state = new GameState();
  state.loadSaveData({ xp: xpForLevel(14), money: 500000, reputation, ownedTransports: TRANSPORTS.map(t => t.id), unlockedDistricts: ids, selectedDistrict: id });
  return state;
}
function fixture(id = 'residential', transport = 'WALKING') {
  const state = stateIn(id); state.equipTransport(transport); let time = 0;
  const orders = new OrderManager({ state, ...districtDeliveryLocations(id), random: () => 0, now: () => time });
  const events = new EventManager(state, orders, () => .99, () => time);
  return { state, orders, events, advance: ms => { time += ms; orders.update(); } };
}
const complete = orders => { orders.accept(); orders.interact(orders.order.restaurant); while (orders.getTarget()) orders.interact(orders.order.customer); };

test('all district purchases validate each requirement atomically and never charge twice', () => {
  for (const id of ids.slice(1)) {
    const d = DISTRICTS[id], state = new GameState();
    const valid = { xp: xpForLevel(d.level), money: d.cost, reputation: d.reputation, ownedTransports: ['WALKING', 'MOPED'] };
    for (const changes of [{ xp: xpForLevel(d.level) - 1 }, { money: d.cost - 1 }, ...(d.reputation ? [{ reputation: d.reputation - 1 }] : []), ...(d.requiredOwnedTransports ? [{ ownedTransports: ['WALKING'] }] : [])]) {
      state.loadSaveData({ ...valid, ...changes }); const before = state.getSaveData();
      assert.equal(state.unlockDistrict(id), false, `${id} ${JSON.stringify(changes)}`); assert.deepEqual(state.getSaveData(), before);
    }
    state.loadSaveData(valid); assert.equal(state.unlockDistrict(id), true); assert.equal(state.values.money, 0);
    const after = state.getSaveData(); assert.equal(state.unlockDistrict(id), false); assert.deepEqual(state.getSaveData(), after);
  }
  const state = new GameState(); state.update({ xp: xpForLevel(4), money: DISTRICTS.center.cost, reputation: -10 });
  assert.equal(state.unlockDistrict('center'), true, 'existing Center unlock still ignores reputation');
  assert.equal(state.unlockDistrict('__proto__'), false);
});

test('owned business transport allows access while walking; unowned equipped values cannot unlock it', () => {
  const state = new GameState(); state.loadSaveData({ xp: xpForLevel(14), reputation: 70, money: DISTRICTS.business.cost, ownedTransports: ['MOPED'], equippedTransport: 'WALKING' });
  assert.equal(state.unlockDistrict('business'), true); assert.equal(state.selectDistrict('business'), true);
  assert.equal(state.values.equippedTransport, 'WALKING');
});

test('district selection blocks locked, active, event and modal paths and preserves all progression', () => {
  const { state, orders, events } = fixture(); orders.generate();
  const before = state.getSaveData(); assert.equal(state.selectDistrict('center'), true);
  assert.deepEqual(state.getSaveData(), { ...before, selectedDistrict: 'center' });
  state.selectDistrict('residential'); orders.accept(); assert.equal(state.selectDistrict('center'), false);
  orders.interact(orders.order.restaurant); assert.equal(state.selectDistrict('center'), false);
  complete(orders); assert.equal(state.selectDistrict('center'), true);
  events.active = { event: EVENTS[0] }; assert.equal(state.selectDistrict('residential'), false); events.active = null;
  state.isDistrictBlocked = () => true; assert.equal(state.selectDistrict('residential'), false); state.isDistrictBlocked = null;
  assert.equal(state.selectDistrict('__proto__'), false); orders.destroy();
  const locked = new GameState(); assert.equal(locked.selectDistrict('elite'), false);
});

test('all district/transport pools obey distance ranges, type gates and reachable distinct Double stops', () => {
  for (const id of ids) for (const transport of TRANSPORTS) {
    const { orders } = fixture(id, transport.id);
    for (let i = 0; i < 100; i++) {
      let draw = 0; orders.random = () => [((i % 3) + .5) / 3, (i + .5) / 100, (i + .5) / 100, .5, .5][draw++] ?? .5;
      orders.order = null; assert.equal(orders.generate(), true);
      const o = orders.order, [min, singleMax] = DISTRICTS[id].routeRange;
      const max = singleMax * (o.type === 'DOUBLE' ? DISTRICTS[id].doubleRouteMultiplier : 1);
      assert.ok(o.distance >= min - 1 && o.distance <= max + 1, `${id}/${transport.id}/${o.type}: ${o.distance}`);
      if (o.type === 'LARGE') assert.equal(transport.id, 'CAR');
      if (o.type === 'ELITE') assert.ok(ELITE_ORDERS.districts.includes(id));
      if (o.type === 'DOUBLE') { assert.equal(o.customers.length, 2); assert.notEqual(o.customers[0].id, o.customers[1].id); }
    }
    orders.destroy();
  }
});

test('controlled layouts keep every entrance connected to spawn for every transport body', () => {
  // Flood walkable 20px cells with clearance for the shared 22×24 collision body.
  for (const id of ids) {
    const blocks = districtLayout(id).blocks, step = 20, width = WORLD.width / step, height = WORLD.height / step;
    assert.ok(blocks.length < 20, 'lightweight static bodies');
    const free = (x, y) => x >= 1 && y >= 1 && x < width - 1 && y < height - 1 && !blocks.some(b => x * step > b.x - 12 && x * step < b.x + b.w + 12 && y * step > b.y - 13 && y * step < b.y + b.h + 13);
    const queue = [[WORLD.spawn.x / step, WORLD.spawn.y / step]], seen = new Set([queue[0].join(',')]);
    for (let head = 0; head < queue.length; head++) {
      const [x, y] = queue[head];
      for (const [nx, ny] of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]) if (free(nx,ny) && !seen.has(`${nx},${ny}`)) { seen.add(`${nx},${ny}`); queue.push([nx,ny]); }
    }
    const locations = districtDeliveryLocations(id);
    for (const p of [...locations.restaurants, ...locations.customers]) {
      assert.ok(!blocks.some(b => p.x > b.x - 12 && p.x < b.x + b.w + 12 && p.y > b.y - 13 && p.y < b.y + b.h + 13), `${id}/${p.id}: body clearance`);
      assert.ok(seen.has(`${Math.round(p.x / step)},${Math.round(p.y / step)}`), `${id}/${p.id}: connected`);
    }
  }
});

test('district weighting creates the intended distribution and Business has highest average offers', () => {
  const results = {};
  for (const id of ids) {
    const { orders } = fixture(id, 'CAR'), counts = {}; let reward = 0;
    for (let i = 0; i < 1000; i++) {
      let draw = 0; orders.random = () => [.5, .5, (i+.5)/1000, .5, .5][draw++] ?? .5; orders.order = null; orders.generate();
      counts[orders.order.type] = (counts[orders.order.type] || 0) + 1; reward += orders.order.reward;
    }
    results[id] = { counts, reward: reward/1000 }; orders.destroy();
  }
  assert.ok(results.center.counts.URGENT > results.residential.counts.URGENT);
  assert.ok(results.industrial.counts.LARGE > results.residential.counts.LARGE);
  assert.ok(results.elite.counts.FRAGILE > results.residential.counts.FRAGILE);
  assert.ok(results.business.counts.DOUBLE > results.residential.counts.DOUBLE);
  assert.ok(results.business.counts.ELITE > 0 && results.business.counts.ELITE < 100);
  assert.ok(results.business.reward > Math.max(...ids.filter(id => id !== 'business').map(id => results[id].reward)));
});

test('elite gates require advanced district, level and reputation and variants remain rare', () => {
  for (const [id, level, reputation, valid] of [['residential',14,100,false],['industrial',14,100,false],['elite',11,100,false],['elite',12,59,false],['elite',12,60,true],['business',14,70,true]]) {
    const state = stateIn(id, reputation); state.update({ xp: xpForLevel(level) });
    assert.equal(eliteOrdersEligible(state.getSnapshot()), valid);
    const orders = new OrderManager({ state, ...districtDeliveryLocations(id), random: () => 0 });
    assert.equal(orders.generate({ forcedType: 'ELITE' }), valid); orders.destroy();
  }
  const f = fixture('elite'); f.state.update({ reputation: 60 }); f.orders.generate({ forcedType: 'ELITE', forcedVariant: 'vip' });
  assert.notEqual(f.orders.order.variant, 'vip', 'VIP requires 70 reputation');
  f.state.update({ reputation: 59 }); assert.equal(f.orders.accept(), false, 'recheck requirements at acceptance');
  f.state.update({ reputation: 70 }); f.orders.order = null; f.orders.generate({ forcedType: 'ELITE', forcedVariant: 'vip' });
  f.state.update({ reputation: 69 }); assert.equal(f.orders.accept(), false, 'recheck VIP-specific reputation at acceptance');
});

test('every elite flavor pays configured money/XP/reputation once, preserves equipment and tracks failure', () => {
  for (const id of ELITE_ORDERS.districts) for (const variant of ELITE_ORDERS.variants) {
    const f = fixture(id, 'CAR'); f.orders.generate({ forcedType: 'ELITE', forcedVariant: variant.id });
    const o = f.orders.order, d = DISTRICTS[id], meters = o.distance;
    assert.equal(o.variant, variant.id);
    const base = Math.min(BALANCE.maxReward, Math.max(BALANCE.minReward, Math.round(BALANCE.baseReward + meters * BALANCE.moneyPerMeter)));
    const xp = Math.min(BALANCE.maxXP, Math.round(BALANCE.baseXP + meters * BALANCE.xpPerMeter));
    assert.equal(o.reward, Math.round(base * ELITE_ORDERS.money * variant.money * d.money));
    assert.equal(o.xpReward, Math.round(xp * ELITE_ORDERS.xp * d.xp)); assert.equal(o.reputationReward, variant.reputation);
    const before = f.state.getSnapshot(); complete(f.orders); assert.equal(f.state.values.money, before.money + o.reward);
    assert.equal(f.state.values.districtStats[id].completedOrders, 1); assert.equal(f.orders.interact(o.customer), false);
    f.orders.order = null; f.orders.generate({ forcedType: 'ELITE' }); f.orders.accept(); const reputation = f.state.values.reputation;
    f.advance(300000); assert.equal(f.state.values.reputation, reputation - ELITE_ORDERS.failurePenalty); assert.equal(f.state.values.districtStats[id].failedOrders, 1);
  }
});

test('mastery thresholds stay capped, affect offered payout and district stats isolate earnings/failures', () => {
  for (const [count, name, bonus] of [[0,'Новичок района',0],[9,'Новичок района',0],[10,'Знает улицы',.01],[24,'Знает улицы',.01],[25,'Местный профи',.03],[49,'Местный профи',.03],[50,'Легенда района',.05],[10000,'Легенда района',.05]]) {
    assert.deepEqual(districtMastery(count), { min: count < 10 ? 0 : count < 25 ? 10 : count < 50 ? 25 : 50, name, bonus });
  }
  const f = fixture('center'); f.state.values.districtStats.center.completedOrders = 49;
  f.orders.generate({ forcedType: 'STANDARD' }); assert.equal(f.orders.order.masteryBonus, .03);
  complete(f.orders); assert.equal(districtMastery(f.state.values.districtStats.center.completedOrders).bonus, .05);
  const money = f.orders.order.reward; f.state.applyEventMoney(50, true); f.state.applyEventMoney(-100);
  assert.equal(f.state.values.districtStats.center.totalEarned, money + 50); assert.equal(f.state.values.districtStats.center.bestDeliveryReward, money);
  assert.deepEqual(f.state.values.districtStats.residential, emptyDistrictStats());
  const loaded = new GameState(); loaded.loadSaveData(f.state.getSaveData()); assert.deepEqual(loaded.getSaveData(), f.state.getSaveData());
});

test('pre-Stage 8 saves retain Center/company/personal progress and default new district counters', () => {
  for (const version of [1,2,3,4,5,6,7]) {
    const state = new GameState(); state.loadSaveData({ version, xp: xpForLevel(10), money: 12345, reputation: 45,
      unlockedDistricts: ['residential','center'], selectedDistrict: 'center', transport: 'BICYCLE', ownedItems: ['thermobag'], completedOrders: 52, companyUnlocked: true, companyBalance: 4321 });
    const s = state.getSnapshot(); assert.deepEqual(s.unlockedDistricts, ['residential','center']); assert.equal(s.selectedDistrict, 'center');
    assert.equal(s.money, 12345); assert.equal(s.completedOrders, 52); assert.equal(s.companyBalance, 4321); assert.ok(s.ownedTransports.includes('BICYCLE'));
    assert.deepEqual(s.districtIntroductionsSeen, ['residential','center']); for (const stats of Object.values(s.districtStats)) assert.deepEqual(stats, emptyDistrictStats());
  }
});

test('version 9 preserves unseen introductions and sanitizes counters without trusting derived unlocks', () => {
  const s = stateIn('elite'); s.values.districtIntroductionsSeen = ['residential']; s.values.districtStats.elite.completedOrders = 50;
  s.refresh(); const saved = s.getSaveData(), loaded = new GameState(); loaded.loadSaveData(saved); assert.deepEqual(loaded.getSaveData(), saved);
  const snapshot = loaded.getSnapshot(); snapshot.districtStats.elite.completedOrders = 0; snapshot.districtIntroductionsSeen.push('business');
  assert.equal(loaded.values.districtStats.elite.completedOrders, 50); assert.deepEqual(loaded.values.districtIntroductionsSeen, ['residential']);
  loaded.loadSaveData({ unlockedDistricts: ['center','center','__proto__','unknown'], selectedDistrict: 'elite', districtStats: { center: { completedOrders: -5, failedOrders: Infinity, totalEarned: 10.8, bestDeliveryReward: NaN } }, districtIntroductionsSeen: ['business','center','center'] });
  assert.equal(loaded.values.selectedDistrict, 'residential'); assert.deepEqual(loaded.values.districtStats.center, { ...emptyDistrictStats(), totalEarned: 10 });
  assert.deepEqual(loaded.values.districtIntroductionsSeen, ['residential','center']);
});

test('district event eligibility, both security choices, delays and positive rewards are configurable', () => {
  const districtEvents = EVENTS.filter(e => e.requirements?.districts);
  for (const id of ids) {
    const f = fixture(id); f.orders.generate(); f.orders.accept();
    for (const e of districtEvents) assert.equal(f.events.eligible(e), e.requirements.districts.includes(id));
  }
  const resolve = (f, id, choice = 0) => { f.events.active = { event: EVENTS.find(e => e.id === id), resume: () => {}, pausedAt: f.orders.now() }; const text = f.events.resolve(choice); f.events.finish(); return text; };
  for (const [id, event, choices] of [['industrial','industrial-security',[B.district.securityCallTime,B.district.securityDetourTime]],['business','business-pass',[B.district.businessWaitTime,B.district.businessCallTime]]]) {
    for (const [choice, loss] of choices.entries()) {
      const f = fixture(id); f.orders.generate(); f.orders.accept(); const before = f.orders.order.deadline, rep = f.state.values.reputation;
      resolve(f,event,choice); assert.equal(f.orders.order.deadline, before-loss*1000); assert.equal(f.state.values.reputation,rep);
    }
  }
  const f = fixture('elite'); f.orders.generate(); f.orders.accept();
  let deadline = f.orders.order.deadline; resolve(f,'elite-security'); assert.equal(f.orders.order.deadline,deadline);
  f.state.update({ reputation: 40 }); resolve(f,'elite-security'); assert.equal(f.orders.order.deadline,deadline-B.district.eliteWaitTime*1000);
  f.events.random = () => 0; f.state.update({ reputation: 0 }); const before = f.state.values.totalTipsEarned; resolve(f,'elite-tips');
  assert.equal(f.state.values.totalTipsEarned-before, Math.round(B.district.eliteTips[0]*DISTRICTS.elite.tip));
  const business = fixture('business'); business.orders.generate(); business.orders.accept(); business.events.random = () => 0;
  deadline = business.orders.order.deadline; resolve(business,'business-pass',1); assert.equal(business.orders.order.deadline,deadline);
  const cash = business.state.values.money; resolve(business,'corporate-bonus'); assert.equal(business.state.values.money,cash+B.district.corporateBonus[0]);
  const industrial = fixture('industrial'); resolve(industrial,'empty-roads'); assert.equal(industrial.events.modifiers.speed('CAR'),B.greenSpeed);
});

test('company district modifier sums to 14%, applies online/offline and settles old-rate income before unlock', () => {
  const state = stateIn('residential'); state.values.unlockedDistricts = ['residential']; let now = 0;
  const company = new CompanyManager(state, { now: () => now, wallNow: () => 1000000, random: () => .5 });
  company.openCompany('Доставка'); company.hire(company.candidate().id); const employee = state.values.employees[0];
  const base = company.employeeRate(employee), expected = company.incomeRate();
  now = 10000; state.unlockDistrict('center'); assert.ok(state.values.companyBalance+state.values.companyIncomeRemainder >= expected/6);
  let bonus = .02; assert.equal(company.incomeFactors(employee).districts, 1+bonus);
  for (const id of ids.slice(2)) { state.unlockDistrict(id); bonus += DISTRICTS[id].companyBonus; assert.equal(company.incomeFactors(employee).districts, 1+bonus); }
  assert.equal(Math.round(companyDistrictBonus(state.values)*100),14);
  assert.ok(Math.abs(company.incomeFactors(employee,state.values,true).districts-1.14)<1e-10);
  assert.ok(company.employeeRate(employee) >= base*1.14);
});

test('career uses the single milestone path; city king requires mastery and persists when company opens', () => {
  const state = stateIn('elite'); assert.equal(careerTitle(state.values),'Автокурьер');
  state.values.unlockedDistricts = ids; state.refresh(); assert.equal(careerTitle(state.values),'Автокурьер');
  state.values.districtStats.elite.completedOrders = 50; state.refresh(); assert.equal(careerTitle(state.values),'Король города');
  state.values.companyUnlocked = true; state.refresh(); assert.equal(careerTitle(state.values),'Король города');
});
