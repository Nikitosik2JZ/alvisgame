import { t as tr, localization } from '../services/LocalizationService.js';
import { ECONOMY } from './economyConfig.js';

export const COMPANY = Object.freeze({
  unlockLevel: 12,
  unlockPrice: 40000,
  hireCost: 2500,
  defaultName: tr('company-config.001'),
  nameLimit: 20,
  employeeNames: Object.freeze([tr('company-config.002'), tr('company-config.003'), tr('company-config.004'), tr('company-config.005'), tr('company-config.006'), tr('company-config.007'), tr('company-config.008'), tr('company-config.009')]),
  levels: Object.freeze([
    Object.freeze({ level: 1, name: tr('company-config.010'), slots: 2, price: 0, bonus: 0, careerTitle: tr('company-config.011') }),
    Object.freeze({ level: 2, name: tr('company-config.012'), slots: 4, price: 15000, bonus: .05, careerTitle: tr('company-config.013') }),
    Object.freeze({ level: 3, name: tr('company-config.014'), slots: 7, price: 45000, bonus: .10, careerTitle: tr('company-config.015') }),
    Object.freeze({ level: 4, name: tr('company-config.016'), slots: 12, price: 120000, bonus: .18, careerTitle: tr('company-config.017') }),
  ]),
  vehicles: Object.freeze([
    Object.freeze({ type: 'BICYCLE', name: tr('company-config.018'), price: 3000 }),
    Object.freeze({ type: 'MOPED', name: tr('company-config.019'), price: 8000 }),
    Object.freeze({ type: 'CAR', name: tr('company-config.020'), price: 25000 }),
  ]),
  baseIncome: ECONOMY.companyBaseIncome,
  transportMultipliers: ECONOMY.companyTransportMultipliers,
  offlineCapMs: 2 * 60 * 60 * 1000,
  storageCapMs: 2 * 60 * 60 * 1000,
  tickMs: 1000,
  logLimit: 12,
  activityIntervalMs: 5 * 60 * 1000,
  candidateCount: 3,
  refreshCost: 300,
  statRanges: { efficiency: [.8, 1.3], reliability: [.8, 1.2], speed: [.8, 1.2] },
  archetypes: {
    ROOKIE: { name: tr('company-config.021'), cost: 2500, efficiency: [.90, 1.02], reliability: [.96, 1.04], speed: [.94, 1.04], offline: .85 },
    EXPERIENCED: { name: tr('company-config.022'), cost: 5500, efficiency: [1.10, 1.22], reliability: [1.02, 1.12], speed: [1, 1.10], offline: .85 },
    FAST: { name: tr('company-config.023'), cost: 4200, efficiency: [1.08, 1.18], reliability: [.82, .94], speed: [1.10, 1.20], offline: .85 },
    ACCURATE: { name: tr('company-config.024'), cost: 5000, efficiency: [.94, 1.04], reliability: [1.14, 1.20], speed: [.86, .98], offline: .85 },
    WORKAHOLIC: { name: tr('company-config.025'), cost: 6000, efficiency: [1.04, 1.16], reliability: [.98, 1.08], speed: [.98, 1.08], offline: 1 },
  },
  employeeMaxLevel: 10,
  employeeXpBase: 100,
  employeeXpStep: 50,
  levelEfficiencyBonus: .02,
  levelReliabilityBonus: .005,
  permanentBonusCap: .06,
  simulationStepMs: 10000,
  deliveriesPerMinute: 2,
  xpPerDelivery: 8,
  baseFailureChance: .025,
  reliabilityFailureScale: .2,
  failureRange: [.002, .08],
  failureIncomeLoss: .5,
  transportSpeedInfluence: { WALKING: .1, BICYCLE: .25, MOPED: .4, CAR: .5 },
  reputation: { perDelivery: .01, perFailure: .2, perUpgrade: 3, candidateStatCap: .03, candidateScale: .0001, incomeCap: .05, incomeScale: .0001 },
  ranks: [ { name: tr('company-config.026'), reputation: 0 }, { name: tr('company-config.027'), reputation: 30 },
    { name: tr('company-config.028'), reputation: 100 }, { name: tr('company-config.029'), reputation: 250 } ],
  upgrades: {
    dispatch: { name: tr('company-config.030'), label: tr('company-config.031'), costs: [5000, 14000, 35000], effects: [0, .03, .06, .10] },
    routing: { name: tr('company-config.032'), label: tr('company-config.033'), costs: [4000, 12000, 30000], effects: [0, .02, .05, .08] },
    training: { name: tr('company-config.034'), label: tr('company-config.035'), costs: [3500, 10000, 25000], effects: [0, .10, .20, .35] },
    advertising: { name: tr('company-config.036'), label: tr('company-config.031'), costs: [4500, 13000, 32000], effects: [0, .02, .04, .07] },
  },
});

export const companyLevel = level => COMPANY.levels.find(entry => entry.level === level) || COMPANY.levels[0];
export const companyVehicle = type => COMPANY.vehicles.find(entry => entry.type === type);
export const archetypeFor = key => Object.hasOwn(COMPANY.archetypes, key) ? COMPANY.archetypes[key] : COMPANY.archetypes.ROOKIE;
export const employeeXpRequired = level => COMPANY.employeeXpBase + (level - 1) * COMPANY.employeeXpStep;
export const companyRank = reputation => COMPANY.ranks.findLast(rank => reputation >= rank.reputation) || COMPANY.ranks[0];
export const upgradeEffect = (key, snapshot) => COMPANY.upgrades[key].effects[snapshot.companyUpgrades[key]] || 0;
export const clampStat = (key, value) => Math.max(COMPANY.statRanges[key][0], Math.min(COMPANY.statRanges[key][1], value));
export const companyName = value => Object.values(localization.catalogs).some(c => c['company-config.001'] === value) ? COMPANY.defaultName : typeof value === 'string'
  ? Array.from(value.replace(/[\u0000-\u001f\u007f]/g, '').trim()).slice(0, COMPANY.nameLimit).join('') || COMPANY.defaultName
  : COMPANY.defaultName;
