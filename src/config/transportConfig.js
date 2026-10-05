import { ECONOMY as E } from './economyConfig.js';
import { EVENT_BALANCE as B } from './eventBalance.js';

export const TRANSPORT = Object.freeze({ WALKING: 'WALKING', BICYCLE: 'BICYCLE', MOPED: 'MOPED', CAR: 'CAR' });
const visual = (texture, width = 44, height = 44) => ({ texture, width, height, bodyWidth: 22, bodyHeight: 24 });
export const TRANSPORTS = Object.freeze([
  { id: 'WALKING', name: 'ПЕШКОМ', purchasePrice: 0, requiredLevel: 1, movementSpeed: E.walkingBaseSpeed,
    weatherModifier: B.rainWalking, fragileModifier: 1, eventModifiers: {}, visual: visual('courier'), careerTitle: 'Новичок',
    bonuses: 'Короткие маршруты · обувь повышает скорость', disadvantages: 'Дождь замедляет на 20%' },
  { id: 'BICYCLE', name: 'ВЕЛОСИПЕД', purchasePrice: E.bicyclePrice, requiredLevel: E.bicycleLevel, movementSpeed: E.bicycleSpeed,
    weatherModifier: B.rainBicycle, fragileModifier: 1.1, eventModifiers: {}, visual: visual('courier-bicycle'), careerTitle: 'Велокурьер',
    bonuses: 'Короткие и средние маршруты · двойные заказы', disadvantages: 'Дождь −25% скорости · иногда спускает колесо' },
  { id: 'MOPED', name: 'МОПЕД', purchasePrice: E.mopedPrice, requiredLevel: E.mopedLevel, movementSpeed: E.mopedSpeed,
    weatherModifier: .9, fragileModifier: .8, eventModifiers: {}, visual: visual('courier-moped', 48, 56), careerTitle: 'Опытный курьер',
    milestoneTitle: 'МОПЕД ДОСТУПЕН!', milestoneText: `Накопите ${E.mopedPrice} ₽ и пересаживайтесь на мопед.`,
    bonuses: 'Больше срочных и двойных заказов · дальние маршруты · дождь всего −10%',
    disadvantages: `Бензин на нуле? −${B.mopedFuelTime} сек. · идеальный маршрут: временное ускорение`,
    celebration: { title: 'НОВАЯ ЖИЗНЬ!', text: 'Вы купили мопед. Ещё недавно вы бегали по району пешком. Теперь вас ждут более дорогие заказы.' } },
  { id: 'CAR', name: 'АВТОМОБИЛЬ', purchasePrice: E.carPrice, requiredLevel: E.carLevel, movementSpeed: E.carSpeed,
    weatherModifier: .98, fragileModifier: .35, eventModifiers: { traffic: { center: 1.6 }, parking: { center: 1.6 } }, visual: visual('courier-car', 58, 76), careerTitle: 'Профи доставки',
    milestoneTitle: 'АВТОМОБИЛЬ ДОСТУПЕН!', milestoneText: 'Теперь вам доступны самые дорогие доставки.',
    bonuses: 'Крупные заказы · дальние доставки · защита хрупкого груза · дождь всего −2%',
    disadvantages: 'Пробки и парковка · в Центре эти события встречаются чаще',
    celebration: { title: 'ВОТ ЭТО УЖЕ СЕРЬЁЗНО.', text: 'У вас появился автомобиль. Открыты крупные доставки. Вы становитесь профи доставки.' } },
].map(t => Object.freeze({ ...t, allowedOrderTypes: Object.keys(E.transportOrderWeights[t.id]),
  orderWeights: E.transportOrderWeights[t.id], distancePool: E.transportDistancePools[t.id] })));
export const transportById = id => TRANSPORTS.find(t => t.id === id);
export const transportFor = id => transportById(id) || TRANSPORTS[0];
export const nextTransportGoal = player => TRANSPORTS[1 + Math.max(...player.ownedTransports.map(id => TRANSPORTS.findIndex(t => t.id === id)))];
export const careerTitle = player => [...TRANSPORTS].reverse().find(t => player.ownedTransports.includes(t.id)).careerTitle;
export const goalText = player => {
  const next = nextTransportGoal(player);
  return next ? `СЛЕДУЮЩАЯ ЦЕЛЬ · ${next.name}\nСтоимость: ${next.purchasePrice} ₽ · У вас: ${player.money} ₽ · Осталось: ${Math.max(0, next.purchasePrice - player.money)} ₽ · Уровень: ${player.level} / ${next.requiredLevel}`
    : 'ПРОФИ ДОСТАВКИ · Весь транспорт куплен!';
};
