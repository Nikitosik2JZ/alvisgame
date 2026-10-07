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
      const count = this.manager.pendingRewards(); this.opener.querySelector('span').textContent = `ЗАДАНИЯ${count ? ` • ${count}` : ''}`;
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
  perform(action) { const result = action(); this.feedback.textContent = result.ok ? 'Готово. Прогресс сохранён.' : result.reason; this.render(); }
  button(parent, text, id, action, disabled = false) {
    const button = el('button', text); button.dataset.taskAction = id; button.disabled = disabled; button.onclick = () => this.perform(action); parent.append(button); return button;
  }
  card(task, group) {
    const card = el('article', undefined, 'shop-item task-card'); card.dataset.taskId = task.id;
    card.append(el('small', task.claimed ? 'ПОЛУЧЕНО' : task.completed ? 'НАГРАДА ДОСТУПНА' : 'В ПРОЦЕССЕ'), el('h3', task.title), el('p', task.description));
    const label = `${task.currentProgress.toLocaleString('ru-RU')} / ${task.target.toLocaleString('ru-RU')}`;
    card.append(el('p', label)); const bar = el('progress'); bar.max = task.target; bar.value = task.currentProgress; bar.setAttribute('aria-label', `${task.title}: ${label}`); card.append(bar);
    card.append(el('p', `Награда: ${rewardText(task.reward)}`, 'progress-reward'));
    this.button(card, task.claimed ? 'ПОЛУЧЕНО' : 'ЗАБРАТЬ', `${group}:${task.id}`, () => this.manager.claim(task.id, group), !task.completed || task.claimed); this.content.append(card);
  }
  render() {
    const focused = document.activeElement?.dataset.taskAction, scroll = this.dialog.querySelector('.modal-content'), position = scroll.scrollTop;
    const s = this.state.values; this.content.replaceChildren();
    for (const button of this.dialog.querySelectorAll('[data-task-view]')) button.setAttribute('aria-pressed', String(button.dataset.taskView === this.view));
    if (s.level >= TASK_CONFIG.unlock.daily && !s.tasksIntroductionSeen) {
      const intro = el('article', undefined, 'goal-card'); intro.append(el('h3', 'ЗАДАНИЯ'), el('p', 'Каждый день появляются новые цели. Выполняйте их во время обычной игры и получайте дополнительные награды. Пропустили день? Ничего страшного.'));
      this.button(intro, 'ПОНЯТНО', 'intro', () => { s.tasksIntroductionSeen = true; this.state.refresh(); return { ok: true }; }); this.content.append(intro);
    }
    if (this.view === 'daily') {
      const bonus = el('article', undefined, 'shop-item'); bonus.append(el('h3', 'ЕЖЕДНЕВНЫЙ БОНУС'), el('p', rewardText(this.manager.bonusReward)), el('small', 'Один бонус на календарный день. Пропуски ничего не отнимают.'));
      this.button(bonus, this.manager.canClaimBonus() ? 'ЗАБРАТЬ' : 'ПОЛУЧЕНО', 'bonus', () => this.manager.claimDailyBonus(), !this.manager.canClaimBonus()); this.content.append(bonus);
      if (s.level < TASK_CONFIG.unlock.daily) this.content.append(el('p', `Ежедневные задания откроются на уровне ${TASK_CONFIG.unlock.daily}.`, 'modal-note'));
      else {
        this.content.append(el('p', '3 цели на день. Играйте в своём темпе; новые задания появятся в следующий календарный день.', 'modal-note'));
        for (const task of s.dailyTasks) this.card(task, 'daily');
        const completion = el('article', undefined, 'goal-card'); completion.append(el('h3', 'ВСЕ ЗАДАНИЯ ВЫПОЛНЕНЫ'), el('p', rewardText(this.manager.completionReward)));
        this.button(completion, s.dailyTaskCompletionBonusClaimed ? 'ПОЛУЧЕНО' : 'ЗАБРАТЬ БОНУС', 'completion', () => this.manager.claimCompletionBonus(), !s.dailyTaskSetCompleted || s.dailyTaskCompletionBonusClaimed); this.content.append(completion);
      }
    }
    if (this.view === 'challenges') {
      this.content.append(el('h3', 'ЧЕЛЛЕНДЖ СЕССИИ'), el('p', 'Участие по желанию. Новый челлендж — через две доставки после получения награды или выбора «Позже».', 'modal-note'));
      const session = this.manager.currentSessionChallenge;
      if (session?.accepted) this.card(session, 'session');
      else if (session) {
        const offer = el('article', undefined, 'shop-item'); offer.append(el('h3', 'НОВЫЙ ЧЕЛЛЕНДЖ · ' + session.title), el('p', session.description), el('p', rewardText(session.reward)));
        this.button(offer, 'ПРИНЯТЬ', 'accept-session', () => this.manager.acceptSession()); this.button(offer, 'ПОЗЖЕ', 'later-session', () => this.manager.declineSession()); this.content.append(offer);
      } else this.content.append(el('p', s.level < TASK_CONFIG.unlock.session ? `Откроется на уровне ${TASK_CONFIG.unlock.session}.` : 'Продолжайте обычные доставки — появится новый челлендж.'));
      this.content.append(el('h3', 'ОСОБОЕ ЗАДАНИЕ'));
      if (s.rotatingChallenge) this.card(s.rotatingChallenge, 'rotating');
      else this.content.append(el('p', `Откроется на уровне ${TASK_CONFIG.unlock.rotating}.`));
      this.content.append(el('p', 'Особое задание обновляется вместе с ежедневными. Никаких штрафов за пропуск.', 'modal-note'));
    }
    if (this.view === 'streak') {
      this.content.append(el('h3', `🔥 СЕРИЯ ДОСТАВОК · ${s.currentDeliveryStreak}`), el('p', `Лучший результат: ${s.bestDeliveryStreak}`), el('p', 'Успешный личный заказ увеличивает серию на один. Двойной заказ тоже считается один раз. Провал прерывает текущую серию; лучший результат сохраняется. События сами по себе серию не прерывают.'));
      for (const m of TASK_CONFIG.streakMilestones) this.content.append(el('p', `${m.count} доставок: ${[m.xp && `+${m.xp} XP`, m.moneyBonus && `+${Math.round(m.moneyBonus * 100)}% к этому заказу`, m.reputation && `+${m.reputation} реп.`].filter(Boolean).join(' · ')}`, 'goal-card'));
      this.content.append(el('p', `Бонусы начисляются автоматически на указанной доставке. Максимальная надбавка — ${TASK_CONFIG.streakBonusCap * 100}%. Счётчик может расти дальше без увеличения надбавки.`));
    }
    if (focused) this.content.querySelector(`[data-task-action="${CSS.escape(focused)}"]`)?.focus({ preventScroll: true }); scroll.scrollTop = position;
  }
}
