import { EVENTS } from '../data/events.js';
import { EVENT_BALANCE as B } from '../config/eventBalance.js';
import { DISTRICTS, reputationTier } from '../config/economyConfig.js';
import { TemporaryModifiers } from './TemporaryModifiers.js';
import { transportFor, TRANSPORTS } from '../config/transportConfig.js';
import { progressionMultiplier, reputationReward } from './ProgressionModifiers.js';

export const fragileDamageRisk = s => Math.max(B.fragileMinimumRisk,
  B.fragileDamageRisk * transportFor(s.equippedTransport).fragileModifier * (s.equippedItems.BAG === 'thermobag' ? B.bagRisk : 1));

export class EventManager {
  constructor(state, orders, random = Math.random, now = () => performance.now()) {
    this.state = state; this.orders = orders; this.random = random;
    this.modifiers = new TemporaryModifiers(now); this.history = [];
    this.negativeStreak = 0; this.serial = 0; this.lastRareNegative = -Infinity;
    this.lastId = null; this.active = null; this.pending = null;
    orders.events = this;
  }
  eligible(event, checkDeadline = true) {
    const s = this.state.getSnapshot(), r = event.requirements || {};
    return (!r.bicycle || s.transport === 'BICYCLE') && (!r.reputation || s.reputation >= r.reputation)
      && (!r.districts || r.districts.includes(s.selectedDistrict))
      && (!r.transports || r.transports.includes(s.equippedTransport))
      && (!r.nearDeadline || !checkDeadline || this.orders.remainingSeconds() <= B.nearDeadline)
      && (this.negativeStreak < B.maxNegativeStreak || event.category === 'POSITIVE' || event.category === 'NEUTRAL')
      && (event.category !== 'NEGATIVE' || (this.negativeStreak < B.maxNegativeStreak
        && (event.rarity !== 'VERY_RARE' || this.serial - this.lastRareNegative >= B.rareNegativeCooldown)));
  }
  weighted(pool) {
    const s = this.state.getSnapshot();
    const weights = pool.map(e => e.weight
      * (DISTRICTS[s.selectedDistrict].eventWeights[e.id] ?? 1)
      * (e.requirements?.food && s.equippedItems.BAG === 'thermobag' ? B.bagRisk : 1)
      * (e.requirements?.food ? transportFor(s.equippedTransport).fragileModifier : 1)
      * (transportFor(s.equippedTransport).eventModifiers[e.id]?.[s.selectedDistrict] || 1)
      * (e.requirements?.walkingRisk && s.transport === 'WALKING' && s.equippedItems.SHOES === 'good-shoes' ? B.shoesRisk : 1)
      * (e.category === 'POSITIVE' ? 1 + this.negativeStreak * B.positiveRecoveryWeight : 1));
    let roll = this.random() * weights.reduce((a, b) => a + b, 0);
    return pool.find((e, i) => (roll -= weights[i]) < 0) || pool.at(-1);
  }
  prepare() {
    this.pending = null;
    const district = DISTRICTS[this.state.getSnapshot().selectedDistrict];
    let roll = this.random(), rarity;
    for (const [key, chance] of Object.entries(B.rarity)) {
      const adjusted = chance * district.event * (this.orders.order?.eventMultiplier || 1);
      if (roll < adjusted) { rarity = key; break; }
      roll -= adjusted;
    }
    if (!rarity) return;
    this.pending = this.weighted(EVENTS.filter(e => e.rarity === rarity && e.id !== this.lastId && this.eligible(e, false)));
  }
  trigger(moment, resume = () => {}) {
    let event = this.pending?.trigger === moment ? this.pending : null;
    if (event) this.pending = null;
    if (!event && moment === 'customer' && this.orders.order.type === 'FRAGILE' && !this.orders.order.damageChecked) {
      this.orders.order.damageChecked = true;
      const soup = EVENTS.find(e => e.id === 'soup');
      if (this.random() < fragileDamageRisk(this.state.getSnapshot()) && this.eligible(soup) && this.lastId !== soup.id) event = soup;
    }
    if (!event || !this.eligible(event) || this.active || this.isBlocked?.()) { resume(); return false; }
    this.active = { event, resume, pausedAt: this.orders.now() }; this.onShow?.(event); return true;
  }
  debug(category) {
    if (this.active || this.isBlocked?.()) return false;
    const event = this.weighted(EVENTS.filter(e => e.category === category && e.id !== this.lastId && this.eligible(e)));
    if (!event) return false;
    this.active = { event, resume: () => {}, pausedAt: this.orders.now() }; this.onShow?.(event); return true;
  }
  resolve(choice = 0) {
    if (!this.active || this.active.resolved) return;
    const event = this.active.event;
    const effects = { ...(event.choices?.[choice]?.effects || event.possibleEffects) };
    const lines = [], s = this.state.getSnapshot(), tier = reputationTier(s.reputation);
    const outcome = {};
    const range = ([min, max]) => min + Math.floor(this.random() * (max - min + 1));
    if (effects.dispute) {
      if (this.random() < tier.dispute) { outcome.disputeWon = true; lines.push('ПОДДЕРЖКА НА ВАШЕЙ СТОРОНЕ\nШтраф отменён.'); }
      else { effects.money = -B.colaFine; effects.reputation = B.colaReputation; lines.push('Поддержка поверила клиенту.'); }
    }
    if (effects.gamble === 'fries') {
      if (this.random() < B.friesCaught) { outcome.friesCaught = true; effects.money = -B.friesFine; effects.reputation = B.friesReputation; lines.push('Клиент пересчитал картошку. Одной не хватает!'); }
      else { outcome.friesEscaped = true; lines.push('Картошка исчезла без свидетелей. Совесть всё видела.'); }
    }
    if (effects.gamble === 'door' || effects.gamble === 'call') {
      const chance = effects.gamble === 'door' ? B.doorComplaint : 1 - B.callSuccess;
      if (this.random() < chance) { effects.reputation = B.complaintReputation; lines.push('Клиент пожаловался: «А где торжественная передача?»'); }
      else lines.push('Клиент получил заказ. Связь с человечеством восстановлена.');
    }
    if (effects.eliteSecurity) {
      if (s.reputation >= B.district.eliteSkipReputation) lines.push('ВАС УЗНАЛИ! Проходите без ожидания.');
      else effects.time = B.district.eliteWaitTime;
    }
    if (effects.businessCall) {
      if (this.random() < B.district.businessCallSuccess) lines.push('Клиент подтвердил пропуск. Проходите!');
      else { effects.time = B.district.businessCallTime; lines.push('Клиент ищет заявку. Небольшая задержка.'); }
    }
    if (effects.moneyRange) effects.money = range(effects.moneyRange);
    if (effects.tips) effects.money = Math.round(range(effects.tips) * tier.tips * DISTRICTS[s.selectedDistrict].tip * (this.orders.getTarget() ? this.orders.order.tipMultiplier || 1 : 1) * progressionMultiplier(s, 'tips'));
    if (effects.reputationRange) effects.reputation = range(effects.reputationRange);
    if (effects.money) {
      const actual = this.state.applyEventMoney(effects.money, Boolean(effects.tips));
      if (effects.money > 0 && this.orders.getTarget()) this.orders.order.eventIncome = (this.orders.order.eventIncome || 0) + actual;
      lines.push(effects.money < 0 ? `ШТРАФ: ${-effects.money} ₽\nСписано: ${actual} ₽${actual < -effects.money ? '\nБаланс исчерпан' : ''}` : `БОНУС / ЧАЕВЫЕ: +${actual} ₽`);
    }
    if (effects.reputation) {
      effects.reputation = reputationReward(this.state.values, effects.reputation);
      this.state.tasks.gameplayEvent(effects.reputation > 0 ? 'reputation' : 'negativeReputation', { amount: effects.reputation });
      if (effects.reputation < 0 && this.orders.order) this.orders.order.negativeReputation = true;
      this.state.update({ reputation: s.reputation + effects.reputation }); lines.push(`РЕПУТАЦИЯ: ${effects.reputation > 0 ? '+' : ''}${effects.reputation}`);
    }
    const order = this.orders.getTarget() ? this.orders.order : null;
    if (effects.time) {
      if (order) { order.deadline -= effects.time * 1000; lines.push(`ВРЕМЯ ЗАКАЗА: −${effects.time} сек.`); }
      else lines.push('Активного заказа нет — время не списано.');
    }
    if (effects.payment) {
      if (order) { order.paymentPenalty = effects.payment; lines.push(`ОПЛАТА ЗАКАЗА: ${Math.round(effects.payment * 100)}%`); }
      else lines.push('Активного заказа нет — оплата не изменена.');
    }
    if (effects.orderBonus) {
      if (order) { order.extraMoney = (order.extraMoney || 0) + effects.orderBonus; lines.push(`ДОПЛАТА ПРИ УСПЕХЕ: +${effects.orderBonus} ₽`); }
      else lines.push('Доплата доступна только при активном заказе.');
    }
    if (effects.demand) { this.state.setDemand(effects.demand); if (order) order.skipDemand = true; lines.push(`СПРОС: +${B.demandBonus * 100}% на ${effects.demand} следующих успешных заказа`); }
    if (effects.closeOrder) { this.state.nextCloseOrder = true; lines.push(`СЛЕДУЮЩИЙ ЗАКАЗ: ближайший клиент · +${Math.round((B.closeOrderMoney-1)*100)}% оплаты`); }
    if (effects.largeOrderBoost) { this.state.setLargeOrderBoost(effects.largeOrderBoost); lines.push('Следующий заказ на автомобиле: повышен шанс крупной доставки.'); }
    if (effects.speed) {
      const kind = effects.speed;
      const settings = { green: [B.greenSpeed, B.greenDuration], puncture: [B.punctureSpeed, B.punctureDuration],
        traffic: [B.trafficSpeed, B.trafficDuration], rain: [transportFor(s.equippedTransport).weatherModifier, B.rainDuration] };
      const [value, duration] = settings[kind];
      this.modifiers.add(event.id, value, duration, kind === 'rain' ? null : event.requirements?.transports || (kind === 'puncture' ? 'BICYCLE' : null),
        kind === 'rain' ? Object.fromEntries(TRANSPORTS.map(t => [t.id, t.weatherModifier])) : null);
      lines.push(`СКОРОСТЬ: ${Math.round((value - 1) * 100)}% · ${duration} сек.`);
    }
    const bad = (effects.money || 0) < 0 || (effects.reputation || 0) < 0 || effects.time || effects.payment || (effects.speed && effects.speed !== 'green');
    this.negativeStreak = bad ? this.negativeStreak + 1 : 0;
    if (bad && event.rarity === 'VERY_RARE') this.lastRareNegative = this.serial + 1;
    this.serial++; this.lastId = event.id;
    if (event.category === 'POSITIVE' && !bad) this.state.tasks.gameplayEvent('positiveEvent');
    if (event.category === 'CHOICE' && !bad) this.state.tasks.gameplayEvent('choiceSuccess');
    this.state.progression.event({ ...outcome, friesHonest: event.id === 'fries' && choice === 0,
      rarity: event.rarity, positive: event.category === 'POSITIVE', bad: Boolean(bad) });
    this.history.unshift({ title: event.title, text: lines.join('\n') || 'Обычная доставка. Без штрафов.', bad: Boolean(bad) });
    this.history.length = Math.min(this.history.length, B.historyLimit);
    this.active.resolved = true;
    return this.history[0].text;
  }
  finish() {
    if (!this.active?.resolved) return;
    const { resume, pausedAt } = this.active;
    if (this.orders.getTarget() && Number.isFinite(pausedAt)) this.orders.order.deadline += this.orders.now() - pausedAt;
    this.active = null; resume();
  }
}
