import { BALANCE, xpForLevel } from '../config/gameBalance.js';
import { ORDER_STATUS } from '../managers/OrderManager.js';

export class OrderUI {
  constructor(scene, manager, state, player) {
    this.manager = manager;
    this.player = player;
    this.panel = document.querySelector('#order-panel');
    this.offer = document.querySelector('#order-offer');
    this.objective = document.querySelector('#objective');
    this.timer = document.querySelector('#timer');
    this.distance = document.querySelector('#distance');
    this.result = document.querySelector('#result');
    this.interaction = document.querySelector('#interact');
    this.acceptButton = document.querySelector('#accept-order');
    this.accept = () => { if (!player.inputBlocked) manager.accept(); };
    this.interact = () => { if (!player.inputBlocked) manager.interact(player); };
    this.acceptButton.addEventListener('click', this.accept);
    this.interaction.addEventListener('click', this.interact);
    this.key = scene.input.keyboard.addKey('E');
    this.key.on('down', this.interact);
    this.unsubscribeState = state.subscribe(({ money, level, xp, reputation }) => {
      document.querySelector('#money').textContent = `${money} ₽`;
      document.querySelector('#level').textContent = level;
      document.querySelector('#reputation').textContent = reputation;
      document.querySelector('#xp').textContent = `${xp} / ${xpForLevel(level + 1)} XP`;
    });
    this.unsubscribeOrder = manager.subscribe((event, order, extra) => this.render(event, order, extra));
    scene.events.once('shutdown', () => this.destroy());
  }

  render(event, order, extra) {
    const available = order.status === ORDER_STATUS.AVAILABLE;
    this.offer.hidden = !available;
    this.result.hidden = true;
    this.interaction.hidden = true;
    this.timer.hidden = true;
    this.distance.hidden = true;
    if (available) {
      this.objective.textContent = 'НОВЫЙ ЗАКАЗ';
      document.querySelector('#offer-restaurant').textContent = order.restaurant.name;
      document.querySelector('#offer-details').textContent = `Доставка: ${order.distance} м · Оплата: ${order.reward} ₽ · Время: ${order.deliveryTime} сек.`;
    } else if (managerIsActive(order)) {
      this.objective.textContent = order.status === ORDER_STATUS.ACCEPTED
        ? `Заберите заказ в ${order.restaurant.name}` : `Доставьте заказ: ${order.customer.name}`;
    } else {
      this.objective.textContent = order.status === ORDER_STATUS.DELIVERED ? 'ЗАКАЗ ДОСТАВЛЕН' : 'ВРЕМЯ ВЫШЛО';
      this.result.hidden = false;
      this.result.textContent = order.status === ORDER_STATUS.DELIVERED
        ? `+${extra.payout.total} ₽ · +${order.xpReward} XP · +${order.reputationReward} репутации`
        : `Заказ провален · −${BALANCE.failurePenalty} репутации`;
      if (extra.level > extra.previousLevel) this.result.textContent += `\nНОВЫЙ УРОВЕНЬ! Уровень ${extra.level}`;
      if (extra.payout?.modifiers.length) this.result.textContent += `\nБазовая оплата: ${extra.payout.baseReward} ₽\n${extra.payout.modifiers.map(modifier => `${modifier.name}: +${modifier.amount} ₽`).join('\n')}\nИтого: ${extra.payout.total} ₽`;
    }
  }

  update() {
    const target = this.manager.getTarget();
    if (!target) return;
    const seconds = this.manager.remainingSeconds();
    this.timer.hidden = false;
    this.timer.textContent = `Осталось: ${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    this.timer.classList.toggle('urgent', seconds <= 15);
    this.distance.hidden = false;
    const pickup = this.manager.order.status === ORDER_STATUS.ACCEPTED;
    this.distance.textContent = `До ${pickup ? 'ресторана' : 'клиента'}: ${Math.round(Math.hypot(this.player.x - target.x, this.player.y - target.y) * BALANCE.metersPerPixel)} м`;
    this.interaction.hidden = !this.manager.canInteract(this.player);
    this.interaction.textContent = pickup ? 'ЗАБРАТЬ ЗАКАЗ · E' : 'ПЕРЕДАТЬ ЗАКАЗ · E';
  }

  destroy() {
    this.unsubscribeOrder();
    this.unsubscribeState();
    this.acceptButton.removeEventListener('click', this.accept);
    this.interaction.removeEventListener('click', this.interact);
    this.key.off('down', this.interact);
  }
}

const managerIsActive = (order) => [ORDER_STATUS.ACCEPTED, ORDER_STATUS.PICKED_UP].includes(order.status);
