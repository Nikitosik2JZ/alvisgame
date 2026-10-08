import { t as tr } from '../services/LocalizationService.js';
import { BALANCE } from '../config/gameBalance.js';
import { EVENT_BALANCE } from '../config/eventBalance.js';

export const CATEGORIES = Object.freeze(['SHOES', 'BAG']);
export const SHOP_ITEMS = Object.freeze([
  Object.freeze({ id: 'old-shoes', name: tr('shop-items.001'), category: 'SHOES', price: BALANCE.oldShoesPrice, walkingBonus: BALANCE.oldShoesBonus, description: tr('shop-items.002') }),
  Object.freeze({ id: 'good-shoes', name: tr('shop-items.003'), category: 'SHOES', price: BALANCE.goodShoesPrice, requiresItem: 'old-shoes', walkingBonus: BALANCE.goodShoesBonus, description: tr('shop-items.004', { v0: BALANCE.goodShoesBonus * 100, v1: Math.round((1 - EVENT_BALANCE.shoesRisk) * 100) }) }),
  Object.freeze({ id: 'thermobag', name: tr('shop-items.005'), category: 'BAG', price: BALANCE.thermobagPrice, moneyBonus: BALANCE.thermobagBonus, description: tr('shop-items.006', { v0: BALANCE.thermobagBonus * 100, v1: Math.round((1 - EVENT_BALANCE.bagRisk) * 100) }) }),
]);
export const itemById = (id) => SHOP_ITEMS.find(item => item.id === id);
