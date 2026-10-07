import { DISTRICTS, districtRequirements, districtMastery, companyDistrictBonus, ELITE_ORDERS } from '../config/districtConfig.js';
import { transportFor } from '../config/transportConfig.js';
import { ModalUI } from './ModalUI.js';

export class DistrictUI extends ModalUI {
  constructor(scene, state, player, orders, switchWorld) {
    const opener = document.createElement('button'); opener.id = 'open-districts'; opener.textContent = 'КАРТА'; document.querySelector('.hud-actions').append(opener);
    const dialog = document.createElement('dialog'); dialog.id = 'district-dialog'; dialog.className = 'progression-dialog';
    dialog.setAttribute('aria-labelledby', 'city-title');
    dialog.innerHTML = '<div class="modal-header"><h2 id="city-title">КАРТА ГОРОДА</h2><button data-close>ЗАКРЫТЬ ×</button></div><div class="modal-content"><p id="city-summary" class="goal-card"></p><p id="district-feedback" role="status" aria-live="polite"></p><section id="district-introduction" hidden><h3></h3><p></p><button>ПОЕХАЛИ</button></section><div id="district-list"></div></div>';
    document.body.append(dialog);
    super(scene, player, 'district-dialog', 'open-districts');
    const feedback = dialog.querySelector('#district-feedback'), intro = dialog.querySelector('#district-introduction');
    // The map itself is the switch control. Every other dialog is a blocker.
    state.isDistrictBlocked = () => scene.districtTransition || Boolean(document.querySelector('dialog[open]:not(#district-dialog)'));
    this.switchTo = id => {
      const reason = state.districtSwitchError(id);
      if (reason) { feedback.textContent = reason; return false; }
      if (!state.selectDistrict(id)) return false;
      this.close(); switchWorld(); return true;
    };
    this.showIntroduction = id => {
      const d = DISTRICTS[id]; intro.hidden = false;
      intro.querySelector('h3').textContent = `${d.name.toUpperCase()} · РАЙОН ОТКРЫТ`;
      intro.querySelector('p').textContent = `${d.description}\nОплата ×${d.money} · XP ×${d.xp}\nРекомендуемый транспорт: ${d.recommendedTransports.map(t => transportFor(t).name).join(' / ')}`;
      const button = intro.querySelector('button');
      button.onclick = () => {
        intro.hidden = true; state.markDistrictIntroduction(id);
        this.switchTo(id);
      };
      if (dialog.open) { intro.scrollIntoView({ block: 'start' }); button.focus(); }
    };
    const render = () => {
      const s = state.getSnapshot(), next = Object.entries(DISTRICTS).find(([id]) => !s.unlockedDistricts.includes(id));
      dialog.querySelector('#city-summary').textContent = `Открыто районов: ${s.unlockedDistricts.length} / ${Object.keys(DISTRICTS).length}\nСейчас: ${DISTRICTS[s.selectedDistrict].name}\n${next ? `Следующий район: ${next[1].name}\n${districtRequirements(next[1])}` : 'Весь город открыт!'}\nБонус дохода компании: +${Math.round(companyDistrictBonus(s) * 100)}%`;
      const list = dialog.querySelector('#district-list'); list.replaceChildren();
      for (const [id, d] of Object.entries(DISTRICTS)) {
        const owned = s.unlockedDistricts.includes(id), selected = s.selectedDistrict === id, stats = s.districtStats[id], mastery = districtMastery(stats.completedOrders);
        const card = document.createElement('article'); card.className = 'shop-item district-card'; card.dataset.district = id;
        card.dataset.state = selected ? 'EQUIPPED' : owned ? 'OWNED' : 'LOCKED';
        card.style.setProperty('--district-color', `#${d.visual.building.toString(16).padStart(6, '0')}`);
        const title = document.createElement('h3'); title.textContent = d.name.toUpperCase();
        const text = document.createElement('p'); text.textContent = `${owned ? selected ? 'Вы здесь' : 'Открыт' : districtRequirements(d)}\n${d.description}\nОплата ×${d.money} · XP ×${d.xp} · Чаевые ×${d.tip}\nМаршруты: ${d.routeRange.join('–')} м · ${d.orderSummary}\nТранспорт: ${d.recommendedTransports.map(t => transportFor(t).name).join(' / ')}${ELITE_ORDERS.districts.includes(id) ? `\nЭлитные заказы: уровень ${ELITE_ORDERS.level} · репутация ${ELITE_ORDERS.reputation}+` : ''}`;
        const progress = document.createElement('small'); progress.textContent = `${mastery.name} · ${stats.completedOrders} доставок · +${Math.round(mastery.bonus * 100)}% оплаты\nПровалено: ${stats.failedOrders} · Заработано: ${stats.totalEarned.toLocaleString('ru-RU')} ₽ · Рекорд доставки: ${stats.bestDeliveryReward.toLocaleString('ru-RU')} ₽\nКомпания: +${Math.round(d.companyBonus * 100)}% дохода при открытии`;
        const action = document.createElement('button'); action.textContent = selected ? 'ВЫБРАН' : owned ? 'ВЫБРАТЬ' : `ОТКРЫТЬ ЗА ${d.cost} ₽`;
        action.disabled = selected;
        action.onclick = () => {
          if (owned) this.switchTo(id);
          else {
            const error = state.districtUnlockError(id);
            if (error) { feedback.textContent = error; return; }
            if (state.unlockDistrict(id)) { feedback.textContent = ''; this.showIntroduction(id); }
          }
        };
        card.append(title, text, progress, action); list.append(card);
      }
      if (orders.getTarget() || orders.events?.active) feedback.textContent = 'СНАЧАЛА ЗАВЕРШИТЕ ТЕКУЩИЙ ЗАКАЗ';
    };
    const onOpen = () => {
      render(); const s = state.getSnapshot();
      const pending = s.unlockedDistricts.find(id => !s.districtIntroductionsSeen.includes(id));
      if (pending) this.showIntroduction(pending);
    };
    opener.addEventListener('click', onOpen);
    this.unsubscribe = state.subscribe(render); this.unsubscribeOrder = orders.subscribe(render);
    scene.events.once('shutdown', () => {
      this.unsubscribe(); this.unsubscribeOrder(); state.isDistrictBlocked = null;
      opener.removeEventListener('click', onOpen); dialog.remove(); opener.remove();
    });
  }
}
