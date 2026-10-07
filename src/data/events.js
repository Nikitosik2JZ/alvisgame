import { EVENT_BALANCE as B } from '../config/eventBalance.js';
const event = (id, title, description, category, rarity, trigger, possibleEffects, extra = {}) =>
  ({ id, title, description, category, rarity, trigger, weight: 1, possibleEffects, ...extra });
export const EVENTS = [
  event('yard-dog', 'Злая собака во дворе', 'Охранник двора весит три килограмма, но спорить с ним не хочется.', 'NEGATIVE', 'COMMON', 'pickup', { time: B.district.dogTime }, { requirements: { districts: ['residential'] } }),
  event('street-closed', 'Перекрыли улицу', 'Асфальт ремонтируют именно там, где вам было удобно.', 'NEGATIVE', 'COMMON', 'pickup', { time: B.district.closedStreetTime }, { requirements: { districts: ['center'] } }),
  event('industrial-security', 'Охрана не пускает', 'Пропуск на склад есть у супа. У курьера — пока нет.', 'CHOICE', 'COMMON', 'customer', {}, { requirements: { districts: ['industrial'] }, choices: [
    { label: 'ПОЗВОНИТЬ КЛИЕНТУ', consequence: `−${B.district.securityCallTime} сек. · безопасно`, effects: { time: B.district.securityCallTime } },
    { label: 'ОБЪЕХАТЬ', consequence: `−${B.district.securityDetourTime} сек. · без потери репутации`, effects: { time: B.district.securityDetourTime } },
  ] }),
  event('empty-roads', 'Пустые дороги', 'Все фуры на обеде. Дорога временно ваша.', 'POSITIVE', 'COMMON', 'pickup', { speed: 'green' }, { requirements: { districts: ['industrial'] } }),
  event('elite-security', 'Охрана попросила подождать', 'Охрана проверяет список гостей. Возможно, вас уже знают.', 'NEUTRAL', 'COMMON', 'customer', { eliteSecurity: true }, { requirements: { districts: ['elite'] } }),
  event('elite-tips', 'Щедрые чаевые', '«Спасибо! Вы спасли наш приём». Даже пакет почувствовал себя важным.', 'POSITIVE', 'COMMON', 'customer', { tips: B.district.eliteTips }, { requirements: { districts: ['elite'] } }),
  event('business-pass', 'Пропуск не оформлен', 'Ресепшен ждёт заявку. Заявка ждёт согласование. Заказ ждёт вас.', 'CHOICE', 'COMMON', 'customer', {}, { requirements: { districts: ['business'] }, choices: [
    { label: 'ПОДОЖДАТЬ', consequence: `−${B.district.businessWaitTime} сек. · безопасно`, effects: { time: B.district.businessWaitTime } },
    { label: 'ПОЗВОНИТЬ КЛИЕНТУ', consequence: `${Math.round(B.district.businessCallSuccess * 100)}% сразу пройти · иначе −${B.district.businessCallTime} сек.`, effects: { businessCall: true } },
  ] }),
  event('corporate-bonus', 'Корпоративный бонус', 'Бухгалтерия согласовала доплату. Маленькое офисное чудо.', 'POSITIVE', 'UNCOMMON', 'customer', { moneyRange: B.district.corporateBonus }, { requirements: { districts: ['business'] } }),
  event('moped-fuel', 'БЕНЗИН НА НУЛЕ?', 'Лампочка топлива выглядит подозрительно грустно.', 'NEGATIVE', 'COMMON', 'pickup', { time: B.mopedFuelTime }, { requirements: { transports: ['MOPED'] } }),
  event('moped-route', 'Идеальный маршрут', 'Сегодня все светофоры будто работают на вас.', 'POSITIVE', 'COMMON', 'pickup', { speed: 'green' }, { requirements: { transports: ['MOPED'] } }),
  event('traffic', 'ПРОБКА', 'Навигатор обещал 5 минут.\nНавигатор соврал.', 'NEGATIVE', 'UNCOMMON', 'pickup', { speed: 'traffic' }, { requirements: { transports: ['CAR'] } }),
  event('parking', 'ПАРКОВКИ НЕТ', 'Свободное место существует только в легендах.', 'NEGATIVE', 'COMMON', 'customer', { time: B.parkingTime }, { requirements: { transports: ['CAR'] } }),
  event('car-green', 'ЗЕЛЁНЫЙ КОРИДОР', 'Все перекрёстки открыты. Доставка летит по расписанию.', 'POSITIVE', 'COMMON', 'pickup', { speed: 'green' }, { requirements: { transports: ['CAR'] } }),
  event('car-large', 'БОЛЬШОЙ ЗАКАЗ', 'Офис ищет курьера с автомобилем. Следующий заказ может стать крупным.', 'POSITIVE', 'UNCOMMON', 'customer', { largeOrderBoost: B.largeOrderBoost }, { requirements: { transports: ['CAR'] } }),
  event('cola', 'Где моя кола?!', 'Клиент уверен: кола исчезла по дороге. Поддержка изучает дело века.', 'NEGATIVE', 'VERY_RARE', 'customer', { dispute: true }),
  event('soup', 'Разлитый суп', 'Контейнер не пережил поездку. Пакет теперь немного аквариум.', 'NEGATIVE', 'COMMON', 'pickup', { payment: B.soupPayment }, { requirements: { food: true } }),
  event('entrance', 'Не тот подъезд', 'Навигатор привёл к соседнему дому. Он тоже красивый, но не тот.', 'NEGATIVE', 'COMMON', 'pickup', { time: B.wrongEntranceTime }, { requirements: { walkingRisk: true } }),
  event('barrier', 'Шлагбаум закрыт', 'Охрана проверяет, действительно ли вы курьер, а не суповой шпион.', 'NEGATIVE', 'COMMON', 'pickup', { time: B.barrierTime }, { requirements: { walkingRisk: true } }),
  event('rain', 'Дождь стеной', 'Небо включило бесплатный душ. Полотенце в тариф не входит.', 'NEGATIVE', 'UNCOMMON', 'pickup', { speed: 'rain' }),
  event('puncture', 'Колесо спустило', 'Велосипед решил немного побыть пешеходом. Скоро отпустит.', 'NEGATIVE', 'UNCOMMON', 'pickup', { speed: 'puncture' }, { requirements: { bicycle: true } }),
  event('principled', 'Принципиальный клиент', 'Успели, но клиент уже приготовил речь про пунктуальность.', 'NEGATIVE', 'RARE', 'customer', { reputation: -1 }, { requirements: { nearDeadline: true } }),
  event('generous', 'Щедрый клиент', '«Сдачи не надо». Самые красивые слова рабочего дня.', 'POSITIVE', 'COMMON', 'customer', { tips: B.tips }),
  event('thanks', 'Спасибо, вы спасли мой вечер!', 'Без ужина вечер был бы просто совещанием с холодильником.', 'POSITIVE', 'COMMON', 'customer', { reputationRange: B.thanks }),
  event('demand', 'Повышенный спрос', 'Город проголодался одновременно. Следующие три заказа дороже.', 'POSITIVE', 'UNCOMMON', 'customer', { demand: B.demandOrders }),
  event('green', 'Зелёная волна', 'Сегодня вселенная решила помочь курьеру.', 'POSITIVE', 'COMMON', 'pickup', { speed: 'green' }),
  event('close', 'Очень близкий заказ', 'Следующий клиент почти сосед. Ноги одобряют.', 'POSITIVE', 'UNCOMMON', 'customer', { closeOrder: true }),
  event('big-tips', 'Чаевые от души', 'Клиент явно знает, сколько стоит хорошее настроение.', 'POSITIVE', 'VERY_RARE', 'customer', { tips: B.bigTips }),
  event('favorite', 'Любимый курьер', 'Вас узнали! Даже кот вышел на встречу.', 'POSITIVE', 'RARE', 'customer', { money: B.favoriteMoney, reputation: B.favoriteReputation }, { requirements: { reputation: B.favoriteMinimum } }),
  event('silent', 'Клиент не отвечает', 'Вы у двери. Клиент, похоже, ушёл в режим полёта.', 'CHOICE', 'COMMON', 'customer', {}, { choices: [
    { label: 'ПОЗВОНИТЬ ЕЩЁ РАЗ', consequence: `−${B.callTime} сек. · ${B.callSuccess * 100}% обычная доставка`, effects: { time: B.callTime, gamble: 'call' } },
    { label: 'ОСТАВИТЬ У ДВЕРИ', consequence: `Сразу передать · ${B.doorComplaint * 100}% жалоба (${B.complaintReputation} реп.)`, effects: { gamble: 'door' } },
  ] }),
  event('lift', 'Лифт сломан', `Лифт умер. 12 этаж ждёт. Клиент предлагает доплатить ${B.stairsMoney} ₽.`, 'CHOICE', 'UNCOMMON', 'customer', {}, { choices: [
    { label: 'ПОДНЯТЬСЯ', consequence: `+${B.stairsMoney} ₽ после успешной доставки · −${B.stairsTime} сек.`, effects: { orderBonus: B.stairsMoney, time: B.stairsTime } },
    { label: 'ОТКАЗАТЬСЯ', consequence: 'Обычная оплата · без штрафа репутации', effects: {} },
  ] }),
  event('fries', 'Пахнет картошкой...', 'Пакет пахнет так, будто лично приглашает на обед.', 'CHOICE', 'COMMON', 'pickup', {}, { choices: [
    { label: 'НЕ ТРОГАТЬ', consequence: '+1 репутации', effects: { reputation: 1 } },
    { label: 'СЪЕСТЬ ОДНУ', consequence: `${Math.round((1-B.friesCaught)*100)}% ничего · ${B.friesCaught*100}% штраф ${B.friesFine} ₽ и ${B.friesReputation} реп.`, effects: { gamble: 'fries' } },
  ] }),
];
