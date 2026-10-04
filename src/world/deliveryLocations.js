// Entrances sit on walkable ground outside the existing static building bodies.
export const restaurants = [
  { id: 'burger', name: 'Burger House', x: 670, y: 795, building: 'MARKET', color: 0xf5b75d },
  { id: 'pizza', name: 'Pizza Point', x: 1792, y: 795, building: 'CORNER SHOP', color: 0xf28f79 },
  { id: 'sushi', name: 'Sushi Place', x: 670, y: 1490, building: 'BAKERY', color: 0xa5ddcb },
];

export const customers = [
  { id: 'west-north', name: 'Клиент · Запад', x: 150, y: 840 },
  { id: 'north', name: 'Клиент · Север', x: 952, y: 795 },
  { id: 'east-north', name: 'Клиент · Восток', x: 2245, y: 840 },
  { id: 'center-south', name: 'Клиент · Почта', x: 952, y: 1490 },
  { id: 'south', name: 'Клиент · Юг', x: 1792, y: 1490 },
  { id: 'east-south', name: 'Клиент · Набережная', x: 2245, y: 1510 },
];

export function createDeliveryLocations(scene) {
  for (const place of [...restaurants, ...customers]) {
    const isRestaurant = 'building' in place;
    scene.add.circle(place.x, place.y, 18, isRestaurant ? place.color : 0x9fb8eb, 0.9).setDepth(2);
    scene.add.text(place.x, place.y, isRestaurant ? 'R' : 'К', {
      fontFamily: 'Arial', fontSize: '18px', fontStyle: 'bold', color: '#182b29',
    }).setOrigin(0.5).setDepth(2);
    scene.add.text(place.x, place.y + 28, place.name, {
      fontFamily: 'Arial', fontSize: '14px', color: '#ffffff', backgroundColor: '#182b29', padding: { x: 6, y: 4 },
    }).setOrigin(0.5, 0).setDepth(2);
  }
}
