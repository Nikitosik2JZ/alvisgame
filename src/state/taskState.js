import { DAILY_TASKS, instantiateTask, ROTATING_TASK_IDS } from '../data/dailyTasks.js';
import { TASK_CONFIG, validTaskDate } from '../config/taskConfig.js';
const count = n => Number.isSafeInteger(n) && n >= 0 ? n : 0;
export const initialTaskState = () => ({ dailyTaskDate: null, lastDailyResetDate: null, dailyTasks: [], dailyTaskCompletionBonusClaimed: false, dailyTaskSetCompleted: false,
  dailyRewardTier: 'EARLY', lastDailyBonusClaimDate: null, currentDeliveryStreak: 0, bestDeliveryStreak: 0,
  rotatingChallenge: null, rotatingChallengeDate: null, rotatingChallengeProgress: 0, tasksIntroductionSeen: false,
  dailyTasksCompleted: 0, dailySetsCompleted: 0, totalChallengesCompleted: 0, rotatingChallengesCompleted: 0 });
export function loadTaskState(data) {
  const s = initialTaskState();
  for (const key of ['dailyTaskDate', 'lastDailyResetDate', 'lastDailyBonusClaimDate', 'rotatingChallengeDate']) s[key] = validTaskDate(data[key]);
  // Keep a monotonic calendar high-water mark, including previously claimed bonus dates.
  s.lastDailyResetDate = [s.lastDailyResetDate, s.dailyTaskDate, s.lastDailyBonusClaimDate, s.rotatingChallengeDate].filter(Boolean).sort().at(-1) || null;
  for (const key of ['currentDeliveryStreak', 'bestDeliveryStreak', 'dailyTasksCompleted', 'dailySetsCompleted', 'totalChallengesCompleted', 'rotatingChallengesCompleted']) s[key] = count(data[key]);
  s.bestDeliveryStreak = Math.max(s.bestDeliveryStreak, s.currentDeliveryStreak);
  for (const key of ['dailyTaskCompletionBonusClaimed', 'dailyTaskSetCompleted', 'tasksIntroductionSeen']) s[key] = data[key] === true;
  const tier = TASK_CONFIG.tiers.find(t => t.id === data.dailyRewardTier) || TASK_CONFIG.tiers[0]; s.dailyRewardTier = tier.id;
  const normalize = (row, rotating = false) => {
    const d = DAILY_TASKS.find(d => d.id === row?.id); if (!d || (rotating && !ROTATING_TASK_IDS.includes(d.id))) return null;
    const taskTier = TASK_CONFIG.tiers.find(t => t.id === row.tier) || tier;
    const result = instantiateTask(d, taskTier.minLevel, rotating);
    result.currentProgress = Math.min(result.target, count(row.currentProgress)); result.completed = result.currentProgress >= result.target;
    result.claimed = result.completed && row.claimed === true; return result;
  };
  const categories = new Set();
  s.dailyTasks = (Array.isArray(data.dailyTasks) ? data.dailyTasks : []).map(row => normalize(row)).filter(t => {
    if (!t || categories.has(t.category)) return false; categories.add(t.category); return true;
  }).slice(0, TASK_CONFIG.dailyCount);
  s.dailyTaskSetCompleted = s.dailyTasks.length === TASK_CONFIG.dailyCount && s.dailyTasks.every(t => t.completed);
  s.dailyTaskCompletionBonusClaimed = s.dailyTaskSetCompleted && s.dailyTaskCompletionBonusClaimed;
  s.rotatingChallenge = normalize(data.rotatingChallenge, true); s.rotatingChallengeProgress = s.rotatingChallenge?.currentProgress || 0;
  return s;
}
