import { BALANCE, xpForLevel } from '../config/gameBalance.js';
import { ORDER_STATUS } from '../managers/OrderManager.js';
import { ORDER_TYPES, DISTRICTS } from '../config/economyConfig.js';
import { transportFor } from '../config/transportConfig.js';
import { ads, saves } from '../services/GameRuntime.js';
import { lifecycle } from '../services/LifecycleManager.js';
import { localization as l } from '../services/LocalizationService.js';

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
    this.resultActions = document.querySelector('#result-actions');
    this.bonusText = document.querySelector('#delivery-ad-bonus');
    this.rewardButton = document.querySelector('#rewarded-delivery');
    this.continueButton = document.querySelector('#continue-delivery');
    this.feedback = document.querySelector('#ad-feedback');
    this.reward = async () => {
      if (ads.busy || this.rewardButton.disabled) return;
      this.rewardButton.disabled = true; this.continueButton.disabled = true;
      const result = await ads.rewarded(manager);
      this.feedback.textContent = result.rewarded ? 'БОНУС ПОЛУЧЕН · Прогресс сохранён' : l.t('adUnavailable');
      this.continueButton.disabled = false;
    };
    this.continue = async () => {
      if (ads.busy || this.continueButton.disabled || document.querySelector('dialog[open]')) return;
      this.continueButton.disabled = true;
      await ads.interstitial(manager);
      // A platform/auth/visibility blocker may still remain after the ad closes.
      manager.generate(); lifecycle.set('RESULT', false);
      this.continueButton.disabled = false;
    };
    this.rewardButton.addEventListener('click', this.reward);
    this.continueButton.addEventListener('click', this.continue);
    this.interaction = document.querySelector('#interact');
    this.acceptButton = document.querySelector('#accept-order');
    this.toggle = document.querySelector('#toggle-order');
    this.details = document.querySelector('#active-order-details');
    this.expanded = false;
    this.toggleDetails = () => {
      this.expanded = !this.expanded;
      this.details.hidden = !this.expanded;
      this.toggle.textContent = this.expanded ? 'СКРЫТЬ ▲' : 'ДЕТАЛИ ▼';
      this.toggle.setAttribute('aria-expanded', String(this.expanded));
    };
    this.toggle.addEventListener('click', this.toggleDetails);
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
    this.resultActions.hidden = !['completed', 'failed'].includes(event);
    if (event === 'generated') lifecycle.set('RESULT', false);
    if (['completed', 'failed'].includes(event)) {
      lifecycle.set('RESULT', true); saves.interrupt();
      if (event === 'completed') ads.offerDelivery(order, extra.payout);
      const bonus = event === 'completed' ? this.manager.state.values.deliveryAdBonus : null;
      this.bonusText.hidden = !bonus; this.rewardButton.hidden = !bonus;
      this.bonusText.textContent = bonus ? `Получить ещё +${bonus.amount} ₽ (+${Math.round(ads.config.rewardedMultiplier * 100)}% к оплате) за просмотр рекламы` : '';
      this.rewardButton.disabled = !bonus || bonus.attempted || bonus.claimed;
      this.feedback.textContent = ''; this.continueButton.disabled = false;
    }
    const available = order.status === ORDER_STATUS.AVAILABLE;
    const typeLabel = ORDER_TYPES[order.type]?.name || 'ОБЫЧНЫЙ';
    const districtName = DISTRICTS[order.district]?.name || '';
    this.panel.dataset.value = order.type === 'ELITE' ? 'elite' : order.type === 'LARGE' ? 'large' : 'normal';
    const progress = order.type === 'DOUBLE' ? ` · ${order.deliveredCount} / 2 доставлено` : '';
    this.panel.dataset.mode = available ? 'offer' : managerIsActive(order) ? 'active' : 'result';
    this.toggle.hidden = !managerIsActive(order);
    if (this.orderId !== order.id) { this.expanded = !document.documentElement.classList.contains('compact'); this.orderId = order.id; }
    this.details.hidden = !this.expanded || !managerIsActive(order);
    this.toggle.textContent = this.expanded ? 'СКРЫТЬ ▲' : 'ДЕТАЛИ ▼';
    this.toggle.setAttribute('aria-expanded', String(this.expanded));
    this.offer.hidden = !available;
    this.result.hidden = true;
    this.interaction.hidden = true;
    this.timer.hidden = true;
    this.distance.hidden = true;
    if (available) {
      this.objective.textContent = `НОВЫЙ ЗАКАЗ · ${typeLabel}`;
      document.querySelector('#offer-restaurant').textContent = `${districtName} · ${order.cargo || order.restaurant.name}`;
      document.querySelector('#offer-reward').textContent = `${order.reward} ₽`;
      document.querySelector('#offer-summary').textContent = `${order.distance} м · ${order.deliveryTime} сек. · +${order.reputationReward} реп.${order.requiredTransport ? ` · Требуется: ${transportFor(order.requiredTransport).name}` : ''}`;
      document.querySelector('#offer-details').textContent = `${order.flavor ? `${order.flavor}\n` : ''}${districtName}\nРасстояние: ${order.distance} м · Оплата: ${order.reward} ₽ · Время: ${order.deliveryTime} сек.\n+${order.xpReward} XP · +${order.reputationReward} репутации${order.masteryBonus ? ` · Мастерство +${Math.round(order.masteryBonus * 100)}% включено` : ''}\n${order.requiredTransport ? 'Требуется' : 'Рекомендуемый транспорт'}: ${transportFor(order.requiredTransport || order.recommendedTransport).name}`;
    } else if (managerIsActive(order)) {
      this.objective.textContent = order.status === ORDER_STATUS.ACCEPTED
        ? `Заберите · ${order.restaurant.name}${progress}` : `Доставьте · ${order.customer.name}${progress}`;
      this.details.textContent = `${typeLabel} · ${districtName}${order.flavor ? `\n${order.flavor}` : ''} · Базовая оплата: ${order.reward} ₽\nРесторан: ${order.restaurant.name}\nКлиент: ${order.customer.name}\n+${order.xpReward} XP · +${order.reputationReward} реп. · Провал −${order.failurePenalty}\n${order.requiredTransport ? 'Требуется' : 'Рекомендуется'}: ${transportFor(order.requiredTransport || order.recommendedTransport).name}`;
    } else {
      this.objective.textContent = order.status === ORDER_STATUS.DELIVERED ? `${typeLabel}${progress} · ЗАКАЗ ДОСТАВЛЕН` : 'ВРЕМЯ ВЫШЛО';
      this.result.hidden = false;
      this.result.textContent = order.status === ORDER_STATUS.DELIVERED
        ? `+${extra.payout.total} ₽ · +${order.actualXpReward ?? order.xpReward} XP · +${order.actualReputationReward ?? order.reputationReward} репутации`
        : `Заказ провален · −${order.failurePenalty} репутации`;
      if (extra.level > extra.previousLevel) this.result.textContent += `\nНОВЫЙ УРОВЕНЬ! Уровень ${extra.level}`;
      if (extra.payout?.modifiers.length) this.result.textContent += `\nБазовая оплата: ${extra.payout.baseReward} ₽\n${extra.payout.modifiers.map(modifier => `${modifier.name}: ${modifier.amount >= 0 ? '+' : ''}${modifier.amount} ₽`).join('\n')}\nИтого: ${extra.payout.total} ₽`;
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
    this.interaction.hidden = this.player.inputBlocked || !this.manager.canInteract(this.player);
    this.interaction.textContent = pickup ? 'ЗАБРАТЬ ЗАКАЗ · E' : 'ПЕРЕДАТЬ ЗАКАЗ · E';
  }

  destroy() {
    this.rewardButton.removeEventListener('click', this.reward);
    this.continueButton.removeEventListener('click', this.continue);
    lifecycle.set('RESULT', false);
    this.unsubscribeOrder();
    this.unsubscribeState();
    this.acceptButton.removeEventListener('click', this.accept);
    this.interaction.removeEventListener('click', this.interact);
    this.key.off('down', this.interact);
    this.toggle.removeEventListener('click', this.toggleDetails);
  }
}

const managerIsActive = (order) => [ORDER_STATUS.ACCEPTED, ORDER_STATUS.PICKED_UP].includes(order.status);
