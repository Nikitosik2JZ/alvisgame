import { t as tr } from '../services/LocalizationService.js';
import { TASK_CONFIG, localTaskDate, validTaskDate, taskTier, streakMilestone } from '../config/taskConfig.js';
import { DAILY_TASKS, instantiateTask, taskEligible, ROTATING_TASK_IDS, SESSION_CHALLENGES } from '../data/dailyTasks.js';

const hash = text => [...text].reduce((n, c) => Math.imul(n ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
export class TaskManager {
  constructor(state, { date = () => localTaskDate() } = {}) {
    this.state = state; this.date = date; this.listeners = new Set(); this.resetSession();
  }
  resetSession() { this.currentSessionChallenge = null; this.sessionSequence = 0; this.sessionOfferAfter = 0; this.companyEarnings = this.state.values.companyLifetimeEarnings; }
  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  emit(text) { for (const listener of this.listeners) listener({ text }); }
  get effectiveDate() {
    const date = validTaskDate(this.date()), last = this.state.values.lastDailyResetDate;
    return [date, last].filter(Boolean).sort().at(-1) || null;
  }
  select(date, count, rotating = false, previous = []) {
    const s = this.state.values, ids = new Set(previous.map(t => t.id));
    const pool = DAILY_TASKS.filter(d => taskEligible(d, s) && (!rotating || ROTATING_TASK_IDS.includes(d.id)))
      .sort((a, b) => Number(ids.has(a.id)) - Number(ids.has(b.id)) || hash(`${date}:${rotating}:${a.id}`) - hash(`${date}:${rotating}:${b.id}`));
    const categories = new Set(), result = [];
    for (const d of pool) { if (categories.has(d.category)) continue; categories.add(d.category); result.push(instantiateTask(d, s.level, rotating)); if (result.length === count) break; }
    return result;
  }
  // Called on state mutations and a lightweight calendar timer / focus event, never per frame.
  sync() {
    const s = this.state.values, date = this.effectiveDate;
    if (!date) return false;
    let changed = false;
    if (s.lastDailyResetDate !== date) { s.lastDailyResetDate = date; changed = true; }
    if (s.level >= TASK_CONFIG.unlock.daily && (s.dailyTaskDate !== date || s.dailyTasks.length !== TASK_CONFIG.dailyCount)) {
      const firstSet = !s.dailyTaskDate;
      s.dailyTasks = this.select(date, TASK_CONFIG.dailyCount, false, s.dailyTasks); s.dailyTaskDate = date;
      s.dailyRewardTier = taskTier(s.level).id; s.dailyTaskCompletionBonusClaimed = false; s.dailyTaskSetCompleted = false; changed = true;
      if (firstSet && !this.state.loadingProgression) this.emit(tr('task-manager.001'));
    }
    if (s.level >= TASK_CONFIG.unlock.rotating && (s.rotatingChallengeDate !== date || !s.rotatingChallenge)) {
      s.rotatingChallenge = this.select(date, 1, true, s.rotatingChallenge ? [s.rotatingChallenge] : [])[0];
      s.rotatingChallengeDate = date; s.rotatingChallengeProgress = 0; changed = true;
    }
    const companyDelta = Math.max(0, s.companyLifetimeEarnings - (this.companyEarnings ?? s.companyLifetimeEarnings));
    this.companyEarnings = s.companyLifetimeEarnings;
    if (companyDelta) this.advance('companyIncome', { amount: companyDelta });
    if (s.level >= TASK_CONFIG.unlock.session && !this.currentSessionChallenge && s.completedOrders >= this.sessionOfferAfter) {
      const d = SESSION_CHALLENGES[this.sessionSequence++ % SESSION_CHALLENGES.length];
      this.currentSessionChallenge = { ...d, target: d.id === 'session-speed' ? 1 : TASK_CONFIG.sessionTarget, currentProgress: 0,
        completed: false, claimed: false, accepted: false, reward: { ...TASK_CONFIG.sessionReward } }; changed = true;
      if (!this.state.loadingProgression) this.emit(tr('task-manager.002', { v0: d.title }));
    }
    return changed;
  }
  checkDate() { if (this.sync()) this.state.refresh(); }
  tasks() { return [...this.state.values.dailyTasks, this.state.values.rotatingChallenge, this.currentSessionChallenge?.accepted ? this.currentSessionChallenge : null].filter(Boolean); }
  complete(task) {
    if (task.completed) return;
    task.completed = true;
    const s = this.state.values;
    if (s.dailyTasks.includes(task)) s.dailyTasksCompleted++;
    else { s.totalChallengesCompleted++; if (task === s.rotatingChallenge) s.rotatingChallengesCompleted++; }
    this.emit(tr('task-manager.003', { v0: task.title }));
    if (!s.dailyTaskSetCompleted && s.dailyTasks.length === TASK_CONFIG.dailyCount && s.dailyTasks.every(t => t.completed)) {
      s.dailyTaskSetCompleted = true; s.dailySetsCompleted++; this.emit(tr('task-manager.004'));
    }
  }
  advance(type, payload = {}) {
    const s = this.state.values;
    for (const task of this.tasks()) {
      if (task.completed) continue;
      const d = DAILY_TASKS.find(d => d.id === task.id) || task, filter = d.filter || {};
      if (type === 'failed' && ['consecutive', 'clean'].includes(task.type)) { task.currentProgress = 0; continue; }
      if (type === 'negativeReputation' && task.type === 'clean') { task.currentProgress = 0; continue; }
      let amount = 0;
      if (type === 'delivery') {
        if (filter.orderType && filter.orderType !== payload.type || filter.transport && filter.transport !== payload.transport || filter.district && filter.district !== payload.district || filter.fast && (!Number.isFinite(payload.remainingSeconds) || payload.remainingSeconds < TASK_CONFIG.fastSeconds)) continue;
        if (['delivery', 'consecutive'].includes(task.type)) amount = 1;
        if (task.type === 'clean') { if (payload.negativeReputation) { task.currentProgress = 0; continue; } amount = 1; }
        if (task.type === 'money') amount = payload.reward;
        if (task.type === 'sessionMoney') amount = payload.reward;
      } else if (type === task.type) amount = payload.amount ?? 1;
      const before = task.currentProgress;
      task.currentProgress = Math.min(task.target, task.currentProgress + Math.max(0, amount));
      if (task.currentProgress >= task.target) this.complete(task);
      else if (['delivery', 'consecutive'].includes(task.type) && task.target > 2 && before < task.target - 1 && task.currentProgress === task.target - 1)
        this.emit(tr('task-manager.005', { v0: task.title }));
    }
    s.rotatingChallengeProgress = s.rotatingChallenge?.currentProgress || 0;
  }
  delivery(payload) {
    this.sync(); const s = this.state.values;
    s.currentDeliveryStreak++; s.bestDeliveryStreak = Math.max(s.bestDeliveryStreak, s.currentDeliveryStreak);
    const milestone = streakMilestone(s.currentDeliveryStreak);
    if (milestone) {
      s.xp += milestone.xp || 0; s.reputation += milestone.reputation || 0;
      this.emit(tr('task-manager.007', { v0: s.currentDeliveryStreak, v1: milestone.moneyBonus ? tr('task-manager.006', { v0: Math.round(Math.min(TASK_CONFIG.streakBonusCap, milestone.moneyBonus) * 100) }) : tr('common.xpReward', { amount: milestone.xp }) }));
    }
    this.advance('delivery', payload);
    // Task/streak rewards are not gameplay earnings or reputation task progress.
    if (payload.reputation > 0) this.advance('reputation', { amount: payload.reputation });
  }
  failure() {
    this.sync(); const s = this.state.values;
    if (s.currentDeliveryStreak >= TASK_CONFIG.streakHUDMinimum) this.emit(tr('task-manager.008', { v0: s.bestDeliveryStreak }));
    s.currentDeliveryStreak = 0; this.advance('failed');
  }
  gameplayEvent(type, payload = {}) { this.sync(); this.advance(type, payload); }
  pay(reward) {
    const s = this.state.values;
    s.money += reward.money || 0; s.xp += reward.xp || 0; s.reputation += reward.reputation || 0;
    this.state.refresh(); return { ok: true };
  }
  claim(id, group = 'daily') {
    this.checkDate(); const s = this.state.values;
    const task = group === 'session' ? this.currentSessionChallenge : group === 'rotating' ? s.rotatingChallenge : s.dailyTasks.find(t => t.id === id);
    if (!task || task.id !== id || !task.completed || task.claimed) return { ok: false, reason: tr('achievement-manager.005') };
    task.claimed = true;
    if (group === 'session') { this.currentSessionChallenge = null; this.sessionOfferAfter = s.completedOrders + TASK_CONFIG.sessionCooldownDeliveries; }
    return this.pay(task.reward);
  }
  get completionReward() { return TASK_CONFIG.tiers.find(t => t.id === this.state.values.dailyRewardTier).completionBonus; }
  get bonusReward() { return taskTier(this.state.values.level).dailyBonus; }
  canClaimBonus() { const s = this.state.values; return s.level >= TASK_CONFIG.unlock.dailyBonus && Boolean(this.effectiveDate) && (!s.lastDailyBonusClaimDate || s.lastDailyBonusClaimDate < this.effectiveDate); }
  claimDailyBonus() {
    this.checkDate(); if (!this.canClaimBonus()) return { ok: false, reason: tr('task-manager.009') };
    this.state.values.lastDailyBonusClaimDate = this.effectiveDate; return this.pay(this.bonusReward);
  }
  claimCompletionBonus() {
    this.checkDate(); const s = this.state.values;
    if (!s.dailyTaskSetCompleted || s.dailyTaskCompletionBonusClaimed) return { ok: false, reason: tr('task-manager.010') };
    s.dailyTaskCompletionBonusClaimed = true; return this.pay(this.completionReward);
  }
  acceptSession() {
    this.checkDate(); if (!this.currentSessionChallenge || this.currentSessionChallenge.accepted) return { ok: false, reason: tr('task-manager.011') };
    this.currentSessionChallenge.accepted = true; this.state.refresh(); return { ok: true };
  }
  declineSession() {
    this.currentSessionChallenge = null; this.sessionOfferAfter = this.state.values.completedOrders + TASK_CONFIG.sessionCooldownDeliveries;
    this.state.refresh(); return { ok: true };
  }
  pendingRewards() { return Number(this.canClaimBonus()) + Number(this.state.values.dailyTaskSetCompleted && !this.state.values.dailyTaskCompletionBonusClaimed) + this.tasks().filter(t => t.completed && !t.claimed).length; }
}
