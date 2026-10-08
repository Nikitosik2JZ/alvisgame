import { t as tr } from '../services/LocalizationService.js';
import { ECONOMY as E } from './economyConfig.js';
import { EVENT_BALANCE as B } from './eventBalance.js';
import { companyLevel } from './companyConfig.js';
import { DISTRICTS, ELITE_ORDERS } from './districtConfig.js';
import { CAREER_MILESTONES } from './progressionConfig.js';

export const TRANSPORT = Object.freeze({ WALKING: 'WALKING', BICYCLE: 'BICYCLE', MOPED: 'MOPED', CAR: 'CAR' });
const visual = (texture, width = 44, height = 44) => ({ texture, width, height, bodyWidth: 22, bodyHeight: 24 });
export const TRANSPORTS = Object.freeze([
  { id: 'WALKING', name: tr('transport-config.001'), purchasePrice: 0, requiredLevel: 1, movementSpeed: E.walkingBaseSpeed,
    weatherModifier: B.rainWalking, fragileModifier: 1, eventModifiers: {}, visual: visual('courier'), careerTitle: tr('company-config.021'),
    bonuses: tr('transport-config.002'), disadvantages: tr('transport-config.003') },
  { id: 'BICYCLE', name: tr('transport-config.004'), purchasePrice: E.bicyclePrice, requiredLevel: E.bicycleLevel, movementSpeed: E.bicycleSpeed,
    weatherModifier: B.rainBicycle, fragileModifier: 1.1, eventModifiers: {}, visual: visual('courier-bicycle'), careerTitle: tr('progression-config.003'),
    bonuses: tr('transport-config.005'), disadvantages: tr('transport-config.006') },
  { id: 'MOPED', name: tr('transport-config.007'), purchasePrice: E.mopedPrice, requiredLevel: E.mopedLevel, movementSpeed: E.mopedSpeed,
    weatherModifier: .9, fragileModifier: .8, eventModifiers: {}, visual: visual('courier-moped', 48, 56), careerTitle: tr('legacy-config.001'),
    milestoneTitle: tr('transport-config.008'), milestoneText: tr('transport-config.009', { v0: E.mopedPrice }),
    bonuses: tr('transport-config.010'),
    disadvantages: tr('transport-config.011', { v0: B.mopedFuelTime }),
    celebration: { title: tr('transport-config.012'), text: tr('transport-config.013') } },
  { id: 'CAR', name: tr('transport-config.014'), purchasePrice: E.carPrice, requiredLevel: E.carLevel, movementSpeed: E.carSpeed,
    weatherModifier: .98, fragileModifier: .35, eventModifiers: { traffic: { center: 1.6 }, parking: { center: 1.6 } }, visual: visual('courier-car', 58, 76), careerTitle: tr('progression-config.004'),
    milestoneTitle: tr('transport-config.015'), milestoneText: tr('transport-config.016'),
    bonuses: tr('transport-config.017'),
    disadvantages: tr('transport-config.018'),
    celebration: { title: tr('transport-config.019'), text: tr('transport-config.020') } },
].map(t => Object.freeze({ ...t, allowedOrderTypes: Object.keys(E.transportOrderWeights[t.id]),
  orderWeights: E.transportOrderWeights[t.id], distancePool: E.transportDistancePools[t.id] })));
export const transportById = id => TRANSPORTS.find(t => t.id === id);
export const transportFor = id => transportById(id) || TRANSPORTS[0];
export const nextTransportGoal = player => TRANSPORTS[1 + Math.max(...player.ownedTransports.map(id => TRANSPORTS.findIndex(t => t.id === id)))];
export const careerTitle = player => player.careerMilestones ? [...CAREER_MILESTONES].reverse().find(m => player.careerMilestones.includes(m.id))?.title || tr('company-config.021')
  : player.companyUnlocked ? companyLevel(player.companyLevel).careerTitle
  : Object.keys(DISTRICTS).every(id => player.unlockedDistricts?.includes(id)) ? tr('progression-config.012')
  : player.level >= ELITE_ORDERS.level && player.reputation >= ELITE_ORDERS.reputation && ELITE_ORDERS.districts.some(id => player.unlockedDistricts?.includes(id)) ? tr('transport-config.021')
  : [...TRANSPORTS].reverse().find(t => player.ownedTransports.includes(t.id)).careerTitle;
export const goalText = player => {
  const next = nextTransportGoal(player);
  return next ? tr('transport-config.022', { v0: next.name, v1: next.purchasePrice, v2: player.money, v3: Math.max(0, next.purchasePrice - player.money), v4: player.level, v5: next.requiredLevel })
    : tr('transport-config.023', { v0: careerTitle(player).toUpperCase() });
};
