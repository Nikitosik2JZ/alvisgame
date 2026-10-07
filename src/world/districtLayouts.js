// Readable layouts share roads and entrances. Buildings are the only physics obstacles.
export const WORLD = { width: 2400, height: 2000, spawn: { x: 1200, y: 1000 } };
const BASE_BLOCKS = [
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
const offices = name => [250, 650, 1050, 1450, 1850].map(x => ({ x, y: 100, w: 160, h: 110, name }));
export function districtLayout(id = 'residential') {
  let blocks = BASE_BLOCKS.map(b => ({ ...b }));
  let streetsX = [360, 1200, 2040], streetsY = [320, 1000, 1680];
  if (id === 'center' || id === 'business') {
    streetsX.push(1960); streetsY.push(1800);
    blocks.push(...offices(id === 'business' ? 'БИЗНЕС-ЦЕНТР' : 'ОФИСЫ'));
  }
  if (id === 'industrial') {
    blocks = blocks.filter(b => !['POST OFFICE', 'STUDIOS'].includes(b.name) && b.x !== 850);
    blocks.filter(b => b.x === 565).forEach(b => { b.w = 490; });
    blocks.push({ x: 1365, y: 505, w: 245, h: 240, name: 'ЦЕХ № 7' });
    blocks = blocks.map(b => ({ ...b, label: b.name === 'HOMES' ? 'СКЛАД' : 'ЛОГИСТИКА' }));
  } else if (id === 'elite') {
    blocks = blocks.map(b => ({ ...b, x: b.x + 22, y: b.y + 25, w: b.w - 44, h: b.h - 50, label: 'ВИЛЛА' }));
  } else if (id === 'business') blocks = blocks.map(b => ({ ...b, label: 'ОФИСНАЯ БАШНЯ' }));
  return { blocks, streetsX, streetsY, greenery: id === 'elite' ? 'formal' : id === 'industrial' ? 'yard' : id === 'business' ? 'plaza' : 'park' };
}
