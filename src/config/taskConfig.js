// Local clock adapter can be replaced by platform-aware time in a later stage.
export const localTaskDate = (date = new Date()) => {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
export const validTaskDate = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return localTaskDate(new Date(`${value}T12:00:00`)) === value ? value : null;
};
export const TASK_CONFIG = {
  unlock: { dailyBonus: 1, daily: 2, session: 3, rotating: 5 }, dailyCount: 3,
  tiers: [
    { id: 'EARLY', minLevel: 1, targets: { delivery: 3, money: 800, reputation: 4, type: 1, transport: 2, district: 2, tips: 1, streak: 3, company: 1000, event: 1, fast: 1, clean: 3 }, reward: { money: 100, xp: 10 }, completionBonus: { money: 200, xp: 20, reputation: 1 }, dailyBonus: { money: 300 }, rotatingReward: { money: 350, xp: 35, reputation: 2 } },
    { id: 'MID', minLevel: 6, targets: { delivery: 5, money: 3000, reputation: 10, type: 2, transport: 3, district: 3, tips: 2, streak: 4, company: 3000, event: 1, fast: 2, clean: 5 }, reward: { money: 200, xp: 20 }, completionBonus: { money: 400, xp: 40, reputation: 2 }, dailyBonus: { money: 700 }, rotatingReward: { money: 700, xp: 60, reputation: 3 } },
    { id: 'LATE', minLevel: 12, targets: { delivery: 8, money: 8000, reputation: 18, type: 2, transport: 5, district: 4, tips: 3, streak: 5, company: 5000, event: 2, fast: 3, clean: 7 }, reward: { money: 350, xp: 30 }, completionBonus: { money: 700, xp: 60, reputation: 3 }, dailyBonus: { money: 1500 }, rotatingReward: { money: 1200, xp: 100, reputation: 4 } },
  ],
  fastSeconds: 20, rotatingTargetMultiplier: 2, sessionCooldownDeliveries: 2,
  sessionReward: { money: 120, xp: 10 }, sessionTarget: 3,
  streakHUDMinimum: 3, streakBonusCap: .15,
  streakMilestones: [{ count: 3, xp: 10 }, { count: 5, moneyBonus: .05 }, { count: 10, moneyBonus: .10, reputation: 1 }, { count: 20, moneyBonus: .15, xp: 30, reputation: 2 }],
};
export const taskTier = level => [...TASK_CONFIG.tiers].reverse().find(t => level >= t.minLevel) || TASK_CONFIG.tiers[0];
export const streakMilestone = count => TASK_CONFIG.streakMilestones.find(m => m.count === count);
export const nextStreakBonus = s => Math.min(TASK_CONFIG.streakBonusCap, streakMilestone((s.currentDeliveryStreak || 0) + 1)?.moneyBonus || 0);
