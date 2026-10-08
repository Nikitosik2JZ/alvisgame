import { formatNumber } from '../services/LocalizationService.js';
import { t as tr, localization } from '../services/LocalizationService.js';
import { ModalUI } from './ModalUI.js';
import { TASK_CONFIG } from '../config/taskConfig.js';
import { rewardText } from '../managers/AchievementManager.js';
const el = (tag, text, className) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; };

export class TasksUI extends ModalUI {
  constructor(scene, state, player) {
    super(scene, player, 'tasks-dialog', 'open-tasks');
    this.state = state; this.manager = state.tasks; this.view = 'daily'; this.content = this.dialog.querySelector('#tasks-content'); this.feedback = this.dialog.querySelector('#tasks-feedback');
    this.toast = document.querySelector('#task-toast'); this.queue = [];
    this.onOpen = () => { this.manager.checkDate(); this.feedback.textContent = ''; this.render(); };
    this.opener.addEventListener('click', this.onOpen);
    this.onTab = event => { const button = event.target.closest('[data-task-view]'); if (button) { this.view = button.dataset.taskView; this.render(); this.dialog.querySelector('.modal-content').scrollTop = 0; } };
    this.dialog.addEventListener('click', this.onTab);
    this.unsubscribe = state.subscribe(s => {
      const count = this.manager.pendingRewards(); this.opener.querySelector('span').textContent = tr('tasks-ui.001', { v0: count ? ` • ${count}` : '' });
      const streak = document.querySelector('#delivery-streak'); streak.hidden = s.currentDeliveryStreak < TASK_CONFIG.streakHUDMinimum; streak.textContent = `🔥 ${s.currentDeliveryStreak}`;
      if (this.dialog.open) this.render();
    });
    this.unsubscribeEvents = this.manager.subscribe(event => { if (this.queue.length < 3) this.queue.push(event.text); if (!this.toastTimer) this.nextToast(); });
    this.dateTimer = setInterval(() => this.manager.checkDate(), 30000);
    this.onFocus = () => this.manager.checkDate(); window.addEventListener('focus', this.onFocus); document.addEventListener('visibilitychange', this.onFocus);
    scene.events.once('shutdown', () => {
      this.unsubscribe(); this.unsubscribeEvents(); clearTimeout(this.toastTimer); clearInterval(this.dateTimer); this.toast.hidden = true;
      window.removeEventListener('focus', this.onFocus); document.removeEventListener('visibilitychange', this.onFocus);
      this.opener.removeEventListener('click', this.onOpen); this.dialog.removeEventListener('click', this.onTab);
    });
  }
  nextToast() {
    const message = this.queue.shift(); if (!message) { this.toast.hidden = true; this.toastTimer = null; return; }
    this.toast.hidden = false; this.toast.textContent = message; this.toastTimer = setTimeout(() => this.nextToast(), 4000);
  }
  perform(action) { const result = action(); this.feedback.textContent = result.ok ? tr('progress-ui.008') : result.reason; this.render(); }
  button(parent, text, id, action, disabled = false) {
    const button = el('button', text); button.dataset.taskAction = id; button.disabled = disabled; button.onclick = () => this.perform(action); parent.append(button); return button;
  }
  card(task, group) {
    const card = el('article', undefined, 'shop-item task-card'); card.dataset.taskId = task.id;
    card.append(el('small', task.claimed ? tr('progress-ui.004') : task.completed ? tr('progress-ui.003') : tr('progress-ui.002')), el('h3', task.title), el('p', task.description));
    const label = `${formatNumber(task.currentProgress)} / ${formatNumber(task.target)}`;
    card.append(el('p', label)); const bar = el('progress'); bar.max = task.target; bar.value = task.currentProgress; bar.setAttribute('aria-label', `${task.title}: ${label}`); card.append(bar);
    card.append(el('p', tr('progress-ui.012', { v0: rewardText(task.reward) }), 'progress-reward'));
    this.button(card, task.claimed ? tr('progress-ui.004') : tr('tasks-ui.002'), `${group}:${task.id}`, () => this.manager.claim(task.id, group), !task.completed || task.claimed); this.content.append(card);
  }
  render() {
    const focused = document.activeElement?.dataset.taskAction, scroll = this.dialog.querySelector('.modal-content'), position = scroll.scrollTop;
    const s = this.state.values; this.content.replaceChildren();
    for (const button of this.dialog.querySelectorAll('[data-task-view]')) button.setAttribute('aria-pressed', String(button.dataset.taskView === this.view));
    if (s.level >= TASK_CONFIG.unlock.daily && !s.tasksIntroductionSeen) {
      const intro = el('article', undefined, 'goal-card'); intro.append(el('h3', tr('tasks-ui.003')), el('p', tr('tasks-ui.004')));
      this.button(intro, tr('company-event-ui.002'), 'intro', () => { s.tasksIntroductionSeen = true; this.state.refresh(); return { ok: true }; }); this.content.append(intro);
    }
    if (this.view === 'daily') {
      const bonus = el('article', undefined, 'shop-item'); bonus.append(el('h3', tr('tasks-ui.005')), el('p', rewardText(this.manager.bonusReward)), el('small', tr('tasks-ui.006')));
      this.button(bonus, this.manager.canClaimBonus() ? tr('tasks-ui.002') : tr('progress-ui.004'), 'bonus', () => this.manager.claimDailyBonus(), !this.manager.canClaimBonus()); this.content.append(bonus);
      if (s.level < TASK_CONFIG.unlock.daily) this.content.append(el('p', tr('tasks-ui.007', { v0: TASK_CONFIG.unlock.daily }), 'modal-note'));
      else {
        this.content.append(el('p', tr('tasks-ui.008'), 'modal-note'));
        for (const task of s.dailyTasks) this.card(task, 'daily');
        const completion = el('article', undefined, 'goal-card'); completion.append(el('h3', tr('tasks-ui.009')), el('p', rewardText(this.manager.completionReward)));
        this.button(completion, s.dailyTaskCompletionBonusClaimed ? tr('progress-ui.004') : tr('tasks-ui.010'), 'completion', () => this.manager.claimCompletionBonus(), !s.dailyTaskSetCompleted || s.dailyTaskCompletionBonusClaimed); this.content.append(completion);
      }
    }
    if (this.view === 'challenges') {
      this.content.append(el('h3', tr('tasks-ui.011')), el('p', tr('tasks-ui.012'), 'modal-note'));
      const session = this.manager.currentSessionChallenge;
      if (session?.accepted) this.card(session, 'session');
      else if (session) {
        const offer = el('article', undefined, 'shop-item'); offer.append(el('h3', tr('tasks-ui.013', { v0: session.title })), el('p', session.description), el('p', rewardText(session.reward)));
        this.button(offer, tr('company-events.036'), 'accept-session', () => this.manager.acceptSession()); this.button(offer, tr('tasks-ui.014'), 'later-session', () => this.manager.declineSession()); this.content.append(offer);
      } else this.content.append(el('p', s.level < TASK_CONFIG.unlock.session ? tr('tasks-ui.015', { v0: TASK_CONFIG.unlock.session }) : tr('tasks-ui.016')));
      this.content.append(el('h3', tr('tasks-ui.017')));
      if (s.rotatingChallenge) this.card(s.rotatingChallenge, 'rotating');
      else this.content.append(el('p', tr('tasks-ui.015', { v0: TASK_CONFIG.unlock.rotating })));
      this.content.append(el('p', tr('tasks-ui.018'), 'modal-note'));
    }
    if (this.view === 'streak') {
      this.content.append(el('h3', tr('tasks-ui.019', { v0: s.currentDeliveryStreak })), el('p', tr('tasks-ui.020', { v0: s.bestDeliveryStreak })), el('p', tr('tasks-ui.021')));
      for (const m of TASK_CONFIG.streakMilestones) this.content.append(el('p', tr('tasks-ui.023', { v0: localization.plural('count.deliveries', m.count), v1: [m.xp && tr('common.xpReward', { amount: m.xp }), m.moneyBonus && tr('tasks-ui.022', { v0: Math.round(m.moneyBonus * 100) }), m.reputation && tr('achievement-manager.001', { v0: m.reputation })].filter(Boolean).join(' · ') }), 'goal-card'));
      this.content.append(el('p', tr('tasks-ui.024', { v0: TASK_CONFIG.streakBonusCap * 100 })));
    }
    if (focused) this.content.querySelector(`[data-task-action="${CSS.escape(focused)}"]`)?.focus({ preventScroll: true }); scroll.scrollTop = position;
  }
}
