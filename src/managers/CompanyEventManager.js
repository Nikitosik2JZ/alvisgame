import { COMPANY } from '../config/companyConfig.js';
import { COMPANY_EVENTS, COMPANY_EVENT_BALANCE as B } from '../data/companyEvents.js';

export class CompanyEventManager {
  constructor(company) { this.company = company; this.state = company.state; this.pending = null; this.active = null; }
  interval() { return B.intervalMs[0] + this.company.roll() * (B.intervalMs[1] - B.intervalMs[0]); }
  workers() { return this.state.values.employees.filter(e => e.status === 'WORKING'); }
  eligible(event) {
    const s = this.state.values, memory = s.companyEventState;
    return s.companyUnlocked && this.workers().length > 0 && event.id !== memory.lastId
      && !(event.category === 'NEGATIVE' && memory.negativeStreak >= B.maxNegativeStreak)
      && !(event.vehicle && !this.workers().some(e => e.assignedTransport));
  }
  weight(event, employee) {
    const s = this.state.values;
    const reliability = this.company.employeeReliability(employee);
    const risk = Math.max(B.riskWeightRange[0], Math.min(B.riskWeightRange[1], 1 + (1 - reliability) * B.reliabilityRiskScale));
    const urgent = this.company.effect('risk') > 0 ? B.urgentEventWeight : 1;
    return event.weight * (event.reliable || event.category === 'NEGATIVE' ? risk * urgent : 1)
      * (event.corporate ? 1 + Math.min(B.corporateWeightCap, s.companyReputation * B.corporateReputationScale) : 1);
  }
  select(category, id) {
    let employees = this.workers();
    if (id && COMPANY_EVENTS.find(e => e.id === id)?.vehicle) employees = employees.filter(e => e.assignedTransport);
    if (!employees.length) return null;
    const employee = employees[Math.floor(this.company.roll() * employees.length)];
    const pool = COMPANY_EVENTS.filter(e => (!category || e.category === category) && (!id || e.id === id) && this.eligible(e)
      && (!e.vehicle || employee.assignedTransport));
    let roll = this.company.roll() * pool.reduce((sum, e) => sum + this.weight(e, employee), 0);
    const event = pool.find(e => (roll -= this.weight(e, employee)) < 0) || pool.at(-1);
    return event ? { event, employeeId: employee.id } : null;
  }
  advance(elapsed) {
    if (!this.workers().length || this.active || this.pending) return;
    const memory = this.state.values.companyEventState;
    memory.remainingMs ??= this.interval(); memory.remainingMs -= elapsed;
    if (memory.remainingMs <= 0) { this.pending = this.select(); memory.remainingMs = this.interval(); }
  }
  debug(category, id) {
    if (this.active || this.pending) return false;
    this.pending = this.select(category, id); return Boolean(this.pending);
  }
  update() {
    if (this.company.hidden || !this.pending || this.active || !this.onShow || this.isBlocked?.()) return;
    const candidate = this.pending; this.pending = null;
    if (!this.eligible(candidate.event) || !this.workers().some(e => e.id === candidate.employeeId)) return;
    this.active = { ...candidate, resolved: false }; this.onShow(candidate.event);
  }
  fine(requested) {
    const s = this.state.values;
    // Forced penalties use company funds only and never drain a small ledger.
    const paid = Math.min(requested, Math.floor(s.companyBalance * B.penaltyBalanceFraction));
    s.companyBalance -= paid; return paid;
  }
  resolve(choice = 0) {
    if (!this.active || this.active.resolved) return { ok: false, reason: 'Событие уже завершено' };
    const { event, employeeId } = this.active, s = this.state.values;
    if (event.choices && (!Number.isInteger(choice) || !event.choices[choice])) return { ok: false, reason: 'Выберите вариант' };
    const employee = s.employees.find(e => e.id === employeeId), effects = { ...(event.choices?.[choice]?.effects || event.effects) };
    if (effects.cost && s.money < effects.cost) return { ok: false, reason: 'Не хватает личных денег. Выберите другой вариант.' };
    this.company.tick(); // Settle preceding time before changing rates.
    const lines = []; let bad = event.category === 'NEGATIVE';
    if (effects.dispute && this.company.roll() < B.disputeSuccessChance) {
      delete effects.fine; delete effects.reputation; delete effects.failure; lines.push('Штраф отменён.');
    }
    if (effects.cost) { s.money -= effects.cost; lines.push(`Оплачено: ${effects.cost} ₽.`); }
    const money = effects.money || 0;
    if (money > 0) { const credited = this.company.creditBonus(money); lines.push(`В компанию: +${credited} ₽.`); }
    if (money < 0 || effects.fine) { lines.push(`Штраф: ${this.fine(effects.fine || -money)} ₽ (с учётом защиты баланса).`); bad = true; }
    if (effects.reputation) { this.company.reputation(effects.reputation); lines.push(`Репутация компании: ${effects.reputation > 0 ? '+' : ''}${effects.reputation}.`); }
    if (effects.permanentEfficiency && employee) {
      employee.permanentEfficiencyBonus = Math.min(COMPANY.permanentBonusCap, employee.permanentEfficiencyBonus + B.bonusEfficiency);
      lines.push(`Постоянный бонус эффективности: +${Math.round(employee.permanentEfficiencyBonus * 100)}%.`);
    }
    for (const kind of ['companyIncome', 'employeeIncome', 'risk']) if (effects[kind]) {
      s.companyEffects.push({ kind, value: effects[kind], until: s.companyActiveTimeMs + effects.duration * 1000, employeeId: kind === 'employeeIncome' ? employeeId : null });
      lines.push(`${kind === 'risk' ? 'Риск провала' : kind === 'employeeIncome' ? 'Доход курьера' : 'Доход компании'}: ${Math.round(effects[kind] * 100)}% · ${effects.duration} сек.`);
      if (effects[kind] < 0) bad = true;
    }
    if (effects.unavailable && employee) {
      employee.status = 'TEMPORARILY_UNAVAILABLE'; employee.unavailableUntil = s.companyActiveTimeMs + effects.duration * 1000;
      employee.recoveryMessage = effects.recovery || ''; lines.push(`${employee.name}: перерыв ${effects.duration} сек. игрового времени.`);
    }
    if (effects.failure && employee) { employee.failedDeliveries++; s.companyStats.employeeFailures++; }
    const memory = s.companyEventState; memory.lastId = event.id; memory.negativeStreak = bad ? memory.negativeStreak + 1 : 0;
    if (bad) s.companyStats.negativeEvents++; else if (event.category === 'POSITIVE' || effects.companyIncome > 0 || effects.permanentEfficiency) s.companyStats.positiveEvents++;
    this.active.resolved = true;
    const message = lines.join('\n') || 'Без последствий.';
    this.company.log(`${event.title} · ${employee?.name || 'Компания'}: ${message}`);
    s.companyStats.highestIncomePerMinute = Math.max(s.companyStats.highestIncomePerMinute, this.company.incomeRate());
    this.state.refresh(); return { ok: true, message };
  }
  finish() { if (this.active?.resolved) this.active = null; }
}
