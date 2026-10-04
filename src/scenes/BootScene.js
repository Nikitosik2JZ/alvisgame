import Phaser from 'phaser';
import { platformService } from '../services/PlatformService.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  async create() {
    await platformService.initialize();
    // Original courier texture, drawn locally with Phaser shapes.
    const graphics = this.make.graphics({ x: 0, y: 0 });
    graphics.fillStyle(0x172c2b, 0.22).fillEllipse(22, 27, 30, 18);
    graphics.fillStyle(0xf0b65c).fillRoundedRect(11, 11, 22, 23, 7);
    graphics.fillStyle(0x314a46).fillRoundedRect(14, 24, 16, 12, 3);
    graphics.fillStyle(0xffd6ad).fillCircle(22, 11, 8);
    graphics.fillStyle(0x263c38).fillRoundedRect(13, 3, 18, 8, 4);
    graphics.fillStyle(0xf8e5b7).fillRect(19, 26, 6, 3);
    graphics.generateTexture('courier', 44, 44);
    graphics.destroy();
    this.scene.start('GameScene');
  }
}
