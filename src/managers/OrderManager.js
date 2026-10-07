import { BALANCE } from '../config/gameBalance.js';
import { calculateDeliveryReward } from './DeliveryRewards.js';
import { ORDER_TYPES, DISTRICTS, reputationTier } from '../config/economyConfig.js';
import { EVENT_BALANCE } from '../config/eventBalance.js';
import { transportFor } from '../config/transportConfig.js';
import { districtMastery, ELITE_ORDERS, eliteOrdersEligible } from '../config/districtConfig.js';

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
    state.isTransportLocked = () => Boolean(this.getTarget());
    state.isDistrictLocked = () => Boolean(this.events?.active);
    let previousTransport = state.getSnapshot().equippedTransport;
    this.unsubscribeState = state.subscribe(snapshot => {
      if (snapshot.equippedTransport === previousTransport) return;
      previousTransport = snapshot.equippedTransport;
      if (this.order?.status === ORDER_STATUS.AVAILABLE) { this.order = null; this.generate(); }
    });
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

  generate({ forcedType, forcedVariant } = {}) {
    if (this.order && ![ORDER_STATUS.DELIVERED, ORDER_STATUS.FAILED].includes(this.order.status)) return false;
    if (!this.restaurants.length || !this.customers.length) return false;
    const restaurant = this.restaurants[Math.floor(this.random() * this.restaurants.length)];
    const snapshot = this.state.getSnapshot();
    const transport = transportFor(snapshot.equippedTransport);
    const district = DISTRICTS[snapshot.selectedDistrict || 'residential'];
    const candidates = [...this.customers].sort((a, b) => distance(restaurant, a) - distance(restaurant, b));
    const nearby = this.state.nextCloseOrder;
    const customerRoll = this.random();
    const types = Object.entries(ORDER_TYPES).filter(([id, config]) => snapshot.level >= config.level && (id === 'ELITE' ? eliteOrdersEligible(snapshot) : transport.allowedOrderTypes.includes(id))
      && (!config.requiredTransport || config.requiredTransport === transport.id));
    if (forcedType && !types.some(([id]) => id === forcedType)) return false;
    const weights = types.map(([id]) => (transport.orderWeights[id] || ORDER_TYPES[id].weight) * district.orderWeights[id]
      * (id !== 'STANDARD' ? reputationTier(snapshot.reputation).betterOrders : 1)
      * (id === 'LARGE' && snapshot.largeOrderBoost ? snapshot.largeOrderBoost : 1));
    let roll = this.random() * weights.reduce((sum, value) => sum + value, 0);
    const type = forcedType || types.find((entry, i) => (roll -= weights[i]) < 0)?.[0] || 'STANDARD';
    const config = ORDER_TYPES[type];
    let variant = null;
    if (type === 'ELITE') {
      const variants = ELITE_ORDERS.variants.filter(v => snapshot.reputation >= (v.minimumReputation || ELITE_ORDERS.reputation));
      let variantRoll = this.random() * variants.reduce((sum, v) => sum + v.weight, 0);
      variant = variants.find(v => v.id === forcedVariant) || variants.find(v => (variantRoll -= v.weight) < 0) || variants[0];
    }
    const [minMeters, singleMaxMeters] = district.routeRange;
    const maxMeters = singleMaxMeters * (type === 'DOUBLE' ? district.doubleRouteMultiplier : 1);
    let routes = candidates.filter(c => distance(restaurant, c) * BALANCE.metersPerPixel >= minMeters && distance(restaurant, c) * BALANCE.metersPerPixel <= singleMaxMeters);
    // Sparse/custom layouts use the closest reachable endpoint rather than inventing coordinates.
    if (!routes.length) routes = [...candidates].sort((a, b) => Math.abs(distance(restaurant, a) * BALANCE.metersPerPixel - minMeters) - Math.abs(distance(restaurant, b) * BALANCE.metersPerPixel - minMeters)).slice(0, 1);
    if (type === 'DOUBLE') {
      const pairs = routes.filter(c => candidates.some(other => other.id !== c.id && (distance(restaurant, c) + distance(c, other)) * BALANCE.metersPerPixel <= maxMeters));
      if (pairs.length) routes = pairs;
    }
    if (!routes.length || !restaurant) return false;
    const start = nearby ? 0 : Math.min(routes.length - 1, Math.floor(routes.length * Math.max(transport.distancePool.start, config.distanceStart || 0, variant?.distanceStart || 0)));
    const end = nearby ? 1 : Math.max(start + 1, Math.ceil(routes.length * Math.min(1, transport.distancePool.end + district.transportPoolExtension)));
    const pool = routes.slice(start, end);
    const customer = pool[Math.floor(customerRoll * pool.length)];
    const stops = [customer];
    if (type === 'DOUBLE') {
      let others = candidates.filter(c => c.id !== customer.id && (distance(restaurant, customer) + distance(customer, c)) * BALANCE.metersPerPixel <= maxMeters);
      if (!others.length) others = candidates.filter(c => c.id !== customer.id).sort((a, b) => distance(customer, a) - distance(customer, b)).slice(0, 1);
      if (others.length) stops.push(others[Math.floor(this.random() * others.length)]);
    }
    const meters = Math.round((distance(restaurant, customer) + (stops[1] ? distance(customer, stops[1]) : 0)) * BALANCE.metersPerPixel);
    this.order = {
      id: `order-${++this.sequence}`, restaurant, customer, customers: stops, deliveredCount: 0, type, district: snapshot.selectedDistrict, distance: meters,
      variant: variant?.id || null, flavor: variant?.name || null, cargo: variant?.cargo || null,
      tipMultiplier: variant?.tip || 1, eventMultiplier: type === 'ELITE' ? ELITE_ORDERS.event : 1,
      masteryBonus: districtMastery(snapshot.districtStats?.[snapshot.selectedDistrict]?.completedOrders || 0).bonus,
      failurePenalty: type === 'ELITE' ? ELITE_ORDERS.failurePenalty : BALANCE.failurePenalty * district.failureMultiplier,
      requiredTransport: config.requiredTransport || null,
      recommendedTransport: config.requiredTransport || variant?.recommendedTransport || district.recommendedTransports[0],
      reward: Math.round(clamp(Math.round(BALANCE.baseReward + meters * BALANCE.moneyPerMeter), BALANCE.minReward, BALANCE.maxReward) * config.money * (variant?.money || 1) * district.money * (1 + districtMastery(snapshot.districtStats?.[snapshot.selectedDistrict]?.completedOrders || 0).bonus) * (nearby ? EVENT_BALANCE.closeOrderMoney : 1)),
      xpReward: Math.round(clamp(Math.round(BALANCE.baseXP + meters * BALANCE.xpPerMeter), BALANCE.baseXP, BALANCE.maxXP) * config.xp * district.xp),
      reputationReward: type === 'ELITE' ? clamp(variant.reputation, ...ELITE_ORDERS.reputationRange) : clamp(1 + Math.floor(meters / BALANCE.metersPerReputation), 1, BALANCE.maxReputation) + config.reputation + district.reputationBonus,
      deliveryTime: Math.round(clamp(Math.round(BALANCE.minDeliveryTime + meters / BALANCE.metersPerTimerSecond), BALANCE.minDeliveryTime, BALANCE.maxDeliveryTime) * (variant?.timer || config.timer)),
      status: ORDER_STATUS.AVAILABLE,
    };
    this.state.nextCloseOrder = false;
    if (transport.id === 'CAR' && snapshot.largeOrderBoost) this.state.setLargeOrderBoost(0);
    this.emit('generated');
    return true;
  }

  accept() {
    if (this.order?.status !== ORDER_STATUS.AVAILABLE) return false;
    const snapshot = this.state.getSnapshot(), transport = transportFor(snapshot.equippedTransport);
    const eliteVariant = ELITE_ORDERS.variants.find(v => v.id === this.order.variant);
    if (!(this.order.type === 'ELITE' ? eliteOrdersEligible(snapshot) && snapshot.reputation >= (eliteVariant?.minimumReputation || ELITE_ORDERS.reputation) : transport.allowedOrderTypes.includes(this.order.type)) || (this.order.requiredTransport && this.order.requiredTransport !== transport.id)) {
      this.order = null; this.generate(); return false;
    }
    this.order.status = ORDER_STATUS.ACCEPTED;
    this.order.acceptedAt = this.now(); this.order.eventIncome = 0;
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
      const before = this.state.getSnapshot();
      this.state.addRewards({ ...this.order, reward: payout.total, elapsedSeconds: (this.now() - this.order.acceptedAt) / 1000,
        orderMoney: payout.total + (this.order.eventIncome || 0) });
      const after = this.state.getSnapshot();
      this.order.actualXpReward = after.xp - before.xp; this.order.actualReputationReward = after.reputation - before.reputation;
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
      this.state.failOrder(this.order.failurePenalty, this.order.district);
      this.nextOrderAt = this.now() + BALANCE.nextOrderDelay;
      this.emit('failed');
    }
    if (!this.events?.active && [ORDER_STATUS.DELIVERED, ORDER_STATUS.FAILED].includes(this.order?.status) && this.now() >= this.nextOrderAt) this.generate();
  }

  destroy() { this.unsubscribeState(); this.state.isTransportLocked = null; this.state.isDistrictLocked = null; }
}
