import { t as tr, localization } from '../services/LocalizationService.js';
import { TASK_CONFIG, taskTier } from '../config/taskConfig.js';
import { ORDER_TYPES } from '../config/economyConfig.js';
import { DISTRICTS, ELITE_ORDERS, eliteOrdersEligible } from '../config/districtConfig.js';
import { transportFor } from '../config/transportConfig.js';

const descriptions = {
  delivery: tr('daily-tasks.001'),
  money: tr('daily-tasks.002'),
  reputation: tr('daily-tasks.003'),
  tips: tr('daily-tasks.004'),
  consecutive: tr('daily-tasks.005'),
  clean: tr('daily-tasks.006'),
  companyCollect: tr('daily-tasks.007'),
  companyIncome: tr('daily-tasks.008'),
  positiveEvent: tr('daily-tasks.009'),
  choiceSuccess: tr('daily-tasks.010'),
  sessionMoney: tr('daily-tasks.011'),
};
const task = (id, title, category, type, targetKey, filter = {}, requirements = {}) => ({ id, title, description: descriptions[type], category, type, targetKey, filter, requirements });
export const DAILY_TASKS = [
  task('deliveries', tr('daily-tasks.012'), 'DELIVERY', 'delivery', 'delivery'),
  task('earnings', tr('daily-tasks.013'), 'MONEY', 'money', 'money'),
  task('reputation', tr('daily-tasks.014'), 'REPUTATION', 'reputation', 'reputation'),
  ...[['STANDARD', tr('daily-tasks.015')], ['URGENT', tr('daily-tasks.016')], ['FRAGILE', tr('daily-tasks.017')], ['DOUBLE', tr('daily-tasks.018')], ['LARGE', tr('daily-tasks.019')], ['ELITE', tr('daily-tasks.020')]].map(([id, name]) => task(`type-${id}`, tr('daily-tasks.021', { v0: name }), 'ORDER_TYPE', 'delivery', 'type', { orderType: id }, { orderType: id })),
  ...[['WALKING', tr('daily-tasks.022')], ['BICYCLE', tr('daily-tasks.023')], ['MOPED', tr('daily-tasks.024')], ['CAR', tr('daily-tasks.025')]].map(([id, name]) => task(`transport-${id}`, tr('daily-tasks.026', { v0: name }), 'TRANSPORT', 'delivery', 'transport', { transport: id }, { transport: id })),
  ...Object.entries(DISTRICTS).map(([id, d]) => task(`district-${id}`, tr('daily-tasks.027', { v0: d.name }), 'DISTRICT', 'delivery', 'district', { district: id }, { district: id })),
  task('tips', tr('daily-tasks.028'), 'EVENT', 'tips', 'tips'),
  task('no-failure', tr('daily-tasks.029'), 'STREAK', 'consecutive', 'streak'),
  task('reach-streak', tr('daily-tasks.030'), 'STREAK', 'consecutive', 'streak'),
  task('company-collect', tr('daily-tasks.031'), 'COMPANY', 'companyCollect', 'company', {}, { company: true }),
  task('company-generate', tr('daily-tasks.032'), 'COMPANY', 'companyIncome', 'company', {}, { company: true, workforce: true }),
  task('positive-event', tr('daily-tasks.033'), 'EVENT', 'positiveEvent', 'event'),
  task('choice-success', tr('daily-tasks.034'), 'EVENT', 'choiceSuccess', 'event'),
  task('fast-delivery', tr('daily-tasks.035'), 'DELIVERY', 'delivery', 'fast', { fast: true }),
  task('session-money', tr('daily-tasks.036'), 'MONEY', 'sessionMoney', 'money'),
  task('no-complaints', tr('daily-tasks.037'), 'STREAK', 'clean', 'clean'),
];
export function taskEligible(d, s) {
  const r = d.requirements;
  if (r.transport && !s.ownedTransports.includes(r.transport)) return false;
  if (r.district && !s.unlockedDistricts.includes(r.district)) return false;
  if (r.company && !s.companyUnlocked) return false;
  if (d.type === 'companyCollect' && !s.employees.length && s.companyBalance < taskTier(s.level).targets.company) return false;
  if (r.workforce && !s.employees.length) return false;
  if (r.orderType) {
    if (s.level < ORDER_TYPES[r.orderType].level) return false;
    if (r.orderType === 'ELITE') return ELITE_ORDERS.districts.some(id => s.unlockedDistricts.includes(id) && eliteOrdersEligible({ ...s, selectedDistrict: id }));
    return s.ownedTransports.some(id => transportFor(id).allowedOrderTypes.includes(r.orderType) && (!ORDER_TYPES[r.orderType].requiredTransport || id === ORDER_TYPES[r.orderType].requiredTransport));
  }
  return true;
}
export function instantiateTask(d, level, rotating = false) {
  const tier = taskTier(level), target = tier.targets[d.targetKey] * (rotating ? TASK_CONFIG.rotatingTargetMultiplier : 1);
  const title = localization.interpolate(d.title, { count: target, seconds: TASK_CONFIG.fastSeconds,
    orders: localization.plural('count.orders', target), deliveries: localization.plural('count.deliveries', target),
    typedOrders: d.filter.orderType ? localization.plural(`tasks.orderType.${d.filter.orderType}`, target) : '',
    times: localization.plural('count.times', target), positiveEvents: localization.plural('count.positiveEvents', target),
    choiceEvents: localization.plural('count.choiceEvents', target) });
  return { id: d.id, title, description: d.description, category: d.category, type: d.type, target, currentProgress: 0, reward: { ...(rotating ? tier.rotatingReward : tier.reward) }, requirements: { ...d.requirements }, completed: false, claimed: false, tier: tier.id };
}
export const ROTATING_TASK_IDS = ['deliveries', 'transport-BICYCLE', 'type-URGENT', 'district-center', 'district-industrial', 'no-complaints', 'earnings'];
export const SESSION_CHALLENGES = [
  { id: 'session-series', title: tr('daily-tasks.040'), description: tr('daily-tasks.041', { v0: TASK_CONFIG.sessionTarget }), type: 'consecutive' },
  { id: 'session-on-time', title: tr('daily-tasks.042'), description: tr('daily-tasks.043', { v0: TASK_CONFIG.sessionTarget }), type: 'consecutive' },
  { id: 'session-speed', title: tr('daily-tasks.044'), description: tr('daily-tasks.045', { v0: TASK_CONFIG.fastSeconds }), type: 'delivery', filter: { orderType: 'URGENT', fast: true } },
];
