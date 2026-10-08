// One set of blockers owns movement, active clocks, audio and GameplayAPI.
export class LifecycleManager {
  constructor({ now = () => performance.now(), platform = null } = {}) {
    this.clock = now; this.platform = platform; this.reasons = new Set(['BOOT']);
    this.lastClock = now(); this.elapsed = 0; this.listeners = new Set(); this.userMuted = false;
  }
  get paused() { return this.reasons.size > 0; }
  now = () => {
    const current = this.clock();
    if (!this.paused) this.elapsed += Math.max(0, current - this.lastClock);
    this.lastClock = current;
    return this.elapsed;
  };
  set(reason, blocked) {
    this.now();
    if (blocked === this.reasons.has(reason)) return;
    if (blocked) this.reasons.add(reason); else this.reasons.delete(reason);
    this.refresh();
  }
  refresh() {
    if (typeof document !== 'undefined') document.body?.classList.toggle('game-paused', this.paused);
    if (this.paused) this.platform?.gameplayStop(); else this.platform?.gameplayStart();
    for (const listener of this.listeners) listener(this.paused);
  }
  subscribe(listener) { this.listeners.add(listener); listener(this.paused); return () => this.listeners.delete(listener); }
  setUserMuted(muted) { this.userMuted = Boolean(muted); this.refresh(); }
  bindScene(scene) {
    const unsubscribe = this.subscribe(paused => {
      scene.player.clearInput(); scene.player.inputBlocked = paused;
      scene.input.keyboard.enabled = !paused;
      if (paused) scene.physics.pause(); else scene.physics.resume();
      scene.time.paused = paused;
      if (paused) scene.tweens.pauseAll(); else scene.tweens.resumeAll();
      scene.sound.mute = this.userMuted || paused;
      if (paused) scene.sound.pauseAll(); else if (!this.userMuted) scene.sound.resumeAll();
      if (paused) document.querySelector('#interact').hidden = true;
    });
    scene.events.once('shutdown', unsubscribe);
  }
}
export const lifecycle = new LifecycleManager();
