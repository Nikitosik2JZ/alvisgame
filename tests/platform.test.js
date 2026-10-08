// Deterministic contract doubles only. These tests do NOT exercise a real Yandex environment.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PlatformService, withTimeout } from '../src/services/PlatformService.js';
import { LifecycleManager } from '../src/services/LifecycleManager.js';
import { LocalizationService } from '../src/services/LocalizationService.js';
import { SaveManager, decodeSave } from '../src/services/SaveManager.js';
import { courierScore } from '../src/services/LeaderboardManager.js';
import { AdManager } from '../src/managers/PlatformOffersManager.js';
import { GameState } from '../src/state/GameState.js';
import { OrderManager } from '../src/managers/OrderManager.js';
import { CompanyManager } from '../src/managers/CompanyManager.js';
import { restaurants, customers } from '../src/world/deliveryLocations.js';
import { PLATFORM_CONFIG as C } from '../src/config/platformConfig.js';

function fixture({ authorized = false, cloud = null, playerError = false, cloudError = false } = {}) {
  let time = 0; const store = new Map(), calls = [], handlers = {};
  const player = { isAuthorized: () => authorized, getUniqueID: () => authorized ? 'account' : 'guest', getName: () => '',
    getData: async () => { if (cloudError) throw Error('offline'); return { [C.cloudKey]: cloud }; },
    setData: async data => { calls.push(['save', data]); } };
  const sdk = { on: (event, callback) => { handlers[event] = callback; }, EVENTS: {},
    environment: { i18n: { lang: 'en' } }, deviceInfo: { type: 'mobile' }, serverTime: () => Date.UTC(2026, 9, 7) + time,
    getPlayer: async () => { if (playerError) throw Error('player'); return player; },
    features: { LoadingAPI: { ready: () => calls.push(['ready']) }, GameplayAPI: { start: () => calls.push(['start']), stop: () => calls.push(['stop']) } },
    adv: {}, auth: { openAuthDialog: async () => { authorized = true; } },
    isAvailableMethod: async () => true,
    leaderboards: { setScore: async (...args) => calls.push(['score', ...args]), getEntries: async () => ({ entries: [] }), getPlayerEntry: async () => ({ rank: 2, score: 6000 }) } };
  const platform = new PlatformService({ window: { YaGames: { init: async () => sdk } }, storage: { getItem: key => store.get(key), setItem: (key, value) => store.set(key, value) }, clock: () => time });
  return { platform, sdk, player, calls, handlers, store, advance: ms => { time += ms; }, clock: () => time };
}

test('SDK missing / rejected init falls back once; local no-op ads cannot grant a reward', async () => {
  for (const host of [undefined, { YaGames: { init: async () => { throw Error('init'); } } }]) {
    const p = new PlatformService({ window: host }); await p.initialize(); await p.initialize();
    assert.equal(p.isYandex(), false); assert.equal(p.getLanguage(), 'ru'); assert.ok(p.getServerTime() > 0);
    let rewards = 0; assert.equal((await p.showRewarded(() => rewards++)).rewarded, false); assert.equal(rewards, 0);
    assert.equal(await p.setLeaderboardScore(10), false);
  }
});
test('SDK ready/start/stop are idempotent; player error preserves playable Yandex mode', async () => {
  const f = fixture({ playerError: true }); await f.platform.initialize();
  assert.equal(f.platform.isYandex(), true); assert.equal(f.platform.getPlayer(), null);
  f.platform.gameplayStart(); assert.deepEqual(f.calls, []);
  f.platform.gameReady(); f.platform.gameReady(); f.platform.gameplayStart(); f.platform.gameplayStart(); f.platform.gameplayStop(); f.platform.gameplayStop();
  assert.deepEqual(f.calls.map(c => c[0]), ['ready', 'start', 'stop']);
});
test('startup language initializes English and platform device complements viewport detection', async () => {
  const f = fixture(); await f.platform.initialize(); const l = new LocalizationService();
  assert.equal(f.platform.getLanguage(), 'en'); assert.equal(l.initialize(f.platform.getLanguage()), 'en'); assert.ok(l.t('login').includes('YANDEX'));
  assert.equal(f.platform.getDeviceType(), 'mobile');
});
test('nested pause reasons freeze order, temporary and company clocks until all blockers close', async () => {
  const f = fixture(); await f.platform.initialize(); f.platform.gameReady();
  const life = new LifecycleManager({ now: f.clock, platform: f.platform }); life.set('BOOT', false);
  f.advance(1000); assert.equal(life.now(), 1000);
  const state = new GameState(); const orders = new OrderManager({ state, restaurants, customers, now: life.now }); orders.generate(); orders.accept();
  const remaining = orders.remainingSeconds();
  life.set('MENU:garage', true); life.set('PLATFORM', true); f.advance(900000); orders.update();
  assert.equal(orders.remainingSeconds(), remaining); life.set('PLATFORM', false); assert.equal(life.paused, true);
  life.set('MENU:garage', false); f.advance(1000); assert.equal(orders.remainingSeconds(), remaining - 1);
  assert.deepEqual(f.calls.map(c => c[0]), ['ready', 'start', 'stop', 'start']); orders.destroy();
});
test('server anchor ignores device clock edits; missing trusted time disables offline credit', async () => {
  const f = fixture(); await f.platform.initialize(); const time = f.platform.getServerTime();
  f.platform.wallNow = () => time + 999999999; f.sdk.serverTime = () => { throw Error('clock'); }; f.advance(5000);
  assert.equal(f.platform.getServerTime(), time + 5000);
  const state = new GameState(); state.values.companyUnlocked = true; state.values.lastCompanyUpdateTimestamp = time - 3600000;
  const company = new CompanyManager(state, { wallNow: () => null }); assert.equal(company.resumeOffline(), 0);
});
test('cloud wins conflicts; empty cloud migrates existing local without combining currencies', async () => {
  for (const cloud of [null, { saveVersion: 10, revision: 8, savedAt: 1, gameState: { version: 10, money: 70, xp: 200 } }]) {
    const f = fixture({ cloud }); await f.platform.initialize(); f.platform.writeLocal({ version: 9, money: 900, xp: 100 }, f.platform.saveKey);
    const state = new GameState(), saves = new SaveManager(state, f.platform, { clock: f.clock });
    const result = await saves.initialize(); assert.equal(state.values.money, cloud ? 70 : 900); assert.equal(result.source, cloud ? 'cloud' : 'local');
    assert.equal(f.calls.length, 0); assert.equal(await saves.flush(), true);
    const envelope = f.calls.at(-1)[1][C.cloudKey]; assert.equal(envelope.saveVersion, 12); assert.equal(envelope.gameState.money, cloud ? 70 : 900);
    saves.destroy();
  }
});
test('guest and authorized cloud writes work; old local storage remains a flat backup', async () => {
  for (const authorized of [false, true]) {
    const f = fixture({ authorized }); await f.platform.initialize(); const state = new GameState(), saves = new SaveManager(state, f.platform, { clock: f.clock });
    await saves.initialize(); state.update({ money: 25 }); await saves.flush();
    assert.equal(f.platform.readLocal().money, 25); assert.equal(f.calls.at(-1)[1][C.cloudKey].gameState.money, 25); saves.destroy();
  }
});
test('failed cloud/player load and unknown future schema never overwrite existing cloud', async () => {
  for (const options of [{ cloudError: true }, { playerError: true }, { cloud: { saveVersion: 13, gameState: { version: 13, money: 100 } } }]) {
    const f = fixture(options); await f.platform.initialize(); f.platform.writeLocal({ money: 88, xp: 0 });
    const saves = new SaveManager(new GameState(), f.platform, { clock: f.clock }); await saves.initialize();
    assert.equal(saves.cloudWritable, false); assert.equal(await saves.flush(), false); assert.equal(f.calls.length, 0); saves.destroy();
  }
  assert.equal(decodeSave({}), null); assert.equal(decodeSave({ version: 11, money: -5 }), null);
});
test('rapid save triggers batch latest state; failures retry with throttle; account dialog freezes every write', async () => {
  const f = fixture(); await f.platform.initialize(); const state = new GameState(), saves = new SaveManager(state, f.platform, { clock: f.clock }); await saves.initialize();
  for (let i = 0; i < 100; i++) state.update({ money: i }); await saves.flush(); assert.equal(f.calls.length, 1); assert.equal(f.calls[0][1][C.cloudKey].gameState.money, 99);
  state.update({ money: 101 }); assert.equal(await saves.flush(), false);
  f.advance(5000); f.player.setData = async () => { throw Error('network'); }; assert.equal(await saves.flush(), false); assert.equal(saves.dirty, true);
  saves.suspend('ACCOUNT'); const backup = f.platform.readLocal(); state.update({ money: 500 }); f.advance(10000); await saves.flush(); assert.deepEqual(f.platform.readLocal(), backup);
  saves.destroy();
});
test('account reload forbids guest legacy import into a newly selected empty account', async () => {
  const f = fixture({ authorized: true }); await f.platform.initialize(); f.platform.writeLocal({ money: 9999 }, f.platform.saveKey);
  const state = new GameState(), saves = new SaveManager(state, f.platform); saves.accountReload = true; await saves.initialize();
  assert.equal(state.values.money, 0); saves.destroy();
});
test('optional authorization succeeds/cancels; SDK account events are translated', async () => {
  const f = fixture(); await f.platform.initialize(); assert.equal(f.platform.isAuthorized(), false);
  let opened = 0, closed = 0; f.platform.on('accountOpen', () => opened++); f.platform.on('accountClose', () => closed++);
  f.handlers.ACCOUNT_SELECTION_DIALOG_OPENED(); f.handlers.ACCOUNT_SELECTION_DIALOG_CLOSED(); assert.equal(opened, 1); assert.equal(closed, 1);
  f.sdk.auth.openAuthDialog = async () => { throw Error('cancel'); }; assert.equal(await f.platform.requestAuthorization(), false);
  f.sdk.auth.openAuthDialog = async () => {}; assert.equal(await f.platform.requestAuthorization(), false);
  const a = fixture(); await a.platform.initialize(); assert.equal(await a.platform.requestAuthorization(), true);
});
test('SDK wrappers grant only onRewarded, once; refusal, early close, errors and duplicate callbacks are safe', async () => {
  for (const outcome of ['reward', 'close', 'error', 'throw']) {
    const f = fixture(); await f.platform.initialize(); let reward = 0;
    f.sdk.adv.showRewardedVideo = ({ callbacks: c }) => {
      if (outcome === 'throw') throw Error('throw'); c.onOpen();
      if (outcome === 'reward') { c.onRewarded(); c.onRewarded(); }
      if (outcome === 'error') c.onError(Error('error')); else c.onClose(false);
      c.onRewarded(); c.onClose(true);
    };
    const result = await f.platform.showRewarded(() => reward++); assert.equal(reward, outcome === 'reward' ? 1 : 0); assert.equal(result.rewarded, outcome === 'reward');
  }
  const f = fixture(); await f.platform.initialize(); f.sdk.adv.showFullscreenAdv = ({ callbacks }) => callbacks.onClose(false);
  assert.equal((await f.platform.showInterstitial()).shown, false);
});
test('rewarded result credits exactly half payout once, no XP/reputation; reload cannot claim old result', async () => {
  const originalDocument = globalThis.document; globalThis.document = { querySelector: () => null };
  try {
    const f = fixture(); await f.platform.initialize(); const life = new LifecycleManager({ now: f.clock }); life.set('BOOT', false);
    const state = new GameState(), saves = new SaveManager(state, f.platform, { clock: f.clock }); await saves.initialize();
    const ads = new AdManager(state, f.platform, life, saves); const order = { status: 'DELIVERED' }, orders = { order, getTarget: () => null };
    ads.offerDelivery(order, { total: 641 }); const before = state.getSnapshot();
    f.sdk.adv.showRewardedVideo = ({ callbacks: c }) => { c.onOpen(); c.onRewarded(); c.onRewarded(); c.onClose(); };
    await ads.rewarded(orders); await ads.rewarded(orders); assert.equal(state.values.money, before.money + 320); assert.equal(state.values.xp, before.xp); assert.equal(state.values.reputation, before.reputation);
    assert.equal(state.values.totalMoneyEarned, before.totalMoneyEarned);
    const restored = new GameState(); restored.loadSaveData(state.getSaveData()); const reloaded = new AdManager(restored, f.platform, life, saves);
    assert.equal((await reloaded.rewarded({ order: { status: 'AVAILABLE' }, getTarget: () => null })).rewarded, false); saves.destroy();
  } finally { globalThis.document = originalDocument; }
});
test('interstitial natural breaks require four completions and 180 seconds; menu / active order forbid ads; refusal does not retry', async () => {
  const originalDocument = globalThis.document; globalThis.document = { querySelector: () => null };
  try {
    const f = fixture(); await f.platform.initialize(); const life = new LifecycleManager({ now: f.clock }); life.set('BOOT', false);
    const saves = { interrupt() {} }, ads = new AdManager(new GameState(), f.platform, life, saves); const orders = { getTarget: () => null };
    for (let i = 0; i < 4; i++) ads.completed(); assert.equal(ads.eligible(), false); f.advance(180000); assert.equal(ads.eligible(), true);
    life.set('MENU:garage', true); assert.equal(await ads.interstitial(orders), false); life.set('MENU:garage', false);
    assert.equal(await ads.interstitial({ getTarget: () => ({}) }), false);
    f.sdk.adv.showFullscreenAdv = ({ callbacks }) => callbacks.onClose(false); assert.equal(await ads.interstitial(orders), false); assert.equal(ads.eligible(), false);
    assert.equal(life.paused, false);
  } finally { globalThis.document = originalDocument; }
});
test('leaderboard guests never call restricted methods; missing API/404 and throttle are safe; score never depends on wallet', async () => {
  const f = fixture(); await f.platform.initialize(); assert.equal(await f.platform.getLeaderboardEntries(), null); assert.equal(await f.platform.setLeaderboardScore(1), false);
  const a = fixture({ authorized: true }); await a.platform.initialize(); assert.equal(await a.platform.setLeaderboardScore(100), true); assert.equal(await a.platform.setLeaderboardScore(200), false);
  a.advance(10000); a.sdk.leaderboards.setScore = async () => { throw Error('404'); }; assert.equal(await a.platform.setLeaderboardScore(300), false);
  a.sdk.isAvailableMethod = async () => false; assert.equal(await a.platform.getPlayerLeaderboardEntry(), null);
  const state = new GameState(), before = courierScore(state.values); state.update({ money: 999999 }); assert.equal(courierScore(state.values), before);
  state.update({ reputation: 50 }); const high = courierScore(state.values); state.update({ reputation: -10 }); assert.equal(courierScore(state.values), high);
});
test('cloud data size cap refuses payloads above safety threshold and requests have bounded timeout', async () => {
  const f = fixture(); await f.platform.initialize(); assert.equal(await f.platform.saveCloudData({ log: 'x'.repeat(200000) }), false); assert.equal(f.calls.length, 0);
  await assert.rejects(withTimeout(new Promise(() => {}), 1), /timeout/);
});
test('trusted UTC rollover refreshes once, retains task progress before midnight and device clock cannot duplicate daily reward', async () => {
  const f = fixture(); await f.platform.initialize(); f.sdk.serverTime = () => Date.UTC(2026, 9, 7, 23, 59, 59) + f.clock();
  const state = new GameState({ tasks: { date: () => null } }); state.update({ xp: 3000 });
  const saves = new SaveManager(state, f.platform, { clock: f.clock }); await saves.initialize();
  assert.equal(state.values.dailyTaskDate, '2026-10-07'); state.values.dailyTasks[0].currentProgress = 1;
  assert.equal(state.tasks.claimDailyBonus().ok, true); f.platform.wallNow = () => Date.UTC(2035, 1, 1);
  state.tasks.checkDate(); assert.equal(state.values.dailyTasks[0].currentProgress, 1); assert.equal(state.tasks.claimDailyBonus().ok, false);
  f.advance(2000); state.tasks.checkDate(); assert.equal(state.values.dailyTaskDate, '2026-10-08');
  assert.equal(state.tasks.claimDailyBonus().ok, true); assert.equal(state.tasks.claimDailyBonus().ok, false); saves.destroy();
});
test('trusted offline company income keeps two-hour cap and cannot be credited twice', async () => {
  const f = fixture(); await f.platform.initialize(); const time = f.platform.getServerTime();
  const state = new GameState(); state.loadSaveData({ money: 0, xp: 6000, companyUnlocked: true, lastCompanyUpdateTimestamp: time - 12 * 3600000, employees: [{ id: 'worker', name: 'Саша' }] });
  const company = new CompanyManager(state, { wallNow: () => f.platform.getServerTime(), now: f.clock });
  const earned = company.resumeOffline(); assert.ok(earned > 0); assert.ok(earned <= company.storageLimit());
  f.platform.wallNow = () => time + 100000000; assert.equal(company.resumeOffline(), 0);
});
test('leaderboard reads batch rapid UI reopen requests, including 404, and pending availability never writes into selected account', async () => {
  const f = fixture({ authorized: true }); await f.platform.initialize(); let reads = 0;
  f.sdk.leaderboards.getEntries = async () => { reads++; throw Error('404'); };
  await Promise.all(Array.from({ length: 100 }, () => f.platform.getLeaderboardEntries())); assert.equal(reads, 1);
  f.advance(16000); await f.platform.getLeaderboardEntries(); assert.equal(reads, 2);
  let available; f.sdk.isAvailableMethod = () => new Promise(resolve => { available = resolve; });
  const request = f.platform.setLeaderboardScore(999); f.handlers.ACCOUNT_SELECTION_DIALOG_OPENED(); available(true);
  assert.equal(await request, false); assert.ok(!f.calls.some(c => c[0] === 'score'));
});


test('delivery offers are temporary, expire and allow retry after unavailable video without pausing menus', async () => {
  const previous = globalThis.document; globalThis.document = { querySelector: () => null };
  try {
    const state = new GameState(), life = new LifecycleManager(); life.set('BOOT', false);
    const saves = { interrupt() {}, blockers: new Set() };
    const platform = { accountEpoch: 0, showRewarded: async () => ({ rewarded: false }) };
    const ads = new AdManager(state, platform, life, saves);
    const order = { id: 'order-1', status: 'DELIVERED' }, orders = { order, getTarget: () => null };
    ads.offerDelivery(order, { total: 321 });
    assert.equal(life.paused, false);
    assert.equal('deliveryAdBonus' in state.getSaveData(), false);
    const restored = new GameState(); restored.loadSaveData({ ...state.getSaveData(), deliveryAdBonus: state.values.deliveryAdBonus });
    assert.equal(restored.values.deliveryAdBonus, null);
    await ads.rewarded(orders);
    assert.equal(life.paused, false); assert.equal(state.values.deliveryAdBonus.attempted, false);
    life.set('MENU:garage', true); await ads.rewarded(orders); assert.equal(life.paused, true);
    life.set('MENU:garage', false); ads.expireDelivery();
    assert.equal((await ads.rewarded(orders)).rewarded, false);
    ads.offerDelivery({ id: 'order-2', status: 'DELIVERED' }, { total: 500 });
    assert.equal(state.values.deliveryAdBonus.orderId, 'order-2');
  } finally { globalThis.document = previous; }
});
