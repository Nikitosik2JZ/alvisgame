import { ModalUI } from './ModalUI.js';
import { ACHIEVEMENTS, ACHIEVEMENT_CATEGORIES } from '../data/achievements.js';
import { CAREER_MILESTONES, GLOBAL_GOALS, RECORD_SETTINGS } from '../config/progressionConfig.js';
import { LEGACY_UPGRADES } from '../config/legacyConfig.js';
import { requirementsProgress, progressValue, completionRatio, rewardText, availableTitles } from '../managers/AchievementManager.js';

const number = n => Math.floor(n).toLocaleString('ru-RU');
const el = (tag, text, className) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; };
const STATES = { LOCKED: 'ЗАКРЫТО', IN_PROGRESS: 'В ПРОЦЕССЕ', COMPLETED: 'НАГРАДА ДОСТУПНА', CLAIMED: 'ПОЛУЧЕНО' };

export class ProgressUI extends ModalUI {
  constructor(scene, state, player) {
    super(scene, player, 'progress-dialog', 'open-progress');
    this.state = state; this.manager = state.progression; this.view = 'career'; this.category = ACHIEVEMENT_CATEGORIES[0];
    this.content = this.dialog.querySelector('#progress-content'); this.feedback = this.dialog.querySelector('#progress-feedback');
    this.dialog.querySelector('#magnate-celebration').hidden = true;
    this.onClick = event => {
      const button = event.target.closest('button'); if (!button) return;
      if (button.dataset.progressView) { this.view = button.dataset.progressView; this.render(); this.dialog.querySelector('.modal-content').scrollTop = 0; }
      if (button.dataset.category) { this.category = button.dataset.category; this.render(); }
    };
    this.dialog.addEventListener('click', this.onClick);
    this.onOpen = () => { this.feedback.textContent = ''; this.dialog.querySelector('#magnate-celebration').hidden = true; this.render(); this.showCelebration(); };
    this.opener.addEventListener('click', this.onOpen);
    this.unsubscribe = state.subscribe(() => { if (this.dialog.open && document.activeElement?.id !== 'progress-title-select') this.render(); });
    this.queue = []; this.toast = document.querySelector('#achievement-toast');
    this.unsubscribeEvents = this.manager.subscribe(event => {
      this.queue.push(event); if (!this.toastTimer) this.nextToast();
      if (event.definition.id === 'magnate' && this.dialog.open) this.showCelebration();
    });
    scene.events.once('shutdown', () => {
      this.unsubscribe(); this.unsubscribeEvents(); clearTimeout(this.toastTimer); this.toast.hidden = true;
      this.dialog.removeEventListener('click', this.onClick); this.opener.removeEventListener('click', this.onOpen);
    });
  }
  nextToast() {
    const event = this.queue.shift();
    if (!event) { this.toast.hidden = true; this.toastTimer = null; return; }
    this.toast.hidden = false;
    this.toast.textContent = `${event.type === 'achievement' ? 'ДОСТИЖЕНИЕ ОТКРЫТО' : 'НОВЫЙ ЭТАП КАРЬЕРЫ'}\n${event.definition.title.toUpperCase()}\n${event.definition.description || 'Титул открыт. Награда доступна в разделе ПРОГРЕСС.'}`;
    this.toastTimer = setTimeout(() => this.nextToast(), 4500);
  }
  showCelebration() {
    const s = this.state.values;
    if (!s.careerMilestones.includes('magnate') || s.magnateCelebrationSeen) return;
    this.dialog.querySelector('#magnate-celebration').hidden = false;
    this.manager.acknowledgeMagnate();
    this.dialog.querySelector('#magnate-continue').onclick = () => { this.dialog.querySelector('#magnate-celebration').hidden = true; };
  }
  perform(action) { const result = action(); this.feedback.textContent = result.ok ? 'Готово. Прогресс сохранён.' : result.reason; this.render(); }
  bar(root, rows) {
    for (const row of rows) {
      const label = `${row.label}: ${number(Math.min(row.current, row.target))} / ${number(row.target)}`;
      root.append(el('p', `${label}${row.current >= row.target ? ' ✓' : ''}`, 'progress-requirement'));
      const bar = el('progress'); bar.max = row.target; bar.value = row.current; bar.setAttribute('aria-label', label); root.append(bar);
    }
  }
  render() {
    const focused = document.activeElement;
    const focusSelector = this.content.contains(focused) ? focused.id ? `#${CSS.escape(focused.id)}`
      : focused.dataset.category ? `[data-category="${CSS.escape(focused.dataset.category)}"]`
      : focused.dataset.claim ? `[data-claim="${CSS.escape(focused.dataset.claim)}"]` : null : null;
    const scroll = this.dialog.querySelector('.modal-content'), scrollTop = scroll.scrollTop;
    const s = this.state.getSnapshot();
    const count = s.achievements.length, stages = s.careerMilestones.length;
    this.dialog.querySelector('#progress-summary').textContent = `ДОСТИЖЕНИЯ ${count} / ${ACHIEVEMENTS.length} · ${Math.floor(count / ACHIEVEMENTS.length * 100)}%  |  КАРЬЕРА ${stages} / ${CAREER_MILESTONES.length}`;
    for (const button of this.dialog.querySelectorAll('[data-progress-view]')) button.setAttribute('aria-pressed', String(button.dataset.progressView === this.view));
    this.content.replaceChildren();
    if (this.view === 'career') this.career(s);
    if (this.view === 'achievements') this.achievements(s);
    if (this.view === 'records') this.records(s);
    if (this.view === 'legacy') this.legacy(s);
    if (focusSelector) this.content.querySelector(focusSelector)?.focus({ preventScroll: true });
    scroll.scrollTop = scrollTop;
  }
  card(definition, s, career = false) {
    const status = this.manager.status(definition, career), hidden = definition.hidden && !s.achievements.includes(definition.id);
    const card = el('article', undefined, 'shop-item progress-card'); card.dataset.progressId = definition.id; card.dataset.state = status;
    card.append(el('small', STATES[status]), el('h3', hidden ? '???' : definition.title));
    if (!career) card.append(el('p', hidden ? 'Секретное достижение' : definition.description));
    if (!hidden) {
      this.bar(card, career ? requirementsProgress(s, definition) : [{ label: 'Прогресс', current: progressValue(s, definition.source), target: definition.target }]);
      card.append(el('p', `Награда: ${rewardText(definition.reward)}`, 'progress-reward'));
    }
    const button = el('button', status === 'CLAIMED' ? 'ПОЛУЧЕНО' : 'ПОЛУЧИТЬ НАГРАДУ');
    button.disabled = status !== 'COMPLETED'; button.dataset.claim = definition.id;
    button.onclick = () => this.perform(() => this.manager.claim(definition.id, career)); card.append(button);
    return card;
  }
  career(s) {
    const next = CAREER_MILESTONES.find(m => !s.careerMilestones.includes(m.id));
    this.content.append(el('p', next ? `Следующий этап: ${next.title}` : 'Вы стали Курьерским магнатом. Город продолжает жить.', 'modal-note'));
    const suggested = el('article', undefined, 'goal-card'); suggested.append(el('h3', 'ГЛАВНАЯ ЦЕЛЬ'), el('p', this.manager.suggestedGoal().title));
    this.bar(suggested, this.manager.suggestedRequirements()); this.content.append(suggested);
    const label = el('label', 'Видимый титул'); const select = el('select'); select.id = 'progress-title-select'; select.add(new Option('Текущий карьерный статус', ''));
    for (const title of availableTitles(s)) select.add(new Option(title.title, title.id));
    select.value = s.selectedTitle || ''; select.onchange = () => this.perform(() => this.manager.selectTitle(select.value || null));
    label.append(select); this.content.append(label, el('h3', 'ПУТЬ КАРЬЕРЫ'));
    for (const milestone of CAREER_MILESTONES) this.content.append(this.card(milestone, s, true));
    this.content.append(el('h3', 'БОЛЬШИЕ ЦЕЛИ'));
    for (const goal of GLOBAL_GOALS) {
      const card = el('article', undefined, 'shop-item'); card.append(el('h3', goal.title));
      const rows = requirementsProgress(s, goal); this.bar(card, rows);
      card.append(el('small', completionRatio(rows) === 1 ? 'ВЫПОЛНЕНО' : `${Math.floor(completionRatio(rows) * 100)}%`)); this.content.append(card);
    }
  }
  achievements(s) {
    const filter = el('nav', undefined, 'achievement-filters'); filter.setAttribute('aria-label', 'Категория достижений');
    for (const category of ACHIEVEMENT_CATEGORIES) {
      const button = el('button', category); button.dataset.category = category; button.setAttribute('aria-pressed', String(this.category === category)); filter.append(button);
    }
    this.content.append(filter);
    for (const a of ACHIEVEMENTS.filter(a => a.category === this.category)) this.content.append(this.card(a, s));
  }
  records(s) {
    const p = s.personalRecords, c = s.companyRecords;
    this.content.append(el('h3', 'ЛИЧНЫЕ РЕКОРДЫ'));
    const rows = [ ['Самая быстрая доставка', p.fastestDeliverySeconds === null ? 'Пока нет' : `${p.fastestDeliverySeconds.toFixed(1)} сек.`],
      ['Лучшая оплата доставки', `${number(p.highestDeliveryReward)} ₽`], ['Самые большие чаевые', `${number(p.biggestTip)} ₽`],
      ['Максимальный доход с заказа', `${number(p.mostMoneyInOrder)} ₽`], ['Максимальная репутация', number(p.highestReputation)], ['Максимальный уровень', number(p.highestLevel)],
      ['Всего доставок', number(s.completedOrders)], ['Провалено', number(s.failedOrders)], ['Личный доход за всё время', `${number(s.totalMoneyEarned)} ₽`],
      ['Расстояние доставок', `${number(s.totalDistanceDelivered)} м`], ['Редкие события', number(s.eventCounters.rareEvents)] ];
    const addRows = entries => { const dl = el('dl', undefined, 'company-summary'); for (const [label, value] of entries) dl.append(el('dt', label), el('dd', value)); this.content.append(dl); };
    addRows(rows);
    addRows([['Лучшая серия доставок', number(s.bestDeliveryStreak)], ['Ежедневных заданий выполнено', number(s.dailyTasksCompleted)],
      ['Челленджей выполнено', number(s.totalChallengesCompleted)], ['Особых заданий выполнено', number(s.rotatingChallengesCompleted)]]);
    this.content.append(el('p', `Рекорд скорости: успешный маршрут от ${RECORD_SETTINGS.minimumRouteMeters} м. Время с принятия заказа, включая ожидание и события.`, 'modal-note'), el('h3', 'РЕКОРДЫ КОМПАНИИ'));
    addRows([['Рекорд дохода / мин.', `${number(s.companyStats.highestIncomePerMinute)} ₽`], ['Доход за всё время', `${number(s.companyLifetimeEarnings)} ₽`],
      ['Сотрудников одновременно', number(c.mostEmployees)], ['Максимальный уровень сотрудника', number(c.highestEmployeeLevel)], ['Лучший доход сотрудника', `${number(c.bestEmployeeEarnings)} ₽`]]);
  }
  legacy(s) {
    this.content.append(el('h3', `Очки наследия: ${s.legacyPoints}`), el('p', `Получено за всё время: ${s.legacyPointsEarned}. Награды за крупные этапы и достижения нужно забрать вручную.`, 'modal-note'),
      el('p', 'Постоянные улучшения. Деньги, транспорт, компания, сотрудники, районы и уровни сохраняются.', 'goal-card'));
    for (const u of LEGACY_UPGRADES) {
      const card = el('article', undefined, 'shop-item'); card.dataset.legacy = u.id;
      card.append(el('h3', u.title), el('p', u.description), el('small', `${u.cost} очк. наследия`));
      const owned = s.legacyUpgrades.includes(u.id), button = el('button', owned ? 'ИЗУЧЕНО' : 'ОТКРЫТЬ');
      button.disabled = owned || s.legacyPoints < u.cost; button.onclick = () => this.perform(() => this.manager.buyLegacy(u.id));
      card.append(button); this.content.append(card);
    }
  }
}
