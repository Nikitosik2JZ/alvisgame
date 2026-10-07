import { lifecycle } from '../services/LifecycleManager.js';
export class EventUI {
  constructor(scene, player, manager) {
    this.dialog = document.createElement('dialog'); this.dialog.className = 'progression-dialog event-dialog'; this.dialog.id = 'event-dialog';
    this.dialog.setAttribute('aria-labelledby', 'event-title');
    this.dialog.innerHTML = '<div class="modal-header"><h2 id="event-title"></h2><span aria-hidden="true">✦</span></div><div class="modal-content"><p id="event-description"></p><p id="event-effects" role="status"></p><div id="event-buttons"></div><p class="modal-note">Движение и таймер приостановлены на время выбора. Время из последствий списывается.</p></div>';
    document.body.append(this.dialog);
    const buttons = this.dialog.querySelector('#event-buttons');
    const close = () => {
      if (!manager.active?.resolved) return;
      this.dialog.close();
      manager.finish(); lifecycle.set('MENU:EVENT', false); document.querySelector('#open-profile').focus();
    };
    const button = (label, action) => { const node = document.createElement('button'); node.textContent = label; node.onclick = action; buttons.append(node); return node; };
    manager.isBlocked = () => Boolean(document.querySelector('dialog[open]'));
    manager.onShow = event => {
      lifecycle.set('MENU:EVENT', true);
      this.dialog.querySelector('#event-title').textContent = event.title;
      this.dialog.querySelector('#event-description').textContent = event.description;
      const effects = this.dialog.querySelector('#event-effects'); effects.textContent = ''; buttons.replaceChildren();
      const resolve = i => { effects.textContent = manager.resolve(i); buttons.replaceChildren(); button('ПОНЯТНО', close).focus(); };
      if (event.choices) event.choices.forEach((choice, i) => button(`${choice.label}\n${choice.consequence}`, () => resolve(i)));
      else resolve(0);
      this.dialog.showModal(); buttons.firstElementChild.focus();
    };
    this.dialog.addEventListener('cancel', e => { e.preventDefault(); close(); });
    scene.events.once('shutdown', () => { this.dialog.remove(); manager.onShow = null; lifecycle.set('MENU:EVENT', false); });
  }
}
