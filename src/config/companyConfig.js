import { ECONOMY } from './economyConfig.js';

export const COMPANY = Object.freeze({
  unlockLevel: 12,
  unlockPrice: 40000,
  hireCost: 2500,
  defaultName: 'Моя доставка',
  nameLimit: 20,
  employeeNames: Object.freeze(['Саша', 'Илья', 'Миша', 'Катя', 'Дима', 'Аня', 'Макс', 'Лена']),
  levels: Object.freeze([
    Object.freeze({ level: 1, slots: 2, price: 0, careerTitle: 'Предприниматель' }),
    Object.freeze({ level: 2, slots: 4, price: 15000, careerTitle: 'Владелец службы доставки' }),
    Object.freeze({ level: 3, slots: 6, price: 40000, careerTitle: 'Курьерский босс' }),
  ]),
  vehicles: Object.freeze([
    Object.freeze({ type: 'BICYCLE', name: 'Велосипед', price: 3000 }),
    Object.freeze({ type: 'MOPED', name: 'Мопед', price: 8000 }),
  ]),
  baseIncome: ECONOMY.companyBaseIncome,
  transportMultipliers: ECONOMY.companyTransportMultipliers,
  offlineCapMs: 2 * 60 * 60 * 1000,
  storageCapMs: 2 * 60 * 60 * 1000,
  tickMs: 1000,
  logLimit: 5,
  activityIntervalMs: 5 * 60 * 1000,
});

export const companyLevel = level => COMPANY.levels.find(entry => entry.level === level) || COMPANY.levels[0];
export const companyVehicle = type => COMPANY.vehicles.find(entry => entry.type === type);
export const companyName = value => typeof value === 'string'
  ? Array.from(value.replace(/[\u0000-\u001f\u007f]/g, '').trim()).slice(0, COMPANY.nameLimit).join('') || COMPANY.defaultName
  : COMPANY.defaultName;
