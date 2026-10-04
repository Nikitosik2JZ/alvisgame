import { itemById } from '../data/shopItems.js';

export class ShopManager {
  constructor(state) { this.state = state; }

  getItemState(id) {
    const item = itemById(id);
    const player = this.state.getSnapshot();
    if (!item) return { status: 'LOCKED', reason: 'Предмет не найден' };
    if (player.equippedItems[item.category] === id) return { status: 'EQUIPPED', reason: 'ЭКИПИРОВАНО' };
    if (player.ownedItems.includes(id)) return { status: 'OWNED', reason: 'КУПЛЕНО' };
    if (player.level < (item.requiredLevel || 1)) return { status: 'LOCKED', reason: `ТРЕБУЕТСЯ УРОВЕНЬ ${item.requiredLevel}` };
    if (item.requiresItem && !player.ownedItems.includes(item.requiresItem)) return { status: 'LOCKED', reason: `Сначала купите: ${itemById(item.requiresItem).name}` };
    return { status: 'AVAILABLE', reason: player.money < item.price ? `НЕ ХВАТАЕТ ДЕНЕГ · ещё ${item.price - player.money} ₽` : `КУПИТЬ — ${item.price} ₽` };
  }

  purchase(id) { return this.state.purchaseItem(id); }
  equip(id) { return this.state.equipItem(id); }
}
