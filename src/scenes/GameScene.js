import Phaser from 'phaser';
import { Courier } from '../entities/Courier.js';
import { createCity, WORLD } from '../world/createCity.js';
import { gameState } from '../state/GameState.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    this.physics.world.setBounds(0, 0, WORLD.width, WORLD.height);
    this.buildings = createCity(this);
    this.player = new Courier(this, WORLD.spawn.x, WORLD.spawn.y);
    this.physics.add.collider(this.player, this.buildings);
    this.cameras.main.setBounds(0, 0, WORLD.width, WORLD.height);
    this.cameras.main.startFollow(this.player, true);
    const unsubscribe = gameState.subscribe(({ money, level, reputation }) => {
      document.querySelector('#money').textContent = `${money} ₽`;
      document.querySelector('#level').textContent = level;
      document.querySelector('#reputation').textContent = reputation;
    });
    this.events.once('shutdown', unsubscribe);
  }

  update() {
    this.player.update();
  }
}
