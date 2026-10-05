import { ModalUI } from './ModalUI.js';

// Session preference survives district scene restarts and orientation changes.
let manualCollapsed;
export const COMPACT_QUERY = '(max-width: 900px), (pointer: coarse)';

export class HUDUI extends ModalUI {
  constructor(scene, player) {
    super(scene, player, 'menu-dialog', 'open-menu');
    this.hud = document.querySelector('.hud');
    this.toggle = document.querySelector('#toggle-hud');
    this.actions = document.querySelector('.hud-actions');
    this.media = matchMedia(COMPACT_QUERY);
    this.render = () => {
      const collapsed = manualCollapsed ?? this.media.matches;
      this.hud.classList.toggle('collapsed', collapsed);
      document.documentElement.classList.toggle('compact', this.media.matches);
      this.toggle.textContent = collapsed ? '▼' : '▲';
      this.toggle.setAttribute('aria-expanded', String(!collapsed));
      this.toggle.setAttribute('aria-label', collapsed ? 'Развернуть HUD' : 'Свернуть HUD');
      (this.media.matches || collapsed ? document.querySelector('#menu-actions') : this.hud).append(this.actions);
      player.clearInput();
    };
    this.toggleHUD = () => { manualCollapsed = !this.hud.classList.contains('collapsed'); this.render(); };
    this.toggle.addEventListener('click', this.toggleHUD);
    this.media.addEventListener('change', this.render);
    // Close the menu before opening an existing screen; native dialog continues
    // to block all background input until its destination has opened.
    this.choose = event => { if (event.target.closest('.hud-actions button')) this.close(); };
    this.dialog.addEventListener('click', this.choose, true);
    this.render();
    scene.events.once('shutdown', () => {
      this.toggle.removeEventListener('click', this.toggleHUD);
      this.media.removeEventListener('change', this.render);
      this.dialog.removeEventListener('click', this.choose, true);
    });
  }
}
