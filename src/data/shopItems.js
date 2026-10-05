import { BALANCE } from '../config/gameBalance.js';
import { EVENT_BALANCE } from '../config/eventBalance.js';

export { TRANSPORT } from '../config/transportConfig.js';
export const CATEGORIES = Object.freeze(['SHOES', 'BAG', 'TRANSPORT']);
export const SHOP_ITEMS = Object.freeze([
  Object.freeze({ id: 'old-shoes', name: 'Старые кроссовки', category: 'SHOES', price: BALANCE.oldShoesPrice, walkingBonus: BALANCE.oldShoesBonus, description: '+5% скорости пешком' }),
  Object.freeze({ id: 'good-shoes', name: 'Хорошие кроссовки', category: 'SHOES', price: BALANCE.goodShoesPrice, requiresItem: 'old-shoes', walkingBonus: BALANCE.goodShoesBonus, description: `+${BALANCE.goodShoesBonus * 100}% скорости пешком всего · заменяют старые · риск неверного подъезда и шлагбаума ниже на ${Math.round((1 - EVENT_BALANCE.shoesRisk) * 100)}%` }),
  Object.freeze({ id: 'thermobag', name: 'Термосумка', category: 'BAG', price: BALANCE.thermobagPrice, moneyBonus: BALANCE.thermobagBonus, description: `+${BALANCE.thermobagBonus * 100}% оплаты успешных доставок · риск разлитого супа и повреждения хрупкого заказа ниже на ${Math.round((1 - EVENT_BALANCE.bagRisk) * 100)}%` }),
  Object.freeze({ id: 'bicycle', name: 'Велосипед', category: 'TRANSPORT', price: BALANCE.bicyclePrice, requiredLevel: BALANCE.bicycleLevel, description: `Скорость ${BALANCE.bicycleSpeed} · обувь не влияет · иногда спускает колесо: временное замедление, без поломки` }),
]);
export const itemById = (id) => SHOP_ITEMS.find(item => item.id === id);
