import { xpForLevel } from '../config/gameBalance.js';
import { itemById } from '../data/shopItems.js';
import { ModalUI } from './ModalUI.js';
import { reputationTier, DISTRICTS } from '../config/economyConfig.js';

export class PlayerProfileUI extends ModalUI {
  constructor(scene, state, player, events) {
    super(scene, player, 'profile-dialog', 'open-profile');
    const historyButton = document.createElement('button'); historyButton.textContent = 'СОБЫТИЯ'; historyButton.id = 'show-events';
    const history = document.createElement('div'); history.id = 'event-history'; history.hidden = true;
    document.querySelector('#profile-dialog .modal-content').append(historyButton, history);
    historyButton.onclick = () => {
      history.hidden = !history.hidden; history.replaceChildren();
      if (!events?.history.length) history.textContent = 'Пока без приключений. Подозрительно спокойно.';
      for (const event of events?.history || []) { const row = document.createElement('p'); row.textContent = `${event.bad ? '−' : '+'} ${event.title}: ${event.text}`; history.append(row); }
    };
    scene.events.once('shutdown', () => { historyButton.remove(); history.remove(); });
    this.walk = document.querySelector('#equip-walking');
    this.bicycle = document.querySelector('#equip-bicycle');
    this.walk.onclick = () => state.unequipCategory('TRANSPORT');
    this.bicycle.onclick = () => state.equipItem('bicycle');
    this.unsubscribe = state.subscribe(snapshot => {
      const rows = [ ['Уровень', snapshot.level], ['Опыт', `${snapshot.xp} / ${xpForLevel(snapshot.level + 1)} XP`],
        ['Репутация', `${snapshot.reputation} · ${reputationTier(snapshot.reputation).name}`], ['Деньги', `${snapshot.money} ₽`],
        ['Район', DISTRICTS[snapshot.selectedDistrict].name], ['Бонус спроса', `${snapshot.demandBonusOrders} заказов`],
        ['Транспорт', snapshot.transport === 'BICYCLE' ? 'Велосипед' : 'Пешком'],
        ['Обувь', itemById(snapshot.equippedItems.SHOES)?.name || 'Нет'],
        ['Сумка', itemById(snapshot.equippedItems.BAG)?.name || 'Нет'], ['Скорость', `${snapshot.movementSpeed} пикс./сек.`] ];
      const details = document.querySelector('#profile-details');
      details.replaceChildren();
      for (const [label, value] of rows) {
        const term = document.createElement('dt'); term.textContent = label;
        const definition = document.createElement('dd'); definition.textContent = value;
        details.append(term, definition);
      }
      this.walk.disabled = snapshot.transport === 'WALKING';
      this.bicycle.hidden = !snapshot.ownedItems.includes('bicycle');
      this.bicycle.disabled = snapshot.transport === 'BICYCLE';
    });
    scene.events.once('shutdown', () => { this.unsubscribe(); this.walk.onclick = null; this.bicycle.onclick = null; });
  }
}
