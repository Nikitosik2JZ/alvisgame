import { BALANCE } from '../config/gameBalance.js';
import { calculateDeliveryReward } from './DeliveryRewards.js';
import { ORDER_TYPES, DISTRICTS, reputationTier } from '../config/economyConfig.js';
import { EVENT_BALANCE } from '../config/eventBalance.js';

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
    const snapshot = this.state.getSnapshot();
    const district = DISTRICTS[snapshot.selectedDistrict || 'residential'];
    const candidates = [...this.customers].sort((a, b) => distance(restaurant, a) - distance(restaurant, b));
    const nearby = this.state.nextCloseOrder;
    const pool = nearby ? candidates.slice(0, 1) : candidates.slice(0, Math.max(1, Math.ceil(candidates.length * district.customerPoolFraction)));
    const customer = pool[Math.floor(this.random() * pool.length)];
    const types = Object.entries(ORDER_TYPES).filter(([, config]) => snapshot.level >= config.level);
    const weights = types.map(([id, config]) => config.weight * (id === 'URGENT' ? district.urgent : 1) * (id !== 'STANDARD' ? reputationTier(snapshot.reputation).betterOrders : 1));
    let roll = this.random() * weights.reduce((sum, value) => sum + value, 0);
    const type = types.find((entry, i) => (roll -= weights[i]) < 0)?.[0] || 'STANDARD';
    const config = ORDER_TYPES[type];
    const stops = [customer];
    if (type === 'DOUBLE') {
      const others = this.customers.filter(c => c.id !== customer.id);
      stops.push(others[Math.floor(this.random() * others.length)]);
    }
    const meters = Math.round((distance(restaurant, customer) + (stops[1] ? distance(customer, stops[1]) : 0)) * BALANCE.metersPerPixel);
    this.order = {
      id: `order-${++this.sequence}`, restaurant, customer, customers: stops, deliveredCount: 0, type, district: snapshot.selectedDistrict, distance: meters,
      reward: Math.round(clamp(Math.round(BALANCE.baseReward + meters * BALANCE.moneyPerMeter), BALANCE.minReward, BALANCE.maxReward) * config.money * district.money * (nearby ? EVENT_BALANCE.closeOrderMoney : 1)),
      xpReward: Math.round(clamp(Math.round(BALANCE.baseXP + meters * BALANCE.xpPerMeter), BALANCE.baseXP, BALANCE.maxXP) * config.xp * district.xp),
      reputationReward: clamp(1 + Math.floor(meters / BALANCE.metersPerReputation), 1, BALANCE.maxReputation) + config.reputation,
      deliveryTime: Math.round(clamp(Math.round(BALANCE.minDeliveryTime + meters / BALANCE.metersPerTimerSecond), BALANCE.minDeliveryTime, BALANCE.maxDeliveryTime) * config.timer),
      status: ORDER_STATUS.AVAILABLE,
    };
    this.state.nextCloseOrder = false;
    this.emit('generated');
    return true;
  }

  accept() {
    if (this.order?.status !== ORDER_STATUS.AVAILABLE) return false;
    this.order.status = ORDER_STATUS.ACCEPTED;
    this.order.deadline = this.now() + this.order.deliveryTime * 1000;
    this.events?.prepare();
    this.emit('accepted');
    return true;
  }

  getTarget() {
    if (this.order?.status === ORDER_STATUS.ACCEPTED) return this.order.restaurant;
    if (this.order?.status === ORDER_STATUS.PICKED_UP) return this.order.customer;
    return null;
  }

  remainingSeconds() {
    return this.getTarget() ? Math.max(0, Math.ceil((this.order.deadline - (this.events?.active?.pausedAt ?? this.now())) / 1000)) : 0;
  }

  canInteract(player) {
    const target = this.getTarget();
    return Boolean(target && this.remainingSeconds() > 0 && distance(player, target) <= BALANCE.interactionRadius);
  }

  interact(player) {
    if (this.events?.active) return false;
    this.update(); // Deadline wins even if interaction occurs on the final frame.
    if (!this.canInteract(player)) return false;
    if (this.order.status === ORDER_STATUS.ACCEPTED) {
      this.order.status = ORDER_STATUS.PICKED_UP;
      this.emit('picked up');
      this.events?.trigger('pickup');
    } else {
      const id = this.order.id;
      const resume = () => { if (this.order?.id === id) this.completeStop(); };
      if (this.events) this.events.trigger('customer', resume);
      else resume();
    }
    return true;
  }

  completeStop() {
    this.update();
    if (this.order?.status !== ORDER_STATUS.PICKED_UP) return false;
    this.order.deliveredCount++;
    if (this.order.deliveredCount < this.order.customers.length) {
      this.order.customer = this.order.customers[this.order.deliveredCount];
      this.emit('next customer');
    } else {
      this.order.status = ORDER_STATUS.DELIVERED;
      const previousLevel = this.state.getSnapshot().level;
      const payout = calculateDeliveryReward(this.order.reward, this.state.getSnapshot(), this.order);
      this.state.addRewards({ ...this.order, reward: payout.total });
      if (this.state.getSnapshot().demandBonusOrders > 0 && !this.order.skipDemand) this.state.setDemand(this.state.getSnapshot().demandBonusOrders - 1);
      this.nextOrderAt = this.now() + BALANCE.nextOrderDelay;
      this.emit('completed', { previousLevel, level: this.state.getSnapshot().level, payout });
      this.log('rewards received', this.state.getSnapshot());
    }
    return true;
  }

  update() {
    if (this.events?.active) return;
    if (this.getTarget() && this.now() >= this.order.deadline) {
      this.order.status = ORDER_STATUS.FAILED;
      this.state.update({ reputation: this.state.getSnapshot().reputation - BALANCE.failurePenalty });
      this.nextOrderAt = this.now() + BALANCE.nextOrderDelay;
      this.emit('failed');
    }
    if (!this.events?.active && [ORDER_STATUS.DELIVERED, ORDER_STATUS.FAILED].includes(this.order?.status) && this.now() >= this.nextOrderAt) this.generate();
  }
}
