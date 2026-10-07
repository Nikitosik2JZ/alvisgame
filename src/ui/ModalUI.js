import { lifecycle } from '../services/LifecycleManager.js';
// Native dialog supplies focus trapping and blocks pointer input behind the panel.
export class ModalUI {
  constructor(scene, player, dialogId, openerId) {
    this.scene = scene;
    this.player = player;
    this.dialog = document.getElementById(dialogId);
    this.opener = document.getElementById(openerId);
    this.closeButton = this.dialog.querySelector('[data-close]');
    this.open = () => {
      if (document.querySelector('dialog[open]')) return;
      this.blocking = true;
      lifecycle.set(`MENU:${dialogId}`, true);
      this.dialog.showModal();
      document.querySelector('#interact').hidden = true;
      this.closeButton.focus();
    };
    this.close = () => {
      this.dialog.close();
      this.onClose(); // Restore input now; native close events may arrive on a later frame.
    };
    this.onClose = () => {
      if (!this.blocking || this.dialog.open) return;
      this.blocking = false;
      lifecycle.set(`MENU:${dialogId}`, false);
      this.opener.focus();
    };
    this.onCancel = event => { event.preventDefault(); this.close(); };
    this.opener.addEventListener('click', this.open);
    this.closeButton.addEventListener('click', this.close);
    this.dialog.addEventListener('close', this.onClose);
    this.dialog.addEventListener('cancel', this.onCancel);
    scene.events.once('shutdown', () => this.destroy());
  }

  destroy() {
    if (this.dialog.open) this.close();
    this.opener.removeEventListener('click', this.open);
    this.closeButton.removeEventListener('click', this.close);
    this.dialog.removeEventListener('close', this.onClose);
    this.dialog.removeEventListener('cancel', this.onCancel);
  }
}
