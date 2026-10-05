import { COMPANY, companyLevel, companyName, companyVehicle } from '../config/companyConfig.js';

// The ledger is mathematical. No employee sprites, routes or per-frame payouts.
export class CompanyManager {
  constructor(state, { wallNow = Date.now, now = () => performance.now(), random = Math.random } = {}) {
    this.state = state; this.wallNow = wallNow; this.now = now; this.random = random;
    this.lastTick = now(); this.activityElapsed = 0; this.offlineEarned = 0;
  }

  employeeRate(employee, snapshot = this.state.values) {
    if (employee.status !== 'WORKING') return 0;
    const type = snapshot.companyVehicles.find(v => v.id === employee.assignedTransport)?.type || 'WALKING';
    return employee.baseIncome * COMPANY.transportMultipliers[type] * employee.efficiency;
  }
  incomeRate(snapshot = this.state.values) { return snapshot.employees.reduce((sum, employee) => sum + this.employeeRate(employee, snapshot), 0); }
  storageLimit(snapshot = this.state.values) { return Math.floor(this.incomeRate(snapshot) * COMPANY.storageCapMs / 60000); }
  log(message) { this.state.values.companyLog.unshift(message); this.state.values.companyLog.length = Math.min(COMPANY.logLimit, this.state.values.companyLog.length); }

  accrue(elapsed) {
    const s = this.state.values, rate = this.incomeRate();
    if (!s.companyUnlocked || rate <= 0 || !Number.isFinite(elapsed) || elapsed <= 0) return 0;
    const room = Math.max(0, this.storageLimit() - s.companyBalance - s.companyIncomeRemainder);
    const earned = Math.min(room, rate * Math.min(elapsed, COMPANY.offlineCapMs) / 60000);
    if (earned <= 0) return 0;
    for (const employee of s.employees) employee.totalEarned += earned * this.employeeRate(employee) / rate;
    const credit = s.companyIncomeRemainder + earned;
    const rubles = Math.floor(credit + 1e-9);
    s.companyIncomeRemainder = Math.max(0, credit - rubles);
    s.companyBalance += rubles; s.companyLifetimeEarnings += rubles;
    return rubles;
  }

  resumeOffline() {
    const s = this.state.values, timestamp = s.lastCompanyUpdateTimestamp, wall = this.wallNow();
    this.lastTick = this.now();
    if (!s.companyUnlocked) return 0;
    const elapsed = Number.isSafeInteger(timestamp) && timestamp > 0 && timestamp <= wall
      ? Math.min(COMPANY.offlineCapMs, wall - timestamp) : 0;
    this.offlineEarned = this.accrue(elapsed);
    s.lastCompanyUpdateTimestamp = wall;
    if (this.offlineEarned > 0) this.log(`Пока вас не было: +${this.offlineEarned} ₽.`);
    this.state.refresh();
    return this.offlineEarned;
  }

  tick() {
    const current = this.now(), elapsed = Math.max(0, current - this.lastTick);
    this.lastTick = current;
    if (!this.state.values.companyUnlocked) return 0;
    const earned = this.accrue(elapsed);
    this.state.values.lastCompanyUpdateTimestamp = this.wallNow();
    this.activityElapsed += elapsed;
    if (earned > 0 && this.activityElapsed >= COMPANY.activityIntervalMs) {
      this.log('Курьеры завершили несколько заказов. Сегодня у компании хороший день.');
      this.activityElapsed = 0;
    }
    this.state.refresh();
    return earned;
  }

  start() {
    if (this.timer) return;
    this.resumeOffline();
    this.timer = setInterval(() => this.tick(), COMPANY.tickMs);
    this.onHide = () => { if (document.visibilityState === 'hidden') this.tick(); };
    this.onPageHide = () => this.tick();
    document.addEventListener('visibilitychange', this.onHide);
    window.addEventListener('pagehide', this.onPageHide);
  }
  destroy() {
    this.tick(); clearInterval(this.timer); this.timer = null;
    document.removeEventListener('visibilitychange', this.onHide);
    window.removeEventListener('pagehide', this.onPageHide);
  }

  requireCompany() { return this.state.values.companyUnlocked ? null : { ok: false, reason: 'Сначала откройте компанию' }; }
  spend(price) {
    if (this.state.values.money < price) return false;
    this.state.values.money -= price; return true;
  }
  nextId(prefix, entries) { let index = 1; while (entries.some(entry => entry.id === `${prefix}-${index}`)) index++; return `${prefix}-${index}`; }
  candidate() {
    return { name: COMPANY.employeeNames[Math.min(COMPANY.employeeNames.length - 1, Math.max(0, Math.floor(this.random() * COMPANY.employeeNames.length)))], level: 1, efficiency: 1, baseIncome: COMPANY.baseIncome };
  }

  openCompany(name) {
    const s = this.state.values;
    if (s.companyUnlocked) return { ok: false, reason: 'Компания уже открыта' };
    if (s.level < COMPANY.unlockLevel) return { ok: false, reason: `Требуется уровень ${COMPANY.unlockLevel}` };
    if (!this.spend(COMPANY.unlockPrice)) return { ok: false, reason: 'Не хватает денег на открытие компании' };
    s.companyUnlocked = true; s.companyName = companyName(name); s.lastCompanyUpdateTimestamp = this.wallNow(); this.lastTick = this.now();
    this.log('Собственная служба доставки открыта. Пора нанимать людей.'); this.state.refresh();
    return { ok: true };
  }
  rename(name) {
    const blocked = this.requireCompany(); if (blocked) return blocked;
    this.state.values.companyName = companyName(name); this.state.refresh(); return { ok: true };
  }
  hire(candidate = this.candidate()) {
    const blocked = this.requireCompany(); if (blocked) return blocked;
    this.tick(); const s = this.state.values;
    if (s.employees.length >= companyLevel(s.companyLevel).slots) return { ok: false, reason: 'НЕТ СВОБОДНЫХ МЕСТ. Улучшите компанию.' };
    if (!this.spend(COMPANY.hireCost)) return { ok: false, reason: 'Не хватает денег на найм' };
    const employee = { id: this.nextId('courier', s.employees), name: companyName(candidate?.name), level: 1,
      efficiency: 1, assignedTransport: null, baseIncome: COMPANY.baseIncome, status: 'WORKING', totalEarned: 0 };
    s.employees.push(employee); s.companyStats.employeesHired++;
    this.log(`${employee.name} вышел на линию.${s.employees.length === 1 ? ' Первый курьер компании!' : ''}`);
    this.state.refresh(); return { ok: true, employee: { ...employee } };
  }
  buyVehicle(type) {
    const blocked = this.requireCompany(); if (blocked) return blocked;
    const vehicle = companyVehicle(type); if (!vehicle) return { ok: false, reason: 'Транспорт компании не найден' };
    this.tick(); const s = this.state.values;
    if (s.companyVehicles.length >= 1000) return { ok: false, reason: 'Автопарк заполнен' };
    if (!this.spend(vehicle.price)) return { ok: false, reason: 'Не хватает денег на транспорт компании' };
    s.companyVehicles.push({ id: this.nextId('vehicle', s.companyVehicles), type });
    this.log(`Куплен ${vehicle.name.toLowerCase()} для компании.`); this.state.refresh(); return { ok: true };
  }
  assignVehicle(employeeId, vehicleId = null) {
    const blocked = this.requireCompany(); if (blocked) return blocked;
    const s = this.state.values, employee = s.employees.find(e => e.id === employeeId);
    if (!employee) return { ok: false, reason: 'Курьер не найден' };
    if (vehicleId !== null && !s.companyVehicles.some(v => v.id === vehicleId)) return { ok: false, reason: 'Транспорт не принадлежит компании' };
    if (vehicleId !== null && s.employees.some(e => e.id !== employeeId && e.assignedTransport === vehicleId)) return { ok: false, reason: 'Транспорт занят. Сначала переведите другого курьера на пешие доставки.' };
    this.tick(); employee.assignedTransport = vehicleId;
    const type = s.companyVehicles.find(v => v.id === vehicleId)?.type;
    this.log(`${employee.name}: ${companyVehicle(type)?.name || 'пешие доставки'}.`); this.state.refresh(); return { ok: true };
  }
  collect() {
    const blocked = this.requireCompany(); if (blocked) return blocked;
    this.tick(); const s = this.state.values, amount = s.companyBalance;
    if (amount <= 0) return { ok: false, reason: 'Доход пока не накоплен' };
    s.money += amount; s.companyBalance = 0; s.companyStats.totalIncomeCollected += amount;
    this.offlineEarned = 0; this.log(`Забрано ${amount} ₽ дохода компании.`); this.state.refresh(); return { ok: true, amount };
  }
  upgrade() {
    const blocked = this.requireCompany(); if (blocked) return blocked;
    this.tick(); const s = this.state.values, next = COMPANY.levels.find(level => level.level === s.companyLevel + 1);
    if (!next) return { ok: false, reason: 'Достигнут максимальный уровень компании' };
    if (!this.spend(next.price)) return { ok: false, reason: 'Не хватает денег на улучшение' };
    s.companyLevel = next.level; this.log(`Компания улучшена до уровня ${next.level}.`); this.state.refresh(); return { ok: true };
  }
}
