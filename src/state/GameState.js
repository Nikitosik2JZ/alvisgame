import { BALANCE, levelForXP } from '../config/gameBalance.js';
import { CATEGORIES, itemById } from '../data/shopItems.js';
import { DISTRICTS } from '../config/economyConfig.js';
import { EVENT_BALANCE } from '../config/eventBalance.js';
import { TRANSPORT, transportById, transportFor, TRANSPORTS } from '../config/transportConfig.js';
import { initialCompanyState, loadCompanyState } from './companyState.js';

const STAT_KEYS = ['completedOrders', 'failedOrders', 'totalMoneyEarned', 'totalTipsEarned', 'totalFinesPaid', 'totalDistanceDelivered'];

const initialState = () => ({ money: 0, level: 1, xp: 0, reputation: 0, movementSpeed: BALANCE.walkingBaseSpeed,
  unlockedDistricts: ['residential'], selectedDistrict: 'residential', demandBonusOrders: 0,
  transport: TRANSPORT.WALKING, equippedTransport: TRANSPORT.WALKING, ownedTransports: [TRANSPORT.WALKING], transportMilestones: [],
  largeOrderBoost: 0, ownedItems: [], equippedItems: { SHOES: null, BAG: null },
  ...Object.fromEntries(STAT_KEYS.map(key => [key, 0])), ...initialCompanyState() });

// One owner for progression. Derived stats are recalculated, never trusted from saves.
export class GameState {
  constructor() { this.values = initialState(); this.listeners = new Set(); }

  getSnapshot() {
    return { ...this.values, unlockedDistricts: [...this.values.unlockedDistricts], ownedTransports: [...this.values.ownedTransports],
      transportMilestones: [...this.values.transportMilestones], ownedItems: [...this.values.ownedItems], equippedItems: { ...this.values.equippedItems },
      employees: this.values.employees.map(e => ({ ...e })), companyVehicles: this.values.companyVehicles.map(v => ({ ...v })),
      companyStats: { ...this.values.companyStats }, companyLog: [...this.values.companyLog] };
  }

  refresh() {
    this.values.level = levelForXP(this.values.xp);
    this.values.transport = this.values.equippedTransport;
    const transport = transportFor(this.values.transport);
    const shoes = itemById(this.values.equippedItems.SHOES);
    this.values.movementSpeed = Math.round(transport.movementSpeed * (transport.id === TRANSPORT.WALKING ? 1 + (shoes?.walkingBonus || 0) : 1));
    for (const listener of this.listeners) listener(this.getSnapshot());
  }

  update(changes) {
    for (const key of ['money', 'xp', 'reputation']) {
      if (Number.isFinite(changes[key])) {
        this.values[key] = key === 'reputation' ? Math.floor(changes[key]) : Math.max(0, Math.floor(changes[key]));
      }
    }
    this.refresh();
  }

  addRewards({ reward, xpReward, reputationReward, distance = 0 }) {
    this.values.completedOrders++;
    this.values.totalMoneyEarned += reward;
    this.values.totalDistanceDelivered += Math.max(0, Math.round(distance));
    this.update({ money: this.values.money + reward, xp: this.values.xp + xpReward, reputation: this.values.reputation + reputationReward });
  }

  failOrder(penalty) {
    this.values.failedOrders++;
    this.update({ reputation: this.values.reputation - penalty });
  }

  applyEventMoney(delta, tips = false) {
    const actual = delta < 0 ? -Math.min(this.values.money, -delta) : delta;
    if (actual > 0) {
      this.values.totalMoneyEarned += actual;
      if (tips) this.values.totalTipsEarned += actual;
    } else this.values.totalFinesPaid -= actual;
    this.update({ money: this.values.money + actual });
    return Math.abs(actual);
  }

  purchaseItem(id) {
    const item = itemById(id);
    if (!item) return { ok: false, reason: 'Предмет не найден' };
    if (this.values.ownedItems.includes(id)) return { ok: false, reason: 'Уже куплено' };
    if (this.values.level < (item.requiredLevel || 1)) return { ok: false, reason: 'Требуется уровень ' + item.requiredLevel };
    if (item.requiresItem && !this.values.ownedItems.includes(item.requiresItem)) return { ok: false, reason: 'Сначала купите: ' + itemById(item.requiresItem).name };
    if (this.values.money < item.price) return { ok: false, reason: 'Не хватает денег · ещё ' + (item.price - this.values.money) + ' ₽' };
    this.values.money -= item.price;
    this.values.ownedItems.push(id);
    this.values.equippedItems[item.category] = id;
    this.refresh();
    return { ok: true, item };
  }

  equipItem(id) {
    const item = itemById(id);
    if (!item || !this.values.ownedItems.includes(id)) return { ok: false, reason: 'Предмет не куплен' };
    this.values.equippedItems[item.category] = id;
    this.refresh();
    return { ok: true, item };
  }

  unequipCategory(category) {
    if (!CATEGORIES.includes(category)) return false;
    this.values.equippedItems[category] = null;
    this.refresh();
    return true;
  }

  setDemand(count) { this.values.demandBonusOrders = Math.max(0, Math.floor(count)); this.refresh(); }

  transportChangeError() {
    return this.isTransportLocked?.() ? 'СНАЧАЛА ЗАВЕРШИТЕ ТЕКУЩИЙ ЗАКАЗ' : null;
  }

  purchaseTransport(id) {
    const transport = transportById(id), blocked = this.transportChangeError();
    if (!transport) return { ok: false, reason: 'Транспорт не найден' };
    if (this.values.ownedTransports.includes(id)) return { ok: false, reason: 'Уже куплено' };
    if (blocked) return { ok: false, reason: blocked };
    if (this.values.level < transport.requiredLevel) return { ok: false, reason: 'Требуется уровень ' + transport.requiredLevel };
    if (this.values.money < transport.purchasePrice) return { ok: false, reason: 'Не хватает денег · ещё ' + (transport.purchasePrice - this.values.money) + ' ₽' };
    this.values.money -= transport.purchasePrice;
    this.values.ownedTransports.push(id);
    this.values.equippedTransport = id;
    this.refresh();
    return { ok: true, transport };
  }

  equipTransport(id) {
    if (!transportById(id) || !this.values.ownedTransports.includes(id)) return { ok: false, reason: 'Транспорт не куплен' };
    const blocked = this.transportChangeError();
    if (blocked) return { ok: false, reason: blocked };
    this.values.equippedTransport = id;
    this.refresh();
    return { ok: true, transport: transportById(id) };
  }

  setLargeOrderBoost(value) { this.values.largeOrderBoost = Math.max(0, Math.min(EVENT_BALANCE.largeOrderBoost, value)); this.refresh(); }
  markTransportMilestone(id) {
    if (!transportById(id) || this.values.transportMilestones.includes(id)) return false;
    this.values.transportMilestones.push(id); this.refresh(); return true;
  }

  unlockDistrict(id) {
    const district = Object.hasOwn(DISTRICTS, id) ? DISTRICTS[id] : null;
    if (!district || this.values.unlockedDistricts.includes(id)) return false;
    if (this.values.level < district.level || this.values.money < district.cost) return false;
    this.values.money -= district.cost; this.values.unlockedDistricts.push(id); this.refresh(); return true;
  }

  selectDistrict(id) {
    if (!this.values.unlockedDistricts.includes(id)) return false;
    this.values.selectedDistrict = id; this.refresh(); return true;
  }

  getSaveData() { return { version: 6, ...this.getSnapshot() }; }

  loadSaveData(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
    this.values = initialState();
    Object.assign(this.values, loadCompanyState(data));
    this.nextCloseOrder = false;
    if (Array.isArray(data.unlockedDistricts)) this.values.unlockedDistricts = [...new Set(['residential', ...data.unlockedDistricts.filter(id => typeof id === 'string' && Object.hasOwn(DISTRICTS, id))])];
    if (this.values.unlockedDistricts.includes(data.selectedDistrict)) this.values.selectedDistrict = data.selectedDistrict;
    if (Number.isFinite(data.demandBonusOrders)) this.values.demandBonusOrders = Math.min(EVENT_BALANCE.demandOrders, Math.max(0, Math.floor(data.demandBonusOrders)));
    if (Array.isArray(data.ownedItems)) this.values.ownedItems = [...new Set(data.ownedItems.filter(id => itemById(id)))];
    for (const category of CATEGORIES) {
      const id = data.equippedItems?.[category];
      if (this.values.ownedItems.includes(id) && itemById(id)?.category === category) this.values.equippedItems[category] = id;
    }
    if (Array.isArray(data.ownedTransports)) this.values.ownedTransports = [...new Set([TRANSPORT.WALKING, ...data.ownedTransports.filter(id => transportById(id))])];
    const legacyBicycle = (Array.isArray(data.ownedItems) && data.ownedItems.includes('bicycle')) || data.transport === TRANSPORT.BICYCLE || data.equippedItems?.TRANSPORT === 'bicycle';
    if (legacyBicycle && !this.values.ownedTransports.includes(TRANSPORT.BICYCLE)) this.values.ownedTransports.push(TRANSPORT.BICYCLE);
    const equipped = data.equippedTransport ?? (data.equippedItems?.TRANSPORT === 'bicycle' ? TRANSPORT.BICYCLE : data.transport);
    if (this.values.ownedTransports.includes(equipped)) this.values.equippedTransport = equipped;
    if (Array.isArray(data.transportMilestones)) this.values.transportMilestones = [...new Set(data.transportMilestones.filter(id => TRANSPORTS.some(t => t.id === id && t.milestoneTitle)))];
    if (Number.isFinite(data.largeOrderBoost)) this.values.largeOrderBoost = Math.max(0, Math.min(EVENT_BALANCE.largeOrderBoost, data.largeOrderBoost));
    for (const key of STAT_KEYS) if (Number.isFinite(data[key])) this.values[key] = Math.max(0, Math.floor(data[key]));
    this.update(data);
    return true;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }
}
export const gameState = new GameState();
