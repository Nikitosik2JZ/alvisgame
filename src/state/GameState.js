import { BALANCE, levelForXP } from '../config/gameBalance.js';
import { CATEGORIES, TRANSPORT, itemById } from '../data/shopItems.js';

const initialState = () => ({ money: 0, level: 1, xp: 0, reputation: 0, movementSpeed: BALANCE.walkingBaseSpeed,
  transport: TRANSPORT.WALKING, ownedItems: [], equippedItems: { SHOES: null, BAG: null, TRANSPORT: null } });

// One owner for progression. Derived stats are recalculated, never trusted from saves.
export class GameState {
  constructor() { this.values = initialState(); this.listeners = new Set(); }

  getSnapshot() {
    return { ...this.values, ownedItems: [...this.values.ownedItems], equippedItems: { ...this.values.equippedItems } };
  }

  refresh() {
    this.values.level = levelForXP(this.values.xp);
    this.values.transport = this.values.equippedItems.TRANSPORT === 'bicycle' ? TRANSPORT.BICYCLE : TRANSPORT.WALKING;
    const shoes = itemById(this.values.equippedItems.SHOES);
    this.values.movementSpeed = this.values.transport === TRANSPORT.BICYCLE
      ? BALANCE.bicycleSpeed : Math.round(BALANCE.walkingBaseSpeed * (1 + (shoes?.walkingBonus || 0)));
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

  addRewards({ reward, xpReward, reputationReward }) {
    this.update({ money: this.values.money + reward, xp: this.values.xp + xpReward, reputation: this.values.reputation + reputationReward });
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

  getSaveData() { return { version: 2, ...this.getSnapshot() }; }

  loadSaveData(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
    this.values = initialState();
    if (Array.isArray(data.ownedItems)) this.values.ownedItems = [...new Set(data.ownedItems.filter(id => itemById(id)))];
    for (const category of CATEGORIES) {
      const id = data.equippedItems?.[category];
      if (this.values.ownedItems.includes(id) && itemById(id)?.category === category) this.values.equippedItems[category] = id;
    }
    // Migration for saves that stored transport but omitted equipment.
    if (!data.equippedItems && data.transport === TRANSPORT.BICYCLE && this.values.ownedItems.includes('bicycle')) this.values.equippedItems.TRANSPORT = 'bicycle';
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
