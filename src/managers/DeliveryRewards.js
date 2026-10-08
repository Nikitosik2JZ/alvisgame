import { t as tr } from '../services/LocalizationService.js';
import { itemById } from '../data/shopItems.js';
import { EVENT_BALANCE as B } from '../config/eventBalance.js';
import { nextStreakBonus } from '../config/taskConfig.js';

// Additive modifiers are explicit lines; base order payment remains unchanged.
export function calculateDeliveryReward(baseReward, player, order = {}) {
  const modifiers = Object.values(player.equippedItems).map(itemById).filter(item => item?.moneyBonus)
    .map(item => ({ id: item.id, name: item.name, amount: Math.round(baseReward * item.moneyBonus) }));
  if (player.demandBonusOrders > 0 && !order.skipDemand) modifiers.push({ id: 'demand', name: tr('events.053'), amount: Math.round(baseReward * B.demandBonus) });
  if (order.paymentPenalty) modifiers.push({ id: 'damage', name: tr('events.037'), amount: Math.round(baseReward * order.paymentPenalty) });
  if (order.extraMoney) modifiers.push({ id: 'stairs', name: tr('delivery-rewards.001'), amount: order.extraMoney });
  const streakBonus = nextStreakBonus(player);
  if (streakBonus) modifiers.push({ id: 'streak', name: tr('delivery-rewards.002', { v0: (player.currentDeliveryStreak || 0) + 1 }), amount: Math.round(baseReward * streakBonus) });
  return { baseReward, modifiers, total: Math.max(0, baseReward + modifiers.reduce((sum, modifier) => sum + modifier.amount, 0)) };
}
