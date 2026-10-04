export const BALANCE = Object.freeze({
  metersPerPixel: 0.4,
  interactionRadius: 60,
  nextOrderDelay: 3000,
  baseReward: 100,
  moneyPerMeter: 0.22,
  minReward: 100,
  maxReward: 300,
  baseXP: 15,
  xpPerMeter: 0.025,
  maxXP: 40,
  metersPerReputation: 250,
  maxReputation: 4,
  failurePenalty: 2,
  minDeliveryTime: 60,
  maxDeliveryTime: 120,
  metersPerTimerSecond: 12,
});

// Total XP to reach level L: 0, 100, 250, 450, ...
export const xpForLevel = (level) => 25 * (level - 1) * (level + 2);
export const levelForXP = (xp) => Math.max(1, Math.floor((-1 + Math.sqrt(9 + 0.16 * xp)) / 2));
