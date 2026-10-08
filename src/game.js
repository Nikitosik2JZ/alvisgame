import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { GameScene } from './scenes/GameScene.js';
import { bindBrowserLifecycle } from './services/GameRuntime.js';
export { lifecycle } from './services/LifecycleManager.js';
export { platformService } from './services/PlatformService.js';

bindBrowserLifecycle();

// Compact objectives follow the actual HUD height, including safe areas.
const hud = document.querySelector('.hud');
const observer = new ResizeObserver(() => document.documentElement.style.setProperty('--hud-bottom', `${hud.getBoundingClientRect().bottom + 12}px`));
observer.observe(hud);

export const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#8ca77b',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: document.querySelector('#game').clientWidth,
    height: document.querySelector('#game').clientHeight,
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 0 }, debug: false },
  },
  input: { activePointers: 3 },
  scene: [BootScene, GameScene],
});
game.events.once('destroy', () => observer.disconnect());
