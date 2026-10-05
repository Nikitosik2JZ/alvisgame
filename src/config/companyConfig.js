import { ECONOMY } from './economyConfig.js';

export const COMPANY = Object.freeze({
  unlockLevel: 12,
  unlockPrice: 40000,
  hireCost: 2500,
  defaultName: 'Моя доставка',
  nameLimit: 20,
  employeeNames: Object.freeze(['Саша', 'Илья', 'Миша', 'Катя', 'Дима', 'Аня', 'Макс', 'Лена']),
  levels: Object.freeze([
    Object.freeze({ level: 1, name: 'Подвал', slots: 2, price: 0, bonus: 0, careerTitle: 'Предприниматель' }),
    Object.freeze({ level: 2, name: 'Маленький офис', slots: 4, price: 15000, bonus: .05, careerTitle: 'Владелец службы доставки' }),
    Object.freeze({ level: 3, name: 'Нормальный офис', slots: 7, price: 45000, bonus: .10, careerTitle: 'Курьерский босс' }),
    Object.freeze({ level: 4, name: 'Бизнес-центр', slots: 12, price: 120000, bonus: .18, careerTitle: 'Владелец крупного оператора' }),
  ]),
  vehicles: Object.freeze([
    Object.freeze({ type: 'BICYCLE', name: 'Велосипед', price: 3000 }),
    Object.freeze({ type: 'MOPED', name: 'Мопед', price: 8000 }),
    Object.freeze({ type: 'CAR', name: 'Автомобиль', price: 25000 }),
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
    ROOKIE: { name: 'Новичок', cost: 2500, efficiency: [.90, 1.02], reliability: [.96, 1.04], speed: [.94, 1.04], offline: .85 },
    EXPERIENCED: { name: 'Опытный', cost: 5500, efficiency: [1.10, 1.22], reliability: [1.02, 1.12], speed: [1, 1.10], offline: .85 },
    FAST: { name: 'Быстрый', cost: 4200, efficiency: [1.08, 1.18], reliability: [.82, .94], speed: [1.10, 1.20], offline: .85 },
    ACCURATE: { name: 'Аккуратный', cost: 5000, efficiency: [.94, 1.04], reliability: [1.14, 1.20], speed: [.86, .98], offline: .85 },
    WORKAHOLIC: { name: 'Трудоголик', cost: 6000, efficiency: [1.04, 1.16], reliability: [.98, 1.08], speed: [.98, 1.08], offline: 1 },
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
  ranks: [ { name: 'Местная доставка', reputation: 0 }, { name: 'Районная служба', reputation: 30 },
    { name: 'Городская компания', reputation: 100 }, { name: 'Крупный оператор', reputation: 250 } ],
  upgrades: {
    dispatch: { name: 'Диспетчерская', label: 'Доход', costs: [5000, 14000, 35000], effects: [0, .03, .06, .10] },
    routing: { name: 'Маршрутизация', label: 'Эффективность', costs: [4000, 12000, 30000], effects: [0, .02, .05, .08] },
    training: { name: 'Обучение курьеров', label: 'Опыт', costs: [3500, 10000, 25000], effects: [0, .10, .20, .35] },
    advertising: { name: 'Реклама компании', label: 'Доход', costs: [4500, 13000, 32000], effects: [0, .02, .04, .07] },
  },
});

export const companyLevel = level => COMPANY.levels.find(entry => entry.level === level) || COMPANY.levels[0];
export const companyVehicle = type => COMPANY.vehicles.find(entry => entry.type === type);
export const archetypeFor = key => Object.hasOwn(COMPANY.archetypes, key) ? COMPANY.archetypes[key] : COMPANY.archetypes.ROOKIE;
export const employeeXpRequired = level => COMPANY.employeeXpBase + (level - 1) * COMPANY.employeeXpStep;
export const companyRank = reputation => COMPANY.ranks.findLast(rank => reputation >= rank.reputation) || COMPANY.ranks[0];
export const upgradeEffect = (key, snapshot) => COMPANY.upgrades[key].effects[snapshot.companyUpgrades[key]] || 0;
export const clampStat = (key, value) => Math.max(COMPANY.statRanges[key][0], Math.min(COMPANY.statRanges[key][1], value));
export const companyName = value => typeof value === 'string'
  ? Array.from(value.replace(/[\u0000-\u001f\u007f]/g, '').trim()).slice(0, COMPANY.nameLimit).join('') || COMPANY.defaultName
  : COMPANY.defaultName;
