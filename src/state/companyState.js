import { COMPANY, companyLevel, companyName, companyVehicle } from '../config/companyConfig.js';

const amount = (value, fallback = 0) => Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER ? value : fallback;
const identifier = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value);
export const initialCompanyState = () => ({
  companyUnlocked: false, companyName: COMPANY.defaultName, companyLevel: 1,
  companyBalance: 0, companyIncomeRemainder: 0, companyLifetimeEarnings: 0,
  employees: [], companyVehicles: [], lastCompanyUpdateTimestamp: null,
  companyStats: { employeesHired: 0, totalIncomeCollected: 0 }, companyLog: [],
});

// Do not trust saved assignments: personal vehicles never enter the company fleet.
export function loadCompanyState(data) {
  const result = initialCompanyState();
  if (data.companyUnlocked !== true) return result;
  result.companyUnlocked = true;
  result.companyName = companyName(data.companyName);
  result.companyLevel = companyLevel(data.companyLevel).level;
  const ids = new Set();
  if (Array.isArray(data.companyVehicles)) for (const vehicle of data.companyVehicles.slice(0, 1000)) {
    if (!vehicle || !identifier(vehicle.id) || ids.has(vehicle.id) || !companyVehicle(vehicle.type)) continue;
    ids.add(vehicle.id); result.companyVehicles.push({ id: vehicle.id, type: vehicle.type });
  }
  ids.clear();
  const assigned = new Set();
  if (Array.isArray(data.employees)) for (const employee of data.employees.slice(0, 1000)) {
    if (result.employees.length >= companyLevel(result.companyLevel).slots) break;
    if (!employee || !identifier(employee.id) || ids.has(employee.id)) continue;
    ids.add(employee.id);
    const vehicle = result.companyVehicles.find(v => v.id === employee.assignedTransport && !assigned.has(v.id));
    if (vehicle) assigned.add(vehicle.id);
    result.employees.push({ id: employee.id, name: companyName(employee.name),
      level: Math.max(1, Math.min(100, Math.floor(amount(employee.level, 1)))),
      efficiency: Math.max(0.1, Math.min(2, amount(employee.efficiency, 1))),
      assignedTransport: vehicle?.id || null, baseIncome: Math.min(COMPANY.baseIncome * 2, amount(employee.baseIncome, COMPANY.baseIncome)),
      status: employee.status === 'IDLE' ? 'IDLE' : 'WORKING', totalEarned: amount(employee.totalEarned) });
  }
  result.companyBalance = Math.floor(amount(data.companyBalance));
  result.companyIncomeRemainder = Math.min(0.999999999, amount(data.companyIncomeRemainder));
  result.companyLifetimeEarnings = Math.max(result.companyBalance, Math.floor(amount(data.companyLifetimeEarnings)));
  result.lastCompanyUpdateTimestamp = Number.isSafeInteger(data.lastCompanyUpdateTimestamp) && data.lastCompanyUpdateTimestamp > 0
    ? data.lastCompanyUpdateTimestamp : null;
  result.companyStats = {
    employeesHired: Math.max(result.employees.length, Math.floor(amount(data.companyStats?.employeesHired))),
    totalIncomeCollected: Math.floor(amount(data.companyStats?.totalIncomeCollected)),
  };
  if (Array.isArray(data.companyLog)) result.companyLog = data.companyLog.filter(message => typeof message === 'string')
    .slice(0, COMPANY.logLimit).map(message => message.slice(0, 160));
  return result;
}
