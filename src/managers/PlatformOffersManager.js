import { PLATFORM_CONFIG as C } from '../config/platformConfig.js';
export class AdManager {
  constructor(state, platform, lifecycle, saves, config = C.ads) {
    this.state = state; this.platform = platform; this.lifecycle = lifecycle; this.saves = saves; this.config = config;
    this.ordersSinceRequest = 0; this.lastRequest = -Infinity; this.busy = false;
  }
  completed() { this.ordersSinceRequest++; }
  offerDelivery(order, payout) {
    if (order.bonusId) return;
    order.bonusId = `delivery-${this.state.values.completedOrders}`;
    this.state.values.deliveryAdBonus = { id: order.bonusId, orderId: order.id, baseEligibleReward: payout.total, amount: Math.floor(payout.total * this.config.rewardedMultiplier), attempted: false, claimed: false };
    this.completed(); this.state.refresh();
  }
  expireDelivery() { this.state.values.deliveryAdBonus = null; }
  eligible() {
    const now = this.lifecycle.now();
    return this.platform.isYandex() && !this.busy && this.ordersSinceRequest >= this.config.ordersBetweenInterstitials
      && now >= this.config.firstInterstitialMs && now - this.lastRequest >= this.config.interstitialIntervalMs;
  }
  async interstitial(orders) {
    if (!this.eligible() || orders.getTarget() || orders.events?.active || document.querySelector('dialog[open]')
      || this.lifecycle.paused) return false;
    this.lastRequest = this.lifecycle.now(); this.ordersSinceRequest = 0; this.busy = true;
    this.lifecycle.set('ADVERTISEMENT', true); this.saves.interrupt();
    try { return (await this.platform.showInterstitial()).shown; }
    finally { this.busy = false; this.lifecycle.set('ADVERTISEMENT', false); }
  }
  async rewarded(orders) {
    const bonus = this.state.values.deliveryAdBonus;
    if (this.busy || !bonus || bonus.claimed || bonus.attempted || orders.order?.status !== 'DELIVERED' || orders.order?.bonusId !== bonus.id || orders.order?.id !== bonus.orderId || orders.getTarget() || orders.events?.active
      || document.querySelector('dialog[open]') || this.lifecycle.paused) return { rewarded: false };
    this.busy = true; const epoch = this.platform.accountEpoch;
    // Lock concurrent clicks; this temporary offer never survives reload.
    bonus.attempted = true; this.state.refresh();
    this.lifecycle.set('ADVERTISEMENT', true); this.saves.interrupt();
    try {
      return await this.platform.showRewarded(() => {
        if (epoch !== this.platform.accountEpoch || this.saves.blockers.size || bonus !== this.state.values.deliveryAdBonus || bonus.claimed) return;
        bonus.claimed = true; this.state.values.money += bonus.amount;
        this.state.refresh(); this.saves.interrupt();
      });
    } finally {
      if (bonus === this.state.values.deliveryAdBonus) {
        if (bonus.claimed) this.expireDelivery();
        else bonus.attempted = false;
      }
      this.busy = false; this.lifecycle.set('ADVERTISEMENT', false);
    }
  }
}
