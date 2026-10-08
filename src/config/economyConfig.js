import { t as tr } from '../services/LocalizationService.js';
import { ELITE_ORDERS } from './districtConfig.js';
export { DISTRICTS } from './districtConfig.js';

export const ECONOMY = Object.freeze({
  walkingBaseSpeed: 160,
  bicycleSpeed: 250,
  oldShoesPrice: 3000,
  goodShoesPrice: 6000,
  thermobagPrice: 5500,
  bicyclePrice: 7000,
  oldShoesBonus: 0.05,
  goodShoesBonus: 0.10,
  thermobagBonus: 0.10,
  bicycleLevel: 3,
  mopedPrice: 30000,
  mopedLevel: 6,
  mopedSpeed: 340,
  carPrice: 105000,
  carLevel: 10,
  carSpeed: 420,
  companyBaseIncome: 45,
  companyTransportMultipliers: Object.freeze({ WALKING: 1, BICYCLE: 1.35, MOPED: 1.8, CAR: 2.4 }),
  transportOrderWeights: {
    WALKING: { STANDARD: 65, URGENT: 20, FRAGILE: 10 },
    BICYCLE: { STANDARD: 55, URGENT: 23, FRAGILE: 12, DOUBLE: 10 },
    MOPED: { STANDARD: 40, URGENT: 35, FRAGILE: 10, DOUBLE: 15 },
    CAR: { STANDARD: 25, URGENT: 30, FRAGILE: 10, DOUBLE: 15, LARGE: 20 },
  },
  transportDistancePools: {
    WALKING: { start: 0, end: .67 }, BICYCLE: { start: 0, end: .85 },
    MOPED: { start: .2, end: 1 }, CAR: { start: .4, end: 1 },
  },
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
  STANDARD: { name: tr('economy-config.001'), weight: 65, level: 1, money: 1, xp: 1, reputation: 0, timer: 1 },
  URGENT: { name: tr('economy-config.002'), weight: 20, level: 1, money: 1.35, xp: 1.25, reputation: 1, timer: .75 },
  FRAGILE: { name: tr('economy-config.003'), weight: 10, level: 1, money: 1.2, xp: 1, reputation: 0, timer: 1 },
  DOUBLE: { name: tr('economy-config.004'), weight: 5, level: 3, money: 1.85, xp: 1.6, reputation: 1, timer: 1.5 },
  LARGE: { name: tr('economy-config.005'), weight: 20, level: 10, money: 2.3, xp: 2, reputation: 2, timer: 1.8, requiredTransport: 'CAR', distanceStart: .6 },
  ELITE: { name: tr('economy-config.006'), weight: 1, level: ELITE_ORDERS.level, money: ELITE_ORDERS.money, xp: ELITE_ORDERS.xp, reputation: 0, timer: ELITE_ORDERS.timer },
};
export const REPUTATION_TIERS = [
  { min: 0, name: tr('company-config.021'), dispute: .1, tips: 1, betterOrders: 1 },
  { min: 20, name: tr('economy-config.007'), dispute: .25, tips: 1.05, betterOrders: 1.05 },
  { min: 50, name: tr('economy-config.008'), dispute: .45, tips: 1.1, betterOrders: 1.1 },
  { min: 100, name: tr('economy-config.009'), dispute: .45, tips: 1.15, betterOrders: 1.15 },
];
export const reputationTier = value => [...REPUTATION_TIERS].reverse().find(t => value >= t.min) || REPUTATION_TIERS[0];
