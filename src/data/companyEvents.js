import { t as tr } from '../services/LocalizationService.js';
// All durations use active gameplay seconds. No business events run offline.
export const COMPANY_EVENT_BALANCE = Object.freeze({
  intervalMs: [180000, 300000], maxNegativeStreak: 1, corporateReputationScale: .002, corporateWeightCap: 1.5,
  reliabilityRiskScale: 3, riskWeightRange: [.25, 2], penaltyBalanceFraction: .15,
  disputeSuccessChance: .5, bonusEfficiency: .02, urgentEventWeight: 1.5, maxEffectDurationMs: 300000,
});
export const COMPANY_EVENTS = Object.freeze([
  { id: 'employee-month', category: 'POSITIVE', weight: 3, title: tr('company-events.001'), description: tr('company-events.002'), effects: { employeeIncome: .20, duration: 180, reputation: 2 } },
  { id: 'corporate', category: 'POSITIVE', weight: 2, corporate: true, title: tr('company-events.003'), description: tr('company-events.004'), effects: { money: 2000, reputation: 3 } },
  { id: 'good-day', category: 'POSITIVE', weight: 3, title: tr('company-events.005'), description: tr('company-events.006'), effects: { companyIncome: .12, duration: 180, reputation: 1 } },
  { id: 'tips', category: 'POSITIVE', weight: 3, title: tr('company-events.007'), description: tr('company-events.008'), effects: { money: 400 } },
  { id: 'late', category: 'NEGATIVE', weight: 3, title: tr('company-events.009'), description: tr('company-events.010'), effects: { employeeIncome: -.15, duration: 90, reputation: -1, failure: true } },
  { id: 'damaged', category: 'NEGATIVE', weight: 2, reliable: true, title: tr('company-events.011'), description: tr('company-events.012'), effects: { money: -500, reputation: -2, failure: true } },
  { id: 'illness', category: 'NEGATIVE', weight: 1, title: tr('company-events.013'), description: tr('company-events.014'), effects: { unavailable: true, duration: 180 } },
  { id: 'transport', category: 'NEGATIVE', weight: 2, vehicle: true, title: tr('company-events.015'), description: tr('company-events.016'), effects: { employeeIncome: -.25, duration: 120 } },
  { id: 'shawarma', category: 'NEUTRAL', weight: 2, title: tr('company-events.017'), description: tr('company-events.018'), effects: { unavailable: true, duration: 45, recovery: tr('company-events.019') } },
  { id: 'praise', category: 'POSITIVE', weight: 2, title: tr('company-events.020'), description: tr('company-events.021'), effects: { reputation: 4 } },
  { id: 'coffee', category: 'CHOICE', weight: 2, title: tr('company-events.022'), description: tr('company-events.023'), choices: [
    { label: tr('company-events.024'), consequence: tr('company-events.025'), effects: { cost: 1000, companyIncome: .10, duration: 180 } },
    { label: tr('company-events.026'), consequence: tr('company-events.027'), effects: {} } ] },
  { id: 'broken-choice', category: 'CHOICE', weight: 2, reliable: true, title: tr('company-events.028'), description: tr('company-events.029'), choices: [
    { label: tr('company-events.030'), consequence: tr('company-events.031'), effects: { cost: 1000 } },
    { label: tr('company-events.032'), consequence: tr('company-events.033'), effects: { dispute: true, fine: 1800, reputation: -2, failure: true } } ] },
  { id: 'urgent-choice', category: 'CHOICE', weight: 2, corporate: true, title: tr('company-events.034'), description: tr('company-events.035'), choices: [
    { label: tr('company-events.036'), consequence: tr('company-events.037'), effects: { companyIncome: .18, risk: .02, duration: 180 } },
    { label: tr('company-events.038'), consequence: tr('company-events.027'), effects: {} } ] },
  { id: 'raise-choice', category: 'CHOICE', weight: 2, title: tr('company-events.039'), description: tr('company-events.040'), choices: [
    { label: tr('company-events.041'), consequence: tr('company-events.042'), effects: { cost: 1500, permanentEfficiency: true } },
    { label: tr('company-events.043'), consequence: tr('company-events.044'), effects: { employeeIncome: -.05, duration: 120 } } ] },
]);
