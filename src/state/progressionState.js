import { ACHIEVEMENTS } from '../data/achievements.js';
import { CAREER_MILESTONES } from '../config/progressionConfig.js';
import { LEGACY_UPGRADES } from '../config/legacyConfig.js';

export const EVENT_COUNTERS = ['disputeWon', 'friesCaught', 'veryRarePositive', 'negativePair', 'friesHonest', 'friesEscaped', 'walkingOwner', 'eliteDelivery', 'rareEvents'];
export const initialProgressionState = () => ({
  achievements: [], claimedAchievementRewards: [], careerMilestones: [], claimedCareerRewards: [], legacyPoints: 0,
  legacyPointsEarned: 0, legacyUpgrades: [], selectedTitle: null, magnateCelebrationSeen: false, reputationRewardRemainder: 0, xpRewardRemainder: 0,
  eventCounters: Object.fromEntries(EVENT_COUNTERS.map(k => [k, 0])), eventNegativeStreak: 0,
  personalRecords: { fastestDeliverySeconds: null, highestDeliveryReward: 0, biggestTip: 0, mostMoneyInOrder: 0,
    highestReputation: 0, highestLevel: 1 },
  companyRecords: { mostEmployees: 0, highestEmployeeLevel: 0, bestEmployeeEarnings: 0 },
});
const safe = n => Number.isFinite(n) && n >= 0 && n <= Number.MAX_SAFE_INTEGER;
const ids = (data, definitions) => Array.isArray(data) ? [...new Set(data.filter(id => definitions.some(d => d.id === id)))] : [];
export function loadProgressionState(data) {
  const p = initialProgressionState();
  p.achievements = ids(data.achievements, ACHIEVEMENTS); p.claimedAchievementRewards = ids(data.claimedAchievementRewards, ACHIEVEMENTS);
  p.careerMilestones = ids(data.careerMilestones, CAREER_MILESTONES); p.claimedCareerRewards = ids(data.claimedCareerRewards, CAREER_MILESTONES);
  // Claimed proof also preserves completion, even if current reputation has dropped.
  p.achievements = [...new Set([...p.achievements, ...p.claimedAchievementRewards])];
  p.careerMilestones = [...new Set([...p.careerMilestones, ...p.claimedCareerRewards])];
  p.legacyUpgrades = ids(data.legacyUpgrades, LEGACY_UPGRADES);
  for (const k of ['legacyPoints', 'legacyPointsEarned']) if (safe(data[k])) p[k] = Math.floor(data[k]);
  p.legacyPointsEarned = Math.max(p.legacyPointsEarned, p.legacyPoints + p.legacyUpgrades.reduce((n, id) => n + LEGACY_UPGRADES.find(u => u.id === id).cost, 0));
  p.selectedTitle = typeof data.selectedTitle === 'string' ? data.selectedTitle : null;
  p.magnateCelebrationSeen = data.magnateCelebrationSeen === true;
  for (const key of ['reputationRewardRemainder', 'xpRewardRemainder']) if (safe(data[key])) p[key] = Math.min(.999999999, data[key]);
  for (const group of ['eventCounters', 'personalRecords', 'companyRecords']) for (const k of Object.keys(p[group])) {
    if (safe(data[group]?.[k])) p[group][k] = data[group][k];
  }
  if (!(p.personalRecords.fastestDeliverySeconds > 0)) p.personalRecords.fastestDeliverySeconds = null;
  p.personalRecords.highestDeliveryReward = Math.max(p.personalRecords.highestDeliveryReward, ...Object.values(data.districtStats || {}).map(s => safe(s?.bestDeliveryReward) ? s.bestDeliveryReward : 0));
  p.personalRecords.mostMoneyInOrder = Math.max(p.personalRecords.mostMoneyInOrder, p.personalRecords.highestDeliveryReward);
  // Session event sequences cannot be inferred across an offline break.
  return p;
}
