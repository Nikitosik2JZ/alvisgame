import { DISTRICTS } from '../config/economyConfig.js';
import { ModalUI } from './ModalUI.js';
export class DistrictUI extends ModalUI {
  constructor(scene, state, player, orders, switchWorld) {
    const opener = document.createElement('button'); opener.id = 'open-districts'; opener.textContent = 'РАЙОНЫ'; document.querySelector('.hud-actions').append(opener);
    const dialog = document.createElement('dialog'); dialog.id = 'district-dialog'; dialog.className = 'progression-dialog';
    dialog.innerHTML = '<div class="modal-header"><h2>РАЙОНЫ</h2><button data-close>ЗАКРЫТЬ ×</button></div><div class="modal-content"><p id="district-feedback" role="status"></p><div id="district-list"></div></div>'; document.body.append(dialog);
    super(scene, player, 'district-dialog', 'open-districts');
    const feedback = dialog.querySelector('#district-feedback');
    const render = () => {
      const s = state.getSnapshot(), active = Boolean(orders.getTarget());
      const list = dialog.querySelector('#district-list'); list.replaceChildren();
      for (const [id, d] of Object.entries(DISTRICTS)) {
        const owned = s.unlockedDistricts.includes(id), selected = s.selectedDistrict === id;
        const card = document.createElement('div'); card.className = 'shop-item';
        const title = document.createElement('h3'); title.textContent = d.name.toUpperCase();
        const text = document.createElement('p'); text.textContent = `${owned ? 'Открыт' : `Требуется уровень ${d.level} · Стоимость открытия: ${d.cost} ₽`}\nОплата ×${d.money} · XP ×${d.xp}${id === 'center' ? ' · Больше срочных заказов, событий и дальних маршрутов' : ' · Более короткие маршруты'}`;
        const action = document.createElement('button'); action.textContent = selected ? 'ВЫБРАН' : owned ? 'ВЫБРАТЬ' : `ОТКРЫТЬ ЗА ${d.cost} ₽`;
        action.disabled = selected || (owned ? active : s.level < d.level || s.money < d.cost);
        action.onclick = () => {
          if (!owned) feedback.textContent = state.unlockDistrict(id) ? 'Район открыт! Теперь его можно выбрать.' : 'Не выполнены условия открытия.';
          else if (!orders.getTarget() && !orders.events?.active && state.selectDistrict(id)) { switchWorld(); return; }
          render();
        };
        card.append(title, text, action); list.append(card);
      }
      if (active) feedback.textContent = 'Смена района доступна после завершения заказа.';
    };
    this.unsubscribe = state.subscribe(render); this.unsubscribeOrder = orders.subscribe(render);
    scene.events.once('shutdown', () => { this.unsubscribe(); this.unsubscribeOrder(); dialog.remove(); opener.remove(); });
  }
}
