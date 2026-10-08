import { PLATFORM_CONFIG as C } from '../config/platformConfig.js';

export const withTimeout = (promise, ms = C.requestTimeoutMs) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('Platform timeout')), ms);
  Promise.resolve(promise).then(resolve, reject).finally(() => clearTimeout(timer));
});

export class PlatformService {
  constructor({ window: host = globalThis.window, storage, clock = () => performance.now(), wallNow = Date.now, loadSDK } = {}) {
    this.host = host; this.storage = storage; this.clock = clock; this.wallNow = wallNow; this.loadSDK = loadSDK;
    this.mode = 'LOCAL'; this.saveKey = 'courier-empire-save-v1'; this.listeners = new Map(); this.accountEpoch = 0;
    this.ready = false; this.playing = false;
  }
  initialize() { return this.initialization ??= this.initializeOnce(); }
  async initializeOnce() {
    try {
      if (this.loadSDK) await this.loadSDK();
      else if (!this.host?.YaGames && this.host && !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(this.host.location.hostname)
        && !import.meta.env?.DEV) await this.loadScript();
      if (this.host?.YaGames?.init) {
        this.sdk = await withTimeout(this.host.YaGames.init(), C.sdkTimeoutMs);
        this.language = this.sdk.environment?.i18n?.lang;
        this.mode = 'YANDEX'; this.subscribeSDK();
        this.getServerTime();
        await this.reacquirePlayer();
      }
    } catch { this.sdk = null; this.mode = 'LOCAL'; }
    if (this.mode === 'LOCAL') console.info('[Platform] LOCAL mode');
    return { mode: this.mode };
  }
  loadScript() {
    return withTimeout(new Promise((resolve, reject) => {
      const script = this.host.document.createElement('script'); script.src = '/sdk.js'; script.async = true;
      script.onload = resolve; script.onerror = reject; this.host.document.head.append(script);
    }), C.sdkTimeoutMs);
  }
  on(event, listener) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(listener); return () => this.listeners.get(event).delete(listener);
  }
  emit(event) { for (const listener of this.listeners.get(event) || []) listener(); }
  subscribeSDK() {
    this.sdk.on?.('game_api_pause', () => this.emit('pause'));
    this.sdk.on?.('game_api_resume', () => this.emit('resume'));
    for (const [event, internal] of [['ACCOUNT_SELECTION_DIALOG_OPENED', 'accountOpen'], ['ACCOUNT_SELECTION_DIALOG_CLOSED', 'accountClose']]) {
      this.sdk.on?.(this.sdk.EVENTS?.[event] ?? event, () => { this.accountEpoch++; this.emit(internal); });
    }
  }
  isPlatformAvailable() { return Boolean(this.sdk); }
  isYandex() { return this.mode === 'YANDEX'; }
  getLanguage() { return this.isYandex() ? this.language ?? '' : 'ru'; }
  getDeviceType() {
    return this.sdk?.deviceInfo?.type || (this.host?.matchMedia?.('(pointer: coarse)').matches ? 'mobile' : 'desktop');
  }
  getServerTime() {
    if (!this.isYandex()) return this.wallNow();
    try {
      const time = this.sdk.serverTime();
      if (Number.isFinite(time) && time > 0) { this.timeAnchor = time; this.clockAnchor = this.clock(); return time; }
    } catch { /* Never switch to an editable device clock on Yandex. */ }
    return this.timeAnchor ? this.timeAnchor + Math.max(0, this.clock() - this.clockAnchor) : null;
  }
  async reacquirePlayer() {
    try { this.player = await withTimeout(this.sdk.getPlayer()); }
    catch { this.player = null; }
    return this.player;
  }
  getPlayer() { return this.player || null; }
  isAuthorized() { try { return this.player?.isAuthorized?.() === true; } catch { return false; } }
  getPlayerID() { try { return this.player?.getUniqueID?.() || null; } catch { return null; } }
  getPlayerName() { try { return this.isAuthorized() ? this.player.getName?.() || '' : ''; } catch { return ''; } }
  async requestAuthorization() {
    if (!this.sdk?.auth?.openAuthDialog) return false;
    try { await this.sdk.auth.openAuthDialog(); await this.reacquirePlayer(); return this.isAuthorized(); }
    catch { return false; }
  }
  localKey() { return this.isYandex() ? `${this.saveKey}:yandex:${this.getPlayerID() || 'unavailable'}` : this.saveKey; }
  readLocal(key = this.localKey()) {
    try { return JSON.parse((this.storage || this.host?.localStorage)?.getItem(key) || 'null'); } catch { return null; }
  }
  writeLocal(data, key = this.localKey()) {
    try {
      const storage = this.storage || this.host?.localStorage;
      if (!storage) return false;
      storage.setItem(key, JSON.stringify(data)); return true;
    } catch { return false; }
  }
  async loadCloudSave() {
    if (!this.player) throw new Error('Player unavailable');
    const data = await withTimeout(this.player.getData([C.cloudKey]));
    return data?.[C.cloudKey] ?? null;
  }
  async saveCloudData(save) {
    if (!this.player) return false;
    const data = { [C.cloudKey]: save };
    if (new TextEncoder().encode(JSON.stringify(data)).length > C.cloudMaxBytes) return false;
    try { const player = this.player; await withTimeout(player.setData(data, true)); return true; } catch { return false; }
  }
  gameReady() {
    if (this.ready) return; this.ready = true;
    try { this.sdk?.features?.LoadingAPI?.ready(); } catch { /* Local gameplay remains usable. */ }
  }
  gameplayStart() {
    if (this.playing || !this.ready) return; this.playing = true;
    try { this.sdk?.features?.GameplayAPI?.start(); } catch { /* Optional metric. */ }
  }
  gameplayStop() {
    if (!this.playing) return; this.playing = false;
    try { this.sdk?.features?.GameplayAPI?.stop(); } catch { /* Optional metric. */ }
  }
  showInterstitial() { return this.ad('showFullscreenAdv'); }
  showRewarded(onRewarded) { return this.ad('showRewardedVideo', onRewarded); }
  ad(method, onRewarded) {
    if (!this.sdk?.adv?.[method] || this.adInFlight) return Promise.resolve({ shown: false, rewarded: false });
    this.adInFlight = true;
    return new Promise(resolve => {
      let rewarded = false, opened = false, settled = false;
      const finish = (shown = false) => {
        if (settled) return; settled = true; this.adInFlight = false;
        resolve({ shown: Boolean(shown || opened), rewarded });
      };
      try {
        this.sdk.adv[method]({ callbacks: {
          onOpen: () => { if (!settled) opened = true; },
          onRewarded: () => { if (!settled && !rewarded) { rewarded = true; onRewarded?.(); } },
          onClose: shown => finish(shown), onError: () => finish(), onOffline: () => finish(),
        } });
      } catch { finish(); }
      // Do not resume a video on a timer while it may still be onscreen.
    });
  }
  async leaderboard(method, ...args) {
    if (!this.isAuthorized() || !this.sdk?.leaderboards?.[method]) return null;
    const epoch = this.accountEpoch;
    try {
      if (this.sdk.isAvailableMethod && !await withTimeout(this.sdk.isAvailableMethod(`leaderboards.${method}`))) return null;
      if (epoch !== this.accountEpoch) return null;
      return await withTimeout(this.sdk.leaderboards[method](C.leaderboardName, ...args));
    } catch { return null; }
  }
  async setLeaderboardScore(score) {
    if (!this.isAuthorized()) return false;
    if (this.lastScoreRequest != null && this.clock() - this.lastScoreRequest < C.leaderboardIntervalMs) return false;
    this.lastScoreRequest = this.clock();
    return (await this.leaderboard('setScore', Math.max(0, Math.floor(score)))) !== null;
  }
  cachedLeaderboard(method, interval, ...args) {
    this.leaderboardCache ??= new Map();
    const cached = this.leaderboardCache.get(method);
    if (cached && cached.epoch === this.accountEpoch && this.clock() - cached.at < interval) return cached.promise;
    const promise = this.leaderboard(method, ...args);
    this.leaderboardCache.set(method, { epoch: this.accountEpoch, at: this.clock(), promise });
    return promise;
  }
  getLeaderboardEntries() { return this.cachedLeaderboard('getEntries', C.leaderboardEntriesCacheMs, { quantityTop: 5, includeUser: true, quantityAround: 3 }); }
  getPlayerLeaderboardEntry() { return this.cachedLeaderboard('getPlayerEntry', C.leaderboardPlayerCacheMs); }
}
export const platformService = new PlatformService();
