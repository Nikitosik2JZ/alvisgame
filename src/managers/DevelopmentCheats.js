import { xpForLevel } from '../config/gameBalance.js';
import { transportFor, TRANSPORTS } from '../config/transportConfig.js';
import { COMPANY } from '../config/companyConfig.js';

export function setupDevelopmentCheats(scene, state) {
  if (!import.meta.env.DEV) return;
  const handler = (event) => {
    if (event.repeat) return;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target?.tagName)) return;
    if (event.altKey && ['KeyC', 'KeyM', 'KeyH', 'KeyO'].includes(event.code)) {
      event.preventDefault(); const company = scene.company;
      if (event.code === 'KeyC') {
        state.update({ xp: Math.max(state.values.xp, xpForLevel(COMPANY.unlockLevel)), money: Math.max(state.values.money, COMPANY.unlockPrice) });
        company.openCompany(COMPANY.defaultName);
      } else if (event.code === 'KeyM') {
        if (state.values.companyUnlocked) { state.values.companyBalance += 10000; state.refresh(); }
      } else if (event.code === 'KeyH') {
        state.update({ money: state.values.money + COMPANY.hireCost }); company.hire();
      } else {
        company.tick(); state.values.lastCompanyUpdateTimestamp = Date.now() - 3600000; company.resumeOffline();
        company.offlineNoticeShown = false; scene.companyUI.pendingOffline = company.offlineEarned > 0;
      }
      console.debug(`[Development] ${event.code}: company command`); return;
    }
    if (['F4', 'F5', 'F6'].includes(event.code)) {
      event.preventDefault(); scene.deliveryEvents.debug({ F4: 'POSITIVE', F5: 'NEGATIVE', F6: 'CHOICE' }[event.code]); return;
    }
    if (event.code === 'F7') { event.preventDefault(); state.update({ xp: Math.max(450, state.getSnapshot().xp), money: Math.max(3000, state.getSnapshot().money) }); return; }
    const player = state.getSnapshot();
    if (['F8', 'F9'].includes(event.code)) {
      event.preventDefault();
      const t = transportFor(event.code === 'F8' ? 'MOPED' : 'CAR');
      state.update({ xp: Math.max(player.xp, xpForLevel(t.requiredLevel)), money: Math.max(player.money, t.purchasePrice) });
      console.debug(`[Development] ${event.code}: level ${t.requiredLevel}, funds ${t.purchasePrice} ₽ — purchase ${t.name} in garage`);
      return;
    }
    if (event.code === 'F10') {
      event.preventDefault();
      const owned = TRANSPORTS.filter(t => player.ownedTransports.includes(t.id));
      const next = owned[(owned.findIndex(t => t.id === player.equippedTransport) + 1) % owned.length];
      const result = state.equipTransport(next.id);
      console.debug('[Development] F10:', result.ok ? next.name : result.reason);
      document.querySelector('#garage-feedback').textContent = result.ok ? next.name : result.reason;
      return;
    }
    if (event.code === 'F2') {
      event.preventDefault();
      state.update({ money: player.money + 1000 });
      console.debug('[Development] F2: +1000 ₽');
    } else if (event.code === 'F3') {
      event.preventDefault();
      state.update({ xp: player.xp + 100 });
      console.debug('[Development] F3: +100 XP');
    }
  };
  window.addEventListener('keydown', handler);
  scene.events.once('shutdown', () => window.removeEventListener('keydown', handler));
}
