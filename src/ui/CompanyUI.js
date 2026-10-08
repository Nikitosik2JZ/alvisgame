import { formatNumber } from '../services/LocalizationService.js';
import { renderMessage } from '../services/LocalizedMessages.js';
import { t as tr } from '../services/LocalizationService.js';
import { ModalUI } from './ModalUI.js';
import { COMPANY, companyLevel, companyVehicle, archetypeFor, companyRank, employeeXpRequired, upgradeEffect } from '../config/companyConfig.js';
import { companyDistrictBonus } from '../config/districtConfig.js';

const rubles = value => `${formatNumber(Math.floor(value))} ₽`;
const text = (root, selector, value) => { root.querySelector(selector).textContent = value; };
const percent = value => `${Math.round(value * 100)}%`;

export class CompanyUI extends ModalUI {
  constructor(scene, manager, state, player) {
    super(scene, player, 'company-dialog', 'open-company');
    this.manager = manager; this.state = state; this.view = 'dashboard';
    this.pendingOffline = manager.offlineEarned > 0 && !manager.offlineNoticeShown; this.employeeSignature = null;
    this.nameInput = this.dialog.querySelector('#company-name'); this.nameInput.maxLength = COMPANY.nameLimit;
    this.nameInput.value = state.getSnapshot().companyName;
    text(this.dialog, '#company-name-hint', tr('company-ui.001', { v0: COMPANY.nameLimit, v1: COMPANY.defaultName }));
    this.perform = (action, success) => {
      const result = action();
      text(this.dialog, '#company-feedback', result.ok ? success : result.reason);
      return result;
    };
    this.dialog.querySelector('#company-name-form').onsubmit = event => {
      event.preventDefault();
      if (state.getSnapshot().companyUnlocked) {
        if (this.perform(() => manager.rename(this.nameInput.value), tr('company-ui.002')).ok) this.nameInput.value = state.getSnapshot().companyName;
      }
      else this.dialog.querySelector('#company-open').click();
    };
    this.dialog.querySelector('#company-open').onclick = () => {
      if (this.perform(() => manager.openCompany(this.nameInput.value), tr('company-ui.003')).ok) {
        this.view = 'celebration'; this.render(state.getSnapshot()); this.dialog.querySelector('#company-begin').focus();
      }
    };
    const dashboard = () => { this.view = 'dashboard'; this.render(state.getSnapshot()); this.dialog.querySelector('[data-company-view="dashboard"]').focus(); };
    this.dialog.querySelector('#company-begin').onclick = dashboard;
    this.dialog.querySelector('#company-offline-later').onclick = dashboard;
    const collect = () => this.perform(() => manager.collect(), tr('company-ui.004'));
    this.dialog.querySelector('#company-collect').onclick = collect;
    this.dialog.querySelector('#company-offline-collect').onclick = () => { if (collect().ok) dashboard(); };
    this.dialog.querySelector('#company-refresh').onclick = () => this.perform(() => manager.refreshCandidates(), tr('company-ui.005'));
    this.dialog.querySelector('#company-upgrade').onclick = () => this.perform(() => manager.upgrade(), tr('company-ui.006'));
    for (const button of this.dialog.querySelectorAll('[data-company-view]')) button.onclick = () => {
      this.view = button.dataset.companyView; this.render(state.getSnapshot()); this.dialog.querySelector('.modal-content').scrollTop = 0;
    };
    const upgrades = this.dialog.querySelector('#company-upgrades'); upgrades.replaceChildren();
    for (const [key, config] of Object.entries(COMPANY.upgrades)) {
      const card = document.createElement('article'); card.className = 'shop-item'; card.dataset.upgrade = key;
      card.innerHTML = '<h3></h3><p></p><button></button>';
      card.querySelector('h3').textContent = config.name;
      card.querySelector('button').onclick = () => this.perform(() => manager.upgradeBranch(key), tr('company-ui.007'));
      upgrades.append(card);
    }
    const fleet = this.dialog.querySelector('#company-vehicles'); fleet.replaceChildren();
    for (const vehicle of COMPANY.vehicles) {
      const card = document.createElement('article'); card.className = 'shop-item'; card.dataset.companyVehicle = vehicle.type;
      card.innerHTML = '<h3></h3><p data-inventory></p><p data-rate></p><button></button>';
      card.querySelector('h3').textContent = vehicle.name;
      card.querySelector('[data-rate]').textContent = tr('company-ui.008', { v0: rubles(COMPANY.baseIncome * COMPANY.transportMultipliers[vehicle.type]) });
      const button = card.querySelector('button'); button.textContent = tr('company-ui.009', { v0: rubles(vehicle.price) });
      button.onclick = () => this.perform(() => manager.buyVehicle(vehicle.type), tr('company-ui.010'));
      fleet.append(card);
    }
    this.onCompanyClose = () => { this.view = 'dashboard'; this.render(state.getSnapshot()); };
    this.dialog.addEventListener('close', this.onCompanyClose);
    this.unsubscribe = state.subscribe(snapshot => this.render(snapshot));
    scene.events.once('shutdown', () => { this.unsubscribe(); this.dialog.removeEventListener('close', this.onCompanyClose); });
  }

  render(s) {
    const special = ['celebration', 'offline'].includes(this.view), unlocked = s.companyUnlocked;
    for (const id of ['company-wallet', 'company-gameplay-note', 'company-feedback']) this.dialog.querySelector(`#${id}`).hidden = special;
    const current = companyLevel(s.officeLevel), next = COMPANY.levels.find(level => level.level === s.officeLevel + 1);
    this.dialog.querySelector('#company-locked').hidden = unlocked || special;
    this.dialog.querySelector('#company-business').hidden = !unlocked || special;
    this.dialog.querySelector('#company-celebration').hidden = this.view !== 'celebration';
    this.dialog.querySelector('#company-offline').hidden = this.view !== 'offline';
    this.dialog.querySelector('#company-name-form').hidden = special || (unlocked && this.view !== 'dashboard');
    this.dialog.querySelector('#company-rename').hidden = !unlocked;
    if (this.previousName !== s.companyName) { this.nameInput.value = s.companyName; this.previousName = s.companyName; }
    text(this.dialog, '#company-wallet', tr('company-ui.011', { v0: rubles(s.money), v1: s.level }));
    text(this.dialog, '#company-requirements', tr('company-ui.012', { v0: COMPANY.unlockLevel, v1: s.level, v2: rubles(COMPANY.unlockPrice), v3: rubles(Math.max(0, COMPANY.unlockPrice - s.money)) }));
    // Keep the action usable so unmet requirements have an explicit explanation.
    text(this.dialog, '#company-display-name', `«${s.companyName}»`);
    text(this.dialog, '#company-offline-earned', tr('company-ui.013', { v0: rubles(this.manager.offlineEarned), v1: rubles(s.companyBalance) }));
    text(this.dialog, '#company-offline-limit', tr('company-ui.014', { v0: COMPANY.offlineCapMs / 3600000 }));
    for (const panel of this.dialog.querySelectorAll('[data-company-panel]')) panel.hidden = panel.dataset.companyPanel !== this.view;
    for (const button of this.dialog.querySelectorAll('[data-company-view]')) button.setAttribute('aria-pressed', String(button.dataset.companyView === this.view));
    const summary = this.dialog.querySelector('#company-summary'); summary.replaceChildren();
    const efficiency = s.employees.length ? s.employees.reduce((sum, e) => sum + this.manager.employeeEfficiency(e, s), 0) / s.employees.length : 1;
    for (const [label, value] of [ [tr('company-ui.015'), companyRank(s.companyReputation).name], [tr('company-ui.016'), tr('company-ui.017', { v0: current.name, v1: s.officeLevel })], [tr('company-ui.018'), `${s.employees.length} / ${current.slots}`],
      [tr('progression-config.027'), tr('company-ui.019', { v0: rubles(this.manager.incomeRate(s)) })], [tr('company-ui.020'), `+${Math.round(companyDistrictBonus(s) * 100)}%`], [tr('company-ui.021'), rubles(s.companyLifetimeEarnings)],
      [tr('company-config.033'), percent(efficiency)], [tr('company-ui.022'), formatNumber(s.companyReputation, { minimumFractionDigits: 1, maximumFractionDigits: 1 })],
      [tr('company-ui.023'), s.companyStats.employeeDeliveries], [tr('company-ui.024'), s.companyStats.employeeFailures],
      [tr('company-ui.025'), `${s.companyStats.positiveEvents} / ${s.companyStats.negativeEvents}`], [tr('company-ui.026'), tr('company-ui.019', { v0: rubles(s.companyStats.highestIncomePerMinute) })],
      [tr('company-ui.027'), current.slots - s.employees.length], [tr('company-ui.028'), s.companyStats.employeesHired],
      [tr('company-ui.029'), s.companyVehicles.length], [tr('company-ui.030'), rubles(s.companyStats.totalIncomeCollected)] ]) {
      const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = label; dd.textContent = value; summary.append(dt, dd);
    }
    text(this.dialog, '#company-balance', rubles(s.companyBalance));
    text(this.dialog, '#company-storage', tr('company-ui.033', { v0: rubles(this.manager.storageLimit(s)), v1: COMPANY.storageCapMs / 3600000, v2: s.companyBalance >= this.manager.storageLimit(s) && s.employees.length ? tr('company-ui.031') : tr('company-ui.032') }));
    this.dialog.querySelector('#company-collect').disabled = s.companyBalance <= 0;
    text(this.dialog, '#company-capacity', tr('company-ui.034', { v0: s.employees.length, v1: current.slots, v2: current.slots - s.employees.length }));
    text(this.dialog, '#company-hire-status', s.employees.length >= current.slots ? tr('company-manager.010') : tr('company-ui.035'));
    this.renderCandidates(s);
    text(this.dialog, '#company-refresh', tr('company-ui.037', { v0: s.candidateRefreshes === 0 ? tr('company-ui.036') : rubles(COMPANY.refreshCost) }));
    text(this.dialog, '#company-upgrade-title', next ? `${current.name} → ${next.name}` : tr('company-ui.038', { v0: current.name }));
    text(this.dialog, '#company-upgrade-details', tr('company-ui.040', { v0: s.officeLevel, v1: next ? ` → ${next.level}` : '', v2: current.slots, v3: next ? ` → ${next.slots}` : '', v4: percent(current.bonus), v5: next ? tr('company-ui.039', { v0: percent(next.bonus), v1: rubles(next.price) }) : '' }));
    this.dialog.querySelector('#company-upgrade').disabled = !next;
    for (const [key, config] of Object.entries(COMPANY.upgrades)) {
      const card = this.dialog.querySelector(`[data-upgrade="${key}"]`), level = s.companyUpgrades[key], price = config.costs[level];
      const max = price === undefined;
      text(card, 'p', tr('company-ui.044', { v0: level, v1: max ? tr('company-ui.041') : ` → ${level + 1}`, v2: config.label, v3: percent(upgradeEffect(key, s)), v4: max ? '' : ` → +${percent(config.effects[level + 1])}`, v5: max ? tr('company-ui.042') : tr('company-ui.043', { v0: rubles(price) }) }));
      text(card, 'button', max ? tr('company-ui.045') : tr('company-ui.046', { v0: rubles(price) })); card.querySelector('button').disabled = max;
    }
    for (const vehicle of COMPANY.vehicles) {
      const owned = s.companyVehicles.filter(v => v.type === vehicle.type), used = owned.filter(v => s.employees.some(e => e.assignedTransport === v.id)).length;
      text(this.dialog, `[data-company-vehicle="${vehicle.type}"] [data-inventory]`, tr('company-ui.047', { v0: owned.length, v1: used, v2: owned.length - used }));
    }
    const log = this.dialog.querySelector('#company-log'); log.replaceChildren();
    for (const message of s.companyLog) { const item = document.createElement('li'); item.textContent = renderMessage(message); log.append(item); }
    this.renderEmployees(s);
  }

  renderCandidates(s) {
    const signature = JSON.stringify(s.companyCandidates), list = this.dialog.querySelector('#company-candidates');
    if (signature !== this.candidateSignature) {
      this.candidateSignature = signature; list.replaceChildren();
      if (!s.companyCandidates.length) { const note = document.createElement('p'); note.textContent = tr('company-ui.048'); list.append(note); }
      for (const candidate of s.companyCandidates) {
        const card = document.createElement('article'); card.className = 'shop-item'; card.dataset.candidate = candidate.id;
        card.innerHTML = tr('company-ui.049');
        text(card, 'h3', `${candidate.name} · ${archetypeFor(candidate.archetype).name}`);
        text(card, 'p', tr('company-ui.050', { v0: percent(candidate.efficiency), v1: percent(candidate.reliability), v2: percent(candidate.speed), v3: rubles(candidate.price) }));
        const config = archetypeFor(candidate.archetype);
        text(card, 'small', tr('company-ui.055', { v0: percent(config.offline), v1: candidate.archetype === 'FAST' ? tr('company-ui.051') : candidate.archetype === 'ACCURATE' ? tr('company-ui.052') : candidate.archetype === 'WORKAHOLIC' ? tr('company-ui.053') : tr('company-ui.054') }));
        card.querySelector('button').onclick = () => this.perform(() => this.manager.hire(candidate.id), tr('company-ui.056')); list.append(card);
      }
    }
    for (const button of list.querySelectorAll('button')) button.disabled = s.employees.length >= companyLevel(s.officeLevel).slots;
  }

  renderEmployees(s) {
    const signature = JSON.stringify([s.employees.map(e => [e.id, e.name, e.assignedTransport]), s.companyVehicles]);
    const list = this.dialog.querySelector('#company-employees');
    if (signature !== this.employeeSignature) {
      this.employeeSignature = signature; list.replaceChildren();
      if (!s.employees.length) { const note = document.createElement('p'); note.textContent = tr('company-ui.057'); list.append(note); }
      for (const employee of s.employees) {
        const card = document.createElement('article'); card.className = 'shop-item'; card.dataset.employee = employee.id;
        card.innerHTML = tr('company-ui.058');
        const select = card.querySelector('select');
        select.add(new Option(tr('company-ui.059'), ''));
        s.companyVehicles.forEach((vehicle, index) => {
          const assigned = s.employees.find(e => e.assignedTransport === vehicle.id && e.id !== employee.id);
          const option = new Option(`${companyVehicle(vehicle.type).name} №${index + 1}${assigned ? tr('company-ui.060', { v0: assigned.name }) : ''}`, vehicle.id);
          option.disabled = Boolean(assigned); select.add(option);
        });
        select.value = employee.assignedTransport || '';
        card.querySelector('button').onclick = () => this.perform(() => this.manager.assignVehicle(employee.id, select.value || null), tr('company-ui.061'));
        list.append(card);
      }
    }
    for (const employee of s.employees) {
      const card = list.querySelector(`[data-employee="${employee.id}"]`);
      const vehicle = s.companyVehicles.find(v => v.id === employee.assignedTransport);
      text(card, 'h3', tr('company-ui.017', { v0: employee.name, v1: employee.level }));
      const status = employee.status === 'WORKING' ? tr('company-ui.062') : employee.status === 'IDLE' ? tr('company-ui.063') : tr('company-ui.064', { v0: Math.ceil((employee.unavailableUntil - s.companyActiveTimeMs) / 1000) });
      text(card, '[data-employee-status]', tr('company-ui.065', { v0: archetypeFor(employee.archetype).name, v1: companyVehicle(vehicle?.type)?.name || tr('company-ui.059'), v2: rubles(this.manager.employeeRate(employee, s)), v3: status }));
      text(card, '[data-employee-earned]', tr('company-ui.066', { v0: percent(this.manager.employeeReliability(employee)), v1: rubles(employee.totalEarned) }));
      const detail = card.querySelector('[data-employee-detail]'); detail.replaceChildren();
      for (const [label, value] of [[tr('company-ui.067'), archetypeFor(employee.archetype).name], [tr('progression-config.005'), employee.level],
        [tr('company-config.035'), employee.level === COMPANY.employeeMaxLevel ? tr('company-ui.045') : `${Math.floor(employee.currentXp)} / ${employeeXpRequired(employee.level)}`],
        [tr('company-config.033'), percent(this.manager.employeeEfficiency(employee, s))], [tr('company-ui.068'), percent(this.manager.employeeReliability(employee))],
        [tr('company-ui.069'), percent(employee.speed)], [tr('company-ui.070'), companyVehicle(vehicle?.type)?.name || tr('company-ui.059')], [tr('company-config.031'), tr('company-ui.019', { v0: rubles(this.manager.employeeRate(employee, s)) })],
        [tr('company-ui.071'), rubles(employee.totalEarned)], [tr('company-ui.072'), employee.successfulDeliveries], [tr('company-ui.024'), employee.failedDeliveries],
        [tr('company-event-manager.010'), `${formatNumber(this.manager.failureChance(employee, s) * 100, { maximumFractionDigits: 1 })}%`], [tr('company-ui.073'), percent(archetypeFor(employee.archetype).offline)]]) {
        const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = label; dd.textContent = value; detail.append(dt, dd);
      }
      const f = this.manager.incomeFactors(employee, s);
      text(card, '[data-income-formula]', tr('company-ui.074', { v0: rubles(f.base), v1: formatNumber(f.transport, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), v2: formatNumber(f.efficiency, { minimumFractionDigits: 3, maximumFractionDigits: 3 }), v3: formatNumber(f.speed, { minimumFractionDigits: 3, maximumFractionDigits: 3 }), v4: formatNumber(f.office, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), v5: formatNumber(f.company, { minimumFractionDigits: 3, maximumFractionDigits: 3 }), v6: formatNumber(f.reliability, { minimumFractionDigits: 3, maximumFractionDigits: 3 }), v7: formatNumber(f.districts, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), v8: formatNumber(f.legacy, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), v9: formatNumber(f.event, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }));
    }
  }

  update() {
    if (this.manager.offlineEarned > 0 && !this.manager.offlineNoticeShown) this.pendingOffline = true;
    if (this.manager.offlineEarned <= 0) { this.pendingOffline = false; return; }
    if (!this.pendingOffline || document.querySelector('dialog[open]')) return;
    this.pendingOffline = false; this.manager.offlineNoticeShown = true;
    this.view = 'offline'; this.render(this.state.getSnapshot()); this.open();
  }
}
