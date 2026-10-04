import { BALANCE } from '../config/gameBalance.js';

export const ORDER_STATUS = Object.freeze({
  AVAILABLE: 'AVAILABLE', ACCEPTED: 'ACCEPTED', PICKED_UP: 'PICKED_UP', DELIVERED: 'DELIVERED', FAILED: 'FAILED',
});
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export class OrderManager {
  constructor({ restaurants, customers, state, now = () => performance.now(), random = Math.random, debug = false }) {
    this.restaurants = restaurants;
    this.customers = customers;
    this.state = state;
    this.now = now;
    this.random = random;
    this.debug = debug;
    this.sequence = 0;
    this.order = null;
    this.listeners = new Set();
  }

  log(event, data = this.order) {
    if (this.debug) console.debug(`[Orders] ${event}`, data);
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event, extra = {}) {
    this.log(event, { ...this.order, ...extra });
    for (const listener of this.listeners) listener(event, this.order, extra);
  }

  generate() {
    if (this.order && ![ORDER_STATUS.DELIVERED, ORDER_STATUS.FAILED].includes(this.order.status)) return false;
    const restaurant = this.restaurants[Math.floor(this.random() * this.restaurants.length)];
    const customer = this.customers[Math.floor(this.random() * this.customers.length)];
    const meters = Math.round(distance(restaurant, customer) * BALANCE.metersPerPixel);
    this.order = {
      id: `order-${++this.sequence}`, restaurant, customer, distance: meters,
      reward: clamp(Math.round(BALANCE.baseReward + meters * BALANCE.moneyPerMeter), BALANCE.minReward, BALANCE.maxReward),
      xpReward: clamp(Math.round(BALANCE.baseXP + meters * BALANCE.xpPerMeter), BALANCE.baseXP, BALANCE.maxXP),
      reputationReward: clamp(1 + Math.floor(meters / BALANCE.metersPerReputation), 1, BALANCE.maxReputation),
      deliveryTime: clamp(Math.round(BALANCE.minDeliveryTime + meters / BALANCE.metersPerTimerSecond), BALANCE.minDeliveryTime, BALANCE.maxDeliveryTime),
      status: ORDER_STATUS.AVAILABLE,
    };
    this.emit('generated');
    return true;
  }

  accept() {
    if (this.order?.status !== ORDER_STATUS.AVAILABLE) return false;
    this.order.status = ORDER_STATUS.ACCEPTED;
    this.order.deadline = this.now() + this.order.deliveryTime * 1000;
    this.emit('accepted');
    return true;
  }

  getTarget() {
    if (this.order?.status === ORDER_STATUS.ACCEPTED) return this.order.restaurant;
    if (this.order?.status === ORDER_STATUS.PICKED_UP) return this.order.customer;
    return null;
  }

  remainingSeconds() {
    return this.getTarget() ? Math.max(0, Math.ceil((this.order.deadline - this.now()) / 1000)) : 0;
  }

  canInteract(player) {
    const target = this.getTarget();
    return Boolean(target && this.remainingSeconds() > 0 && distance(player, target) <= BALANCE.interactionRadius);
  }

  interact(player) {
    this.update(); // Deadline wins even if interaction occurs on the final frame.
    if (!this.canInteract(player)) return false;
    if (this.order.status === ORDER_STATUS.ACCEPTED) {
      this.order.status = ORDER_STATUS.PICKED_UP;
      this.emit('picked up');
    } else {
      this.order.status = ORDER_STATUS.DELIVERED;
      const previousLevel = this.state.getSnapshot().level;
      this.state.addRewards(this.order);
      this.nextOrderAt = this.now() + BALANCE.nextOrderDelay;
      this.emit('completed', { previousLevel, level: this.state.getSnapshot().level });
      this.log('rewards received', this.state.getSnapshot());
    }
    return true;
  }

  update() {
    if (this.getTarget() && this.now() >= this.order.deadline) {
      this.order.status = ORDER_STATUS.FAILED;
      this.state.update({ reputation: this.state.getSnapshot().reputation - BALANCE.failurePenalty });
      this.nextOrderAt = this.now() + BALANCE.nextOrderDelay;
      this.emit('failed');
    }
    if ([ORDER_STATUS.DELIVERED, ORDER_STATUS.FAILED].includes(this.order?.status) && this.now() >= this.nextOrderAt) this.generate();
  }
}
