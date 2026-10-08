import test from 'node:test';
import assert from 'node:assert/strict';
import { navigationGeometry, indicatorObstructed, ManualNavigationOverride } from '../src/ui/navigationVisibility.js';

const camera = (zoom = 1) => ({ x: 0, y: 0, width: 800, height: 600, scrollX: 500, scrollY: 300,
  matrix: { a: zoom, b: 0, c: 0, d: zoom,
    transformPoint: (x, y) => ({ x: 400 + (x - 400) * zoom, y: 300 + (y - 300) * zoom }) } });
const canvas = { left: 20, top: 10, right: 820, bottom: 610, width: 800, height: 600 };
const hud = { left: 40, top: 30, right: 350, bottom: 250 };
const size = { width: 800, height: 600 };

test('left/upper-left marker overlap, early margin, visible right and empty corners', () => {
  const check = (x, y) => indicatorObstructed(navigationGeometry(camera(), { x: x + 500, y: y + 300 }, 67).ring, hud, canvas, size);
  assert.equal(check(150, 100), true);
  assert.equal(check(300, 230), true);
  assert.equal(check(650, 120), false);
  assert.equal(check(400, 100), true); // ten-pixel advance warning
  assert.equal(check(410, 100), false);
  assert.equal(check(390, 300), false); // empty bounding-box corner
});

test('zoom, scroll, canvas offset/CSS scaling and offscreen arrow bounds', () => {
  const geometry = navigationGeometry(camera(2), { x: 780, y: 510 }, 67);
  assert.deepEqual(geometry.ring, { x: 160, y: 120, rx: 134, ry: 134 });
  assert.equal(indicatorObstructed(geometry.ring, hud, canvas, size), true);
  const outside = navigationGeometry(camera(2), { x: 200, y: 100 }, 67);
  assert.ok(outside.arrow.x >= 30 && outside.arrow.y >= 30);
  assert.equal(indicatorObstructed(outside.arrow, hud, canvas, size), true);
  assert.equal(indicatorObstructed(outside.ring, hud, canvas, size), false);
  const scaled = { left: 100, top: 100, right: 500, bottom: 400, width: 400, height: 300 };
  assert.equal(indicatorObstructed(geometry.ring, { left: 150, top: 130, right: 220, bottom: 190 }, scaled, size), true);
});

test('manual inspection needs both grace time and a new navigation situation', () => {
  const override = new ManualNavigationOverride();
  const state = { target: {}, order: 1, status: 'ACCEPTED', x: 100, y: 100,
    scrollX: 0, scrollY: 0, zoom: 1, width: 390, height: 844 };
  assert.equal(override.allowsCollapse(0, state, true), true);
  override.expand(0, state);
  assert.equal(override.allowsCollapse(100, { ...state, target: {} }, true), false);
  assert.equal(override.allowsCollapse(5000, state, true), false);
  for (const change of [{ target: {} }, { status: 'PICKED_UP' }, { x: 132 }, { scrollX: 32 }, { width: 844 }, { zoom: 2 }]) {
    assert.equal(override.allowsCollapse(2000, { ...state, ...change }, true), true);
  }
  override.allowsCollapse(2000, state, false);
  assert.equal(override.allowsCollapse(2100, state, true), true);
});
