import { LEGACY_UPGRADES } from '../config/legacyConfig.js';

// A single access point for every permanent modifier; rewards never amplify themselves.
export const progressionMultiplier = (snapshot, effect) => 1 + LEGACY_UPGRADES
  .filter(u => u.effect === effect && snapshot.legacyUpgrades?.includes(u.id)).reduce((sum, u) => sum + u.bonus, 0);

export function reputationReward(values, amount) {
  if (amount <= 0) return amount;
  const exact = amount * progressionMultiplier(values, 'reputation') + values.reputationRewardRemainder;
  const whole = Math.floor(exact + 1e-9);
  values.reputationRewardRemainder = Math.max(0, exact - whole);
  return whole;
}

export function personalXpReward(values, amount) {
  const exact = amount * progressionMultiplier(values, 'xp') + values.xpRewardRemainder;
  const whole = Math.floor(exact + 1e-9);
  values.xpRewardRemainder = Math.max(0, exact - whole);
  return whole;
}
