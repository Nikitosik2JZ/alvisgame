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

export function districtDeliveryLocations(id = 'residential') {
  const sources = restaurants.map(r => ({ ...r, name: id === 'industrial' ? `Склад · ${r.name}` : id === 'business' ? `Кафе · ${r.name}` : r.name }));
  const destinations = id === 'industrial' || id === 'business' ? [
    { id: 'gate-north-west', name: id === 'industrial' ? 'Склад · Западные ворота' : 'Офис · Запад', x: 150, y: 270 },
    { id: 'gate-north-east', name: id === 'industrial' ? 'Склад · Восточные ворота' : 'Офис · Восток', x: 2245, y: 270 },
    { id: 'gate-south-west', name: id === 'industrial' ? 'Цех · Южные ворота' : 'Корпорация · Юг', x: 150, y: 1860 },
    { id: 'gate-south-east', name: id === 'industrial' ? 'Склад · Отгрузка' : 'Бизнес-центр · Юг', x: 2245, y: 1860 },
    { id: 'gate-north', name: 'Клиент · Северный въезд', x: 1200, y: 270 },
    { id: 'gate-south', name: 'Клиент · Южный въезд', x: 1200, y: 1900 },
    { id: 'gate-west', name: id === 'industrial' ? 'Цех · Центральные ворота' : 'Офис · Западная площадь', x: 150, y: 1000 },
    { id: 'gate-east', name: id === 'industrial' ? 'Склад · Центральные ворота' : 'Офис · Восточная площадь', x: 2245, y: 1000 },
    ...customers.filter(c => c.id.startsWith('east')).map(c => ({ ...c })),
  ] : customers.map(c => ({ ...c, name: id === 'elite' ? c.name.replace('Клиент', 'Вилла') : c.name }));
  return { restaurants: sources, customers: destinations };
}

export function createDeliveryLocations(scene, locations = { restaurants, customers }) {
  for (const place of [...locations.restaurants, ...locations.customers]) {
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
