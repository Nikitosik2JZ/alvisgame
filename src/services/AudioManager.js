// Original oscillator SFX: no downloaded recordings, soundtrack or asset requests.
export const SOUND_PATTERNS = Object.freeze({
  accepted: [440, 660], success: [523, 659, 784], negative: [220, 147],
  reward: [880, 1109], purchase: [392, 523, 659], achievement: [523, 659, 784, 1047],
});
export class AudioManager {
  constructor(state, lifecycle, host = globalThis.window) {
    this.state = state; this.lifecycle = lifecycle; this.host = host; this.voices = new Set();
    this.unsubscribe = state.subscribe(s => { this.volume = s.masterVolume; this.muted = s.muted; if (this.muted || !this.volume) this.stop(); });
    this.unsubscribePause = lifecycle.subscribe(() => { if (this.blocked) this.stop(); });
    this.unlock = () => {
      if (this.blocked) return;
      const Context = host?.AudioContext || host?.webkitAudioContext;
      try { this.context ??= Context ? new Context() : null; this.context?.resume()?.catch?.(() => {}); } catch { /* Audio is optional. */ }
    };
    host?.addEventListener('pointerdown', this.unlock, true);
    host?.addEventListener('touchend', this.unlock, true);
    host?.addEventListener('keydown', this.unlock, true);
  }
  get blocked() { return [...this.lifecycle.reasons].some(r => !r.startsWith('MENU:') && r !== 'TUTORIAL'); }
  play(kind) {
    if (this.blocked || this.muted || this.volume <= 0 || !this.context || this.context.state !== 'running') return false;
    const notes = SOUND_PATTERNS[kind]; if (!notes) return false;
    // Bound bursts (e.g. several achievements unlocked by the same delivery).
    if (this.voices.size + notes.length > 16) return false;
    try {
      notes.forEach((frequency, index) => {
        const oscillator = this.context.createOscillator(), gain = this.context.createGain();
        const start = this.context.currentTime + index * .075, end = start + .12;
        oscillator.type = kind === 'negative' ? 'triangle' : 'sine'; oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(this.volume * .10, start + .008);
        gain.gain.exponentialRampToValueAtTime(.0001, end);
        oscillator.connect(gain); gain.connect(this.context.destination);
        const voice = { oscillator, gain }; this.voices.add(voice);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); this.voices.delete(voice); };
        oscillator.start(start); oscillator.stop(end);
      });
      return true;
    } catch { this.stop(); return false; }
  }
  stop() {
    for (const { oscillator, gain } of this.voices) {
      try { oscillator.stop(); } catch { /* Already ended. */ }
      oscillator.disconnect(); gain.disconnect();
    }
    this.voices.clear();
  }
  destroy() {
    this.stop(); this.unsubscribe(); this.unsubscribePause();
    this.host?.removeEventListener('pointerdown', this.unlock, true); this.host?.removeEventListener('keydown', this.unlock, true);
    this.host?.removeEventListener('touchend', this.unlock, true);
    this.context?.close()?.catch?.(() => {});
  }
}
