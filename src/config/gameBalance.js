export { ECONOMY as BALANCE } from './economyConfig.js';

// Total XP to reach level L: 0, 100, 250, 450, ...
export const xpForLevel = (level) => 25 * (level - 1) * (level + 2);
export const levelForXP = (xp) => Math.max(1, Math.floor((-1 + Math.sqrt(9 + 0.16 * xp)) / 2));
