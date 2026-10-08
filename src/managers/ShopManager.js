import { t as tr } from '../services/LocalizationService.js';
import { itemById } from '../data/shopItems.js';

export class ShopManager {
  constructor(state) { this.state = state; }

  getItemState(id) {
    const item = itemById(id);
    const player = this.state.getSnapshot();
    if (!item) return { status: 'LOCKED', reason: tr('shop-manager.001') };
    if (player.equippedItems[item.category] === id) return { status: 'EQUIPPED', reason: tr('shop-manager.002') };
    if (player.ownedItems.includes(id)) return { status: 'OWNED', reason: tr('shop-manager.003') };
    if (player.level < (item.requiredLevel || 1)) return { status: 'LOCKED', reason: tr('shop-manager.004', { v0: item.requiredLevel }) };
    if (item.requiresItem && !player.ownedItems.includes(item.requiresItem)) return { status: 'LOCKED', reason: tr('shop-manager.005', { v0: itemById(item.requiresItem).name }) };
    return { status: 'AVAILABLE', reason: player.money < item.price ? tr('shop-manager.006', { v0: item.price - player.money }) : tr('shop-manager.007', { v0: item.price }) };
  }

  purchase(id) { return this.state.purchaseItem(id); }
  equip(id) { return this.state.equipItem(id); }
}
