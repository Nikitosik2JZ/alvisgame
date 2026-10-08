import { t as tr, localization, formatMoney, formatNumber } from '../services/LocalizationService.js';
import { xpForLevel } from '../config/gameBalance.js';
import { itemById } from '../data/shopItems.js';
import { ModalUI } from './ModalUI.js';
import { reputationTier, DISTRICTS } from '../config/economyConfig.js';
import { transportFor, careerTitle, nextTransportGoal } from '../config/transportConfig.js';
import { COMPANY } from '../config/companyConfig.js';
import { selectedTitle } from '../managers/AchievementManager.js';

export class PlayerProfileUI extends ModalUI {
  constructor(scene, state, player) {
    super(scene, player, 'profile-dialog', 'open-profile');
    this.unsubscribe = state.subscribe(snapshot => {
      const next = nextTransportGoal(snapshot);
      const rows = [ [tr('player-profile-ui.001'), careerTitle(snapshot)], [tr('achievement-manager.004'), selectedTitle(snapshot) || careerTitle(snapshot)], [tr('progression-config.005'), snapshot.level], [tr('company-config.035'), tr('common.xp', { current: snapshot.xp, next: xpForLevel(snapshot.level + 1) })],
        [tr('progression-config.006'), snapshot.reputation], [tr('player-profile-ui.002'), reputationTier(snapshot.reputation).name], [tr('player-profile-ui.003'), formatMoney(snapshot.money)],
        [tr('player-profile-ui.004'), DISTRICTS[snapshot.selectedDistrict].name], [tr('player-profile-ui.005'), localization.plural('count.orders', snapshot.demandBonusOrders)],
        [tr('company-ui.070'), transportFor(snapshot.equippedTransport).name],
        [tr('player-profile-ui.007'), itemById(snapshot.equippedItems.SHOES)?.name || tr('player-profile-ui.008')],
        [tr('player-profile-ui.009'), itemById(snapshot.equippedItems.BAG)?.name || tr('player-profile-ui.008')], [tr('company-ui.069'), tr('player-profile-ui.010', { v0: snapshot.movementSpeed })],
        [tr('player-profile-ui.011'), snapshot.completedOrders], [tr('player-profile-ui.012'), snapshot.failedOrders],
        [tr('company-ui.071'), formatMoney(snapshot.totalMoneyEarned)], [tr('player-profile-ui.013'), formatMoney(snapshot.totalTipsEarned)],
        [tr('player-profile-ui.014'), formatMoney(snapshot.totalFinesPaid)], [tr('player-profile-ui.015'), tr('player-profile-ui.016', { v0: snapshot.totalDistanceDelivered })],
        [tr('progression-config.020'), snapshot.companyUnlocked ? snapshot.companyName : tr('player-profile-ui.017')],
        [tr('player-profile-ui.018'), next ? tr('player-profile-ui.019', { v0: next.name, v1: next.purchasePrice, v2: next.requiredLevel }) : snapshot.companyUnlocked ? tr('player-profile-ui.020') : tr('player-profile-ui.021', { v0: COMPANY.unlockPrice, v1: COMPANY.unlockLevel })] ];
      const details = document.querySelector('#profile-details');
      details.replaceChildren();
      for (const [label, value] of rows) {
        const term = document.createElement('dt'); term.textContent = label;
        const definition = document.createElement('dd'); definition.textContent = typeof value === 'number' ? formatNumber(value) : value;
        details.append(term, definition);
      }
    });
    scene.events.once('shutdown', () => this.unsubscribe());
  }
}
