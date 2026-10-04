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
    // Obvious original bicycle silhouette; same texture dimensions and collision body.
    graphics.lineStyle(4, 0x142c35, 1);
    graphics.strokeEllipse(22, 7, 10, 12).strokeEllipse(22, 37, 10, 12);
    graphics.lineStyle(3, 0x87e4fa, 1);
    graphics.lineBetween(22, 7, 14, 25).lineBetween(14, 25, 22, 37).lineBetween(22, 37, 30, 25).lineBetween(30, 25, 22, 7);
    graphics.lineStyle(3, 0xf0b65c, 1);
    graphics.lineBetween(6, 15, 38, 15);
    graphics.generateTexture('courier-bicycle', 44, 44);
    graphics.destroy();
    this.scene.start('GameScene');
  }
}
