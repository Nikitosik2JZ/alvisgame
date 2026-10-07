import { DISTRICTS, DISTRICT_MASTERY } from './districtConfig.js';

export const RECORD_SETTINGS = { minimumRouteMeters: 200 };
export const requirement = (source, target, label) => ({ source, target, label });
const r = requirement;
const stage = (id, title, requirements, reward = {}) => ({ id, title, requirements, reward });
export const CAREER_MILESTONES = [
  stage('novice', 'Новичок', []),
  stage('walker', 'Пеший курьер', [r('deliveries', 5, 'Доставки')], { money: 150, xp: 20 }),
  stage('cyclist', 'Велокурьер', [r('transport:BICYCLE', 1, 'Велосипед'), r('deliveries', 15, 'Доставки')], { money: 500, xp: 40 }),
  stage('pro', 'Профи доставки', [r('level', 6, 'Уровень'), r('reputation', 25, 'Репутация')], { money: 600, xp: 60 }),
  stage('driver', 'Автокурьер', [r('transport:CAR', 1, 'Автомобиль')], { money: 800, xp: 80 }),
  stage('entrepreneur', 'Предприниматель', [r('company', 1, 'Компания открыта')], { money: 1500, legacy: 1 }),
  stage('owner', 'Владелец службы доставки', [r('companyLevel', 2, 'Уровень компании'), r('employees', 4, 'Сотрудники')], { money: 1500, xp: 100 }),
  stage('boss', 'Курьерский босс', [r('companyLevel', 4, 'Уровень компании'), r('companyEarnings', 250000, 'Доход компании за всё время')], { money: 2000, legacy: 2 }),
  stage('king', 'Король города', [r('districts', Object.keys(DISTRICTS).length, 'Районы'), r('maxMastery', DISTRICT_MASTERY.at(-1).min, 'Доставки в одном районе')], { legacy: 3 }),
  stage('magnate', 'Курьерский магнат', [r('level', 20, 'Уровень'), r('transport:CAR', 1, 'Автомобиль'),
    r('districts', Object.keys(DISTRICTS).length, 'Районы'), r('reputation', 100, 'Репутация'), r('companyLevel', 4, 'Уровень компании'),
    r('employees', 8, 'Сотрудники'), r('personalEarnings', 500000, 'Личный доход за всё время'), r('companyEarnings', 1000000, 'Доход компании за всё время'),
    r('deliveries', 100, 'Доставки'), r('publicAchievements', 15, 'Открытые обычные достижения')], { legacy: 5 }),
];
export const GLOBAL_GOALS = [
  stage('car', 'Купить автомобиль', [r('transport:CAR', 1, 'Автомобиль')]),
  stage('business', 'Открыть компанию', [r('company', 1, 'Компания')]),
  stage('team', 'Нанять 5 курьеров', [r('employees', 5, 'Сотрудники')]),
  stage('city', 'Открыть все районы', [r('districts', Object.keys(DISTRICTS).length, 'Районы')]),
  stage('hundred', 'Выполнить 100 заказов', [r('deliveries', 100, 'Доставки')]),
  stage('personal', 'Заработать 500 000 ₽ лично', [r('personalEarnings', 500000, 'Личный доход')]),
  stage('empire', 'Заработать 1 000 000 ₽ компанией', [r('companyEarnings', 1000000, 'Доход компании')]),
  stage('magnate-goal', 'Стать Курьерским магнатом', [r('career:magnate', 1, 'Этап карьеры')]),
];
