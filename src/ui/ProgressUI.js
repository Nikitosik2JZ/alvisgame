import { formatNumber } from '../services/LocalizationService.js';
import { t as tr } from '../services/LocalizationService.js';
import { ModalUI } from './ModalUI.js';
import { ACHIEVEMENTS, ACHIEVEMENT_CATEGORIES } from '../data/achievements.js';
import { CAREER_MILESTONES, GLOBAL_GOALS, RECORD_SETTINGS } from '../config/progressionConfig.js';
import { LEGACY_UPGRADES } from '../config/legacyConfig.js';
import { requirementsProgress, progressValue, completionRatio, rewardText, availableTitles } from '../managers/AchievementManager.js';

const number = n => formatNumber(Math.floor(n));
const el = (tag, text, className) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; };
const STATES = { LOCKED: tr('progress-ui.001'), IN_PROGRESS: tr('progress-ui.002'), COMPLETED: tr('progress-ui.003'), CLAIMED: tr('progress-ui.004') };

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
    this.toast.textContent = `${event.type === 'achievement' ? tr('progress-ui.005') : tr('progress-ui.006')}\n${event.definition.title.toUpperCase()}\n${event.definition.description || tr('progress-ui.007')}`;
    this.toastTimer = setTimeout(() => this.nextToast(), 4500);
  }
  showCelebration() {
    const s = this.state.values;
    if (!s.careerMilestones.includes('magnate') || s.magnateCelebrationSeen) return;
    this.dialog.querySelector('#magnate-celebration').hidden = false;
    this.manager.acknowledgeMagnate();
    this.dialog.querySelector('#magnate-continue').onclick = () => { this.dialog.querySelector('#magnate-celebration').hidden = true; };
  }
  perform(action) { const result = action(); this.feedback.textContent = result.ok ? tr('progress-ui.008') : result.reason; this.render(); }
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
    this.dialog.querySelector('#progress-summary').textContent = tr('progress-ui.009', { v0: count, v1: ACHIEVEMENTS.length, v2: Math.floor(count / ACHIEVEMENTS.length * 100), v3: stages, v4: CAREER_MILESTONES.length });
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
    if (!career) card.append(el('p', hidden ? tr('progress-ui.010') : definition.description));
    if (!hidden) {
      this.bar(card, career ? requirementsProgress(s, definition) : [{ label: tr('progress-ui.011'), current: progressValue(s, definition.source), target: definition.target }]);
      card.append(el('p', tr('progress-ui.012', { v0: rewardText(definition.reward) }), 'progress-reward'));
    }
    const button = el('button', status === 'CLAIMED' ? tr('progress-ui.004') : tr('progress-ui.013'));
    button.disabled = status !== 'COMPLETED'; button.dataset.claim = definition.id;
    button.onclick = () => this.perform(() => this.manager.claim(definition.id, career)); card.append(button);
    return card;
  }
  career(s) {
    const next = CAREER_MILESTONES.find(m => !s.careerMilestones.includes(m.id));
    this.content.append(el('p', next ? tr('progress-ui.014', { v0: next.title }) : tr('progress-ui.015'), 'modal-note'));
    const suggested = el('article', undefined, 'goal-card'); suggested.append(el('h3', tr('progress-ui.016')), el('p', this.manager.suggestedGoal().title));
    this.bar(suggested, this.manager.suggestedRequirements()); this.content.append(suggested);
    const label = el('label', tr('progress-ui.017')); const select = el('select'); select.id = 'progress-title-select'; select.add(new Option(tr('progress-ui.018'), ''));
    for (const title of availableTitles(s)) select.add(new Option(title.title, title.id));
    select.value = s.selectedTitle || ''; select.onchange = () => this.perform(() => this.manager.selectTitle(select.value || null));
    label.append(select); this.content.append(label, el('h3', tr('progress-ui.019')));
    for (const milestone of CAREER_MILESTONES) this.content.append(this.card(milestone, s, true));
    this.content.append(el('h3', tr('progress-ui.020')));
    for (const goal of GLOBAL_GOALS) {
      const card = el('article', undefined, 'shop-item'); card.append(el('h3', goal.title));
      const rows = requirementsProgress(s, goal); this.bar(card, rows);
      card.append(el('small', completionRatio(rows) === 1 ? tr('progress-ui.021') : `${Math.floor(completionRatio(rows) * 100)}%`)); this.content.append(card);
    }
  }
  achievements(s) {
    const filter = el('nav', undefined, 'achievement-filters'); filter.setAttribute('aria-label', tr('progress-ui.022'));
    for (const category of ACHIEVEMENT_CATEGORIES) {
      const button = el('button', category); button.dataset.category = category; button.setAttribute('aria-pressed', String(this.category === category)); filter.append(button);
    }
    this.content.append(filter);
    for (const a of ACHIEVEMENTS.filter(a => a.category === this.category)) this.content.append(this.card(a, s));
  }
  records(s) {
    const p = s.personalRecords, c = s.companyRecords;
    this.content.append(el('h3', tr('progress-ui.023')));
    const rows = [ [tr('progress-ui.024'), p.fastestDeliverySeconds === null ? tr('progress-ui.025') : tr('progress-ui.026', { v0: formatNumber(p.fastestDeliverySeconds, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) })],
      [tr('progress-ui.027'), `${number(p.highestDeliveryReward)} ₽`], [tr('progress-ui.028'), `${number(p.biggestTip)} ₽`],
      [tr('progress-ui.029'), `${number(p.mostMoneyInOrder)} ₽`], [tr('progress-ui.030'), number(p.highestReputation)], [tr('progress-ui.031'), number(p.highestLevel)],
      [tr('progress-ui.032'), number(s.completedOrders)], [tr('company-ui.024'), number(s.failedOrders)], [tr('progression-config.016'), `${number(s.totalMoneyEarned)} ₽`],
      [tr('progress-ui.033'), tr('player-profile-ui.016', { v0: number(s.totalDistanceDelivered) })], [tr('progress-ui.034'), number(s.eventCounters.rareEvents)] ];
    const addRows = entries => { const dl = el('dl', undefined, 'company-summary'); for (const [label, value] of entries) dl.append(el('dt', label), el('dd', value)); this.content.append(dl); };
    addRows(rows);
    addRows([[tr('progress-ui.035'), number(s.bestDeliveryStreak)], [tr('progress-ui.036'), number(s.dailyTasksCompleted)],
      [tr('progress-ui.037'), number(s.totalChallengesCompleted)], [tr('progress-ui.038'), number(s.rotatingChallengesCompleted)]]);
    this.content.append(el('p', tr('progress-ui.039', { v0: RECORD_SETTINGS.minimumRouteMeters }), 'modal-note'), el('h3', tr('progress-ui.040')));
    addRows([[tr('progress-ui.041'), `${number(s.companyStats.highestIncomePerMinute)} ₽`], [tr('progress-ui.042'), `${number(s.companyLifetimeEarnings)} ₽`],
      [tr('progress-ui.043'), number(c.mostEmployees)], [tr('progress-ui.044'), number(c.highestEmployeeLevel)], [tr('progress-ui.045'), `${number(c.bestEmployeeEarnings)} ₽`]]);
  }
  legacy(s) {
    this.content.append(el('h3', tr('progress-ui.046', { v0: s.legacyPoints })), el('p', tr('progress-ui.047', { v0: s.legacyPointsEarned }), 'modal-note'),
      el('p', tr('progress-ui.048'), 'goal-card'));
    for (const u of LEGACY_UPGRADES) {
      const card = el('article', undefined, 'shop-item'); card.dataset.legacy = u.id;
      card.append(el('h3', u.title), el('p', u.description), el('small', tr('progress-ui.049', { v0: u.cost })));
      const owned = s.legacyUpgrades.includes(u.id), button = el('button', owned ? tr('progress-ui.050') : tr('progress-ui.051'));
      button.disabled = owned || s.legacyPoints < u.cost; button.onclick = () => this.perform(() => this.manager.buyLegacy(u.id));
      card.append(button); this.content.append(card);
    }
  }
}
