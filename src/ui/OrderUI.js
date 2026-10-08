import { t as tr, formatMoney, formatNumber } from '../services/LocalizationService.js';
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
      this.feedback.textContent = result.rewarded ? tr('order-ui.001') : l.t('adUnavailable');
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
      this.toggle.textContent = this.expanded ? tr('order-ui.002') : tr('order-ui.003');
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
      document.querySelector('#money').textContent = formatMoney(money);
      document.querySelector('#level').textContent = level;
      document.querySelector('#reputation').textContent = formatNumber(reputation);
      document.querySelector('#xp').textContent = tr('common.xp', { current: xp, next: xpForLevel(level + 1) });
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
      this.bonusText.textContent = bonus ? tr('order-ui.004', { v0: bonus.amount, v1: Math.round(ads.config.rewardedMultiplier * 100) }) : '';
      this.rewardButton.disabled = !bonus || bonus.attempted || bonus.claimed;
      this.feedback.textContent = ''; this.continueButton.disabled = false;
    }
    const available = order.status === ORDER_STATUS.AVAILABLE;
    const typeLabel = ORDER_TYPES[order.type]?.name || tr('economy-config.001');
    const districtName = DISTRICTS[order.district]?.name || '';
    this.panel.dataset.value = order.type === 'ELITE' ? 'elite' : order.type === 'LARGE' ? 'large' : 'normal';
    const progress = order.type === 'DOUBLE' ? tr('order-ui.005', { v0: order.deliveredCount }) : '';
    this.panel.dataset.mode = available ? 'offer' : managerIsActive(order) ? 'active' : 'result';
    this.toggle.hidden = !managerIsActive(order);
    if (this.orderId !== order.id) { this.expanded = !document.documentElement.classList.contains('compact'); this.orderId = order.id; }
    this.details.hidden = !this.expanded || !managerIsActive(order);
    this.toggle.textContent = this.expanded ? tr('order-ui.002') : tr('order-ui.003');
    this.toggle.setAttribute('aria-expanded', String(this.expanded));
    this.offer.hidden = !available;
    this.result.hidden = true;
    this.interaction.hidden = true;
    this.timer.hidden = true;
    this.distance.hidden = true;
    if (available) {
      this.objective.textContent = tr('order-ui.006', { v0: typeLabel });
      document.querySelector('#offer-restaurant').textContent = `${districtName} · ${order.cargo || order.restaurant.name}`;
      document.querySelector('#offer-reward').textContent = formatMoney(order.reward);
      document.querySelector('#offer-summary').textContent = tr('order-ui.008', { v0: order.distance, v1: order.deliveryTime, v2: order.reputationReward, v3: order.requiredTransport ? tr('order-ui.007', { v0: transportFor(order.requiredTransport).name }) : '' });
      document.querySelector('#offer-details').textContent = tr('order-ui.012', { v0: order.flavor ? `${order.flavor}\n` : '', v1: districtName, v2: order.distance, v3: order.reward, v4: order.deliveryTime, v5: order.xpReward, v6: order.reputationReward, v7: order.masteryBonus ? tr('order-ui.009', { v0: Math.round(order.masteryBonus * 100) }) : '', v8: order.requiredTransport ? tr('order-ui.010') : tr('order-ui.011'), v9: transportFor(order.requiredTransport || order.recommendedTransport).name });
    } else if (managerIsActive(order)) {
      this.objective.textContent = order.status === ORDER_STATUS.ACCEPTED
        ? tr('order-ui.013', { v0: order.restaurant.name, v1: progress }) : tr('order-ui.014', { v0: order.customer.name, v1: progress });
      this.details.textContent = tr('order-ui.016', { v0: typeLabel, v1: districtName, v2: order.flavor ? `\n${order.flavor}` : '', v3: order.reward, v4: order.restaurant.name, v5: order.customer.name, v6: order.xpReward, v7: order.reputationReward, v8: order.failurePenalty, v9: order.requiredTransport ? tr('order-ui.010') : tr('order-ui.015'), v10: transportFor(order.requiredTransport || order.recommendedTransport).name });
    } else {
      this.objective.textContent = order.status === ORDER_STATUS.DELIVERED ? tr('order-ui.017', { v0: typeLabel, v1: progress }) : tr('order-ui.018');
      this.result.hidden = false;
      this.result.textContent = order.status === ORDER_STATUS.DELIVERED
        ? tr('order-ui.019', { v0: extra.payout.total, v1: order.actualXpReward ?? order.xpReward, v2: order.actualReputationReward ?? order.reputationReward })
        : tr('order-ui.020', { v0: order.failurePenalty });
      if (extra.level > extra.previousLevel) this.result.textContent += tr('order-ui.021', { v0: extra.level });
      if (extra.payout?.modifiers.length) this.result.textContent += tr('order-ui.022', { v0: extra.payout.baseReward, v1: extra.payout.modifiers.map(modifier => `${modifier.name}: ${modifier.amount >= 0 ? '+' : ''}${formatMoney(modifier.amount)}`).join('\n'), v2: extra.payout.total });
    }
  }

  update() {
    const target = this.manager.getTarget();
    if (!target) return;
    const seconds = this.manager.remainingSeconds();
    this.timer.hidden = false;
    this.timer.textContent = tr('order-ui.023', { v0: String(Math.floor(seconds / 60)).padStart(2, '0'), v1: String(seconds % 60).padStart(2, '0') });
    this.timer.classList.toggle('urgent', seconds <= 15);
    this.distance.hidden = false;
    const pickup = this.manager.order.status === ORDER_STATUS.ACCEPTED;
    this.distance.textContent = tr('order-ui.026', { v0: pickup ? tr('order-ui.024') : tr('order-ui.025'), v1: Math.round(Math.hypot(this.player.x - target.x, this.player.y - target.y) * BALANCE.metersPerPixel) });
    this.interaction.hidden = this.player.inputBlocked || !this.manager.canInteract(this.player);
    this.interaction.textContent = pickup ? tr('order-ui.027') : tr('order-ui.028');
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
