import Phaser from 'phaser';
import { gameState } from '../state/GameState.js';
import { MovementInput } from '../input/MovementInput.js';
import { transportFor } from '../config/transportConfig.js';

export class Courier extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'courier');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(3).setCollideWorldBounds(true);
    this.body.setSize(22, 24).setOffset(11, 10);
    this.inputBlocked = false;
    this.unsubscribeState = gameState.subscribe(({ movementSpeed, transport }) => {
      this.speed = movementSpeed;
      const visual = transportFor(transport).visual;
      this.setTexture(visual.texture);
      this.body.setSize(visual.bodyWidth, visual.bodyHeight).setOffset((visual.width - visual.bodyWidth) / 2, (visual.height - visual.bodyHeight) / 2);
    });
    this.direction = new Phaser.Math.Vector2();
    this.movementInput = new MovementInput(scene, () => this.inputBlocked);
    this.clearInput = () => {
      this.movementInput.reset();
      scene.input.keyboard.resetKeys();
      if (this.body) this.setVelocity(0, 0);
    };
    window.addEventListener('blur', this.clearInput);
    this.visibilityHandler = () => { if (document.hidden) this.clearInput(); };
    document.addEventListener('visibilitychange', this.visibilityHandler);
    scene.events.once('shutdown', () => this.cleanup());
  }

  update() {
    if (this.inputBlocked) { this.setVelocity(0, 0); return; }
    const vector = this.movementInput.getVector();
    this.direction.set(vector.x, vector.y);
    // Input magnitude is capped at one; progression and effects still own speed.
    this.setVelocity(this.direction.x * this.speed * (this.speedMultiplier || 1), this.direction.y * this.speed * (this.speedMultiplier || 1));
    if (this.direction.lengthSq() > 0) this.setRotation(this.direction.angle() + Math.PI / 2);
  }

  cleanup() {
    this.unsubscribeState();
    window.removeEventListener('blur', this.clearInput);
    document.removeEventListener('visibilitychange', this.visibilityHandler);
    this.movementInput.destroy();
  }
}
