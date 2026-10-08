import { audio } from '../services/GameRuntime.js';
import { formatMoney } from '../services/LocalizationService.js';

export class FeedbackUI {
  constructor(scene, state) {
    this.money = document.querySelector('#money-popup'); this.panel = document.querySelector('#order-panel');
    this.clear = () => { this.money.hidden = true; this.money.classList.remove('money-rise'); };
    this.clearPulse = () => this.panel.classList.remove('success-pulse', 'major-pulse');
    this.money.addEventListener('animationend', this.clear); this.panel.addEventListener('animationend', this.clearPulse);
    let previous;
    this.unsubscribe = state.subscribe(s => {
      if (previous) {
        if (s.money > previous.money) {
          this.money.textContent = `+${formatMoney(s.money - previous.money)}`;
          this.money.hidden = false; this.money.classList.remove('money-rise');
          void this.money.offsetWidth; this.money.classList.add('money-rise'); audio?.play('reward');
        }
        const purchase = s.ownedItems.length > previous.ownedItems.length || s.ownedTransports.length > previous.ownedTransports.length
          || s.unlockedDistricts.length > previous.unlockedDistricts.length || s.companyUnlocked && !previous.companyUnlocked
          || s.employees.length > previous.employees.length || s.companyVehicles.length > previous.companyVehicles.length
          || s.officeLevel > previous.officeLevel || Object.keys(s.companyUpgrades).some(k => s.companyUpgrades[k] > previous.companyUpgrades[k]);
        if (purchase) { audio?.play('purchase'); this.pulse('major-pulse'); }
        if (s.level > previous.level) { audio?.play('achievement'); this.pulse('major-pulse'); }
      }
      previous = s;
    });
    this.unsubscribeOrder = scene.orders.subscribe(event => {
      if (event === 'accepted') audio?.play('accepted');
      if (event === 'failed') audio?.play('negative');
      if (event === 'completed') { audio?.play('success'); this.pulse('success-pulse'); }
    });
    this.unsubscribeAchievements = state.progression.subscribe(() => audio?.play('achievement'));
    scene.events.once('shutdown', () => {
      this.unsubscribe(); this.unsubscribeOrder(); this.unsubscribeAchievements(); this.clear(); this.clearPulse();
      this.money.removeEventListener('animationend', this.clear); this.panel.removeEventListener('animationend', this.clearPulse);
    });
  }
  pulse(kind) { this.clearPulse(); void this.panel.offsetWidth; this.panel.classList.add(kind); }
}
