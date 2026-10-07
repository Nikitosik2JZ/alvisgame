// All district progression and economy knobs live here; maps remain small and controlled.
const district = (name, level, cost, money, xp, extra) => ({
  name, level, cost, money, xp, reputation: 0, tip: 1, event: 1,
  reputationBonus: 0, failureMultiplier: 1, companyBonus: 0, transportPoolExtension: 0, doubleRouteMultiplier: 1.5,
  orderWeights: { STANDARD: 1, URGENT: 1, FRAGILE: 1, DOUBLE: 1, LARGE: 1, ELITE: 0 },
  eventWeights: {}, ...extra,
});

export const DISTRICTS = {
  residential: district('Спальный район', 1, 0, 1, 1, {
    routeRange: [100, 400], recommendedTransports: ['WALKING', 'BICYCLE'],
    description: 'Короткие маршруты, обычные заказы и зелёные дворы. Начало карьеры.',
    orderSummary: 'Преобладают обычные заказы',
    eventWeights: { 'yard-dog': 3, traffic: .5, parking: .5 },
    visual: { ground: 0x8ca77b, road: 0x596967, sidewalk: 0xd1ceba, building: 0xa8b9ad, park: 0x769569 },
  }),
  center: district('Центр', 4, 3000, 1.3, 1.15, {
    event: 1.15, companyBonus: .02, transportPoolExtension: .33, routeRange: [180, 700], recommendedTransports: ['BICYCLE', 'MOPED'],
    description: 'Плотная застройка, средние маршруты и вечный поиск парковки.',
    orderSummary: 'Больше срочных и двойных заказов',
    orderWeights: { STANDARD: .8, URGENT: 1.5, FRAGILE: 1.2, DOUBLE: 1.3, LARGE: 1, ELITE: 0 },
    eventWeights: { 'street-closed': 3, traffic: 1.5, parking: 1.5 },
    visual: { ground: 0x9b9da6, road: 0x505e6c, sidewalk: 0xd2d0c8, building: 0x8996b4, park: 0x769569 },
  }),
  industrial: district('Промзона', 7, 8000, 1.55, 1.3, {
    tip: .75, event: 1.2, companyBonus: .03, routeRange: [450, 1050], recommendedTransports: ['MOPED', 'CAR'],
    description: 'Длиннее маршруты. Больше крупных заказов. Выше оплата. Склады и просторные дворы.',
    orderSummary: 'Крупные на автомобиле, двойные и срочные',
    orderWeights: { STANDARD: .7, URGENT: 1.1, FRAGILE: .5, DOUBLE: 1.5, LARGE: 3, ELITE: 0 },
    eventWeights: { 'industrial-security': 3, 'empty-roads': 2, 'moped-fuel': 1.8, puncture: 1.5, generous: .6, 'big-tips': .6 },
    visual: { ground: 0x8b8678, road: 0x515550, sidewalk: 0xb7b1a2, building: 0x9e8b6c, park: 0x817e6a },
  }),
  elite: district('Элитный район', 10, 18000, 1.7, 1.35, {
    reputation: 40, tip: 1.8, event: 1.25, reputationBonus: 1, failureMultiplier: 2, companyBonus: .04,
    routeRange: [220, 650], recommendedTransports: ['BICYCLE', 'MOPED', 'CAR'],
    description: 'Богатые клиенты, ухоженные виллы и высокие ожидания. За серьёзный провал теряется больше репутации.',
    orderSummary: 'Хрупкие, срочные и редкие элитные',
    orderWeights: { STANDARD: .6, URGENT: 1.2, FRAGILE: 3.5, DOUBLE: .7, LARGE: .6, ELITE: 5 },
    eventWeights: { 'elite-security': 3, 'elite-tips': 3, generous: 1.8, 'big-tips': 1.8, principled: 2 },
    visual: { ground: 0x87ae86, road: 0x637977, sidewalk: 0xe3ddc8, building: 0xe0cda2, park: 0x679e72 },
  }),
  business: district('Деловой квартал', 14, 45000, 2, 1.5, {
    reputation: 70, requiredOwnedTransports: ['MOPED', 'CAR'], tip: 1.25, event: 1.4,
    reputationBonus: 1, failureMultiplier: 2, companyBonus: .05,
    routeRange: [550, 1100], recommendedTransports: ['MOPED', 'CAR'],
    description: 'Офисные башни, дальние корпоративные доставки и самые дорогие контракты.',
    orderSummary: 'Срочные, двойные, крупные на авто и редкие элитные',
    orderWeights: { STANDARD: .4, URGENT: 2, FRAGILE: .8, DOUBLE: 2.5, LARGE: 2.5, ELITE: 8 },
    eventWeights: { 'business-pass': 3, 'corporate-bonus': 2, traffic: 1.4, parking: 1.5 },
    visual: { ground: 0x788898, road: 0x3f5261, sidewalk: 0xc2cbd1, building: 0x749cad, park: 0x728e89 },
  }),
};

export const DISTRICT_MASTERY = [
  { min: 0, name: 'Новичок района', bonus: 0 },
  { min: 10, name: 'Знает улицы', bonus: .01 },
  { min: 25, name: 'Местный профи', bonus: .03 },
  { min: 50, name: 'Легенда района', bonus: .05 },
];
export const districtMastery = completed => [...DISTRICT_MASTERY].reverse().find(t => completed >= t.min) || DISTRICT_MASTERY[0];
export const emptyDistrictStats = () => ({ completedOrders: 0, failedOrders: 0, totalEarned: 0, bestDeliveryReward: 0 });
export const companyDistrictBonus = s => (s.unlockedDistricts || []).reduce((sum, id) => sum + (DISTRICTS[id]?.companyBonus || 0), 0);
export const districtRequirements = d => `Уровень ${d.level}${d.reputation ? ` · Репутация ${d.reputation}` : ''} · ${d.cost.toLocaleString('ru-RU')} ₽${d.requiredOwnedTransports ? ' · Мопед или автомобиль в собственности' : ''}`;

export const ELITE_ORDERS = {
  level: 12, reputation: 60, districts: ['elite', 'business'], money: 3, xp: 2,
  reputationRange: [5, 10], timer: 1.3, event: 1.35, failurePenalty: 6,
  variants: [
    { id: 'documents', name: 'СРОЧНАЯ ДОСТАВКА ДОКУМЕНТОВ', cargo: 'Документы', timer: .85, money: 1, reputation: 7, weight: 3 },
    { id: 'vip', name: 'VIP-ДОСТАВКА', cargo: 'Подарок премиум-клиенту', timer: 1.3, money: 1, reputation: 8, tip: 1.5, minimumReputation: 70, weight: 2 },
    { id: 'corporate', name: 'КОРПОРАТИВНЫЙ ЗАКАЗ', cargo: 'Корпоративный груз', timer: 1.6, money: 1.15, reputation: 10, distanceStart: .6, recommendedTransport: 'CAR', weight: 2 },
  ],
};
export const eliteOrdersEligible = s => s.level >= ELITE_ORDERS.level && s.reputation >= ELITE_ORDERS.reputation && ELITE_ORDERS.districts.includes(s.selectedDistrict);
export const DISTRICT_TRANSITION_MS = 180;
