import { TASK_CONFIG, taskTier } from '../config/taskConfig.js';
import { ORDER_TYPES } from '../config/economyConfig.js';
import { DISTRICTS, ELITE_ORDERS, eliteOrdersEligible } from '../config/districtConfig.js';
import { transportFor } from '../config/transportConfig.js';

const descriptions = {
  delivery: 'Учитываются успешные личные заказы. Двойной заказ считается один раз.',
  money: 'Только оплата личных доставок, без бонусов и дохода компании.',
  reputation: 'Репутация за доставки и события. Награды за задания не учитываются.',
  tips: 'Учитываются события с положительными чаевыми.',
  consecutive: 'Новые успешные доставки подряд. Провал начинает эту цель заново.',
  clean: 'Провал или событие с потерей репутации начинает эту цель заново.',
  companyCollect: 'Получайте накопленный доход в разделе КОМПАНИЯ.',
  companyIncome: 'Учитывается новый доход компании, в том числе пока вас не было.',
  positiveEvent: 'Положительные события во время обычных доставок.',
  choiceSuccess: 'Решите событие с выбором без отрицательных последствий.',
  sessionMoney: 'Сегодняшняя смена сохраняется, и её можно продолжить после перерыва.',
};
const task = (id, title, category, type, targetKey, filter = {}, requirements = {}) => ({ id, title, description: descriptions[type], category, type, targetKey, filter, requirements });
export const DAILY_TASKS = [
  task('deliveries', 'Выполнить {n} заказов', 'DELIVERY', 'delivery', 'delivery'),
  task('earnings', 'Заработать {n} ₽ на доставках', 'MONEY', 'money', 'money'),
  task('reputation', 'Получить {n} репутации в игре', 'REPUTATION', 'reputation', 'reputation'),
  ...[['STANDARD', 'обычных'], ['URGENT', 'срочных'], ['FRAGILE', 'хрупких'], ['DOUBLE', 'двойных'], ['LARGE', 'крупных'], ['ELITE', 'элитных']].map(([id, name]) => task(`type-${id}`, `Выполнить {n} ${name} заказов`, 'ORDER_TYPE', 'delivery', 'type', { orderType: id }, { orderType: id })),
  ...[['WALKING', 'пешком'], ['BICYCLE', 'на велосипеде'], ['MOPED', 'на мопеде'], ['CAR', 'на автомобиле']].map(([id, name]) => task(`transport-${id}`, `Выполнить {n} заказов ${name}`, 'TRANSPORT', 'delivery', 'transport', { transport: id }, { transport: id })),
  ...Object.entries(DISTRICTS).map(([id, d]) => task(`district-${id}`, `Выполнить {n} заказов: ${d.name}`, 'DISTRICT', 'delivery', 'district', { district: id }, { district: id })),
  task('tips', 'Получить чаевые {n} раз', 'EVENT', 'tips', 'tips'),
  task('no-failure', 'Выполнить {n} заказов подряд без провала', 'STREAK', 'consecutive', 'streak'),
  task('reach-streak', 'Достичь серии {n} в новых доставках', 'STREAK', 'consecutive', 'streak'),
  task('company-collect', 'Забрать {n} ₽ дохода компании', 'COMPANY', 'companyCollect', 'company', {}, { company: true }),
  task('company-generate', 'Компания заработает {n} ₽', 'COMPANY', 'companyIncome', 'company', {}, { company: true, workforce: true }),
  task('positive-event', 'Получить {n} положительных событий', 'EVENT', 'positiveEvent', 'event'),
  task('choice-success', 'Успешно решить {n} событий с выбором', 'EVENT', 'choiceSuccess', 'event'),
  task('fast-delivery', 'Выполнить {n} заказов с запасом 20 секунд', 'DELIVERY', 'delivery', 'fast', { fast: true }),
  task('session-money', 'Заработать {n} ₽ за сегодняшнюю смену', 'MONEY', 'sessionMoney', 'money'),
  task('no-complaints', 'Выполнить {n} заказов без потери репутации', 'STREAK', 'clean', 'clean'),
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
  const title = d.title.replace('{n}', target).replace('20 секунд', `${TASK_CONFIG.fastSeconds} секунд`);
  return { id: d.id, title, description: d.description, category: d.category, type: d.type, target, currentProgress: 0, reward: { ...(rotating ? tier.rotatingReward : tier.reward) }, requirements: { ...d.requirements }, completed: false, claimed: false, tier: tier.id };
}
export const ROTATING_TASK_IDS = ['deliveries', 'transport-BICYCLE', 'type-URGENT', 'district-center', 'district-industrial', 'no-complaints', 'earnings'];
export const SESSION_CHALLENGES = [
  { id: 'session-series', title: 'СЕРИЯ ЗАКАЗОВ', description: `Выполните ${TASK_CONFIG.sessionTarget} заказа подряд без провала.`, type: 'consecutive' },
  { id: 'session-on-time', title: 'БЕЗ ОПОЗДАНИЙ', description: `Завершите следующие ${TASK_CONFIG.sessionTarget} заказа вовремя.`, type: 'consecutive' },
  { id: 'session-speed', title: 'СКОРОСТНАЯ ДОСТАВКА', description: `Выполните срочный заказ с запасом ${TASK_CONFIG.fastSeconds} секунд.`, type: 'delivery', filter: { orderType: 'URGENT', fast: true } },
];
