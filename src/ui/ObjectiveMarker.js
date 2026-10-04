import { BALANCE } from '../config/gameBalance.js';

export class ObjectiveMarker {
  constructor(scene, manager) {
    this.scene = scene;
    this.manager = manager;
    this.ring = scene.add.graphics().setDepth(4);
    this.arrow = scene.add.graphics().setDepth(5).setScrollFactor(0);
  }

  update(time) {
    this.ring.clear();
    this.arrow.clear();
    const target = this.manager.getTarget();
    if (!target) return;
    const color = this.manager.order.status === 'ACCEPTED' ? 0xffcc70 : 0x91dfff;
    this.ring.lineStyle(4, color, 0.65 + Math.sin(time / 240) * 0.25);
    this.ring.strokeCircle(target.x, target.y, BALANCE.interactionRadius + Math.sin(time / 240) * 5);
    const camera = this.scene.cameras.main;
    const x = target.x - camera.scrollX;
    const y = target.y - camera.scrollY;
    const margin = 30;
    if (x > margin && x < camera.width - margin && y > margin && y < camera.height - margin) return;
    const dx = x - camera.width / 2;
    const dy = y - camera.height / 2;
    const scale = Math.min((camera.width / 2 - margin) / Math.max(1, Math.abs(dx)), (camera.height / 2 - margin) / Math.max(1, Math.abs(dy)));
    const ax = camera.width / 2 + dx * scale;
    const ay = camera.height / 2 + dy * scale;
    const angle = Math.atan2(dy, dx);
    const point = (offset, length) => ({ x: ax + Math.cos(angle + offset) * length, y: ay + Math.sin(angle + offset) * length });
    const tip = point(0, 14), left = point(2.5, 14), right = point(-2.5, 14);
    this.arrow.fillStyle(0x182b29, 0.9).fillCircle(ax, ay, 23);
    this.arrow.fillStyle(color).fillTriangle(tip.x, tip.y, left.x, left.y, right.x, right.y);
  }
}
