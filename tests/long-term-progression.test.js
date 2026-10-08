import test from 'node:test';
import assert from 'node:assert/strict';
import { GameState } from '../src/state/GameState.js';
import { CompanyManager } from '../src/managers/CompanyManager.js';
import { OrderManager } from '../src/managers/OrderManager.js';
import { EventManager } from '../src/managers/EventManager.js';
import { ACHIEVEMENTS } from '../src/data/achievements.js';
import { CAREER_MILESTONES, RECORD_SETTINGS } from '../src/config/progressionConfig.js';
import { DISTRICTS } from '../src/config/districtConfig.js';
import { EVENTS } from '../src/data/events.js';
import { progressionMultiplier } from '../src/managers/ProgressionModifiers.js';
import { requirementsProgress, availableTitles, selectedTitle } from '../src/managers/AchievementManager.js';
import { careerTitle } from '../src/config/transportConfig.js';
import { xpForLevel } from '../src/config/gameBalance.js';
import { restaurants, customers } from '../src/world/deliveryLocations.js';

const deliver = (s, overrides = {}) => s.addRewards({ reward: 100, xpReward: 20, reputationReward: 1, distance: 300, elapsedSeconds: 30, ...overrides });
const reload = s => { const loaded = new GameState(); loaded.loadSaveData(JSON.parse(JSON.stringify(s.getSaveData()))); return loaded; };
test('delivery unlock notifies once; money requires lifetime income and reward claims do not inflate it', () => {
  const s = new GameState(), events = []; s.progression.subscribe(e => events.push(e));
  s.update({ money: 1000000 }); assert.deepEqual(s.values.achievements, []);
  deliver(s); deliver(s); assert.equal(events.filter(e => e.definition.id === 'first-order').length, 1);
  const before = s.getSnapshot(); assert.ok(s.progression.claim('first-order').ok);
  assert.equal(s.values.money, before.money + 50); assert.equal(s.values.totalMoneyEarned, before.totalMoneyEarned);
  assert.equal(s.progression.claim('first-order').ok, false);
  const loaded = reload(s), wallet = loaded.values.money;
  assert.equal(loaded.progression.claim('first-order').ok, false); assert.equal(loaded.values.money, wallet);
  assert.deepEqual(loaded.getSaveData(), s.getSaveData());
});
test('old saves derive proven achievements, career and records silently without modifying assets or auto paying rewards', () => {
  const s = new GameState(), notices = []; s.progression.subscribe(e => notices.push(e));
  const save = { version: 8, money: 321, xp: xpForLevel(14), reputation: 60, totalMoneyEarned: 10000, completedOrders: 25,
    ownedTransports: ['WALKING', 'BICYCLE', 'MOPED', 'CAR'], unlockedDistricts: Object.keys(DISTRICTS),
    companyUnlocked: true, companyLevel: 2, companyBalance: 777, companyLifetimeEarnings: 9999,
    employees: Array.from({ length: 4 }, (_, i) => ({ id: `e-${i}`, level: 3, totalEarned: 500 })),
    districtStats: { elite: { completedOrders: 50, bestDeliveryReward: 1300 } } };
  assert.ok(s.loadSaveData(save));
  for (const id of ['first-order', 'pace', 'not-poor', 'bicycle', 'moped', 'car', 'garage', 'city', 'at-home', 'self-boss', 'employee']) assert.ok(s.values.achievements.includes(id), id);
  for (const id of ['cyclist', 'pro', 'driver', 'entrepreneur', 'owner', 'king']) assert.ok(s.values.careerMilestones.includes(id), id);
  assert.equal(s.values.money, save.money); assert.equal(s.values.companyBalance, save.companyBalance);
  assert.equal(s.values.employees.length, 4); assert.equal(s.values.legacyPoints, 0); assert.equal(s.values.claimedAchievementRewards.length, 0);
  assert.equal(s.values.personalRecords.highestDeliveryReward, 1300); assert.equal(s.values.personalRecords.fastestDeliverySeconds, null);
  assert.equal(s.values.companyRecords.mostEmployees, 4); assert.equal(s.values.companyRecords.highestEmployeeLevel, 3);
  assert.deepEqual(notices, []);
  assert.equal(s.progression.claim('entrepreneur', true).ok, true); assert.equal(s.values.legacyPoints, 1);
  assert.equal(reload(s).progression.claim('entrepreneur', true).ok, false);
});
test('malformed new fields sanitize known IDs and snapshots cannot mutate persisted progression', () => {
  const s = new GameState(); s.loadSaveData({ achievements: ['bicycle', 'bicycle', '__proto__', null], claimedCareerRewards: ['entrepreneur'],
    legacyPoints: -10, legacyUpgrades: ['city', 'city', 'constructor'], selectedTitle: '<script>', eventCounters: { rareEvents: Infinity },
    personalRecords: { fastestDeliverySeconds: -1, biggestTip: NaN } });
  assert.deepEqual(s.values.achievements, ['bicycle']); assert.ok(s.values.careerMilestones.includes('entrepreneur'));
  assert.deepEqual(s.values.legacyUpgrades, ['city']); assert.equal(s.values.selectedTitle, null); assert.equal(s.values.legacyPoints, 0);
  assert.equal(s.values.eventCounters.rareEvents, 0); assert.equal(s.values.personalRecords.fastestDeliverySeconds, null);
  const snapshot = s.getSnapshot(); snapshot.legacyUpgrades.push('experience'); snapshot.achievements.push('first-order'); snapshot.personalRecords.biggestTip = 999;
  assert.equal(s.values.personalRecords.biggestTip, 0); assert.equal(s.values.legacyUpgrades.length, 1); assert.equal(s.values.achievements.length, 1);
});
test('career milestone locks, completes, persists, claims once and keeps canonical status independent of cosmetic title', () => {
  const s = new GameState(), cyclist = CAREER_MILESTONES.find(m => m.id === 'cyclist');
  assert.equal(s.progression.status(cyclist, true), 'LOCKED');
  s.update({ xp: xpForLevel(3), money: 7000 }); assert.ok(s.purchaseTransport('BICYCLE').ok);
  assert.equal(s.progression.status(cyclist, true), 'IN_PROGRESS');
  for (let i = 0; i < 15; i++) deliver(s);
  assert.equal(s.progression.status(cyclist, true), 'COMPLETED'); assert.equal(careerTitle(s.values), 'Велокурьер');
  assert.ok(s.progression.claim('cyclist', true).ok); assert.equal(s.progression.status(cyclist, true), 'CLAIMED');
  assert.ok(s.progression.selectTitle('career:walker').ok); assert.equal(selectedTitle(s.values), 'Пеший курьер');
  assert.equal(careerTitle(s.values), 'Велокурьер'); assert.equal(selectedTitle(reload(s).values), 'Пеший курьер');
  assert.equal(s.progression.selectTitle('career:magnate').ok, false);
  assert.ok(availableTitles(s.values).some(t => t.id === 'career:cyclist'));
});
test('records reject short routes and worse results, retain best values and record event tips separately', () => {
  const s = new GameState(); deliver(s, { distance: RECORD_SETTINGS.minimumRouteMeters - 1, elapsedSeconds: 1 });
  assert.equal(s.values.personalRecords.fastestDeliverySeconds, null);
  deliver(s, { elapsedSeconds: 50, reward: 400, orderMoney: 650 });
  deliver(s, { elapsedSeconds: 60, reward: 300 }); assert.equal(s.values.personalRecords.fastestDeliverySeconds, 50);
  deliver(s, { elapsedSeconds: 20 }); assert.equal(s.values.personalRecords.fastestDeliverySeconds, 20);
  s.applyEventMoney(250, true); s.applyEventMoney(100, true); s.update({ reputation: 90 }); s.update({ reputation: -20 });
  assert.equal(s.values.personalRecords.highestDeliveryReward, 400); assert.equal(s.values.personalRecords.mostMoneyInOrder, 650);
  assert.equal(s.values.personalRecords.biggestTip, 250); assert.equal(s.values.personalRecords.highestReputation, 90);
  assert.equal(reload(s).values.personalRecords.fastestDeliverySeconds, 20);
});
test('event outcomes unlock secrets, disputes and bad-run while existing anti-frustration still blocks negatives', () => {
  const s = new GameState(); let time = 100;
  const orders = new OrderManager({ state: s, restaurants, customers, now: () => time, random: () => 0 }); orders.generate(); orders.accept();
  const events = new EventManager(s, orders, () => 0);
  const show = (id, choice = 0) => { events.active = { event: EVENTS.find(e => e.id === id), resume: () => {}, pausedAt: time }; events.resolve(choice); events.finish(); };
  show('cola'); assert.ok(s.values.achievements.includes('cola'));
  show('fries', 0); assert.ok(s.values.achievements.includes('honest'));
  assert.ok(ACHIEVEMENTS.find(a => a.id === 'honest').hidden);
  show('fries', 1); assert.ok(s.values.achievements.includes('fries'));
  show('cola'); // Success breaks negative sequence.
  show('fries', 1); events.random = () => .99; show('cola');
  assert.ok(s.values.achievements.includes('bad-run')); assert.equal(events.eligible(EVENTS.find(e => e.id === 'soup')), false);
  show('big-tips'); assert.ok(s.values.achievements.includes('lucky')); assert.ok(s.values.eventCounters.rareEvents >= 4);
  show('fries', 1); assert.ok(s.values.achievements.includes('invisible'));
  assert.ok(reload(s).values.achievements.includes('honest'));
});
test('legacy insufficient/duplicate purchases are atomic; all five effects survive saves and leave assets intact', () => {
  const s = new GameState(), before = s.getSaveData();
  assert.equal(s.progression.buyLegacy('city').ok, false); assert.deepEqual(s.getSaveData(), before);
  s.values.legacyPoints = s.values.legacyPointsEarned = 11; s.update({ money: 1234 });
  for (const id of ['experience', 'reputation', 'business', 'tips', 'city']) assert.ok(s.progression.buyLegacy(id).ok);
  assert.equal(s.values.legacyPoints, 0); assert.equal(s.values.money, 1234); assert.equal(s.values.movementSpeed, 165);
  const owned = s.getSaveData(); assert.equal(s.progression.buyLegacy('city').ok, false); assert.deepEqual(s.getSaveData(), owned);
  assert.equal(progressionMultiplier(s.values, 'tips'), 1.05); assert.equal(progressionMultiplier(reload(s).values, 'companyIncome'), 1.03);
});
test('legacy XP and fractional reputation affect actual delivery credits while fines remain unchanged', () => {
  const s = new GameState(); s.values.legacyPoints = 3; s.progression.buyLegacy('experience'); s.progression.buyLegacy('reputation');
  for (let i = 0; i < 20; i++) deliver(s, { xpReward: 100 });
  assert.equal(s.values.xp, 2100); assert.equal(s.values.reputation, 24); // 40 XP / 3 reputation from capped streak milestones, without Legacy amplification.
  assert.ok(s.values.reputationRewardRemainder < 1e-6);
  const before = s.values.reputation; s.failOrder(2); assert.equal(s.values.reputation, before - 2);
});
test('small XP rewards retain the exact 3% bonus across save/load rather than rounding it away', () => {
  let s = new GameState(); s.values.legacyPoints = 1; s.progression.buyLegacy('experience');
  for (let i = 0; i < 10; i++) deliver(s, { xpReward: 10 });
  s = reload(s);
  for (let i = 0; i < 10; i++) deliver(s, { xpReward: 10 });
  assert.equal(s.values.xp, 246); assert.ok(s.values.xpRewardRemainder < 1e-6); // includes 40 direct streak XP.
});
test('legacy tips affect the real event payout, and completed order income includes separately credited event money', () => {
  const s = new GameState(); s.values.legacyPoints = 3; s.progression.buyLegacy('tips');
  let now = 0;
  const orders = new OrderManager({ state: s, restaurants, customers, now: () => now, random: () => 0 });
  orders.generate(); const events = new EventManager(s, orders, () => 0); orders.accept(); events.pending = null;
  orders.interact(orders.order.restaurant);
  events.active = { event: EVENTS.find(e => e.id === 'generous'), resume: () => {}, pausedAt: now }; events.resolve(); events.finish();
  assert.equal(s.values.personalRecords.biggestTip, 105);
  now = 30000; orders.interact(orders.order.customer);
  assert.equal(s.values.totalMoneyEarned, orders.order.reward + 105); assert.equal(s.values.personalRecords.mostMoneyInOrder, orders.order.reward + 105);
});
test('company bonus applies online/offline and settles elapsed income before upgrade at the old rate', () => {
  const s = new GameState(); let now = 0;
  s.update({ xp: xpForLevel(12), money: 500000 }); const c = new CompanyManager(s, { now: () => now, random: () => .5 });
  c.openCompany('Test'); c.hire(); const rate = c.incomeRate();
  s.values.legacyPoints = 2; now = 30000; s.progression.buyLegacy('business');
  assert.equal(s.values.companyLifetimeEarnings, Math.floor(rate / 2));
  assert.ok(Math.abs(c.incomeRate() / c.incomeRate({ ...s.values, legacyUpgrades: [] }) - 1.03) < 1e-9);
  const normal = reload(s), boosted = reload(s); normal.values.legacyUpgrades = [];
  const nc = new CompanyManager(normal), bc = new CompanyManager(boosted);
  const a = nc.accrue(60000, true), b = bc.accrue(60000, true); assert.ok(b > a); assert.ok(b >= a * 1.03 - 2);
});
test('all districts unlock achievement; Magnate requires all configured conditions and ordinary achievements, with one-time celebration', () => {
  const s = new GameState(); s.loadSaveData({ money: 54321, xp: xpForLevel(20), reputation: 100, ownedTransports: ['WALKING', 'CAR'],
    companyUnlocked: true, companyLevel: 4, companyLifetimeEarnings: 1000000, totalMoneyEarned: 500000, completedOrders: 100,
    unlockedDistricts: Object.keys(DISTRICTS), employees: Array.from({ length: 8 }, (_, i) => ({ id: `e-${i}` })),
    achievements: ACHIEVEMENTS.filter(a => !a.hidden).slice(0, 14).map(a => a.id) });
  // Migration derives more proven ordinary achievements and can complete the endgame.
  const magnate = CAREER_MILESTONES.at(-1);
  assert.ok(requirementsProgress(s.values, magnate).every(r => r.current >= r.target));
  assert.ok(s.values.achievements.includes('city')); assert.ok(s.values.careerMilestones.includes('magnate'));
  assert.equal(careerTitle(s.values), 'Курьерский магнат');
  const money = s.values.money; assert.ok(s.progression.claim('magnate', true).ok); assert.equal(s.values.legacyPoints, 5); assert.equal(s.values.money, money);
  assert.equal(s.progression.acknowledgeMagnate(), true); assert.equal(s.progression.acknowledgeMagnate(), false);
  const loaded = reload(s); assert.equal(loaded.progression.acknowledgeMagnate(), false); assert.equal(loaded.progression.claim('magnate', true).ok, false);
  const orders = loaded.values.completedOrders; deliver(loaded); assert.equal(loaded.values.completedOrders, orders + 1);
});
test('each Magnate requirement gates independently, secret achievements never satisfy the public count', () => {
  const magnate = CAREER_MILESTONES.at(-1);
  for (const requirement of magnate.requirements) {
    const s = new GameState();
    s.loadSaveData({ xp: xpForLevel(20), reputation: 100, ownedTransports: ['WALKING', 'CAR'], unlockedDistricts: Object.keys(DISTRICTS),
      companyUnlocked: true, companyLevel: 4, companyLifetimeEarnings: 1000000, totalMoneyEarned: 500000, completedOrders: 100,
      employees: Array.from({ length: 8 }, (_, i) => ({ id: `e-${i}` })), achievements: ACHIEVEMENTS.filter(a => !a.hidden).map(a => a.id) });
    s.values.careerMilestones = s.values.careerMilestones.filter(id => id !== 'magnate');
    const v = s.values;
    if (requirement.source === 'level') v.xp = xpForLevel(19);
    if (requirement.source === 'transport:CAR') v.ownedTransports = ['WALKING'];
    if (requirement.source === 'districts') v.unlockedDistricts = ['residential'];
    if (requirement.source === 'reputation') v.reputation = 99;
    if (requirement.source === 'companyLevel') v.companyLevel = v.officeLevel = 3;
    if (requirement.source === 'employees') v.employees.pop();
    if (requirement.source === 'personalEarnings') v.totalMoneyEarned = 499999;
    if (requirement.source === 'companyEarnings') v.companyLifetimeEarnings = 999999;
    if (requirement.source === 'deliveries') v.completedOrders = 99;
    if (requirement.source === 'publicAchievements') {
      v.achievements = ACHIEVEMENTS.filter(a => a.hidden).map(a => a.id); v.completedOrders = v.totalMoneyEarned = v.companyLifetimeEarnings = 0;
    }
    s.refresh(); assert.equal(v.careerMilestones.includes('magnate'), false, requirement.source);
  }
});
test('main goal changes after transport and district unlocks, then suggests remaining long-term achievements', () => {
  const s = new GameState(); assert.match(s.progression.suggestedGoal().title, /велосипед/);
  s.update({ money: 2000000, xp: xpForLevel(14), reputation: 100 });
  s.purchaseTransport('BICYCLE'); assert.match(s.progression.suggestedGoal().title, /мопед/);
  s.purchaseTransport('MOPED'); s.purchaseTransport('CAR');
  assert.match(s.progression.suggestedGoal().title, /Центр/);
  assert.ok(s.progression.suggestedRequirements().some(r => r.source === 'wallet' && r.target === DISTRICTS.center.cost));
  s.values.money = 2000000;
  for (const id of Object.keys(DISTRICTS).slice(1)) assert.ok(s.unlockDistrict(id));
  assert.match(s.progression.suggestedGoal().title, /компанию/);
  const c = new CompanyManager(s); s.values.money = 2000000; c.openCompany('Test');
  assert.match(s.progression.suggestedGoal().title, /Пеший курьер/);
  s.values.careerMilestones = CAREER_MILESTONES.map(m => m.id);
  s.values.completedOrders = 100; s.values.totalMoneyEarned = 500000; s.values.companyLifetimeEarnings = 1000000;
  s.values.companyRecords.mostEmployees = 8;
  s.values.employees = Array.from({ length: 8 }, (_, i) => ({ id: `test-${i}`, level: 1, totalEarned: 0 }));
  s.values.districtStats = Object.fromEntries(Object.keys(DISTRICTS).map(id => [id, { completedOrders: 50 }]));
  s.values.achievements = ACHIEVEMENTS.filter(a => !a.hidden && a.id !== 'machine').map(a => a.id);
  assert.match(s.progression.suggestedGoal().title, /Машина доставки/);
  s.values.achievements.push('machine'); assert.match(s.progression.suggestedGoal().title, /рекорды/);
});
