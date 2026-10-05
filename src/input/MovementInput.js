export const JOYSTICK_CONFIG = Object.freeze({ deadZone: 0.12, maxRadius: 44 });

// Both input sources produce a vector whose magnitude never exceeds one.
export function joystickVector(dx, dy, radius, deadZone = JOYSTICK_CONFIG.deadZone) {
  const distance = Math.hypot(dx, dy);
  const fraction = Math.min(distance / radius, 1);
  if (fraction <= deadZone) return { x: 0, y: 0 };
  const strength = (fraction - deadZone) / (1 - deadZone);
  return { x: dx / distance * strength, y: dy / distance * strength };
}

export class MovementInput {
  constructor(scene, isBlocked, config = JOYSTICK_CONFIG) {
    this.keys = scene.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT');
    this.scene = scene;
    this.config = config;
    this.isBlocked = isBlocked;
    this.base = document.querySelector('#joystick');
    this.stick = this.base.querySelector('.joystick-stick');
    this.vector = { x: 0, y: 0 };
    this.pointer = null;
    this.down = event => {
      event.preventDefault(); event.stopPropagation();
      if (this.isBlocked() || this.pointer !== null) return;
      this.pointer = event.pointerId;
      this.base.setPointerCapture(event.pointerId);
      this.move(event);
    };
    this.move = event => {
      event.preventDefault(); event.stopPropagation();
      if (event.pointerId !== this.pointer) return;
      if (this.isBlocked()) { this.reset(); return; }
      const box = this.base.getBoundingClientRect();
      // Derive the fixed origin each time so resize/orientation changes are safe.
      const dx = event.clientX - box.x - box.width / 2;
      const dy = event.clientY - box.y - box.height / 2;
      const radius = Math.min(this.config.maxRadius, box.width / 2 - 20);
      this.vector = joystickVector(dx, dy, radius, this.config.deadZone);
      const scale = Math.min(1, radius / (Math.hypot(dx, dy) || 1));
      this.stick.style.transform = `translate(${dx * scale}px, ${dy * scale}px)`;
    };
    this.up = event => {
      event.stopPropagation();
      if (event.pointerId === this.pointer) this.reset();
    };
    this.base.addEventListener('pointerdown', this.down);
    this.base.addEventListener('pointermove', this.move);
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) this.base.addEventListener(name, this.up);
    this.resize = () => this.reset();
    window.addEventListener('resize', this.resize);
  }

  getVector() {
    if (this.isBlocked()) return { x: 0, y: 0 };
    if (this.pointer !== null) return this.vector;
    const k = this.keys;
    const x = Number(k.D.isDown || k.RIGHT.isDown) - Number(k.A.isDown || k.LEFT.isDown);
    const y = Number(k.S.isDown || k.DOWN.isDown) - Number(k.W.isDown || k.UP.isDown);
    const length = Math.hypot(x, y) || 1;
    return { x: x / length, y: y / length };
  }

  reset() {
    const pointer = this.pointer;
    this.pointer = null;
    this.vector = { x: 0, y: 0 };
    this.stick.style.transform = 'translate(0px, 0px)';
    if (pointer !== null && this.base.hasPointerCapture(pointer)) this.base.releasePointerCapture(pointer);
  }

  destroy() {
    this.reset();
    this.base.removeEventListener('pointerdown', this.down);
    this.base.removeEventListener('pointermove', this.move);
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) this.base.removeEventListener(name, this.up);
    window.removeEventListener('resize', this.resize);
  }
}
