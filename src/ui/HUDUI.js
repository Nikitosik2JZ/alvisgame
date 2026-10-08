import { t as tr } from '../services/LocalizationService.js';
import { ModalUI } from './ModalUI.js';
import { BALANCE } from '../config/gameBalance.js';
import { navigationGeometry, indicatorObstructed, ManualNavigationOverride } from './navigationVisibility.js';

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
    this.manualNavigation = new ManualNavigationOverride();
    this.boundsDirty = true;
    this.render = (clearInput = true) => {
      const collapsed = manualCollapsed ?? this.media.matches;
      this.hud.classList.toggle('collapsed', collapsed);
      document.documentElement.classList.toggle('compact', this.media.matches);
      this.toggle.textContent = collapsed ? '▼' : '▲';
      this.toggle.setAttribute('aria-expanded', String(!collapsed));
      this.toggle.setAttribute('aria-label', collapsed ? tr('hudui.001') : tr('hudui.002'));
      (this.media.matches || collapsed ? document.querySelector('#menu-actions') : this.hud).append(this.actions);
      if (clearInput) player.clearInput();
      this.boundsDirty = true;
    };
    this.toggleHUD = () => {
      manualCollapsed = !this.hud.classList.contains('collapsed');
      if (!manualCollapsed) this.manualNavigation.expand(performance.now(), this.navigationState());
      this.render();
    };
    this.toggle.addEventListener('click', this.toggleHUD);
    this.media.addEventListener('change', this.render);
    // Close the menu before opening an existing screen; native dialog continues
    // to block all background input until its destination has opened.
    this.choose = event => { if (event.target.closest('.hud-actions button')) this.close(); };
    this.dialog.addEventListener('click', this.choose, true);
    this.render();
    // Measure only after layout changes; camera/target checks use cached DOM bounds.
    this.resizeObserver = new ResizeObserver(() => { this.boundsDirty = true; });
    this.resizeObserver.observe(this.hud);
    this.resizeObserver.observe(scene.game.canvas);
    this.onResize = () => { this.boundsDirty = true; this.nextNavigationCheck = 0; };
    window.addEventListener('resize', this.onResize);
    scene.scale.on('resize', this.onResize);
    this.checkNavigation = () => this.updateNavigation(performance.now());
    // Camera follow and its transform matrix are finalized during rendering.
    scene.game.events.on('postrender', this.checkNavigation);
    scene.events.once('shutdown', () => {
      this.toggle.removeEventListener('click', this.toggleHUD);
      this.media.removeEventListener('change', this.render);
      this.dialog.removeEventListener('click', this.choose, true);
      this.resizeObserver.disconnect();
      window.removeEventListener('resize', this.onResize);
      scene.scale.off('resize', this.onResize);
      scene.game.events.off('postrender', this.checkNavigation);
    });
  }

  navigationState() {
    const camera = this.scene.cameras.main, orders = this.scene.orders;
    return { target: orders?.getTarget(), order: orders?.order?.id, status: orders?.order?.status,
      x: this.player.x * camera.zoom, y: this.player.y * camera.zoom,
      scrollX: camera.scrollX, scrollY: camera.scrollY, zoom: camera.zoom,
      width: this.scene.scale.width, height: this.scene.scale.height };
  }

  updateNavigation(now) {
    if (this.hud.classList.contains('collapsed')) return;
    const state = this.navigationState();
    const changed = state.target !== this.lastTarget || state.status !== this.lastStatus;
    if (!changed && !this.boundsDirty && now < this.nextNavigationCheck) return;
    this.nextNavigationCheck = now + 100;
    this.lastTarget = state.target; this.lastStatus = state.status;
    if (!state.target) return;
    if (this.boundsDirty) {
      this.hudBounds = this.hud.getBoundingClientRect();
      this.canvasBounds = this.scene.game.canvas.getBoundingClientRect();
      this.boundsDirty = false;
    }
    // Maximum pulse (5) plus half the ring stroke (2), so pulsing cannot flicker the decision.
    const geometry = navigationGeometry(this.scene.cameras.main, state.target, BALANCE.interactionRadius + 7);
    const obstructed = [geometry.ring, geometry.arrow].some(indicator =>
      indicatorObstructed(indicator, this.hudBounds, this.canvasBounds, this.scene.scale));
    if (this.manualNavigation.allowsCollapse(now, state, obstructed) && obstructed) {
      manualCollapsed = true;
      this.render(false);
    }
  }
}
