import { t as tr, localization } from '../services/LocalizationService.js';
import { BALANCE, levelForXP } from '../config/gameBalance.js';
import { CATEGORIES, itemById } from '../data/shopItems.js';
import { DISTRICTS } from '../config/economyConfig.js';
import { emptyDistrictStats } from '../config/districtConfig.js';
import { EVENT_BALANCE } from '../config/eventBalance.js';
import { TRANSPORT, transportById, transportFor, TRANSPORTS } from '../config/transportConfig.js';
import { initialCompanyState, loadCompanyState } from './companyState.js';
import { initialProgressionState, loadProgressionState } from './progressionState.js';
import { AchievementManager } from '../managers/AchievementManager.js';
import { progressionMultiplier, reputationReward, personalXpReward } from '../managers/ProgressionModifiers.js';
import { initialTaskState, loadTaskState } from './taskState.js';
import { TaskManager } from '../managers/TaskManager.js';

const STAT_KEYS = ['completedOrders', 'failedOrders', 'totalMoneyEarned', 'totalTipsEarned', 'totalFinesPaid', 'totalDistanceDelivered'];

const initialState = () => ({ money: 0, level: 1, xp: 0, reputation: 0, movementSpeed: BALANCE.walkingBaseSpeed,
  unlockedDistricts: ['residential'], selectedDistrict: 'residential', demandBonusOrders: 0,
  districtIntroductionsSeen: ['residential'], districtStats: Object.fromEntries(Object.keys(DISTRICTS).map(id => [id, emptyDistrictStats()])),
  transport: TRANSPORT.WALKING, equippedTransport: TRANSPORT.WALKING, ownedTransports: [TRANSPORT.WALKING], transportMilestones: [],
  largeOrderBoost: 0, ownedItems: [], equippedItems: { SHOES: null, BAG: null },
  deliveryAdBonus: null,
  ...Object.fromEntries(STAT_KEYS.map(key => [key, 0])), ...initialCompanyState(), ...initialProgressionState(), ...initialTaskState() });

// One owner for progression. Derived stats are recalculated, never trusted from saves.
export class GameState {
  constructor(options = {}) { this.values = initialState(); this.listeners = new Set(); this.tasks = new TaskManager(this, options.tasks); this.tasks.sync(); this.progression = new AchievementManager(this); this.progression.evaluate(true); }

  getSnapshot() {
    return { ...this.values, deliveryAdBonus: this.values.deliveryAdBonus ? { ...this.values.deliveryAdBonus } : null, dailyTasks: this.values.dailyTasks.map(t => structuredClone(t)), rotatingChallenge: this.values.rotatingChallenge ? structuredClone(this.values.rotatingChallenge) : null,
      unlockedDistricts: [...this.values.unlockedDistricts], ownedTransports: [...this.values.ownedTransports],
      districtIntroductionsSeen: [...this.values.districtIntroductionsSeen], districtStats: Object.fromEntries(Object.entries(this.values.districtStats).map(([id, stats]) => [id, { ...stats }])),
      transportMilestones: [...this.values.transportMilestones], ownedItems: [...this.values.ownedItems], equippedItems: { ...this.values.equippedItems },
      employees: this.values.employees.map(e => ({ ...structuredClone(e), name: localization.displayName(e.name) })), companyVehicles: this.values.companyVehicles.map(v => ({ ...v })),
      companyStats: { ...this.values.companyStats }, companyLog: structuredClone(this.values.companyLog),
      companyCandidates: this.values.companyCandidates.map(c => ({ ...c, name: localization.displayName(c.name) })), companyUpgrades: { ...this.values.companyUpgrades },
      companyEffects: this.values.companyEffects.map(e => ({ ...e })), companyEventState: { ...this.values.companyEventState },
      achievements: [...this.values.achievements], claimedAchievementRewards: [...this.values.claimedAchievementRewards],
      careerMilestones: [...this.values.careerMilestones], claimedCareerRewards: [...this.values.claimedCareerRewards],
      legacyUpgrades: [...this.values.legacyUpgrades], eventCounters: { ...this.values.eventCounters },
      personalRecords: { ...this.values.personalRecords }, companyRecords: { ...this.values.companyRecords } };
  }

  refresh(options = {}) {
    this.values.level = levelForXP(this.values.xp);
    this.values.transport = this.values.equippedTransport;
    const transport = transportFor(this.values.transport);
    const shoes = itemById(this.values.equippedItems.SHOES);
    this.values.movementSpeed = Math.round(transport.movementSpeed * (transport.id === TRANSPORT.WALKING ? 1 + (shoes?.walkingBonus || 0) : 1) * progressionMultiplier(this.values, 'speed'));
    this.tasks.sync();
    this.progression.evaluate(Boolean(this.loadingProgression));
    for (const listener of this.listeners) listener(this.getSnapshot(), options);
  }

  update(changes) {
    for (const key of ['money', 'xp', 'reputation']) {
      if (Number.isFinite(changes[key])) {
        this.values[key] = key === 'reputation' ? Math.floor(changes[key]) : Math.max(0, Math.floor(changes[key]));
      }
    }
    this.refresh();
  }

  addRewards({ reward, xpReward, reputationReward: reputationAmount, distance = 0, district = this.values.selectedDistrict, elapsedSeconds, orderMoney = reward, type, remainingSeconds = 0, negativeReputation = false }) {
    const earnedReputation = reputationReward(this.values, reputationAmount);
    this.tasks.delivery({ reward, reputation: earnedReputation, type, district, remainingSeconds, negativeReputation, transport: this.values.equippedTransport });
    this.progression.delivery({ reward, distance, elapsedSeconds, orderMoney, type });
    this.values.completedOrders++;
    this.values.totalMoneyEarned += reward;
    this.values.totalDistanceDelivered += Math.max(0, Math.round(distance));
    const stats = this.values.districtStats[district];
    if (stats) { stats.completedOrders++; stats.totalEarned += reward; stats.bestDeliveryReward = Math.max(stats.bestDeliveryReward, reward); }
    this.update({ money: this.values.money + reward, xp: this.values.xp + personalXpReward(this.values, xpReward), reputation: this.values.reputation + earnedReputation });
  }

  failOrder(penalty, district = this.values.selectedDistrict) {
    this.tasks.failure();
    this.values.failedOrders++;
    if (this.values.districtStats[district]) this.values.districtStats[district].failedOrders++;
    this.update({ reputation: this.values.reputation - penalty });
  }

  applyEventMoney(delta, tips = false) {
    const actual = delta < 0 ? -Math.min(this.values.money, -delta) : delta;
    if (actual > 0) {
      this.values.totalMoneyEarned += actual;
      this.values.districtStats[this.values.selectedDistrict].totalEarned += actual;
      if (tips) { this.tasks.gameplayEvent('tips'); this.values.totalTipsEarned += actual; this.values.personalRecords.biggestTip = Math.max(this.values.personalRecords.biggestTip, actual); }
    } else this.values.totalFinesPaid -= actual;
    this.update({ money: this.values.money + actual });
    return Math.abs(actual);
  }

  purchaseItem(id) {
    const item = itemById(id);
    if (!item) return { ok: false, reason: tr('shop-manager.001') };
    if (this.values.ownedItems.includes(id)) return { ok: false, reason: tr('game-state.001') };
    if (this.values.level < (item.requiredLevel || 1)) return { ok: false, reason: tr('company-manager.007', { v0: item.requiredLevel }) };
    if (item.requiresItem && !this.values.ownedItems.includes(item.requiresItem)) return { ok: false, reason: tr('shop-manager.005', { v0: itemById(item.requiresItem).name }) };
    if (this.values.money < item.price) return { ok: false, reason: tr('game-state.002', { v0: item.price - this.values.money }) };
    this.values.money -= item.price;
    this.values.ownedItems.push(id);
    this.values.equippedItems[item.category] = id;
    this.refresh();
    return { ok: true, item };
  }

  equipItem(id) {
    const item = itemById(id);
    if (!item || !this.values.ownedItems.includes(id)) return { ok: false, reason: tr('game-state.003') };
    this.values.equippedItems[item.category] = id;
    this.refresh();
    return { ok: true, item };
  }

  unequipCategory(category) {
    if (!CATEGORIES.includes(category)) return false;
    this.values.equippedItems[category] = null;
    this.refresh();
    return true;
  }

  setDemand(count) { this.values.demandBonusOrders = Math.max(0, Math.floor(count)); this.refresh(); }

  transportChangeError() {
    return this.isTransportLocked?.() ? tr('game-state.004') : null;
  }

  purchaseTransport(id) {
    const transport = transportById(id), blocked = this.transportChangeError();
    if (!transport) return { ok: false, reason: tr('game-state.005') };
    if (this.values.ownedTransports.includes(id)) return { ok: false, reason: tr('game-state.001') };
    if (blocked) return { ok: false, reason: blocked };
    if (this.values.level < transport.requiredLevel) return { ok: false, reason: tr('company-manager.007', { v0: transport.requiredLevel }) };
    if (this.values.money < transport.purchasePrice) return { ok: false, reason: tr('game-state.002', { v0: transport.purchasePrice - this.values.money }) };
    this.values.money -= transport.purchasePrice;
    this.values.ownedTransports.push(id);
    this.values.equippedTransport = id;
    this.refresh();
    return { ok: true, transport };
  }

  equipTransport(id) {
    if (!transportById(id) || !this.values.ownedTransports.includes(id)) return { ok: false, reason: tr('game-state.006') };
    const blocked = this.transportChangeError();
    if (blocked) return { ok: false, reason: blocked };
    this.values.equippedTransport = id;
    this.refresh();
    return { ok: true, transport: transportById(id) };
  }

  setLargeOrderBoost(value) { this.values.largeOrderBoost = Math.max(0, Math.min(EVENT_BALANCE.largeOrderBoost, value)); this.refresh(); }
  markTransportMilestone(id) {
    if (!transportById(id) || this.values.transportMilestones.includes(id)) return false;
    this.values.transportMilestones.push(id); this.refresh(); return true;
  }

  districtUnlockError(id) {
    const district = Object.hasOwn(DISTRICTS, id) ? DISTRICTS[id] : null;
    if (!district) return tr('game-state.007');
    if (this.values.unlockedDistricts.includes(id)) return tr('game-state.008');
    if (this.values.level < district.level) return tr('company-manager.007', { v0: district.level });
    if (district.reputation && this.values.reputation < district.reputation) return tr('game-state.009', { v0: district.reputation });
    if (district.requiredOwnedTransports && !district.requiredOwnedTransports.some(t => this.values.ownedTransports.includes(t))) return tr('game-state.010');
    if (this.values.money < district.cost) return tr('game-state.002', { v0: district.cost - this.values.money });
    return null;
  }

  unlockDistrict(id) {
    if (this.districtUnlockError(id)) return false;
    this.beforeDistrictUnlock?.();
    const district = DISTRICTS[id];
    this.values.money -= district.cost; this.values.unlockedDistricts.push(id); this.refresh(); return true;
  }

  districtSwitchError(id) {
    if (!Object.hasOwn(DISTRICTS, id) || !this.values.unlockedDistricts.includes(id)) return tr('game-state.011');
    if (this.isTransportLocked?.() || this.isDistrictLocked?.() || this.isDistrictBlocked?.()) return tr('game-state.004');
    return null;
  }

  selectDistrict(id) {
    if (this.districtSwitchError(id)) return false;
    this.values.selectedDistrict = id; this.refresh(); return true;
  }

  markDistrictIntroduction(id) {
    if (!this.values.unlockedDistricts.includes(id) || this.values.districtIntroductionsSeen.includes(id)) return false;
    this.values.districtIntroductionsSeen.push(id); this.refresh(); return true;
  }

  getSaveData() {
    const snapshot = this.getSnapshot();
    delete snapshot.deliveryAdBonus;
    // Old task titles/descriptions are rebuilt from their existing IDs by loadTaskState.
    const canonicalTask = task => task ? Object.fromEntries(Object.entries(task).filter(([key]) => !['title', 'description'].includes(key))) : null;
    snapshot.dailyTasks = snapshot.dailyTasks.map(canonicalTask);
    snapshot.rotatingChallenge = canonicalTask(snapshot.rotatingChallenge);
    snapshot.employees = structuredClone(this.values.employees);
    snapshot.companyCandidates = structuredClone(this.values.companyCandidates);
    if (Object.values(localization.catalogs).some(c => c['company-config.001'] === snapshot.companyName)) snapshot.companyName = null;
    return { version: 11, ...snapshot };
  }

  loadSaveData(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
    this.values = initialState();
    Object.assign(this.values, loadCompanyState(data));
    Object.assign(this.values, loadProgressionState(data));
    Object.assign(this.values, loadTaskState(data));
    this.tasks.resetSession();
    this.progression.signatures.clear(); this.loadingProgression = true;
    this.nextCloseOrder = false;
    if (Array.isArray(data.unlockedDistricts)) this.values.unlockedDistricts = [...new Set(['residential', ...data.unlockedDistricts.filter(id => typeof id === 'string' && Object.hasOwn(DISTRICTS, id))])];
    if (this.values.unlockedDistricts.includes(data.selectedDistrict)) this.values.selectedDistrict = data.selectedDistrict;
    // Existing unlocked districts are already familiar in pre-Stage 8 saves.
    this.values.districtIntroductionsSeen = [...new Set(['residential', ...(Array.isArray(data.districtIntroductionsSeen)
      ? data.districtIntroductionsSeen.filter(id => this.values.unlockedDistricts.includes(id))
      : this.values.unlockedDistricts)])];
    for (const id of Object.keys(DISTRICTS)) for (const key of Object.keys(emptyDistrictStats())) {
      const value = data.districtStats?.[id]?.[key];
      if (Number.isFinite(value)) this.values.districtStats[id][key] = Math.max(0, Math.floor(value));
    }
    if (Number.isFinite(data.demandBonusOrders)) this.values.demandBonusOrders = Math.min(EVENT_BALANCE.demandOrders, Math.max(0, Math.floor(data.demandBonusOrders)));
    if (Array.isArray(data.ownedItems)) this.values.ownedItems = [...new Set(data.ownedItems.filter(id => itemById(id)))];
    for (const category of CATEGORIES) {
      const id = data.equippedItems?.[category];
      if (this.values.ownedItems.includes(id) && itemById(id)?.category === category) this.values.equippedItems[category] = id;
    }
    if (Array.isArray(data.ownedTransports)) this.values.ownedTransports = [...new Set([TRANSPORT.WALKING, ...data.ownedTransports.filter(id => transportById(id))])];
    const legacyBicycle = (Array.isArray(data.ownedItems) && data.ownedItems.includes('bicycle')) || data.transport === TRANSPORT.BICYCLE || data.equippedItems?.TRANSPORT === 'bicycle';
    if (legacyBicycle && !this.values.ownedTransports.includes(TRANSPORT.BICYCLE)) this.values.ownedTransports.push(TRANSPORT.BICYCLE);
    const equipped = data.equippedTransport ?? (data.equippedItems?.TRANSPORT === 'bicycle' ? TRANSPORT.BICYCLE : data.transport);
    if (this.values.ownedTransports.includes(equipped)) this.values.equippedTransport = equipped;
    if (Array.isArray(data.transportMilestones)) this.values.transportMilestones = [...new Set(data.transportMilestones.filter(id => TRANSPORTS.some(t => t.id === id && t.milestoneTitle)))];
    if (Number.isFinite(data.largeOrderBoost)) this.values.largeOrderBoost = Math.max(0, Math.min(EVENT_BALANCE.largeOrderBoost, data.largeOrderBoost));
    for (const key of STAT_KEYS) if (Number.isFinite(data[key])) this.values[key] = Math.max(0, Math.floor(data[key]));
    this.update(data);
    this.loadingProgression = false;
    return true;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }
}
export const gameState = new GameState({ tasks: { date: () => null } });
