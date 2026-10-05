import { ModalUI } from './ModalUI.js';
import { COMPANY, companyLevel, companyVehicle } from '../config/companyConfig.js';

const rubles = value => `${Math.floor(value).toLocaleString('ru-RU')} ₽`;
const text = (root, selector, value) => { root.querySelector(selector).textContent = value; };

export class CompanyUI extends ModalUI {
  constructor(scene, manager, state, player) {
    super(scene, player, 'company-dialog', 'open-company');
    this.manager = manager; this.state = state; this.view = 'dashboard'; this.candidate = manager.candidate();
    this.pendingOffline = manager.offlineEarned > 0 && !manager.offlineNoticeShown; this.employeeSignature = null;
    this.nameInput = this.dialog.querySelector('#company-name'); this.nameInput.maxLength = COMPANY.nameLimit;
    this.nameInput.value = state.getSnapshot().companyName;
    text(this.dialog, '#company-name-hint', `До ${COMPANY.nameLimit} символов. Пустое название: «${COMPANY.defaultName}».`);
    this.perform = (action, success) => {
      const result = action();
      text(this.dialog, '#company-feedback', result.ok ? success : result.reason);
      return result;
    };
    this.dialog.querySelector('#company-name-form').onsubmit = event => {
      event.preventDefault();
      if (state.getSnapshot().companyUnlocked) {
        if (this.perform(() => manager.rename(this.nameInput.value), 'Название сохранено.').ok) this.nameInput.value = state.getSnapshot().companyName;
      }
      else this.dialog.querySelector('#company-open').click();
    };
    this.dialog.querySelector('#company-open').onclick = () => {
      if (this.perform(() => manager.openCompany(this.nameInput.value), 'Компания открыта!').ok) {
        this.view = 'celebration'; this.render(state.getSnapshot()); this.dialog.querySelector('#company-begin').focus();
      }
    };
    const dashboard = () => { this.view = 'dashboard'; this.render(state.getSnapshot()); this.dialog.querySelector('[data-company-view="dashboard"]').focus(); };
    this.dialog.querySelector('#company-begin').onclick = dashboard;
    this.dialog.querySelector('#company-offline-later').onclick = dashboard;
    const collect = () => this.perform(() => manager.collect(), 'Доход переведён на ваш личный баланс.');
    this.dialog.querySelector('#company-collect').onclick = collect;
    this.dialog.querySelector('#company-offline-collect').onclick = () => { if (collect().ok) dashboard(); };
    this.dialog.querySelector('#company-hire').onclick = () => {
      if (this.perform(() => manager.hire(this.candidate), 'Курьер вышел на линию!').ok) { this.candidate = manager.candidate(); this.render(state.getSnapshot()); }
    };
    this.dialog.querySelector('#company-upgrade').onclick = () => this.perform(() => manager.upgrade(), 'Компания улучшена. Открыты новые места!');
    for (const button of this.dialog.querySelectorAll('[data-company-view]')) button.onclick = () => {
      this.view = button.dataset.companyView; this.render(state.getSnapshot()); this.dialog.querySelector('.modal-content').scrollTop = 0;
    };
    const fleet = this.dialog.querySelector('#company-vehicles'); fleet.replaceChildren();
    for (const vehicle of COMPANY.vehicles) {
      const card = document.createElement('article'); card.className = 'shop-item'; card.dataset.companyVehicle = vehicle.type;
      card.innerHTML = '<h3></h3><p data-inventory></p><p data-rate></p><button></button>';
      card.querySelector('h3').textContent = vehicle.name;
      card.querySelector('[data-rate]').textContent = `Доход новичка: ${rubles(COMPANY.baseIncome * COMPANY.transportMultipliers[vehicle.type])} / мин`;
      const button = card.querySelector('button'); button.textContent = `КУПИТЬ — ${rubles(vehicle.price)}`;
      button.onclick = () => this.perform(() => manager.buyVehicle(vehicle.type), 'Транспорт куплен для компании. Назначьте его курьеру.');
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
    const current = companyLevel(s.companyLevel), next = COMPANY.levels.find(level => level.level === s.companyLevel + 1);
    this.dialog.querySelector('#company-locked').hidden = unlocked || special;
    this.dialog.querySelector('#company-business').hidden = !unlocked || special;
    this.dialog.querySelector('#company-celebration').hidden = this.view !== 'celebration';
    this.dialog.querySelector('#company-offline').hidden = this.view !== 'offline';
    this.dialog.querySelector('#company-name-form').hidden = special || (unlocked && this.view !== 'dashboard');
    this.dialog.querySelector('#company-rename').hidden = !unlocked;
    if (this.previousName !== s.companyName) { this.nameInput.value = s.companyName; this.previousName = s.companyName; }
    text(this.dialog, '#company-wallet', `Личные деньги: ${rubles(s.money)} · Уровень ${s.level}`);
    text(this.dialog, '#company-requirements', `Требуется уровень ${COMPANY.unlockLevel} · Ваш: ${s.level}\nСтоимость открытия: ${rubles(COMPANY.unlockPrice)}\nНе хватает: ${rubles(Math.max(0, COMPANY.unlockPrice - s.money))}`);
    // Keep the action usable so unmet requirements have an explicit explanation.
    text(this.dialog, '#company-display-name', `«${s.companyName}»`);
    text(this.dialog, '#company-offline-earned', `Ваши курьеры заработали ${rubles(this.manager.offlineEarned)}. Всего накоплено: ${rubles(s.companyBalance)}.`);
    text(this.dialog, '#company-offline-limit', `Доход за отсутствие — максимум ${COMPANY.offlineCapMs / 3600000} ч. Кнопка забирает весь накопленный баланс.`);
    for (const panel of this.dialog.querySelectorAll('[data-company-panel]')) panel.hidden = panel.dataset.companyPanel !== this.view;
    for (const button of this.dialog.querySelectorAll('[data-company-view]')) button.setAttribute('aria-pressed', String(button.dataset.companyView === this.view));
    const summary = this.dialog.querySelector('#company-summary'); summary.replaceChildren();
    for (const [label, value] of [ ['Уровень компании', s.companyLevel], ['Курьеров', `${s.employees.length} / ${current.slots}`],
      ['Доход компании', `${rubles(this.manager.incomeRate(s))} / мин`], ['Заработано компанией', rubles(s.companyLifetimeEarnings)],
      ['Свободных мест', current.slots - s.employees.length], ['Нанято за всё время', s.companyStats.employeesHired],
      ['Транспорта компании', s.companyVehicles.length], ['Забрано дохода', rubles(s.companyStats.totalIncomeCollected)] ]) {
      const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = label; dd.textContent = value; summary.append(dt, dd);
    }
    text(this.dialog, '#company-balance', rubles(s.companyBalance));
    text(this.dialog, '#company-storage', `Хранилище: до ${rubles(this.manager.storageLimit(s))} (${COMPANY.storageCapMs / 3600000} ч дохода). ${s.companyBalance >= this.manager.storageLimit(s) && s.employees.length ? 'Заполнено — заберите деньги.' : 'Доход ожидает сбора.'}`);
    this.dialog.querySelector('#company-collect').disabled = s.companyBalance <= 0;
    text(this.dialog, '#company-capacity', `Курьеров: ${s.employees.length} / ${current.slots} · Свободных мест: ${current.slots - s.employees.length}`);
    text(this.dialog, '#company-candidate', this.candidate.name);
    text(this.dialog, '#company-candidate-details', `Опыт: новичок · Эффективность: 100%\nПешком: ${rubles(COMPANY.baseIncome)} / мин · Найм: ${rubles(COMPANY.hireCost)}`);
    text(this.dialog, '#company-hire-status', s.employees.length >= current.slots ? 'НЕТ СВОБОДНЫХ МЕСТ. Улучшите компанию.' : 'Без транспорта курьер работает пешком.');
    this.dialog.querySelector('#company-hire').disabled = s.employees.length >= current.slots;
    text(this.dialog, '#company-upgrade-title', next ? `УРОВЕНЬ ${s.companyLevel} → ${next.level}` : `УРОВЕНЬ ${s.companyLevel} · МАКСИМУМ`);
    text(this.dialog, '#company-upgrade-details', next ? `Курьеров: ${current.slots} → ${next.slots}\nСтоимость: ${rubles(next.price)} · Новый статус: ${next.careerTitle}` : `Доступно ${current.slots} мест. Все улучшения этого этапа открыты.`);
    this.dialog.querySelector('#company-upgrade').disabled = !next;
    for (const vehicle of COMPANY.vehicles) {
      const owned = s.companyVehicles.filter(v => v.type === vehicle.type), used = owned.filter(v => s.employees.some(e => e.assignedTransport === v.id)).length;
      text(this.dialog, `[data-company-vehicle="${vehicle.type}"] [data-inventory]`, `Всего: ${owned.length} · Используется: ${used} · Свободно: ${owned.length - used}`);
    }
    const log = this.dialog.querySelector('#company-log'); log.replaceChildren();
    for (const message of s.companyLog) { const item = document.createElement('li'); item.textContent = message; log.append(item); }
    this.renderEmployees(s);
  }

  renderEmployees(s) {
    const signature = JSON.stringify([s.employees.map(e => [e.id, e.name, e.assignedTransport]), s.companyVehicles]);
    const list = this.dialog.querySelector('#company-employees');
    if (signature !== this.employeeSignature) {
      this.employeeSignature = signature; list.replaceChildren();
      if (!s.employees.length) { const note = document.createElement('p'); note.textContent = 'Курьеров пока нет. Наймите первого помощника.'; list.append(note); }
      for (const employee of s.employees) {
        const card = document.createElement('article'); card.className = 'shop-item'; card.dataset.employee = employee.id;
        card.innerHTML = '<h3></h3><p data-employee-status></p><p data-employee-earned></p><label>Транспорт курьера<select></select></label><button>НАЗНАЧИТЬ ТРАНСПОРТ</button>';
        card.querySelector('h3').textContent = employee.name;
        const select = card.querySelector('select');
        select.add(new Option('Пешком', ''));
        s.companyVehicles.forEach((vehicle, index) => {
          const assigned = s.employees.find(e => e.assignedTransport === vehicle.id && e.id !== employee.id);
          const option = new Option(`${companyVehicle(vehicle.type).name} №${index + 1}${assigned ? ` · занят: ${assigned.name}` : ''}`, vehicle.id);
          option.disabled = Boolean(assigned); select.add(option);
        });
        select.value = employee.assignedTransport || '';
        card.querySelector('button').onclick = () => this.perform(() => this.manager.assignVehicle(employee.id, select.value || null), 'Транспорт назначен.');
        list.append(card);
      }
    }
    for (const employee of s.employees) {
      const card = list.querySelector(`[data-employee="${employee.id}"]`);
      const vehicle = s.companyVehicles.find(v => v.id === employee.assignedTransport);
      text(card, '[data-employee-status]', `${companyVehicle(vehicle?.type)?.name || 'Пешком'} · ${rubles(this.manager.employeeRate(employee, s))} / мин · ${employee.status === 'WORKING' ? 'РАБОТАЕТ' : 'ОЖИДАЕТ'}`);
      text(card, '[data-employee-earned]', `Уровень ${employee.level} · Эффективность: ${Math.round(employee.efficiency * 100)}% · Заработал: ${rubles(employee.totalEarned)}`);
    }
  }

  update() {
    if (this.manager.offlineEarned <= 0) { this.pendingOffline = false; return; }
    if (!this.pendingOffline || document.querySelector('dialog[open]')) return;
    this.pendingOffline = false; this.manager.offlineNoticeShown = true;
    this.view = 'offline'; this.render(this.state.getSnapshot()); this.open();
  }
}
