export const ECONOMY = Object.freeze({
  walkingBaseSpeed: 160,
  bicycleSpeed: 250,
  oldShoesPrice: 300,
  goodShoesPrice: 900,
  thermobagPrice: 1200,
  bicyclePrice: 3500,
  oldShoesBonus: 0.05,
  goodShoesBonus: 0.10,
  thermobagBonus: 0.10,
  bicycleLevel: 3,
  metersPerPixel: 0.4,
  interactionRadius: 60,
  nextOrderDelay: 3000,
  baseReward: 150,
  moneyPerMeter: 0.30,
  minReward: 150,
  maxReward: 290,
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

export const ORDER_TYPES = {
  STANDARD: { name: 'ОБЫЧНЫЙ', weight: 65, level: 1, money: 1, xp: 1, reputation: 0, timer: 1 },
  URGENT: { name: 'СРОЧНЫЙ', weight: 20, level: 1, money: 1.35, xp: 1.25, reputation: 1, timer: .75 },
  FRAGILE: { name: 'ХРУПКИЙ', weight: 10, level: 1, money: 1.2, xp: 1, reputation: 0, timer: 1 },
  DOUBLE: { name: 'ДВОЙНОЙ ЗАКАЗ', weight: 5, level: 3, money: 1.85, xp: 1.6, reputation: 1, timer: 1.5 },
};
export const DISTRICTS = {
  residential: { name: 'Спальный район', level: 1, cost: 0, money: 1, xp: 1, event: 1, urgent: 1, customerPoolFraction: .67 },
  center: { name: 'Центр', level: 4, cost: 3000, money: 1.3, xp: 1.15, event: 1.15, urgent: 1.5, customerPoolFraction: 1 },
};
export const REPUTATION_TIERS = [
  { min: 0, name: 'Новичок', dispute: .1, tips: 1, betterOrders: 1 },
  { min: 20, name: 'Надёжный курьер', dispute: .25, tips: 1.05, betterOrders: 1.05 },
  { min: 50, name: 'Любимчик клиентов', dispute: .45, tips: 1.1, betterOrders: 1.1 },
  { min: 100, name: 'Легенда доставки', dispute: .45, tips: 1.15, betterOrders: 1.15 },
];
export const reputationTier = value => [...REPUTATION_TIERS].reverse().find(t => value >= t.min) || REPUTATION_TIERS[0];
