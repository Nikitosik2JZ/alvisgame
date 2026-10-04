export const WORLD = { width: 2400, height: 2000, spawn: { x: 1200, y: 1000 } };

export function createCity(scene) {
  const art = scene.add.graphics();
  const buildings = scene.physics.add.staticGroup();
  art.fillStyle(0x8ca77b).fillRect(0, 0, WORLD.width, WORLD.height);

  const streetsX = [360, 1200, 2040];
  const streetsY = [320, 1000, 1680];
  // Sidewalks surround the intersecting road grid.
  art.fillStyle(0xd1ceba);
  for (const x of streetsX) art.fillRect(x - 88, 0, 176, WORLD.height);
  for (const y of streetsY) art.fillRect(0, y - 88, WORLD.width, 176);
  art.fillStyle(0x596967);
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

  const blocks = [
    { x: 565, y: 505, w: 210, h: 240, color: 0xc28f73, name: 'MARKET' },
    { x: 850, y: 505, w: 205, h: 240, color: 0xa8b9ad, name: 'APARTMENTS' },
    { x: 565, y: 1160, w: 210, h: 280, color: 0xd5b679, name: 'BAKERY' },
    { x: 850, y: 1160, w: 205, h: 280, color: 0x819eac, name: 'POST OFFICE' },
    { x: 1365, y: 505, w: 245, h: 240, color: 0xb19bba, name: 'STUDIOS' },
    { x: 1690, y: 505, w: 205, h: 240, color: 0xc28f73, name: 'CORNER SHOP' },
    { x: 1690, y: 1160, w: 205, h: 280, color: 0xa8b9ad, name: 'APARTMENTS' },
    { x: 75, y: 490, w: 150, h: 300, color: 0xb19bba, name: 'HOMES' },
    { x: 75, y: 1150, w: 150, h: 310, color: 0xc28f73, name: 'HOMES' },
    { x: 2170, y: 490, w: 150, h: 300, color: 0xd5b679, name: 'HOMES' },
    { x: 2170, y: 1150, w: 150, h: 310, color: 0x819eac, name: 'HOMES' },
  ];
  for (const block of blocks) {
    art.fillStyle(0x233e36, 0.18).fillRoundedRect(block.x + 8, block.y + 10, block.w, block.h, 4);
    const building = scene.add.rectangle(block.x, block.y, block.w, block.h, block.color).setOrigin(0);
    buildings.add(building);
    art.fillStyle(block.color).fillRoundedRect(block.x, block.y, block.w, block.h, 4);
    art.fillStyle(0x243c37, 0.16).fillRect(block.x + 10, block.y + 10, block.w - 20, block.h - 20);
    art.fillStyle(block.color).fillRect(block.x + 18, block.y + 18, block.w - 36, block.h - 36);
    art.fillStyle(0xede4cc).fillRect(block.x + block.w / 2 - 18, block.y + block.h - 22, 36, 22);
    art.fillStyle(0x263c38, 0.22);
    for (let x = block.x + 28; x < block.x + block.w - 20; x += 42) art.fillRect(x, block.y + 35, 20, 25);
    scene.add.text(block.x + block.w / 2, block.y + block.h / 2, block.name, {
      fontFamily: 'Arial', fontSize: '12px', color: '#263e38', fontStyle: 'bold', letterSpacing: 1,
    }).setOrigin(0.5).setDepth(2);
  }
  // Small walkable park. Trees are decorative, buildings are the obstacles.
  art.fillStyle(0x769569).fillRoundedRect(1365, 1160, 245, 280, 20);
  art.fillStyle(0xc9c5a8).fillRect(1466, 1160, 38, 280);
  for (const [x, y] of [[1400, 1205], [1572, 1215], [1400, 1360], [1572, 1370]]) {
    art.fillStyle(0x233e36, 0.15).fillCircle(x + 5, y + 6, 23);
    art.fillStyle(0x496d52).fillCircle(x, y, 23);
    art.fillStyle(0x66875b).fillCircle(x - 5, y - 5, 16);
  }
  scene.add.text(1485, 1465, 'NEIGHBORHOOD PARK', { fontFamily: 'Arial', fontSize: '11px', color: '#344d3c' }).setOrigin(0.5);
  // Keep painted roof detail above building rectangles.
  art.setDepth(1);
  return buildings;
}
