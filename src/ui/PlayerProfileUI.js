import { xpForLevel } from '../config/gameBalance.js';
import { itemById } from '../data/shopItems.js';
import { ModalUI } from './ModalUI.js';
import { reputationTier, DISTRICTS } from '../config/economyConfig.js';
import { transportFor, careerTitle, nextTransportGoal } from '../config/transportConfig.js';

export class PlayerProfileUI extends ModalUI {
  constructor(scene, state, player) {
    super(scene, player, 'profile-dialog', 'open-profile');
    this.unsubscribe = state.subscribe(snapshot => {
      const next = nextTransportGoal(snapshot);
      const rows = [ ['Статус', careerTitle(snapshot)], ['Уровень', snapshot.level], ['Опыт', `${snapshot.xp} / ${xpForLevel(snapshot.level + 1)} XP`],
        ['Репутация', snapshot.reputation], ['Ранг репутации', reputationTier(snapshot.reputation).name], ['Баланс', `${snapshot.money} ₽`],
        ['Район', DISTRICTS[snapshot.selectedDistrict].name], ['Бонус спроса', `${snapshot.demandBonusOrders} заказов`],
        ['Транспорт', transportFor(snapshot.equippedTransport).name],
        ['Обувь', itemById(snapshot.equippedItems.SHOES)?.name || 'Нет'],
        ['Сумка', itemById(snapshot.equippedItems.BAG)?.name || 'Нет'], ['Скорость', `${snapshot.movementSpeed} пикс./сек.`],
        ['Выполнено заказов', snapshot.completedOrders], ['Провалено заказов', snapshot.failedOrders],
        ['Заработано всего', `${snapshot.totalMoneyEarned} ₽`], ['Чаевые', `${snapshot.totalTipsEarned} ₽`],
        ['Штрафы оплачены', `${snapshot.totalFinesPaid} ₽`], ['Доставлено', `${snapshot.totalDistanceDelivered} м`],
        ['Следующая цель', next ? `${next.name} — ${next.purchasePrice} ₽ · уровень ${next.requiredLevel}` : 'Весь транспорт куплен'] ];
      const details = document.querySelector('#profile-details');
      details.replaceChildren();
      for (const [label, value] of rows) {
        const term = document.createElement('dt'); term.textContent = label;
        const definition = document.createElement('dd'); definition.textContent = value;
        details.append(term, definition);
      }
    });
    scene.events.once('shutdown', () => this.unsubscribe());
  }
}
