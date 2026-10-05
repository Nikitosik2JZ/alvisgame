import { COMPANY, companyLevel, companyName, companyVehicle, archetypeFor, clampStat, employeeXpRequired } from '../config/companyConfig.js';
import { COMPANY_EVENT_BALANCE as B } from '../data/companyEvents.js';

const amount = (value, fallback = 0) => Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER ? value : fallback;
const identifier = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value) && !['__proto__', 'constructor', 'prototype'].includes(value);
const bounded = (value, max, fallback = 0) => Math.min(max, amount(value, fallback));
export const initialCompanyState = () => ({
  companyUnlocked: false, companyName: COMPANY.defaultName, companyLevel: 1, officeLevel: 1,
  companyBalance: 0, companyIncomeRemainder: 0, companyLifetimeEarnings: 0,
  employees: [], companyVehicles: [], lastCompanyUpdateTimestamp: null,
  companyUpgrades: Object.fromEntries(Object.keys(COMPANY.upgrades).map(key => [key, 0])),
  companyReputation: 0, companyActiveTimeMs: 0, companySimulationRemainderMs: 0,
  companyCandidates: [], candidateGeneration: 0, candidateRefreshes: 0, companyEffects: [],
  companyEventState: { remainingMs: null, lastId: null, negativeStreak: 0 },
  companyStats: { employeesHired: 0, totalIncomeCollected: 0, employeeDeliveries: 0, employeeFailures: 0,
    positiveEvents: 0, negativeEvents: 0, highestIncomePerMinute: 0 }, companyLog: [],
});

export function normalizeEmployee(employee) {
  const level = Math.max(1, Math.floor(bounded(employee.level, COMPANY.employeeMaxLevel, 1)));
  return { id: employee.id, name: companyName(employee.name),
    archetype: Object.hasOwn(COMPANY.archetypes, employee.archetype) ? employee.archetype : 'ROOKIE', level,
    efficiency: clampStat('efficiency', amount(employee.efficiency, 1)),
    reliability: clampStat('reliability', amount(employee.reliability, 1)), speed: clampStat('speed', amount(employee.speed, 1)),
    assignedTransport: null, baseIncome: bounded(employee.baseIncome, COMPANY.baseIncome * 2, COMPANY.baseIncome),
    status: employee.status === 'IDLE' ? 'IDLE' : 'WORKING', totalEarned: amount(employee.totalEarned),
    successfulDeliveries: Math.floor(amount(employee.successfulDeliveries)), failedDeliveries: Math.floor(amount(employee.failedDeliveries)),
    currentXp: level === COMPANY.employeeMaxLevel ? 0 : bounded(employee.currentXp, employeeXpRequired(level) - .000001),
    workRemainder: bounded(employee.workRemainder, 100), failureRemainder: bounded(employee.failureRemainder, .999999999),
    permanentEfficiencyBonus: bounded(employee.permanentEfficiencyBonus, COMPANY.permanentBonusCap),
    unavailableUntil: amount(employee.unavailableUntil), recoveryMessage: typeof employee.recoveryMessage === 'string' ? employee.recoveryMessage.slice(0, 160) : '',
  };
}

// Version 6 office capacity is only expanded; legacy employee/fleet IDs and all ledgers survive.
export function loadCompanyState(data) {
  const result = initialCompanyState();
  if (data.companyUnlocked !== true) return result;
  result.companyUnlocked = true; result.companyName = companyName(data.companyName);
  result.officeLevel = companyLevel(data.officeLevel ?? data.companyLevel).level;
  result.companyLevel = result.officeLevel;
  result.companyActiveTimeMs = amount(data.companyActiveTimeMs);
  result.companySimulationRemainderMs = bounded(data.companySimulationRemainderMs, COMPANY.simulationStepMs - .000001);
  const ids = new Set();
  if (Array.isArray(data.companyVehicles)) for (const vehicle of data.companyVehicles.slice(0, 1000)) {
    if (!vehicle || !identifier(vehicle.id) || ids.has(vehicle.id) || !companyVehicle(vehicle.type)) continue;
    ids.add(vehicle.id); result.companyVehicles.push({ id: vehicle.id, type: vehicle.type });
  }
  ids.clear(); const assigned = new Set();
  if (Array.isArray(data.employees)) for (const employee of data.employees.slice(0, 1000)) {
    if (result.employees.length >= companyLevel(result.officeLevel).slots) break;
    if (!employee || !identifier(employee.id) || ids.has(employee.id)) continue;
    ids.add(employee.id);
    const normalized = normalizeEmployee(employee);
    const vehicle = result.companyVehicles.find(v => v.id === employee.assignedTransport && !assigned.has(v.id));
    if (vehicle) assigned.add(vehicle.id);
    normalized.assignedTransport = vehicle?.id || null;
    normalized.unavailableUntil = Math.min(normalized.unavailableUntil, result.companyActiveTimeMs + B.maxEffectDurationMs);
    if (normalized.unavailableUntil > result.companyActiveTimeMs && employee.status === 'TEMPORARILY_UNAVAILABLE') normalized.status = 'TEMPORARILY_UNAVAILABLE';
    result.employees.push(normalized);
  }
  result.companyBalance = Math.floor(amount(data.companyBalance));
  result.companyIncomeRemainder = bounded(data.companyIncomeRemainder, .999999999);
  result.companyLifetimeEarnings = Math.max(result.companyBalance, Math.floor(amount(data.companyLifetimeEarnings)));
  result.lastCompanyUpdateTimestamp = Number.isSafeInteger(data.lastCompanyUpdateTimestamp) && data.lastCompanyUpdateTimestamp > 0 ? data.lastCompanyUpdateTimestamp : null;
  result.companyReputation = amount(data.companyReputation);
  for (const key of Object.keys(COMPANY.upgrades)) result.companyUpgrades[key] = Math.floor(bounded(data.companyUpgrades?.[key], COMPANY.upgrades[key].costs.length));
  for (const key of Object.keys(result.companyStats)) result.companyStats[key] = amount(data.companyStats?.[key]);
  result.companyStats.employeesHired = Math.max(result.employees.length, Math.floor(result.companyStats.employeesHired));
  result.companyStats.employeeDeliveries = Math.max(result.companyStats.employeeDeliveries, result.employees.reduce((sum, e) => sum + e.successfulDeliveries, 0));
  result.companyStats.employeeFailures = Math.max(result.companyStats.employeeFailures, result.employees.reduce((sum, e) => sum + e.failedDeliveries, 0));
  result.candidateGeneration = Math.floor(amount(data.candidateGeneration)); result.candidateRefreshes = Math.floor(amount(data.candidateRefreshes));
  ids.clear();
  if (Array.isArray(data.companyCandidates)) for (const candidate of data.companyCandidates.slice(0, COMPANY.candidateCount)) {
    if (!candidate || !identifier(candidate.id) || ids.has(candidate.id)) continue;
    ids.add(candidate.id); const normalized = normalizeEmployee(candidate);
    result.companyCandidates.push({ id: normalized.id, name: normalized.name, archetype: normalized.archetype,
      efficiency: normalized.efficiency, reliability: normalized.reliability, speed: normalized.speed, price: archetypeFor(normalized.archetype).cost });
  }
  if (Array.isArray(data.companyEffects)) result.companyEffects = data.companyEffects.slice(0, 20).filter(e => e &&
    Number.isFinite(e.until) && e.until > result.companyActiveTimeMs && ['companyIncome', 'employeeIncome', 'risk'].includes(e.kind) &&
    Number.isFinite(e.value) && e.value >= -.5 && e.value <= .5 && (!e.employeeId || result.employees.some(employee => employee.id === e.employeeId)))
    .map(e => ({ kind: e.kind, value: e.value, until: Math.min(e.until, result.companyActiveTimeMs + B.maxEffectDurationMs), employeeId: e.employeeId || null }));
  result.companyEventState = { remainingMs: Number.isFinite(data.companyEventState?.remainingMs) ? bounded(data.companyEventState.remainingMs, B.intervalMs[1]) : null,
    lastId: typeof data.companyEventState?.lastId === 'string' ? data.companyEventState.lastId.slice(0, 80) : null,
    negativeStreak: Math.floor(bounded(data.companyEventState?.negativeStreak, B.maxNegativeStreak)) };
  if (Array.isArray(data.companyLog)) result.companyLog = data.companyLog.filter(message => typeof message === 'string').slice(0, COMPANY.logLimit).map(message => message.slice(0, 160));
  return result;
}
