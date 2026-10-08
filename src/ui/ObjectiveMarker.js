import { BALANCE } from '../config/gameBalance.js';
import { navigationGeometry } from './navigationVisibility.js';

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
    const { arrow } = navigationGeometry(camera, target, BALANCE.interactionRadius + 7);
    if (!arrow) return;
    const { x: ax, y: ay, angle } = arrow;
    // Keep the edge indicator in screen pixels even when the camera is zoomed.
    const local = camera.matrix.applyInverse(ax, ay);
    this.arrow.setPosition(local.x, local.y).setScale(1 / camera.zoom).setRotation(-camera.rotation);
    const point = (offset, length) => ({ x: Math.cos(angle + offset) * length, y: Math.sin(angle + offset) * length });
    const tip = point(0, 14), left = point(2.5, 14), right = point(-2.5, 14);
    this.arrow.fillStyle(0x182b29, 0.9).fillCircle(0, 0, 23);
    this.arrow.fillStyle(color).fillTriangle(tip.x, tip.y, left.x, left.y, right.x, right.y);
  }
}
