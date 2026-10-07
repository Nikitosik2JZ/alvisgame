import { gameState } from '../state/GameState.js';
import { districtDeliveryLocations } from './deliveryLocations.js';
import { DISTRICTS } from '../config/districtConfig.js';
import { districtLayout, WORLD } from './districtLayouts.js';
export { WORLD } from './districtLayouts.js';


export function createCity(scene) {
  const id = gameState.getSnapshot().selectedDistrict;
  const district = DISTRICTS[id];
  const layout = districtLayout(id);
  const { restaurants } = districtDeliveryLocations(id);
  const art = scene.add.graphics();
  const buildings = scene.physics.add.staticGroup();
  art.fillStyle(district.visual.ground).fillRect(0, 0, WORLD.width, WORLD.height);

  const { streetsX, streetsY } = layout;
  // Sidewalks surround the intersecting road grid.
  art.fillStyle(district.visual.sidewalk);
  for (const x of streetsX) art.fillRect(x - 88, 0, 176, WORLD.height);
  for (const y of streetsY) art.fillRect(0, y - 88, WORLD.width, 176);
  art.fillStyle(district.visual.road);
  for (const x of streetsX) art.fillRect(x - 60, 0, 120, WORLD.height);
  for (const y of streetsY) art.fillRect(0, y - 60, WORLD.width, 120);
  art.fillStyle(0xabb4a0);
  for (const x of streetsX) {
    for (let y = 20; y < WORLD.height; y += 48) {
      if (streetsY.every((road) => Math.abs(y - road) > 90)) art.fillRect(x - 2, y, 4, 22);
    }
  }
  for (const y of streetsY) {
    for (let x = 20; x < WORLD.width; x += 48) {
      if (streetsX.every((road) => Math.abs(x - road) > 90)) art.fillRect(x, y - 2, 22, 4);
    }
  }
  // Crosswalks at each junction.
  art.fillStyle(0xe0dfcc);
  for (const x of streetsX) {
    for (const y of streetsY) {
      for (let stripe = -44; stripe <= 44; stripe += 16) {
        art.fillRect(x + stripe, y - 81, 8, 18);
        art.fillRect(x + stripe, y + 63, 8, 18);
        art.fillRect(x - 81, y + stripe, 18, 8);
        art.fillRect(x + 63, y + stripe, 18, 8);
      }
    }
  }

  for (const block of layout.blocks) {
    if (id !== 'residential') block.color = district.visual.building;
    const restaurant = restaurants.find((place) => place.building === block.name);
    if (restaurant) { block.name = restaurant.name; block.color = restaurant.color; }
    art.fillStyle(0x233e36, 0.18).fillRoundedRect(block.x + 8, block.y + 10, block.w, block.h, 4);
    const building = scene.add.rectangle(block.x, block.y, block.w, block.h, block.color).setOrigin(0);
    buildings.add(building);
    art.fillStyle(block.color).fillRoundedRect(block.x, block.y, block.w, block.h, 4);
    art.fillStyle(0x243c37, 0.16).fillRect(block.x + 10, block.y + 10, block.w - 20, block.h - 20);
    art.fillStyle(block.color).fillRect(block.x + 18, block.y + 18, block.w - 36, block.h - 36);
    art.fillStyle(0xede4cc).fillRect(block.x + block.w / 2 - 18, block.y + block.h - 22, 36, 22);
    art.fillStyle(0x263c38, 0.22);
    for (let x = block.x + 28; x < block.x + block.w - 20; x += 42) art.fillRect(x, block.y + 35, 20, 25);
    scene.add.text(block.x + block.w / 2, block.y + block.h / 2, restaurant ? block.name : block.label || block.name, {
      fontFamily: 'Arial', fontSize: '12px', color: '#263e38', fontStyle: 'bold', letterSpacing: 1,
    }).setOrigin(0.5).setDepth(2);
  }
  // Small walkable park. Trees are decorative, buildings are the obstacles.
  art.fillStyle(district.visual.park).fillRoundedRect(1365, 1160, 245, 280, 20);
  art.fillStyle(0xc9c5a8).fillRect(1466, 1160, 38, 280);
  const trees = layout.greenery === 'yard' ? [] : [[1400, 1205], [1572, 1215], [1400, 1360], [1572, 1370]];
  if (layout.greenery === 'formal') trees.push([550, 850], [1100, 850], [1660, 850], [550, 1530], [1100, 1530], [1660, 1530]);
  for (const [x, y] of trees) {
    art.fillStyle(0x233e36, 0.15).fillCircle(x + 5, y + 6, 23);
    art.fillStyle(0x496d52).fillCircle(x, y, 23);
    art.fillStyle(0x66875b).fillCircle(x - 5, y - 5, 16);
  }
  scene.add.text(1485, 1465, district.name.toUpperCase(), { fontFamily: 'Arial', fontSize: '11px', color: '#344d3c' }).setOrigin(0.5);
  if (id === 'industrial') {
    art.lineStyle(3, 0xe4c064, .7);
    for (let x = 1385; x < 1600; x += 40) art.strokeRect(x, 1190, 30, 210);
  }
  if (id === 'business') {
    art.fillStyle(0xc0e3ef, .55);
    for (const block of layout.blocks) for (let y = block.y + 28; y < block.y + block.h - 30; y += 32) art.fillRect(block.x + 15, y, block.w - 30, 10);
  }
  // Keep painted roof detail above building rectangles.
  art.setDepth(1);
  return buildings;
}
