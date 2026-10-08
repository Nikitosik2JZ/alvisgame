import { t as tr } from '../services/LocalizationService.js';
import { encodeMessage, message } from '../services/LocalizedMessages.js';
import { COMPANY, companyLevel, companyName, companyVehicle, archetypeFor, clampStat, employeeXpRequired, upgradeEffect } from '../config/companyConfig.js';
import { normalizeEmployee } from '../state/companyState.js';
import { CompanyEventManager } from './CompanyEventManager.js';
import { companyDistrictBonus } from '../config/districtConfig.js';
import { progressionMultiplier } from './ProgressionModifiers.js';

// The ledger is mathematical. No employee sprites, routes or per-frame payouts.
export class CompanyManager {
  constructor(state, { wallNow = Date.now, now = () => performance.now(), random = Math.random, lifecycle = null } = {}) {
    this.lifecycle = lifecycle;
    this.state = state; this.wallNow = wallNow; this.now = now; this.random = random;
    this.lastTick = now(); this.offlineEarned = 0;
    state.beforeDistrictUnlock = () => this.tick();
    state.beforeProgressionPurchase = () => this.tick();
    this.events = new CompanyEventManager(this);
    if (state.values.companyUnlocked && state.values.candidateGeneration === 0) this.generateCandidates();
  }

  employeeEfficiency(employee, snapshot = this.state.values) {
    return employee.efficiency * (1 + (employee.level - 1) * COMPANY.levelEfficiencyBonus + employee.permanentEfficiencyBonus)
      * (1 + upgradeEffect('routing', snapshot));
  }
  employeeReliability(employee) { return employee.reliability + (employee.level - 1) * COMPANY.levelReliabilityBonus; }
  effect(kind, employeeId = null, snapshot = this.state.values) {
    return snapshot.companyEffects.filter(e => e.kind === kind && e.until > snapshot.companyActiveTimeMs && e.employeeId === employeeId).reduce((sum, e) => sum + e.value, 0);
  }
  failureChance(employee, snapshot = this.state.values, baseline = false) {
    return Math.max(COMPANY.failureRange[0], Math.min(COMPANY.failureRange[1], COMPANY.baseFailureChance
      + (1 - this.employeeReliability(employee)) * COMPANY.reliabilityFailureScale + (baseline ? 0 : this.effect('risk', null, snapshot))));
  }
  incomeFactors(employee, snapshot = this.state.values, baseline = false) {
    const type = snapshot.companyVehicles.find(v => v.id === employee.assignedTransport)?.type || 'WALKING';
    return { base: employee.baseIncome, transport: COMPANY.transportMultipliers[type], efficiency: this.employeeEfficiency(employee, snapshot),
      speed: 1 + (employee.speed - 1) * COMPANY.transportSpeedInfluence[type], office: 1 + companyLevel(snapshot.officeLevel).bonus,
      company: 1 + upgradeEffect('dispatch', snapshot) + upgradeEffect('advertising', snapshot)
        + Math.min(COMPANY.reputation.incomeCap, snapshot.companyReputation * COMPANY.reputation.incomeScale),
      reliability: 1 - this.failureChance(employee, snapshot, baseline) * COMPANY.failureIncomeLoss,
      districts: 1 + companyDistrictBonus(snapshot),
      legacy: progressionMultiplier(snapshot, 'companyIncome'),
      event: baseline ? 1 : Math.max(.5, 1 + this.effect('companyIncome', null, snapshot) + this.effect('employeeIncome', employee.id, snapshot)) };
  }
  employeeRate(employee, snapshot = this.state.values, baseline = false) {
    if (employee.status === 'IDLE' || (!baseline && employee.status !== 'WORKING')) return 0;
    return Object.values(this.incomeFactors(employee, snapshot, baseline)).reduce((product, value) => product * value, 1);
  }
  incomeRate(snapshot = this.state.values) { return snapshot.employees.reduce((sum, employee) => sum + this.employeeRate(employee, snapshot), 0); }
  storageLimit(snapshot = this.state.values) { return Math.floor(snapshot.employees.reduce((sum, e) => sum + this.employeeRate(e, snapshot, true), 0) * COMPANY.storageCapMs / 60000); }
  log(message) { this.state.values.companyLog.unshift(encodeMessage(message)); this.state.values.companyLog.length = Math.min(COMPANY.logLimit, this.state.values.companyLog.length); }

  reputation(delta) { this.state.values.companyReputation = Math.max(0, this.state.values.companyReputation + delta); }
  addXp(employee, xp) {
    if (employee.level >= COMPANY.employeeMaxLevel) { employee.currentXp = 0; return; }
    employee.currentXp += xp;
    while (employee.level < COMPANY.employeeMaxLevel && employee.currentXp >= employeeXpRequired(employee.level)) {
      employee.currentXp -= employeeXpRequired(employee.level); employee.level++;
      this.log(message('company-manager.001', { v0: employee.name, v1: employee.level }));
    }
    if (employee.level === COMPANY.employeeMaxLevel) employee.currentXp = 0;
  }
  deliveriesRate(employee, baseline = false) {
    if (employee.status === 'IDLE' || (!baseline && employee.status !== 'WORKING')) return 0;
    const f = this.incomeFactors(employee, this.state.values, baseline);
    return COMPANY.deliveriesPerMinute * f.transport * f.efficiency * f.speed;
  }
  simulateWork(offline = false) {
    const s = this.state.values;
    for (const e of s.employees) {
      const completed = Math.floor(e.workRemainder + 1e-9); e.workRemainder = Math.max(0, e.workRemainder - completed);
      if (!completed) continue;
      if (!offline) e.failureRemainder += completed * this.failureChance(e);
      const failed = offline ? 0 : Math.floor(e.failureRemainder); e.failureRemainder -= failed;
      const successful = completed - failed;
      e.successfulDeliveries += successful; e.failedDeliveries += failed;
      s.companyStats.employeeDeliveries += successful; s.companyStats.employeeFailures += failed;
      this.addXp(e, successful * COMPANY.xpPerDelivery * (1 + upgradeEffect('training', s)));
      this.reputation(successful * COMPANY.reputation.perDelivery - failed * COMPANY.reputation.perFailure);
    }
  }
  credit(rates, elapsed) {
    const s = this.state.values, rate = rates.reduce((sum, value) => sum + value, 0);
    if (rate <= 0) return 0;
    const room = Math.max(0, this.storageLimit() - s.companyBalance - s.companyIncomeRemainder);
    const earned = Math.min(room, rate * elapsed / 60000);
    if (earned <= 0) return 0;
    s.employees.forEach((employee, index) => { employee.totalEarned += earned * rates[index] / rate; });
    const credit = s.companyIncomeRemainder + earned;
    const rubles = Math.floor(credit + 1e-9);
    s.companyIncomeRemainder = Math.max(0, credit - rubles);
    s.companyBalance += rubles; s.companyLifetimeEarnings += rubles;
    return rubles;
  }
  creditBonus(amount) {
    amount = Math.round(amount * progressionMultiplier(this.state.values, 'companyIncome'));
    const s = this.state.values; s.companyBalance += amount; s.companyLifetimeEarnings += amount;
    return amount;
  }
  expireEffects() {
    const s = this.state.values;
    s.companyEffects = s.companyEffects.filter(e => e.until > s.companyActiveTimeMs);
    for (const employee of s.employees) if (employee.status === 'TEMPORARILY_UNAVAILABLE' && employee.unavailableUntil <= s.companyActiveTimeMs) {
      employee.status = 'WORKING'; employee.unavailableUntil = 0;
      this.log(employee.recoveryMessage || message('company-manager.002', { v0: employee.name })); employee.recoveryMessage = '';
    }
  }
  accrue(elapsed, offline = false) {
    const s = this.state.values;
    if (!s.companyUnlocked || !Number.isFinite(elapsed) || elapsed <= 0) return 0;
    let remaining = Math.min(elapsed, COMPANY.offlineCapMs), earned = 0;
    if (offline) {
      // Freeze starting rates: no random events, failures or expiry of gameplay effects offline.
      earned = this.credit(s.employees.map(e => this.employeeRate(e, s, true) * archetypeFor(e.archetype).offline), remaining);
      for (const e of s.employees) e.workRemainder += this.deliveriesRate(e, true) * archetypeFor(e.archetype).offline * remaining / 60000;
      this.simulateWork(true);
    } else {
      while (remaining > 0) {
        this.expireEffects();
        const deadlines = [...s.companyEffects.map(e => e.until), ...s.employees.filter(e => e.status === 'TEMPORARILY_UNAVAILABLE').map(e => e.unavailableUntil)];
        const untilExpiry = Math.min(Infinity, ...deadlines.map(end => end - s.companyActiveTimeMs).filter(ms => ms > 0));
        const step = Math.min(remaining, COMPANY.simulationStepMs - s.companySimulationRemainderMs, untilExpiry);
        earned += this.credit(s.employees.map(e => this.employeeRate(e)), step);
        for (const e of s.employees) e.workRemainder += this.deliveriesRate(e) * step / 60000;
        s.companyActiveTimeMs += step; s.companySimulationRemainderMs += step; remaining -= step;
        if (s.companySimulationRemainderMs >= COMPANY.simulationStepMs - 1e-6) { this.simulateWork(); s.companySimulationRemainderMs = 0; }
      }
      this.expireEffects();
    }
    s.companyStats.highestIncomePerMinute = Math.max(s.companyStats.highestIncomePerMinute, this.incomeRate());
    return earned;
  }

  resumeOffline() {
    const s = this.state.values, timestamp = s.lastCompanyUpdateTimestamp, wall = this.wallNow();
    this.lastTick = this.now();
    if (!s.companyUnlocked) return 0;
    if (!Number.isFinite(wall) || wall <= 0) return 0;
    const elapsed = Number.isSafeInteger(timestamp) && timestamp > 0 && timestamp <= wall
      ? Math.min(COMPANY.offlineCapMs, wall - timestamp) : 0;
    this.offlineEarned = this.accrue(elapsed, true);
    this.offlineNoticeShown = false;
    s.lastCompanyUpdateTimestamp = wall;
    if (this.offlineEarned > 0) this.log(message('company-manager.003', { v0: this.offlineEarned }));
    this.state.refresh();
    return this.offlineEarned;
  }

  settleForSave() { if (!this.hidden) this.tick(); }

  tick() {
    const current = this.now(), elapsed = Math.max(0, current - this.lastTick);
    this.lastTick = current;
    if (!this.state.values.companyUnlocked) return 0;
    const earned = this.accrue(elapsed);
    const wall = this.wallNow();
    if (Number.isFinite(wall) && wall > 0) this.state.values.lastCompanyUpdateTimestamp = wall;
    this.events.advance(Math.min(elapsed, COMPANY.offlineCapMs));
    this.state.refresh({ minor: true });
    return earned;
  }

  start() {
    if (this.timer) return;
    this.resumeOffline();
    this.hidden = document.visibilityState === 'hidden';
    this.timer = setInterval(() => { if (!this.hidden && !this.lifecycle?.paused) this.tick(); }, COMPANY.tickMs);
    this.onHide = () => {
      if (document.visibilityState === 'hidden') {
        this.tick(); this.hidden = true;
        this.hiddenOfflineAllowed = !this.lifecycle || ![...this.lifecycle.reasons].some(r => !r.startsWith('VISIBILITY'));
      } else {
        this.hidden = false;
        if (this.hiddenOfflineAllowed) this.resumeOffline();
        else { this.lastTick = this.now(); const wall = this.wallNow(); if (wall) this.state.values.lastCompanyUpdateTimestamp = wall; }
      }
    };
    this.onPageHide = () => { if (!this.hidden) this.tick(); };
    document.addEventListener('visibilitychange', this.onHide);
    window.addEventListener('pagehide', this.onPageHide);
  }
  destroy() {
    if (!this.hidden) this.tick(); clearInterval(this.timer); this.timer = null;
    document.removeEventListener('visibilitychange', this.onHide);
    window.removeEventListener('pagehide', this.onPageHide);
  }

  requireCompany() { return this.state.values.companyUnlocked ? null : { ok: false, reason: tr('company-manager.004') }; }
  spend(price) {
    if (this.state.values.money < price) return false;
    this.state.values.money -= price; return true;
  }
  nextId(prefix, entries) { let index = 1; while (entries.some(entry => entry.id === `${prefix}-${index}`)) index++; return `${prefix}-${index}`; }
  roll() { return Math.min(.999999999, Math.max(0, this.random())); }
  generateCandidates() {
    const s = this.state.values; s.candidateGeneration++;
    const pool = Object.keys(COMPANY.archetypes), start = Math.floor(this.roll() * pool.length);
    s.companyCandidates = Array.from({ length: COMPANY.candidateCount }, (_, index) => {
      const archetype = pool[(start + index) % pool.length], config = archetypeFor(archetype);
      const stats = Object.fromEntries(['efficiency', 'reliability', 'speed'].map(key => [key,
        Math.round(clampStat(key, config[key][0] + this.roll() * (config[key][1] - config[key][0])
          + Math.min(COMPANY.reputation.candidateStatCap, s.companyReputation * COMPANY.reputation.candidateScale)) * 1000) / 1000]));
      return { id: `candidate-${s.candidateGeneration}-${index}`, name: COMPANY.employeeNames[(Math.floor(this.roll() * COMPANY.employeeNames.length) + index) % COMPANY.employeeNames.length], archetype, ...stats, price: config.cost };
    });
    return s.companyCandidates;
  }
  candidate() { return this.state.values.companyCandidates[0]; }
  refreshCandidates(debug = false) {
    const blocked = this.requireCompany(); if (blocked) return blocked;
    const s = this.state.values, price = s.candidateRefreshes === 0 ? 0 : COMPANY.refreshCost;
    if (!debug && !this.spend(price)) return { ok: false, reason: tr('company-manager.005') };
    if (!debug) s.candidateRefreshes++;
    this.generateCandidates(); this.state.refresh(); return { ok: true };
  }

  openCompany(name) {
    const s = this.state.values;
    if (s.companyUnlocked) return { ok: false, reason: tr('company-manager.006') };
    if (s.level < COMPANY.unlockLevel) return { ok: false, reason: tr('company-manager.007', { v0: COMPANY.unlockLevel }) };
    if (!this.spend(COMPANY.unlockPrice)) return { ok: false, reason: tr('company-manager.008') };
    s.companyUnlocked = true; s.companyName = companyName(name); s.lastCompanyUpdateTimestamp = this.wallNow(); this.lastTick = this.now();
    this.generateCandidates();
    this.log(message('company-manager.009')); this.state.refresh();
    return { ok: true };
  }
  rename(name) {
    const blocked = this.requireCompany(); if (blocked) return blocked;
    this.state.values.companyName = companyName(name); this.state.refresh(); return { ok: true };
  }
  hire(candidateId = this.candidate()?.id) {
    const blocked = this.requireCompany(); if (blocked) return blocked;
    this.tick(); const s = this.state.values;
    if (s.employees.length >= companyLevel(s.officeLevel).slots) return { ok: false, reason: tr('company-manager.010') };
    const candidate = s.companyCandidates.find(c => c.id === candidateId);
    if (!candidate) return { ok: false, reason: tr('company-manager.011') };
    if (!this.spend(candidate.price)) return { ok: false, reason: tr('company-manager.012') };
    const employee = normalizeEmployee({ ...candidate, id: this.nextId('courier', s.employees) });
    s.companyCandidates = s.companyCandidates.filter(c => c.id !== candidate.id);
    s.employees.push(employee); s.companyStats.employeesHired++;
    this.log(message('company-manager.014', { v0: employee.name, v1: s.employees.length === 1 ? message('company-manager.013') : '' }));
    s.companyStats.highestIncomePerMinute = Math.max(s.companyStats.highestIncomePerMinute, this.incomeRate());
    this.state.refresh(); return { ok: true, employee: { ...employee } };
  }
  buyVehicle(type) {
    const blocked = this.requireCompany(); if (blocked) return blocked;
    const vehicle = companyVehicle(type); if (!vehicle) return { ok: false, reason: tr('company-manager.015') };
    this.tick(); const s = this.state.values;
    if (s.companyVehicles.length >= 1000) return { ok: false, reason: tr('company-manager.016') };
    if (!this.spend(vehicle.price)) return { ok: false, reason: tr('company-manager.017') };
    s.companyVehicles.push({ id: this.nextId('vehicle', s.companyVehicles), type });
    this.log(message('company-manager.018', { v0: encodeMessage(vehicle.name) })); this.state.refresh(); return { ok: true };
  }
  assignVehicle(employeeId, vehicleId = null) {
    const blocked = this.requireCompany(); if (blocked) return blocked;
    const s = this.state.values, employee = s.employees.find(e => e.id === employeeId);
    if (!employee) return { ok: false, reason: tr('company-manager.019') };
    if (vehicleId !== null && !s.companyVehicles.some(v => v.id === vehicleId)) return { ok: false, reason: tr('company-manager.020') };
    if (vehicleId !== null && s.employees.some(e => e.id !== employeeId && e.assignedTransport === vehicleId)) return { ok: false, reason: tr('company-manager.021') };
    this.tick(); employee.assignedTransport = vehicleId;
    const type = s.companyVehicles.find(v => v.id === vehicleId)?.type;
    s.companyStats.highestIncomePerMinute = Math.max(s.companyStats.highestIncomePerMinute, this.incomeRate());
    this.log(message('company.log.assignment', { name: encodeMessage(employee.name), vehicle: encodeMessage(companyVehicle(type)?.name || tr('company-manager.022')) })); this.state.refresh(); return { ok: true };
  }
  collect() {
    const blocked = this.requireCompany(); if (blocked) return blocked;
    this.tick(); const s = this.state.values, amount = s.companyBalance;
    if (amount <= 0) return { ok: false, reason: tr('company-manager.023') };
    s.money += amount; s.companyBalance = 0; s.companyStats.totalIncomeCollected += amount;
    this.state.tasks.gameplayEvent('companyCollect', { amount });
    this.offlineEarned = 0; this.log(message('company-manager.024', { v0: amount })); this.state.refresh(); return { ok: true, amount };
  }
  upgrade() {
    const blocked = this.requireCompany(); if (blocked) return blocked;
    this.tick(); const s = this.state.values, next = COMPANY.levels.find(level => level.level === s.officeLevel + 1);
    if (!next) return { ok: false, reason: tr('company-manager.025') };
    if (!this.spend(next.price)) return { ok: false, reason: tr('company-manager.026') };
    s.companyLevel = s.officeLevel = next.level; this.reputation(COMPANY.reputation.perUpgrade);
    this.log(message('company-manager.027', { v0: encodeMessage(next.name) })); s.companyStats.highestIncomePerMinute = Math.max(s.companyStats.highestIncomePerMinute, this.incomeRate());
    this.state.refresh(); return { ok: true };
  }
  upgradeBranch(key) {
    const blocked = this.requireCompany(); if (blocked) return blocked;
    if (!Object.hasOwn(COMPANY.upgrades, key)) return { ok: false, reason: tr('achievement-manager.006') };
    this.tick(); const s = this.state.values, config = COMPANY.upgrades[key], level = s.companyUpgrades[key];
    if (level >= config.costs.length) return { ok: false, reason: tr('company-manager.028') };
    if (!this.spend(config.costs[level])) return { ok: false, reason: tr('company-manager.026') };
    s.companyUpgrades[key]++; this.reputation(COMPANY.reputation.perUpgrade); this.log(message('company-manager.029', { v0: encodeMessage(config.name), v1: level + 1 }));
    s.companyStats.highestIncomePerMinute = Math.max(s.companyStats.highestIncomePerMinute, this.incomeRate());
    this.state.refresh(); return { ok: true };
  }
}
