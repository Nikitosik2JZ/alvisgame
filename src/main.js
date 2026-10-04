import Phaser from 'phaser';
import './style.css';
import { BootScene } from './scenes/BootScene.js';
import { GameScene } from './scenes/GameScene.js';

// Keep the existing stacked mobile HUD below its actual content height.
const hud = document.querySelector('.hud');
new ResizeObserver(() => document.documentElement.style.setProperty('--hud-bottom', `${hud.getBoundingClientRect().bottom + 12}px`)).observe(hud);

export const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#8ca77b',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 0 }, debug: false },
  },
  input: { activePointers: 3 },
  scene: [BootScene, GameScene],
});
