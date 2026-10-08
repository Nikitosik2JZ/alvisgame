import { ModalUI } from './ModalUI.js';
import { audio } from '../services/GameRuntime.js';
export class SettingsUI extends ModalUI {
  constructor(scene, state, player) {
    super(scene, player, 'settings-dialog', 'open-settings');
    this.slider = this.dialog.querySelector('#master-volume'); this.mute = this.dialog.querySelector('#sound-muted');
    this.change = () => state.setAudioPreferences(Number(this.slider.value) / 100, this.mute.checked);
    this.preview = () => audio?.play('accepted');
    this.slider.addEventListener('input', this.change); this.slider.addEventListener('change', this.preview);
    this.mute.addEventListener('change', this.change);
    this.unsubscribe = state.subscribe(s => {
      this.slider.value = Math.round(s.masterVolume * 100); this.mute.checked = s.muted;
      this.dialog.querySelector('#volume-value').textContent = `${Math.round(s.masterVolume * 100)}%`;
    });
    scene.events.once('shutdown', () => {
      this.unsubscribe(); this.slider.removeEventListener('input', this.change); this.slider.removeEventListener('change', this.preview);
      this.mute.removeEventListener('change', this.change);
    });
  }
}
