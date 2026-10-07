export const PLATFORM_CONFIG = Object.freeze({
  sdkTimeoutMs: 8000, requestTimeoutMs: 10000,
  cloudKey: 'courierEmpire', cloudMaxBytes: 190000,
  saveDebounceMs: 1500, cloudIntervalMs: 5000, minorSaveMs: 30000,
  leaderboardName: 'courier_score', leaderboardIntervalMs: 10000,
  leaderboardEntriesCacheMs: 16000, leaderboardPlayerCacheMs: 6000,
  ads: { ordersBetweenInterstitials: 4, firstInterstitialMs: 180000, interstitialIntervalMs: 180000, rewardedMultiplier: .5, stickyBanners: false },
  score: { level: 1000, reputation: 10, deliveries: 100, districts: 2000, achievements: 500, office: 1500, upgrades: 750, employeeDeliveries: 5, legacy: 500 },
});
