import { itemById } from '../data/shopItems.js';

// Additive modifiers are explicit lines; base order payment remains unchanged.
export function calculateDeliveryReward(baseReward, player) {
  const modifiers = Object.values(player.equippedItems).map(itemById).filter(item => item?.moneyBonus)
    .map(item => ({ id: item.id, name: item.name, amount: Math.round(baseReward * item.moneyBonus) }));
  return { baseReward, modifiers, total: baseReward + modifiers.reduce((sum, modifier) => sum + modifier.amount, 0) };
}
