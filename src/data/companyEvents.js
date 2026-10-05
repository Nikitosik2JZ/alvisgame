// All durations use active gameplay seconds. No business events run offline.
export const COMPANY_EVENT_BALANCE = Object.freeze({
  intervalMs: [180000, 300000], maxNegativeStreak: 1, corporateReputationScale: .002, corporateWeightCap: 1.5,
  reliabilityRiskScale: 3, riskWeightRange: [.25, 2], penaltyBalanceFraction: .15,
  disputeSuccessChance: .5, bonusEfficiency: .02, urgentEventWeight: 1.5, maxEffectDurationMs: 300000,
});
export const COMPANY_EVENTS = Object.freeze([
  { id: 'employee-month', category: 'POSITIVE', weight: 3, title: 'Курьер месяца', description: 'Один курьер сегодня быстрее всей диспетчерской.', effects: { employeeIncome: .20, duration: 180, reputation: 2 } },
  { id: 'corporate', category: 'POSITIVE', weight: 2, corporate: true, title: 'Крупный корпоративный заказ', description: 'Офис заказал обед. Даже бухгалтерия довольна.', effects: { money: 2000, reputation: 3 } },
  { id: 'good-day', category: 'POSITIVE', weight: 3, title: 'Хороший день', description: 'Все светофоры зелёные, все домофоны работают.', effects: { companyIncome: .12, duration: 180, reputation: 1 } },
  { id: 'tips', category: 'POSITIVE', weight: 3, title: 'Клиент оставил чаевые', description: 'Клиент округлил сумму в вашу пользу.', effects: { money: 400 } },
  { id: 'late', category: 'NEGATIVE', weight: 3, title: 'Курьер опоздал', description: 'Клиент уже успел съесть салфетки. Почти.', effects: { employeeIncome: -.15, duration: 90, reputation: -1, failure: true } },
  { id: 'damaged', category: 'NEGATIVE', weight: 2, reliable: true, title: 'Разбитый заказ', description: 'Суп решил покинуть контейнер.', effects: { money: -500, reputation: -2, failure: true } },
  { id: 'illness', category: 'NEGATIVE', weight: 1, title: 'Курьер заболел', description: 'Чай и короткий перерыв помогут вернуться на линию.', effects: { unavailable: true, duration: 180 } },
  { id: 'transport', category: 'NEGATIVE', weight: 2, vehicle: true, title: 'Транспорт подвёл', description: 'Транспорт решил ненадолго стать пешеходом.', effects: { employeeIncome: -.25, duration: 120 } },
  { id: 'shawarma', category: 'NEUTRAL', weight: 2, title: 'Курьер пропал', description: 'Последний раз его видели у шаурмичной.', effects: { unavailable: true, duration: 45, recovery: 'Нашёлся. Просто обедал.' } },
  { id: 'praise', category: 'POSITIVE', weight: 2, title: 'Слишком довольный клиент', description: 'Клиент позвонил, чтобы лично похвалить курьера.', effects: { reputation: 4 } },
  { id: 'coffee', category: 'CHOICE', weight: 2, title: 'Кофе для всех', description: 'Курьеры смотрят на кофемашину с надеждой.', choices: [
    { label: 'КУПИТЬ — 1000 ₽', consequence: '+10% дохода на 3 мин', effects: { cost: 1000, companyIncome: .10, duration: 180 } },
    { label: 'НЕ СЕГОДНЯ', consequence: 'Без последствий', effects: {} } ] },
  { id: 'broken-choice', category: 'CHOICE', weight: 2, reliable: true, title: 'Курьер разбил заказ', description: 'Клиент требует компенсацию. Решение за вами.', choices: [
    { label: 'ЗАПЛАТИТЬ КЛИЕНТУ — 1000 ₽', consequence: 'Без других штрафов', effects: { cost: 1000 } },
    { label: 'ПОПРОБОВАТЬ ОСПОРИТЬ', consequence: '50% без штрафа / 50% штраф до 1800 ₽', effects: { dispute: true, fine: 1800, reputation: -2, failure: true } } ] },
  { id: 'urgent-choice', category: 'CHOICE', weight: 2, corporate: true, title: 'Срочный корпоративный заказ', description: 'Много коробок, мало времени. Берёмся?', choices: [
    { label: 'ПРИНЯТЬ', consequence: '+18% дохода и +2% риска провала на 3 мин', effects: { companyIncome: .18, risk: .02, duration: 180 } },
    { label: 'ОТКАЗАТЬСЯ', consequence: 'Без последствий', effects: {} } ] },
  { id: 'raise-choice', category: 'CHOICE', weight: 2, title: 'Курьер просит повышение', description: '«Можно хотя бы премию? Я даже адреса запомнил».', choices: [
    { label: 'ДАТЬ ПРЕМИЮ — 1500 ₽', consequence: '+2% эффективности навсегда (до +6%)', effects: { cost: 1500, permanentEfficiency: true } },
    { label: 'ОТКАЗАТЬ', consequence: '−5% дохода курьера на 2 мин', effects: { employeeIncome: -.05, duration: 120 } } ] },
]);
