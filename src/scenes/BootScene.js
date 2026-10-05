import Phaser from 'phaser';
import { platformService } from '../services/PlatformService.js';
import { gameState } from '../state/GameState.js';
import { transportFor } from '../config/transportConfig.js';
import { CompanyManager } from '../managers/CompanyManager.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  async create() {
    await platformService.initialize();
    gameState.loadSaveData(await platformService.loadSave());
    this.game.company = new CompanyManager(gameState);
    this.game.company.start();
    // Persist progression through the existing local adapter. Active jobs/effects remain session-only.
    this.unsubscribeSave = gameState.subscribe(() => { platformService.save(gameState.getSaveData()); });
    this.game.events.once('destroy', () => { this.game.company.destroy(); this.unsubscribeSave(); });
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
    graphics.clear();
    graphics.fillStyle(0x172c2b, .25).fillEllipse(24, 30, 38, 40);
    graphics.fillStyle(0x172c2b).fillRoundedRect(19, 0, 10, 14, 3).fillRoundedRect(19, 42, 10, 14, 3);
    graphics.fillStyle(0x5dc5da).fillRoundedRect(13, 9, 22, 39, 7);
    graphics.lineStyle(4, 0x233b44).lineBetween(5, 16, 43, 16);
    graphics.fillStyle(0xffefad).fillRect(19, 10, 10, 5);
    graphics.fillStyle(0xf0b65c).fillRoundedRect(12, 20, 24, 21, 6);
    graphics.fillStyle(0xffd6ad).fillCircle(24, 18, 7);
    graphics.fillStyle(0x263c38).fillRoundedRect(16, 10, 16, 8, 4).fillRoundedRect(16, 33, 16, 12, 3);
    const moped = transportFor('MOPED').visual;
    graphics.generateTexture(moped.texture, moped.width, moped.height);
    graphics.clear();
    graphics.fillStyle(0x152a31).fillRoundedRect(4, 12, 10, 18, 3).fillRoundedRect(44, 12, 10, 18, 3)
      .fillRoundedRect(4, 48, 10, 18, 3).fillRoundedRect(44, 48, 10, 18, 3);
    graphics.fillStyle(0xf3b65a).fillRoundedRect(9, 2, 40, 72, 10);
    graphics.fillStyle(0x294c5b).fillRoundedRect(14, 17, 30, 15, 4).fillRoundedRect(14, 52, 30, 11, 3);
    graphics.fillStyle(0xffd68b).fillRoundedRect(15, 34, 28, 16, 3);
    graphics.fillStyle(0xfff1c2).fillRect(12, 6, 10, 5).fillRect(36, 6, 10, 5);
    graphics.fillStyle(0xd95d4c).fillRect(12, 66, 8, 5).fillRect(38, 66, 8, 5);
    graphics.fillStyle(0x294c5b).fillRect(24, 37, 10, 3);
    const car = transportFor('CAR').visual;
    graphics.generateTexture(car.texture, car.width, car.height);
    graphics.destroy();
    this.scene.start('GameScene');
  }
}
