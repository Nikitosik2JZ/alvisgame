import { t as tr } from '../services/LocalizationService.js';
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
      card.innerHTML = tr('garage-ui.001', { v0: transport.name, v1: transport.purchasePrice, v2: transport.movementSpeed, v3: transport.requiredLevel, v4: transport.bonuses, v5: transport.disadvantages, v6: transport.id });
      card.querySelector('button').onclick = () => {
        const owned = state.getSnapshot().ownedTransports.includes(transport.id);
        const result = owned ? state.equipTransport(transport.id) : state.purchaseTransport(transport.id);
        this.feedback.textContent = result.ok ? `${owned ? tr('district-ui.013') : tr('garage-ui.002')} · ${transport.name}${owned ? '' : tr('garage-ui.003')}` : result.reason;
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
    document.querySelector('#current-transport').textContent = tr('garage-ui.004', { v0: transportFor(s.equippedTransport).name, v1: s.movementSpeed });
    const goal = goalText(s);
    const next = nextTransportGoal(s);
    document.querySelector('#transport-goal').textContent = next
      ? tr('garage-ui.005', { v0: next.name, v1: next.purchasePrice, v2: Math.max(0, next.purchasePrice - s.money), v3: s.level, v4: next.requiredLevel }) : goal;
    this.dialog.querySelector('#garage-goal').textContent = goal;
    this.dialog.querySelector('#garage-money').textContent = tr('garage-ui.006', { v0: s.money, v1: s.level });
    for (const t of TRANSPORTS) {
      const owned = s.ownedTransports.includes(t.id), equipped = s.equippedTransport === t.id;
      const status = equipped ? tr('garage-ui.007') : owned ? tr('shop-manager.003') : s.level < t.requiredLevel ? tr('shop-manager.004', { v0: t.requiredLevel }) : s.money < t.purchasePrice ? tr('garage-ui.008') : tr('garage-ui.009');
      const card = this.cards.get(t.id);
      card.dataset.state = equipped ? 'EQUIPPED' : owned ? 'OWNED' : 'AVAILABLE';
      card.querySelector('[data-status]').textContent = status;
      const button = card.querySelector('button');
      button.textContent = equipped ? tr('garage-ui.007') : owned ? tr('district-ui.014') : tr('shop-manager.007', { v0: t.purchasePrice });
      button.disabled = equipped;
    }
    if (this.state.transportChangeError()) this.feedback.textContent = this.state.transportChangeError();
    else if (this.feedback.textContent === tr('game-state.004')) this.feedback.textContent = '';
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
    toast.textContent = tr('garage-ui.010', { v0: next.milestoneTitle, v1: next.requiredLevel, v2: next.milestoneText });
    toast.hidden = false; this.toastUntil = performance.now() + EVENT_BALANCE.transportNoticeDuration * 1000;
  }
}
