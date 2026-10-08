import { t as tr } from '../services/LocalizationService.js';
import { EVENT_BALANCE as B } from '../config/eventBalance.js';
const event = (id, title, description, category, rarity, trigger, possibleEffects, extra = {}) =>
  ({ id, title, description, category, rarity, trigger, weight: 1, possibleEffects, ...extra });
export const EVENTS = [
  event('yard-dog', tr('events.001'), tr('events.002'), 'NEGATIVE', 'COMMON', 'pickup', { time: B.district.dogTime }, { requirements: { districts: ['residential'] } }),
  event('street-closed', tr('events.003'), tr('events.004'), 'NEGATIVE', 'COMMON', 'pickup', { time: B.district.closedStreetTime }, { requirements: { districts: ['center'] } }),
  event('industrial-security', tr('events.005'), tr('events.006'), 'CHOICE', 'COMMON', 'customer', {}, { requirements: { districts: ['industrial'] }, choices: [
    { label: tr('events.007'), consequence: tr('events.008', { v0: B.district.securityCallTime }), effects: { time: B.district.securityCallTime } },
    { label: tr('events.009'), consequence: tr('events.010', { v0: B.district.securityDetourTime }), effects: { time: B.district.securityDetourTime } },
  ] }),
  event('empty-roads', tr('events.011'), tr('events.012'), 'POSITIVE', 'COMMON', 'pickup', { speed: 'green' }, { requirements: { districts: ['industrial'] } }),
  event('elite-security', tr('events.013'), tr('events.014'), 'NEUTRAL', 'COMMON', 'customer', { eliteSecurity: true }, { requirements: { districts: ['elite'] } }),
  event('elite-tips', tr('events.015'), tr('events.016'), 'POSITIVE', 'COMMON', 'customer', { tips: B.district.eliteTips }, { requirements: { districts: ['elite'] } }),
  event('business-pass', tr('events.017'), tr('events.018'), 'CHOICE', 'COMMON', 'customer', {}, { requirements: { districts: ['business'] }, choices: [
    { label: tr('events.019'), consequence: tr('events.008', { v0: B.district.businessWaitTime }), effects: { time: B.district.businessWaitTime } },
    { label: tr('events.007'), consequence: tr('events.020', { v0: Math.round(B.district.businessCallSuccess * 100), v1: B.district.businessCallTime }), effects: { businessCall: true } },
  ] }),
  event('corporate-bonus', tr('events.021'), tr('events.022'), 'POSITIVE', 'UNCOMMON', 'customer', { moneyRange: B.district.corporateBonus }, { requirements: { districts: ['business'] } }),
  event('moped-fuel', tr('events.023'), tr('events.024'), 'NEGATIVE', 'COMMON', 'pickup', { time: B.mopedFuelTime }, { requirements: { transports: ['MOPED'] } }),
  event('moped-route', tr('events.025'), tr('events.026'), 'POSITIVE', 'COMMON', 'pickup', { speed: 'green' }, { requirements: { transports: ['MOPED'] } }),
  event('traffic', tr('events.027'), tr('events.028'), 'NEGATIVE', 'UNCOMMON', 'pickup', { speed: 'traffic' }, { requirements: { transports: ['CAR'] } }),
  event('parking', tr('events.029'), tr('events.030'), 'NEGATIVE', 'COMMON', 'customer', { time: B.parkingTime }, { requirements: { transports: ['CAR'] } }),
  event('car-green', tr('events.031'), tr('events.032'), 'POSITIVE', 'COMMON', 'pickup', { speed: 'green' }, { requirements: { transports: ['CAR'] } }),
  event('car-large', tr('events.033'), tr('events.034'), 'POSITIVE', 'UNCOMMON', 'customer', { largeOrderBoost: B.largeOrderBoost }, { requirements: { transports: ['CAR'] } }),
  event('cola', tr('events.035'), tr('events.036'), 'NEGATIVE', 'VERY_RARE', 'customer', { dispute: true }),
  event('soup', tr('events.037'), tr('events.038'), 'NEGATIVE', 'COMMON', 'pickup', { payment: B.soupPayment }, { requirements: { food: true } }),
  event('entrance', tr('events.039'), tr('events.040'), 'NEGATIVE', 'COMMON', 'pickup', { time: B.wrongEntranceTime }, { requirements: { walkingRisk: true } }),
  event('barrier', tr('events.041'), tr('events.042'), 'NEGATIVE', 'COMMON', 'pickup', { time: B.barrierTime }, { requirements: { walkingRisk: true } }),
  event('rain', tr('events.043'), tr('events.044'), 'NEGATIVE', 'UNCOMMON', 'pickup', { speed: 'rain' }),
  event('puncture', tr('events.045'), tr('events.046'), 'NEGATIVE', 'UNCOMMON', 'pickup', { speed: 'puncture' }, { requirements: { bicycle: true } }),
  event('principled', tr('events.047'), tr('events.048'), 'NEGATIVE', 'RARE', 'customer', { reputation: -1 }, { requirements: { nearDeadline: true } }),
  event('generous', tr('events.049'), tr('events.050'), 'POSITIVE', 'COMMON', 'customer', { tips: B.tips }),
  event('thanks', tr('events.051'), tr('events.052'), 'POSITIVE', 'COMMON', 'customer', { reputationRange: B.thanks }),
  event('demand', tr('events.053'), tr('events.054'), 'POSITIVE', 'UNCOMMON', 'customer', { demand: B.demandOrders }),
  event('green', tr('events.055'), tr('events.056'), 'POSITIVE', 'COMMON', 'pickup', { speed: 'green' }),
  event('close', tr('events.057'), tr('events.058'), 'POSITIVE', 'UNCOMMON', 'customer', { closeOrder: true }),
  event('big-tips', tr('events.059'), tr('events.060'), 'POSITIVE', 'VERY_RARE', 'customer', { tips: B.bigTips }),
  event('favorite', tr('events.061'), tr('events.062'), 'POSITIVE', 'RARE', 'customer', { money: B.favoriteMoney, reputation: B.favoriteReputation }, { requirements: { reputation: B.favoriteMinimum } }),
  event('silent', tr('events.063'), tr('events.064'), 'CHOICE', 'COMMON', 'customer', {}, { choices: [
    { label: tr('events.065'), consequence: tr('events.066', { v0: B.callTime, v1: B.callSuccess * 100 }), effects: { time: B.callTime, gamble: 'call' } },
    { label: tr('events.067'), consequence: tr('events.068', { v0: B.doorComplaint * 100, v1: B.complaintReputation }), effects: { gamble: 'door' } },
  ] }),
  event('lift', tr('events.069'), tr('events.070', { v0: B.stairsMoney }), 'CHOICE', 'UNCOMMON', 'customer', {}, { choices: [
    { label: tr('events.071'), consequence: tr('events.072', { v0: B.stairsMoney, v1: B.stairsTime }), effects: { orderBonus: B.stairsMoney, time: B.stairsTime } },
    { label: tr('company-events.038'), consequence: tr('events.073'), effects: {} },
  ] }),
  event('fries', tr('events.074'), tr('events.075'), 'CHOICE', 'COMMON', 'pickup', {}, { choices: [
    { label: tr('events.076'), consequence: tr('events.077'), effects: { reputation: 1 } },
    { label: tr('events.078'), consequence: tr('events.079', { v0: Math.round((1-B.friesCaught)*100), v1: B.friesCaught*100, v2: B.friesFine, v3: B.friesReputation }), effects: { gamble: 'fries' } },
  ] }),
];
