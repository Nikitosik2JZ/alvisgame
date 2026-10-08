import { t as tr, formatNumber } from '../services/LocalizationService.js';
import { SHOP_ITEMS } from '../data/shopItems.js';
import { ModalUI } from './ModalUI.js';

export class ShopUI extends ModalUI {
  constructor(scene, manager, state, player) {
    super(scene, player, 'shop-dialog', 'open-shop');
    this.manager = manager;
    this.cards = new Map();
    const list = this.dialog.querySelector('#shop-items');
    list.replaceChildren();
    for (const item of SHOP_ITEMS) {
      const card = document.createElement('article');
      card.className = 'shop-item';
      card.innerHTML = `<h3>${item.name} <span>${formatNumber(item.price)} ₽</span></h3><p>${item.description}</p><small data-status></small><button data-item="${item.id}"></button>`;
      const button = card.querySelector('button');
      button.onclick = () => {
        const status = manager.getItemState(item.id).status;
        const result = status === 'OWNED' ? manager.equip(item.id) : manager.purchase(item.id);
        document.querySelector('#shop-feedback').textContent = result.ok
          ? `${status === 'OWNED' ? tr('shop-manager.002') : tr('shop-ui.001')} · ${item.name}\n${item.description}` : result.reason;
      };
      list.append(card);
      this.cards.set(item.id, card);
    }
    this.unsubscribe = state.subscribe(snapshot => this.render(snapshot));
    scene.events.once('shutdown', () => this.unsubscribe());
  }

  render(player) {
    document.querySelector('#shop-money').textContent = tr('garage-ui.006', { v0: player.money, v1: player.level });
    for (const item of SHOP_ITEMS) {
      const card = this.cards.get(item.id);
      const { status, reason } = this.manager.getItemState(item.id);
      card.dataset.state = status;
      card.querySelector('[data-status]').textContent = reason;
      const button = card.querySelector('button');
      button.textContent = status === 'OWNED' ? tr('shop-ui.002') : status === 'EQUIPPED' ? tr('shop-manager.002') : tr('shop-manager.007', { v0: item.price });
      button.disabled = status === 'EQUIPPED';
      // Invalid attempts stay actionable so the player can see their reason.
    }
  }
}
