import { itemById } from '../data/shopItems.js';
import { EVENT_BALANCE as B } from '../config/eventBalance.js';

// Additive modifiers are explicit lines; base order payment remains unchanged.
export function calculateDeliveryReward(baseReward, player, order = {}) {
  const modifiers = Object.values(player.equippedItems).map(itemById).filter(item => item?.moneyBonus)
    .map(item => ({ id: item.id, name: item.name, amount: Math.round(baseReward * item.moneyBonus) }));
  if (player.demandBonusOrders > 0 && !order.skipDemand) modifiers.push({ id: 'demand', name: 'Повышенный спрос', amount: Math.round(baseReward * B.demandBonus) });
  if (order.paymentPenalty) modifiers.push({ id: 'damage', name: 'Разлитый суп', amount: Math.round(baseReward * order.paymentPenalty) });
  if (order.extraMoney) modifiers.push({ id: 'stairs', name: 'Доплата за подъём', amount: order.extraMoney });
  return { baseReward, modifiers, total: Math.max(0, baseReward + modifiers.reduce((sum, modifier) => sum + modifier.amount, 0)) };
}
