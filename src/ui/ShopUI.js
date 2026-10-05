import { SHOP_ITEMS } from '../data/shopItems.js';
import { ModalUI } from './ModalUI.js';
import { goalText } from '../config/transportConfig.js';

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
      card.innerHTML = `<h3>${item.name} <span>${item.price} ₽</span></h3><p>${item.description}</p><small data-status></small><button data-item="${item.id}"></button>`;
      const button = card.querySelector('button');
      button.onclick = () => {
        const status = manager.getItemState(item.id).status;
        const result = status === 'OWNED' ? manager.equip(item.id) : manager.purchase(item.id);
        document.querySelector('#shop-feedback').textContent = result.ok
          ? `${status === 'OWNED' ? 'ЭКИПИРОВАНО' : 'ПОКУПКА УСПЕШНА'} · ${item.name}\n${item.description}` : result.reason;
      };
      list.append(card);
      this.cards.set(item.id, card);
    }
    this.unsubscribe = state.subscribe(snapshot => this.render(snapshot));
    scene.events.once('shutdown', () => this.unsubscribe());
  }

  render(player) {
    document.querySelector('#shop-money').textContent = `У вас: ${player.money} ₽ · Уровень ${player.level}`;
    for (const item of SHOP_ITEMS) {
      const card = this.cards.get(item.id);
      const { status, reason } = this.manager.getItemState(item.id);
      card.dataset.state = status;
      card.querySelector('[data-status]').textContent = reason;
      const button = card.querySelector('button');
      button.textContent = status === 'OWNED' ? 'ЭКИПИРОВАТЬ' : status === 'EQUIPPED' ? 'ЭКИПИРОВАНО' : `КУПИТЬ — ${item.price} ₽`;
      button.disabled = status === 'EQUIPPED';
      // Invalid attempts stay actionable so the player can see their reason.
    }
    const goal = goalText(player);
    document.querySelector('#shop-goal').textContent = goal;
  }
}
