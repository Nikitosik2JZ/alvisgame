import { PLATFORM_CONFIG as C } from '../config/platformConfig.js';
export function courierScore(s) {
  const w = C.score;
  return Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(
    Math.max(s.level, s.personalRecords.highestLevel) * w.level
    + Math.max(0, s.personalRecords.highestReputation, s.reputation) * w.reputation
    + s.completedOrders * w.deliveries + s.unlockedDistricts.length * w.districts
    + s.achievements.length * w.achievements + (s.companyUnlocked ? s.officeLevel * w.office : 0)
    + Object.values(s.companyUpgrades).reduce((a, b) => a + b, 0) * w.upgrades
    + s.companyStats.employeeDeliveries * w.employeeDeliveries + s.legacyUpgrades.length * w.legacy)));
}
export class LeaderboardManager {
  constructor(state, platform, saves) {
    this.state = state; this.platform = platform; this.saves = saves; this.lastSent = -1; this.lastAttempt = -1;
    this.unsubscribe = state.subscribe(() => this.schedule());
  }
  schedule() {
    if (!this.platform.isAuthorized() || this.timer || this.saves.blockers.size || courierScore(this.state.values) <= this.lastAttempt) return;
    this.timer = setTimeout(async () => {
      this.timer = null;
      if (this.saves.blockers.size) return;
      const score = courierScore(this.state.values);
      this.lastAttempt = score;
      // A failed request is retried only after another meaningful progression mutation.
      if (await this.platform.setLeaderboardScore(score)) this.lastSent = score;
    }, C.leaderboardIntervalMs);
  }
  destroy() { clearTimeout(this.timer); this.unsubscribe(); }
}
