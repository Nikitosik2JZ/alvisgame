import test from 'node:test';
import assert from 'node:assert/strict';
import { joystickVector, JOYSTICK_CONFIG } from '../src/input/MovementInput.js';

test('joystick dead zone, analog response and diagonal speed cap', () => {
  const r = JOYSTICK_CONFIG.maxRadius;
  assert.deepEqual(joystickVector(0, 0, r), { x: 0, y: 0 });
  assert.deepEqual(joystickVector(r * .1, 0, r), { x: 0, y: 0 });
  const half = joystickVector(r / 2, 0, r);
  assert.ok(half.x > 0 && half.x < 1);
  for (let angle = 0; angle < Math.PI * 2; angle += .1) {
    const v = joystickVector(Math.cos(angle) * r * 2, Math.sin(angle) * r * 2, r);
    assert.ok(Math.abs(Math.hypot(v.x, v.y) - 1) < 1e-12);
    assert.ok(Math.abs(v.x - Math.cos(angle)) < 1e-12);
    assert.ok(Math.abs(v.y - Math.sin(angle)) < 1e-12);
  }
});
