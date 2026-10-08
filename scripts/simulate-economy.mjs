import { GameState } from '../src/state/GameState.js';
import { OrderManager } from '../src/managers/OrderManager.js';
import { CompanyManager } from '../src/managers/CompanyManager.js';
import { districtDeliveryLocations } from '../src/world/deliveryLocations.js';
import { ECONOMY } from '../src/config/economyConfig.js';
import { COMPANY } from '../src/config/companyConfig.js';
import { DISTRICTS } from '../src/config/districtConfig.js';
import { xpForLevel } from '../src/config/gameBalance.js';
import { pathToFileURL } from 'node:url';

// Expected values, not simulated pathfinding or evidence of hardware/play sessions.
export function estimatePhase(transport, district, level, samples = 2000, pace = 1) {
  let seed = 12;
  const random = () => ((seed = Math.imul(seed, 1664525) + 1013904223 >>> 0) / 4294967296);
  const state = new GameState({ tasks: { date: () => null } });
  state.loadSaveData({ version: 12, money: 0, xp: xpForLevel(level), reputation: level * 7, ownedTransports: ['WALKING', transport],
    equippedTransport: transport, unlockedDistricts: ['residential', district], selectedDistrict: district });
  const orders = new OrderManager({ state, ...districtDeliveryLocations(district), random });
  let money = 0, seconds = 0, xp = 0, distance = 0;
  for (let i = 0; i < samples; i++) {
    orders.order = null; orders.generate(); const order = orders.order;
    money += order.reward * (level >= 6 ? 1.10 : 1); xp += order.xpReward; distance += order.distance;
    // Pickup leg ~65% of delivery distance, road detours ~40%, handling/menu 17 s.
    seconds += (order.distance * 1.65 * 1.4 / (state.values.movementSpeed * ECONOMY.metersPerPixel) + 17) * pace;
  }
  orders.destroy();
  return { transport, district, moneyPerOrder: money / samples, xpPerOrder: xp / samples,
    metersPerOrder: distance / samples, secondsPerOrder: seconds / samples,
    ordersPerHour: 3600 * samples / seconds, incomePerMinute: money / seconds * 60 };
}
export function simulate(pace = 1, adFraction = 0) {
  const phases = [['WALKING', 'residential', 1], ['BICYCLE', 'center', 4], ['MOPED', 'industrial', 7], ['CAR', 'elite', 12], ['CAR', 'business', 20]]
    .map(p => estimatePhase(...p, 2000, pace));
  let total = 0;
  const advance = (cost, phase) => total += cost / (phases[phase].incomePerMinute * (1 + .5 * adFraction));
  const milestones = { shoesMinutes: ECONOMY.oldShoesPrice / phases[0].incomePerMinute };
  milestones.bicycleMinutes = advance(ECONOMY.oldShoesPrice + ECONOMY.bicyclePrice, 0);
  milestones.mopedMinutes = advance(ECONOMY.mopedPrice + DISTRICTS.center.cost + ECONOMY.thermobagPrice, 1);
  milestones.carMinutes = advance(ECONOMY.carPrice + DISTRICTS.industrial.cost, 2);
  milestones.companyMinutes = advance(COMPANY.unlockPrice + DISTRICTS.elite.cost, 3);
  const state = new GameState(); state.loadSaveData({ companyUnlocked: true, officeLevel: 4,
    employees: Array.from({ length: 8 }, (_, i) => ({ id: `e${i}`, name: 'courier', level: 7, assignedTransport: `v${i}` })),
    companyVehicles: Array.from({ length: 8 }, (_, i) => ({ id: `v${i}`, type: 'CAR' })),
    companyUpgrades: { dispatch: 2, routing: 2, training: 2, advertising: 2 }, unlockedDistricts: Object.keys(DISTRICTS) });
  const company = new CompanyManager(state);
  const companyRate = company.incomeRate();
  // 60% developed-fleet uptime proxies ramp-up, not itemized fleet investment.
  const magnateHours = Math.max(total / 60 + (1000000 / (companyRate * .6)) / 60,
    total / 60 + 500000 / phases[4].incomePerMinute / 60);
  return { assumptions: { pace, adFraction, detour: 1.4, pickupRatio: .65, handlingSeconds: 17, developedFleetUptime: .6 },
    phases, milestones, developedCompanyIncomePerMinute: companyRate, magnateHours };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify({ ordinary: simulate(), slower: simulate(1.3), optionalAdsQuarterOfOrders: simulate(1, .25) }, null, 2));
}
