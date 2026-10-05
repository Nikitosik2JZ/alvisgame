import { ModalUI } from './ModalUI.js';
import { TRANSPORTS, transportFor, goalText, nextTransportGoal } from '../config/transportConfig.js';
import { EVENT_BALANCE } from '../config/eventBalance.js';

export class GarageUI extends ModalUI {
  constructor(scene, state, player) {
    super(scene, player, 'garage-dialog', 'open-garage');
    this.state = state;
    this.cards = new Map();
    this.feedback = this.dialog.querySelector('#garage-feedback');
    this.celebration = this.dialog.querySelector('#transport-celebration');
    const list = this.dialog.querySelector('#garage-items');
    list.replaceChildren(); this.celebration.hidden = true; list.hidden = false;
    const resetCelebration = () => { this.celebration.hidden = true; list.hidden = false; };
    this.dialog.addEventListener('close', resetCelebration);
    scene.events.once('shutdown', () => this.dialog.removeEventListener('close', resetCelebration));
    this.dialog.querySelector('#celebration-go').onclick = () => { resetCelebration(); this.close(); };
    for (const transport of TRANSPORTS) {
      const card = document.createElement('article'); card.className = 'shop-item';
      card.innerHTML = `<h3>${transport.name}<span>${transport.purchasePrice} ₽</span></h3><p>Скорость: ${transport.movementSpeed} · Требуется уровень ${transport.requiredLevel}</p><p>${transport.bonuses}</p><p>${transport.disadvantages}</p><small data-status></small><button data-transport="${transport.id}"></button>`;
      card.querySelector('button').onclick = () => {
        const owned = state.getSnapshot().ownedTransports.includes(transport.id);
        const result = owned ? state.equipTransport(transport.id) : state.purchaseTransport(transport.id);
        this.feedback.textContent = result.ok ? `${owned ? 'ВЫБРАН' : 'НОВЫЙ ТРАНСПОРТ!'} · ${transport.name}${owned ? '' : '\nТеперь доставки станут значительно быстрее.'}` : result.reason;
        if (result.ok && !owned && transport.celebration) {
          this.dialog.querySelector('#celebration-title').textContent = transport.celebration.title;
          this.dialog.querySelector('#celebration-transport').textContent = transport.name;
          this.dialog.querySelector('#celebration-text').textContent = transport.celebration.text;
          this.celebration.hidden = false;
          list.hidden = true;
          this.celebration.scrollIntoView({ block: 'start' });
          this.dialog.querySelector('#celebration-go').focus();
        }
      };
      list.append(card); this.cards.set(transport.id, card);
    }
    this.unsubscribe = state.subscribe(s => this.render(s));
    this.unsubscribeOrder = scene.orders.subscribe(() => this.render(state.getSnapshot()));
    scene.events.once('shutdown', () => { this.unsubscribe(); this.unsubscribeOrder(); document.querySelector('#transport-milestone').hidden = true; });
  }

  render(s) {
    document.querySelector('#current-transport').textContent = `Транспорт: ${transportFor(s.equippedTransport).name} · Скорость: ${s.movementSpeed}`;
    const goal = goalText(s);
    const next = nextTransportGoal(s);
    document.querySelector('#transport-goal').textContent = next
      ? `СЛЕДУЮЩАЯ ЦЕЛЬ · ${next.name} — ${next.purchasePrice} ₽\nОсталось: ${Math.max(0, next.purchasePrice - s.money)} ₽ · Уровень: ${s.level} / ${next.requiredLevel}` : goal;
    this.dialog.querySelector('#garage-goal').textContent = goal;
    this.dialog.querySelector('#garage-money').textContent = `У вас: ${s.money} ₽ · Уровень ${s.level}`;
    for (const t of TRANSPORTS) {
      const owned = s.ownedTransports.includes(t.id), equipped = s.equippedTransport === t.id;
      const status = equipped ? 'ИСПОЛЬЗУЕТСЯ' : owned ? 'КУПЛЕНО' : s.level < t.requiredLevel ? `ТРЕБУЕТСЯ УРОВЕНЬ ${t.requiredLevel}` : s.money < t.purchasePrice ? 'НЕ ХВАТАЕТ ДЕНЕГ' : 'ДОСТУПНО';
      const card = this.cards.get(t.id);
      card.dataset.state = equipped ? 'EQUIPPED' : owned ? 'OWNED' : 'AVAILABLE';
      card.querySelector('[data-status]').textContent = status;
      const button = card.querySelector('button');
      button.textContent = equipped ? 'ИСПОЛЬЗУЕТСЯ' : owned ? 'ВЫБРАТЬ' : `КУПИТЬ — ${t.purchasePrice} ₽`;
      button.disabled = equipped;
    }
    if (this.state.transportChangeError()) this.feedback.textContent = this.state.transportChangeError();
    else if (this.feedback.textContent === 'СНАЧАЛА ЗАВЕРШИТЕ ТЕКУЩИЙ ЗАКАЗ') this.feedback.textContent = '';
  }

  update() {
    const toast = document.querySelector('#transport-milestone');
    if (this.toastUntil && performance.now() < this.toastUntil) return;
    toast.hidden = true;
    if (document.querySelector('dialog[open]')) return;
    const s = this.state.getSnapshot();
    const next = TRANSPORTS.find(t => t.milestoneTitle && s.level >= t.requiredLevel && !s.transportMilestones.includes(t.id) && !s.ownedTransports.includes(t.id));
    if (!next) return;
    this.state.markTransportMilestone(next.id);
    toast.textContent = `${next.milestoneTitle}\nВы достигли ${next.requiredLevel} уровня.\n${next.milestoneText}`;
    toast.hidden = false; this.toastUntil = performance.now() + EVENT_BALANCE.transportNoticeDuration * 1000;
  }
}
