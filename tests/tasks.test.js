import test from 'node:test';
import assert from 'node:assert/strict';
import { GameState } from '../src/state/GameState.js';
import { DAILY_TASKS, instantiateTask, taskEligible } from '../src/data/dailyTasks.js';
import { TASK_CONFIG, localTaskDate, validTaskDate, nextStreakBonus } from '../src/config/taskConfig.js';
import { xpForLevel } from '../src/config/gameBalance.js';
import { calculateDeliveryReward } from '../src/managers/DeliveryRewards.js';
import { OrderManager } from '../src/managers/OrderManager.js';
import { CompanyManager } from '../src/managers/CompanyManager.js';
import { EventManager } from '../src/managers/EventManager.js';
import { EVENTS } from '../src/data/events.js';
import { restaurants, customers } from '../src/world/deliveryLocations.js';

function fixture(level = 6) {
  let date = '2026-10-07'; const s = new GameState({ tasks: { date: () => date } }); s.update({ xp: xpForLevel(level) });
  return { s, day: value => { date = value; s.tasks.checkDate(); } };
}
const install = (s, ids) => { s.values.dailyTasks = ids.map(id => instantiateTask(DAILY_TASKS.find(t => t.id === id), s.values.level)); };
const deliver = (s, overrides = {}) => s.addRewards({ reward: 400, xpReward: 20, reputationReward: 2, distance: 300, type: 'STANDARD', remainingSeconds: 30, ...overrides });
const reload = s => { const result = fixture(s.values.level).s; result.loadSaveData(JSON.parse(JSON.stringify(s.getSaveData()))); return result; };

test('staged unlocks; local dates validate calendar and invalid time safely', () => {
  const { s } = fixture(1); assert.equal(s.values.dailyTasks.length, 0); assert.equal(s.tasks.currentSessionChallenge, null); assert.equal(s.values.rotatingChallenge, null);
  assert.ok(s.tasks.canClaimBonus()); s.update({ xp: xpForLevel(2) }); assert.equal(s.values.dailyTasks.length, 3); assert.equal(s.tasks.currentSessionChallenge, null);
  s.update({ xp: xpForLevel(3) }); assert.ok(s.tasks.currentSessionChallenge); s.update({ xp: xpForLevel(5) }); assert.ok(s.values.rotatingChallenge);
  assert.equal(localTaskDate(new Date(NaN)), null); assert.equal(validTaskDate('2026-02-30'), null); assert.equal(validTaskDate('2024-02-29'), '2024-02-29'); assert.equal(validTaskDate('bad'), null);
});
test('28 templates; 3 diverse achievable daily tasks over many dates and progression tiers', () => {
  assert.equal(DAILY_TASKS.length, 28);
  for (const level of [2, 6, 12, 20]) {
    const { s, day } = fixture(level); let previous;
    for (let i = 1; i <= 28; i++) {
      day(`2026-11-${String(i).padStart(2, '0')}`);
      const rows = s.values.dailyTasks; assert.equal(rows.length, 3); assert.equal(new Set(rows.map(t => t.category)).size, 3);
      for (const row of rows) assert.ok(taskEligible(DAILY_TASKS.find(t => t.id === row.id), s.values));
      const current = rows.map(t => t.id).sort().join(); if (previous) assert.notEqual(current, previous); previous = current;
    }
  }
});
test('locked districts, unowned transport, Elite, Double, Large and empty company excluded; actual unlocks enable them', () => {
  const { s } = fixture(2), eligible = id => taskEligible(DAILY_TASKS.find(t => t.id === id), s.values);
  for (const id of ['district-business', 'district-center', 'transport-CAR', 'type-ELITE', 'type-DOUBLE', 'type-LARGE', 'company-collect', 'company-generate']) assert.equal(eligible(id), false, id);
  s.values.companyUnlocked = true; assert.equal(eligible('company-collect'), false); s.values.companyBalance = 1000; assert.ok(eligible('company-collect'));
  s.values.ownedTransports.push('CAR'); s.values.unlockedDistricts.push('business'); s.update({ xp: xpForLevel(14), reputation: 70 });
  for (const id of ['transport-CAR', 'district-business', 'type-LARGE', 'type-ELITE', 'type-DOUBLE']) assert.ok(eligible(id), id);
  s.update({ reputation: 59 }); assert.equal(eligible('type-ELITE'), false);
});
test('delivery progress and completion notify only near end and once; claims persist atomically without gameplay income inflation', () => {
  const { s } = fixture(2); install(s, ['deliveries', 'earnings', 'reputation']); const notifications = []; s.tasks.subscribe(e => notifications.push(e));
  deliver(s); assert.equal(s.values.dailyTasks[0].currentProgress, 1); assert.equal(notifications.length, 0);
  deliver(s); assert.ok(notifications.some(e => e.text.includes('Остался 1 заказ'))); deliver(s);
  assert.equal(s.values.dailyTasksCompleted, 3); assert.equal(s.values.dailySetsCompleted, 1); assert.ok(s.values.achievements.includes('daily-plan'));
  deliver(s); assert.equal(s.values.dailyTasksCompleted, 3); assert.equal(s.values.dailySetsCompleted, 1);
  const income = s.values.totalMoneyEarned; assert.ok(s.tasks.claim('deliveries').ok); const money = s.values.money;
  assert.equal(s.tasks.claim('deliveries').ok, false); assert.equal(s.values.money, money); assert.equal(s.values.totalMoneyEarned, income);
  const loaded = reload(s); assert.equal(loaded.tasks.claim('deliveries').ok, false); assert.deepEqual(loaded.values.dailyTasks, s.values.dailyTasks);
});
test('all daily bonus and login bonus claim once across reload, scene-like subscriptions and date changes', () => {
  const { s, day } = fixture(2); assert.equal(s.tasks.claimCompletionBonus().ok, false); install(s, ['deliveries', 'earnings', 'reputation']);
  for (let i = 0; i < 3; i++) deliver(s);
  assert.ok(s.tasks.claimCompletionBonus().ok); assert.equal(s.tasks.claimCompletionBonus().ok, false);
  assert.ok(s.tasks.claimDailyBonus().ok); assert.equal(s.tasks.claimDailyBonus().ok, false); const loaded = reload(s);
  assert.equal(loaded.tasks.claimDailyBonus().ok, false); assert.equal(loaded.tasks.claimCompletionBonus().ok, false);
  day('2026-10-08'); assert.ok(s.tasks.claimDailyBonus().ok); assert.equal(s.values.dailyTaskCompletionBonusClaimed, false); assert.equal(s.values.dailyTaskSetCompleted, false);
});
test('same date and backward clock cannot recycle rewards or tasks; returning after a break never removes progression or streak', () => {
  const { s, day } = fixture(6); s.tasks.claimDailyBonus(); deliver(s); const original = structuredClone(s.values.dailyTasks), money = s.values.money;
  day('2026-10-07'); assert.deepEqual(s.values.dailyTasks, original); day('2026-09-01'); assert.deepEqual(s.values.dailyTasks, original); assert.equal(s.tasks.claimDailyBonus().ok, false);
  assert.equal(s.values.money, money); day('2026-10-30'); assert.notDeepEqual(s.values.dailyTasks, original); assert.equal(s.values.currentDeliveryStreak, 1); assert.equal(s.values.completedOrders, 1); assert.equal(s.values.money, money);
  day('2026-10-07'); assert.equal(s.values.lastDailyResetDate, '2026-10-30'); assert.ok(s.tasks.claimDailyBonus().ok); assert.equal(s.tasks.claimDailyBonus().ok, false);
});
test('invalid save dates and task data are repaired without deleting old assets or trusting reward injection', () => {
  const { s } = fixture(6); s.loadSaveData({ version: 9, money: 9999, xp: xpForLevel(6), completedOrders: 14, dailyTaskDate: '2026-02-30', lastDailyResetDate: NaN,
    currentDeliveryStreak: -2, bestDeliveryStreak: Infinity, dailyTasks: [{ id: 'deliveries', target: 0, currentProgress: -1, reward: { money: 99999999 }, claimed: true }], dailyTaskSetCompleted: true });
  assert.equal(s.values.money, 9999); assert.equal(s.values.completedOrders, 14); assert.equal(s.values.dailyTasks.length, 3); assert.equal(s.values.dailyTaskDate, '2026-10-07');
  assert.equal(s.values.currentDeliveryStreak, 0); assert.equal(s.values.bestDeliveryStreak, 0); assert.equal(s.values.dailyTaskSetCompleted, false);
  assert.ok(s.values.dailyTasks.every(t => t.target > 0 && !t.claimed && t.reward.money < 1000));
  const loaded = reload(s); assert.deepEqual(loaded.getSaveData(), s.getSaveData());
});
test('saved high-water date includes last bonus claim even if reset/date fields are corrupt', () => {
  const { s, day } = fixture(6); s.loadSaveData({ xp: xpForLevel(6), lastDailyBonusClaimDate: '2026-10-12', lastDailyResetDate: 'broken' });
  assert.equal(s.values.lastDailyResetDate, '2026-10-12'); assert.equal(s.tasks.claimDailyBonus().ok, false); day('2026-10-13'); assert.ok(s.tasks.claimDailyBonus().ok);
});
test('type, transport, district, speed and session earnings update only on matching completed orders', () => {
  const { s } = fixture(6); install(s, ['transport-BICYCLE', 'district-center', 'type-URGENT']);
  deliver(s); assert.ok(s.values.dailyTasks.every(t => t.currentProgress === 0)); s.values.equippedTransport = 'BICYCLE';
  deliver(s, { type: 'URGENT', district: 'center' }); assert.ok(s.values.dailyTasks.every(t => t.currentProgress === 1));
  install(s, ['fast-delivery', 'session-money', 'tips']); deliver(s, { remainingSeconds: 19 }); assert.equal(s.values.dailyTasks[0].currentProgress, 0);
  deliver(s, { remainingSeconds: 20 }); assert.equal(s.values.dailyTasks[0].currentProgress, 1); assert.equal(s.values.dailyTasks[1].currentProgress, 800);
  const before = s.values.dailyTasks[1].currentProgress; s.tasks.claimDailyBonus(); s.applyEventMoney(100, true); assert.equal(s.values.dailyTasks[1].currentProgress, before); assert.equal(s.values.dailyTasks[2].currentProgress, 1);
  assert.deepEqual(reload(s).values.dailyTasks, s.values.dailyTasks);
});
test('streaks persist, ignore event money/reputation penalties, fail once and keep best record', () => {
  const { s } = fixture(6); install(s, ['no-failure', 'no-complaints', 'earnings']);
  deliver(s); s.applyEventMoney(-100); s.tasks.gameplayEvent('negativeReputation'); s.update({ reputation: s.values.reputation - 1 });
  assert.equal(s.values.currentDeliveryStreak, 1); assert.equal(s.values.dailyTasks[1].currentProgress, 0);
  deliver(s, { negativeReputation: true }); assert.equal(s.values.currentDeliveryStreak, 2); assert.equal(s.values.dailyTasks[1].currentProgress, 0);
  const loaded = reload(s); assert.equal(loaded.values.currentDeliveryStreak, 2); loaded.failOrder(2); assert.equal(loaded.values.currentDeliveryStreak, 0); assert.equal(loaded.values.bestDeliveryStreak, 2);
  assert.equal(loaded.values.dailyTasks[0].currentProgress, 0);
});
test('streak milestones and additive money cap apply only on their delivery, work on Elite without exponential modifiers', () => {
  const { s } = fixture(14); s.values.equippedItems.BAG = 'thermobag'; s.values.demandBonusOrders = 3;
  for (const [before, bonus] of [[1, 0], [4, .05], [9, .1], [19, .15], [99, 0]]) {
    s.values.currentDeliveryStreak = before; const result = calculateDeliveryReward(2000, s.values, { type: 'ELITE', extraMoney: 50 });
    assert.equal(nextStreakBonus(s.values), bonus); assert.equal(result.modifiers.find(m => m.id === 'streak')?.amount || 0, 2000 * bonus);
    assert.equal(result.total, result.baseReward + result.modifiers.reduce((sum, m) => sum + m.amount, 0)); assert.ok(result.total < 4000);
  }
  const previous = TASK_CONFIG.streakMilestones[3].moneyBonus; try { TASK_CONFIG.streakMilestones[3].moneyBonus = 9; s.values.currentDeliveryStreak = 19; assert.equal(nextStreakBonus(s.values), .15); } finally { TASK_CONFIG.streakMilestones[3].moneyBonus = previous; }
  s.values.currentDeliveryStreak = 2; const xp = s.values.xp; deliver(s); assert.equal(s.values.xp - xp, 30);
});
test('Double final handoff increments tasks/streak once; expiration resets once', () => {
  const { s } = fixture(6); s.values.ownedTransports.push('BICYCLE'); s.equipTransport('BICYCLE'); install(s, ['deliveries', 'earnings', 'reputation']);
  let time = 0; const orders = new OrderManager({ state: s, restaurants, customers, random: () => 0, now: () => time });
  orders.generate({ forcedType: 'DOUBLE' }); orders.accept(); orders.interact(orders.order.restaurant); orders.interact(orders.order.customer);
  assert.equal(s.values.currentDeliveryStreak, 0); orders.interact(orders.order.customer); assert.equal(s.values.currentDeliveryStreak, 1); assert.equal(s.values.dailyTasks[0].currentProgress, 1);
  assert.equal(orders.completeStop(), false); assert.equal(s.values.completedOrders, 1);
  orders.order = null; orders.generate({ forcedType: 'DOUBLE' }); orders.accept(); time = orders.order.deadline; orders.update(); orders.update(); assert.equal(s.values.failedOrders, 1); assert.equal(s.values.currentDeliveryStreak, 0); orders.destroy();
});
test('session challenge is opt-in, failures restart current sequence; completion claim once and two-delivery cooldown', () => {
  const { s } = fixture(6); deliver(s); assert.equal(s.tasks.currentSessionChallenge.currentProgress, 0); assert.ok(s.tasks.acceptSession().ok);
  deliver(s); s.failOrder(2); assert.equal(s.tasks.currentSessionChallenge.currentProgress, 0);
  for (let i = 0; i < 3; i++) deliver(s); const id = s.tasks.currentSessionChallenge.id;
  assert.equal(s.values.totalChallengesCompleted, 1); assert.ok(s.tasks.claim(id, 'session').ok); assert.equal(s.tasks.claim(id, 'session').ok, false); assert.equal(s.tasks.currentSessionChallenge, null);
  deliver(s); assert.equal(s.tasks.currentSessionChallenge, null); deliver(s); assert.ok(s.tasks.currentSessionChallenge); s.tasks.declineSession(); assert.equal(s.tasks.currentSessionChallenge, null);
});
test('urgent speed session challenge requires both correct type and time left', () => {
  const { s } = fixture(6); s.tasks.sessionSequence = 2; s.tasks.currentSessionChallenge = null; s.tasks.sync(); s.tasks.acceptSession();
  deliver(s, { type: 'STANDARD', remainingSeconds: 90 }); deliver(s, { type: 'URGENT', remainingSeconds: 19.9 }); assert.equal(s.tasks.currentSessionChallenge.completed, false);
  deliver(s, { type: 'URGENT', remainingSeconds: 20 }); assert.equal(s.tasks.currentSessionChallenge.completed, true);
});
test('rotating task progresses, claims once, survives reload and refreshes with date without penalties', () => {
  const { s, day } = fixture(6); s.values.rotatingChallenge = instantiateTask(DAILY_TASKS[0], 6, true);
  for (let i = 0; i < 10; i++) deliver(s); assert.equal(s.values.rotatingChallengeProgress, 10); assert.equal(s.values.rotatingChallengesCompleted, 1);
  const loaded = reload(s); assert.equal(loaded.values.rotatingChallenge.completed, true); assert.ok(loaded.tasks.claim('deliveries', 'rotating').ok); assert.equal(reload(loaded).tasks.claim('deliveries', 'rotating').ok, false);
  day('2026-10-08'); assert.equal(s.values.rotatingChallengeProgress, 0); assert.equal(s.values.rotatingChallengesCompleted, 1);
});
test('company income generation and collection are independent of personal delivery earnings', () => {
  const { s } = fixture(12); const company = new CompanyManager(s, { now: () => 0 }); s.update({ money: 1000000 }); assert.ok(company.openCompany('Тест').ok); assert.ok(company.hire().ok); install(s, ['company-collect', 'company-generate', 'deliveries']);
  company.accrue(600000); s.refresh(); const generated = s.values.dailyTasks[1].currentProgress; assert.ok(generated > 0);
  assert.ok(company.collect().ok); assert.ok(s.values.dailyTasks[0].currentProgress > 0); assert.equal(s.values.dailyTasks[1].currentProgress, generated);
  assert.equal(s.values.totalMoneyEarned, 0); assert.equal(s.values.currentDeliveryStreak, 0); s.refresh(); assert.equal(s.values.dailyTasks[1].currentProgress, generated);
});
test('resolved real positive and choice events advance tasks once; reputation penalties do not terminate delivery streak', () => {
  const { s } = fixture(6); install(s, ['positive-event', 'choice-success', 'reputation']);
  const orders = new OrderManager({ state: s, restaurants, customers, random: () => 0 }); orders.generate(); orders.accept();
  const events = new EventManager(s, orders, () => .99); events.active = { event: EVENTS.find(e => e.id === 'fries'), pausedAt: 0, resolved: false, resume: () => {} }; events.resolve(0); events.resolve(0);
  assert.equal(s.values.dailyTasks[1].currentProgress, 1); assert.equal(s.values.dailyTasks[2].currentProgress, 1);
  events.active = { event: EVENTS.find(e => e.id === 'big-tips'), pausedAt: 0, resolved: false, resume: () => {} }; events.resolve(); assert.equal(s.values.dailyTasks[0].currentProgress, 1); orders.destroy();
});
test('task snapshots cannot mutate rewards or claim ledgers and task achievements stay data driven', () => {
  const { s } = fixture(6); const snapshot = s.getSnapshot(); snapshot.dailyTasks[0].reward.money = 999999; snapshot.dailyTasks[0].claimed = true; snapshot.rotatingChallenge.currentProgress = 999;
  assert.equal(s.values.dailyTasks[0].claimed, false); assert.ok(s.values.dailyTasks[0].reward.money < 1000); assert.equal(s.values.rotatingChallenge.currentProgress, 0);
  s.values.bestDeliveryStreak = 10; s.values.dailyTasksCompleted = 25; s.values.totalChallengesCompleted = 10; s.refresh();
  for (const id of ['streak-five', 'streak-ten', 'daily-worker', 'challenge-fan']) assert.ok(s.values.achievements.includes(id));
});
