import { xpForLevel } from '../config/gameBalance.js';
import { transportFor, TRANSPORTS } from '../config/transportConfig.js';
import { COMPANY, employeeXpRequired } from '../config/companyConfig.js';
import { DISTRICTS, DISTRICT_MASTERY, ELITE_ORDERS } from '../config/districtConfig.js';

export function setupDevelopmentCheats(scene, state) {
  if (!import.meta.env.DEV) return;
  const unlock = id => {
    const d = DISTRICTS[id]; if (!d || state.values.unlockedDistricts.includes(id)) return false;
    state.update({ xp: Math.max(state.values.xp, xpForLevel(d.level)), money: state.values.money + d.cost,
      reputation: Math.max(state.values.reputation, d.reputation) });
    if (d.requiredOwnedTransports && !d.requiredOwnedTransports.some(t => state.values.ownedTransports.includes(t))) {
      state.values.ownedTransports.push(d.requiredOwnedTransports[0]); state.refresh();
    }
    return state.unlockDistrict(id);
  };
  const debug = {
    unlockNext: () => unlock(Object.keys(DISTRICTS).find(id => !state.values.unlockedDistricts.includes(id))),
    unlockAll: () => Object.keys(DISTRICTS).forEach(unlock),
    setReputation: reputation => { if (Number.isFinite(reputation)) state.update({ reputation }); },
    setLevel: level => { if (Number.isInteger(level) && level >= 1) state.update({ xp: xpForLevel(level) }); },
    elite: variant => {
      if (!ELITE_ORDERS.districts.includes(state.values.selectedDistrict) || scene.orders.getTarget() || document.querySelector('dialog[open]') || scene.districtTransition) return false;
      state.update({ xp: Math.max(state.values.xp, xpForLevel(ELITE_ORDERS.level)), reputation: Math.max(state.values.reputation, ELITE_ORDERS.reputation) });
      scene.orders.order = null; return scene.orders.generate({ forcedType: 'ELITE', forcedVariant: variant });
    },
    mastery: (count = DISTRICT_MASTERY.at(-1).min) => {
      if (!Number.isFinite(count)) return;
      state.values.districtStats[state.values.selectedDistrict].completedOrders = Math.max(0, Math.floor(count)); state.refresh();
    },
    switchDistrict: id => scene.districtUI.switchTo(id),
  };
  window.courierDebug = debug;
  const handler = (event) => {
    if (event.repeat) return;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target?.tagName)) return;
    if (event.ctrlKey && event.altKey && ['KeyN', 'KeyA', 'KeyE', 'KeyK', 'KeyD'].includes(event.code)) {
      event.preventDefault();
      if (event.code === 'KeyN') debug.unlockNext();
      if (event.code === 'KeyA') debug.unlockAll();
      if (event.code === 'KeyE') debug.elite();
      if (event.code === 'KeyK') debug.mastery();
      if (event.code === 'KeyD') {
        const ids = state.values.unlockedDistricts; debug.switchDistrict(ids[(ids.indexOf(state.values.selectedDistrict) + 1) % ids.length]);
      }
      console.debug(`[Development] ${event.code}: Stage 8 city command`); return;
    }
    if (event.altKey && ['KeyR', 'KeyP', 'KeyL', 'Digit1', 'Digit2', 'Digit3', 'KeyU', 'KeyT'].includes(event.code)) {
      event.preventDefault(); const company = scene.company, s = state.values;
      if (!s.companyUnlocked) return;
      if (event.code === 'KeyR') company.refreshCandidates(true);
      else if (event.code === 'KeyP') { company.reputation(50); state.refresh(); }
      else if (event.code === 'KeyL') {
        company.tick(); const employee = s.employees[0];
        if (employee) company.addXp(employee, employeeXpRequired(employee.level)); state.refresh();
      } else if (event.code === 'KeyU') {
        const next = COMPANY.levels.find(level => level.level === s.officeLevel + 1);
        if (next) { state.update({ money: s.money + next.price }); company.upgrade(); }
      } else if (event.code === 'KeyT') {
        company.tick(); company.accrue(5 * 60000); company.events.advance(5 * 60000); state.refresh();
      } else company.events.debug({ Digit1: 'POSITIVE', Digit2: 'NEGATIVE', Digit3: 'CHOICE' }[event.code]);
      console.debug(`[Development] ${event.code}: Stage 7 company command`); return;
    }
    if (event.altKey && ['KeyC', 'KeyM', 'KeyH', 'KeyO'].includes(event.code)) {
      event.preventDefault(); const company = scene.company;
      if (event.code === 'KeyC') {
        state.update({ xp: Math.max(state.values.xp, xpForLevel(COMPANY.unlockLevel)), money: Math.max(state.values.money, COMPANY.unlockPrice) });
        company.openCompany(COMPANY.defaultName);
      } else if (event.code === 'KeyM') {
        if (state.values.companyUnlocked) { state.values.companyBalance += 10000; state.refresh(); }
      } else if (event.code === 'KeyH') {
        if (state.values.companyUnlocked && !company.candidate()) company.refreshCandidates(true);
        state.update({ money: state.values.money + (company.candidate()?.price || COMPANY.hireCost) }); company.hire();
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
  scene.events.once('shutdown', () => { window.removeEventListener('keydown', handler); if (window.courierDebug === debug) delete window.courierDebug; });
}
