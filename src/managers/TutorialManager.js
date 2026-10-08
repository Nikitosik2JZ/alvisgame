// Progress only follows real movement and real order events. No invented rewards.
export class TutorialManager {
  constructor(state, orders, player, changed = () => {}) {
    this.state = state; this.orders = orders; this.player = player; this.changed = changed;
    this.step = state.values.tutorialVersionSeen >= 1 ? null : 'welcome';
    state.tutorialActive = Boolean(this.step);
    this.unsubscribe = orders.subscribe(event => {
      if (!this.step) return;
      if (event === 'accepted') this.set('pickup');
      if (event === 'picked up') this.set('delivery');
      if (event === 'completed') this.set('reward');
      if (event === 'failed') this.set('order');
    });
  }
  set(step) { this.step = step; this.state.tutorialActive = Boolean(step); this.changed(step); }
  next() {
    if (this.step === 'welcome') { this.origin = { x: this.player.x, y: this.player.y }; this.set('movement'); }
    else if (this.step === 'reward') this.set('progression');
    else if (this.step === 'progression') this.set('final');
    else if (this.step === 'final') this.finish();
  }
  update() {
    if (this.step === 'movement' && Math.hypot(this.player.x - this.origin.x, this.player.y - this.origin.y) >= 48) this.set('order');
  }
  finish() { this.state.completeTutorial(); this.set(null); }
  destroy() { this.unsubscribe(); this.state.tutorialActive = false; }
}
