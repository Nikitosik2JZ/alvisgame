import { formatNumber } from '../services/LocalizationService.js';
import { t as tr, localization } from '../services/LocalizationService.js';
import { DISTRICTS, districtRequirements, districtMastery, companyDistrictBonus, ELITE_ORDERS } from '../config/districtConfig.js';
import { transportFor } from '../config/transportConfig.js';
import { ModalUI } from './ModalUI.js';

export class DistrictUI extends ModalUI {
  constructor(scene, state, player, orders, switchWorld) {
    const opener = document.createElement('button'); opener.id = 'open-districts'; opener.textContent = tr('district-ui.001'); document.querySelector('.hud-actions').append(opener);
    const dialog = document.createElement('dialog'); dialog.id = 'district-dialog'; dialog.className = 'progression-dialog';
    dialog.setAttribute('aria-labelledby', 'city-title');
    dialog.innerHTML = tr('district-ui.002');
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
      intro.querySelector('h3').textContent = tr('district-ui.003', { v0: d.name.toUpperCase() });
      intro.querySelector('p').textContent = tr('district-ui.004', { v0: d.description, v1: d.money, v2: d.xp, v3: d.recommendedTransports.map(t => transportFor(t).name).join(' / ') });
      const button = intro.querySelector('button');
      button.onclick = () => {
        intro.hidden = true; state.markDistrictIntroduction(id);
        this.switchTo(id);
      };
      if (dialog.open) { intro.scrollIntoView({ block: 'start' }); button.focus(); }
    };
    const render = () => {
      const s = state.getSnapshot(), next = Object.entries(DISTRICTS).find(([id]) => !s.unlockedDistricts.includes(id));
      dialog.querySelector('#city-summary').textContent = tr('district-ui.007', { v0: s.unlockedDistricts.length, v1: Object.keys(DISTRICTS).length, v2: DISTRICTS[s.selectedDistrict].name, v3: next ? tr('district-ui.005', { v0: next[1].name, v1: districtRequirements(next[1]) }) : tr('district-ui.006'), v4: Math.round(companyDistrictBonus(s) * 100) });
      const list = dialog.querySelector('#district-list'); list.replaceChildren();
      for (const [id, d] of Object.entries(DISTRICTS)) {
        const owned = s.unlockedDistricts.includes(id), selected = s.selectedDistrict === id, stats = s.districtStats[id], mastery = districtMastery(stats.completedOrders);
        const card = document.createElement('article'); card.className = 'shop-item district-card'; card.dataset.district = id;
        card.dataset.state = selected ? 'EQUIPPED' : owned ? 'OWNED' : 'LOCKED';
        card.style.setProperty('--district-color', `#${d.visual.building.toString(16).padStart(6, '0')}`);
        const title = document.createElement('h3'); title.textContent = d.name.toUpperCase();
        const text = document.createElement('p'); text.textContent = tr('district-ui.011', { v0: owned ? selected ? tr('district-ui.008') : tr('district-ui.009') : districtRequirements(d), v1: d.description, v2: d.money, v3: d.xp, v4: d.tip, v5: d.routeRange.join('–'), v6: d.orderSummary, v7: d.recommendedTransports.map(t => transportFor(t).name).join(' / '), v8: ELITE_ORDERS.districts.includes(id) ? tr('district-ui.010', { v0: ELITE_ORDERS.level, v1: ELITE_ORDERS.reputation }) : '' });
        const progress = document.createElement('small'); progress.textContent = tr('district-ui.012', { v0: mastery.name, v1: localization.plural('count.deliveries', stats.completedOrders), v2: Math.round(mastery.bonus * 100), v3: stats.failedOrders, v4: formatNumber(stats.totalEarned), v5: formatNumber(stats.bestDeliveryReward), v6: Math.round(d.companyBonus * 100) });
        const action = document.createElement('button'); action.textContent = selected ? tr('district-ui.013') : owned ? tr('district-ui.014') : tr('district-ui.015', { v0: d.cost });
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
      if (orders.getTarget() || orders.events?.active) feedback.textContent = tr('game-state.004');
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
