import { BALANCE } from '../config/gameBalance.js';

export const TRANSPORT = Object.freeze({ WALKING: 'WALKING', BICYCLE: 'BICYCLE' });
export const CATEGORIES = Object.freeze(['SHOES', 'BAG', 'TRANSPORT']);
export const SHOP_ITEMS = Object.freeze([
  Object.freeze({ id: 'old-shoes', name: 'Старые кроссовки', category: 'SHOES', price: BALANCE.oldShoesPrice, walkingBonus: BALANCE.oldShoesBonus, description: '+5% скорости пешком' }),
  Object.freeze({ id: 'good-shoes', name: 'Хорошие кроссовки', category: 'SHOES', price: BALANCE.goodShoesPrice, requiresItem: 'old-shoes', walkingBonus: BALANCE.goodShoesBonus, description: '+10% скорости пешком всего · заменяют старые' }),
  Object.freeze({ id: 'thermobag', name: 'Термосумка', category: 'BAG', price: BALANCE.thermobagPrice, moneyBonus: BALANCE.thermobagBonus, description: '+10% оплаты успешных доставок' }),
  Object.freeze({ id: 'bicycle', name: 'Велосипед', category: 'TRANSPORT', price: BALANCE.bicyclePrice, requiredLevel: BALANCE.bicycleLevel, description: `Скорость ${BALANCE.bicycleSpeed} · обувь не влияет` }),
]);
export const itemById = (id) => SHOP_ITEMS.find(item => item.id === id);
