import test from 'node:test';
import assert from 'node:assert/strict';
import { GameState } from '../src/state/GameState.js';
import { TutorialManager } from '../src/managers/TutorialManager.js';
import { SaveManager, decodeSave } from '../src/services/SaveManager.js';
import { AudioManager, SOUND_PATTERNS } from '../src/services/AudioManager.js';
import { LifecycleManager } from '../src/services/LifecycleManager.js';
import { LocalizationService } from '../src/services/LocalizationService.js';
import { simulate } from '../scripts/simulate-economy.mjs';
import { CompanyManager } from '../src/managers/CompanyManager.js';

test('save settles active company work once and preserves hidden time for offline recovery', async () => {
  let active = 0, wall = 1000, backup;
  const state = new GameState();
  state.loadSaveData({ version: 12, companyUnlocked: true, lastCompanyUpdateTimestamp: wall,
    employees: [{ id: 'e1', name: 'courier' }] });
  const company = new CompanyManager(state, { now: () => active, wallNow: () => wall });
  const platform = { isYandex: () => false, readLocal: () => null, writeLocal: s => { backup = s; }, getServerTime: () => wall };
  const saves = new SaveManager(state, platform); await saves.initialize(); saves.settle = () => company.settleForSave();
  active = 60000; wall = 61000; saves.interrupt();
  assert.ok(backup.companyBalance > 0); assert.equal(backup.lastCompanyUpdateTimestamp, wall);
  const reload = data => { const restored = new GameState(); restored.loadSaveData(data);
    const manager = new CompanyManager(restored, { now: () => active, wallNow: () => wall }); return { restored, earned: manager.resumeOffline() }; };
  assert.equal(reload(backup).earned, 0);
  const earned = backup.companyBalance; company.hidden = true; wall = 121000; saves.interrupt();
  assert.equal(backup.companyBalance, earned); assert.equal(backup.lastCompanyUpdateTimestamp, 61000);
  const recovered = reload(backup); assert.ok(recovered.earned > 0); assert.ok(recovered.restored.values.companyBalance > earned);
  saves.destroy();
});

test('tutorial migration preserves all historical progression and only new players see it', () => {
  for (let version = 1; version <= 11; version++) for (const progress of [
    { completedOrders: 1 }, { level: 2 }, { xp: 100 }, { ownedItems: ['old-shoes'] },
    { companyUnlocked: true }, { ownedItems: ['bicycle'] }, { ownedTransports: ['CAR'] }, { unlockedDistricts: ['center'] },
  ]) {
    const state = new GameState(); state.loadSaveData({ version, money: 4567, ...progress });
    assert.equal(state.values.tutorialVersionSeen, 1); assert.equal(state.values.money, 4567);
  }
  const state = new GameState(); state.loadSaveData({ version: 11, money: 0, xp: 0 }); assert.equal(state.values.tutorialVersionSeen, 0);
  state.loadSaveData({ version: 12, money: 5, tutorialVersionSeen: 3 }); assert.equal(state.values.tutorialVersionSeen, 3);
  state.loadSaveData({ version: 12, tutorialVersionSeen: 'yes' }); assert.equal(state.values.tutorialVersionSeen, 0);
});

test('skip at every step and normal completion persist immediately, never award currency or restart', async () => {
  for (const step of ['welcome', 'movement', 'order', 'pickup', 'delivery', 'reward', 'progression', 'final']) {
    const state = new GameState(); let backup;
    const platform = { readLocal: () => null, isYandex: () => false, getServerTime: () => 1000, writeLocal: v => backup = v };
    const saves = new SaveManager(state, platform); await saves.initialize();
    const listeners = new Set(), orders = { subscribe: f => { listeners.add(f); return () => listeners.delete(f); } };
    const tutorial = new TutorialManager(state, orders, { x: 0, y: 0 }); tutorial.set(step); tutorial.finish(); tutorial.finish();
    assert.equal(backup.tutorialVersionSeen, 1); assert.equal(backup.money, 0); assert.equal(tutorial.step, null);
    const restored = new GameState(); restored.loadSaveData(backup); assert.equal(new TutorialManager(restored, orders, {}).step, null);
    tutorial.destroy(); saves.destroy();
  }
});

test('tutorial advances only on movement and valid delivery milestones, supports failure recovery', () => {
  const state = new GameState(), player = { x: 0, y: 0 }; let callback;
  const tutorial = new TutorialManager(state, { subscribe: f => { callback = f; return () => {}; } }, player);
  tutorial.next(); tutorial.update(); assert.equal(tutorial.step, 'movement');
  player.x = 49; tutorial.update(); assert.equal(tutorial.step, 'order');
  callback('accepted'); assert.equal(tutorial.step, 'pickup'); callback('picked up'); assert.equal(tutorial.step, 'delivery');
  callback('failed'); assert.equal(tutorial.step, 'order'); callback('completed'); tutorial.next(); tutorial.next(); tutorial.next();
  assert.equal(tutorial.step, null); assert.equal(state.values.tutorialVersionSeen, 1);
});

test('newer scoped backup repairs failed cloud synchronization; older and foreign progress never merge', async () => {
  for (const [revision, savedAt, expected] of [[8, 2000, 99], [6, 2000, 70], [8, 500, 70]]) {
    let backup = { version: 12, money: 99, revision, savedAt }, envelope;
    const platform = { readLocal: () => backup, writeLocal: v => backup = v, isYandex: () => true, accountEpoch: 0,
      getServerTime: () => 3000, loadCloudSave: async () => ({ saveVersion: 12, revision: 7, savedAt: 1000, gameState: { version: 12, money: 70 } }),
      saveCloudData: async v => { envelope = v; return true; } };
    const state = new GameState(), saves = new SaveManager(state, platform); await saves.initialize();
    assert.equal(state.values.money, expected); await saves.flush(); assert.equal(envelope.gameState.money, expected); saves.destroy();
  }
  assert.equal(decodeSave({ version: 13, money: 100 }), null);
});

test('audio user preferences survive reload and overlapping platform/ad/focus pauses stop every voice', () => {
  const state = new GameState(), life = new LifecycleManager(); life.set('BOOT', false);
  const nodes = [], handlers = new Map();
  class Context {
    state = 'running'; currentTime = 0; destination = {};
    resume() { return Promise.resolve(); } close() { return Promise.resolve(); }
    createOscillator() { const o = { frequency: {}, connect() {}, disconnect() {}, start() {}, stop() { o.stopped = true; } }; nodes.push(o); return o; }
    createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
  }
  const host = { AudioContext: Context, addEventListener: (k, f) => handlers.set(k, f), removeEventListener: k => handlers.delete(k) };
  const audio = new AudioManager(state, life, host); audio.unlock();
  for (const key of Object.keys(SOUND_PATTERNS)) { audio.stop(); assert.equal(audio.play(key), true); }
  life.set('ADVERTISEMENT', true); life.set('PLATFORM', true); assert.equal(audio.voices.size, 0); assert.ok(nodes.every(n => n.stopped));
  life.set('ADVERTISEMENT', false); assert.equal(audio.play('success'), false);
  state.setAudioPreferences(.27, true); life.set('PLATFORM', false); assert.equal(audio.play('success'), false);
  const restored = new GameState(); restored.loadSaveData(state.getSaveData()); assert.equal(restored.values.masterVolume, .27); assert.equal(restored.values.muted, true);
  state.setAudioPreferences(1, false); assert.equal(audio.play('success'), true);
  life.set('VISIBILITY:BLUR', true); assert.equal(audio.voices.size, 0); audio.destroy(); assert.equal(handlers.size, 0);
});

test('legacy plural fallback matches native rules for shipped RU/EN cardinal forms', () => {
  const original = Intl.PluralRules;
  try {
    const l = new LocalizationService();
    for (const lang of ['ru', 'en']) {
      l.initialize(lang);
      const values = [0, 1, 2, 4, 5, 11, 12, 21, 22, 25, 111, 1.5, -1];
      Intl.PluralRules = original; const expected = values.map(n => l.plural('count.orders', n));
      Intl.PluralRules = undefined; assert.deepEqual(values.map(n => l.plural('count.orders', n)), expected);
    }
  } finally { Intl.PluralRules = original; }
});

test('release expected-value progression avoids instant vehicles and company runaway', () => {
  const { milestones: m, phases, developedCompanyIncomePerMinute, magnateHours } = simulate();
  assert.ok(m.shoesMinutes >= 5 && m.shoesMinutes <= 10); assert.ok(m.bicycleMinutes >= 15 && m.bicycleMinutes <= 30);
  assert.ok(m.mopedMinutes >= 45 && m.mopedMinutes <= 90); assert.ok(m.carMinutes >= 120 && m.carMinutes <= 240);
  assert.ok(m.companyMinutes >= 180 && m.companyMinutes <= 360); assert.ok(magnateHours >= 12 && magnateHours <= 25);
  assert.ok(developedCompanyIncomePerMinute < phases.at(-1).incomePerMinute);
});
