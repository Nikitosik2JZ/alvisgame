import Phaser from 'phaser';

export class Courier extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'courier');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(3).setCollideWorldBounds(true);
    this.body.setSize(22, 24).setOffset(11, 10);
    this.speed = 220;
    this.direction = new Phaser.Math.Vector2();
    this.keys = scene.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT');
    this.touch = new Set();
    this.buttons = [...document.querySelectorAll('[data-direction]')];
    this.handlers = [];
    for (const button of this.buttons) {
      const down = (event) => {
        event.preventDefault();
        button.setPointerCapture(event.pointerId);
        this.touch.add(button.dataset.direction);
      };
      const up = () => this.touch.delete(button.dataset.direction);
      button.addEventListener('pointerdown', down);
      for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(name, up);
      this.handlers.push({ button, down, up });
    }
    this.clearInput = () => {
      this.touch.clear();
      scene.input.keyboard.resetKeys();
      this.setVelocity(0, 0);
    };
    window.addEventListener('blur', this.clearInput);
    this.visibilityHandler = () => { if (document.hidden) this.clearInput(); };
    document.addEventListener('visibilitychange', this.visibilityHandler);
    scene.events.once('shutdown', () => this.cleanup());
  }

  update() {
    const keys = this.keys;
    const left = keys.A.isDown || keys.LEFT.isDown || this.touch.has('left');
    const right = keys.D.isDown || keys.RIGHT.isDown || this.touch.has('right');
    const up = keys.W.isDown || keys.UP.isDown || this.touch.has('up');
    const down = keys.S.isDown || keys.DOWN.isDown || this.touch.has('down');
    this.direction.set(Number(right) - Number(left), Number(down) - Number(up)).normalize();
    // Arcade Physics integrates pixels/second using its time step. Normalizing
    // gives diagonal movement the same speed as horizontal/vertical movement.
    this.setVelocity(this.direction.x * this.speed, this.direction.y * this.speed);
    if (this.direction.lengthSq() > 0) this.setRotation(this.direction.angle() + Math.PI / 2);
  }

  cleanup() {
    window.removeEventListener('blur', this.clearInput);
    document.removeEventListener('visibilitychange', this.visibilityHandler);
    for (const { button, down, up } of this.handlers) {
      button.removeEventListener('pointerdown', down);
      for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) button.removeEventListener(name, up);
    }
    this.touch.clear();
  }
}
