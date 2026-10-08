import { platformService as platform } from './PlatformService.js';
import { lifecycle } from './LifecycleManager.js';
import { localization } from './LocalizationService.js';
import { SaveManager } from './SaveManager.js';
import { LeaderboardManager } from './LeaderboardManager.js';
import { AdManager } from '../managers/PlatformOffersManager.js';
import { gameState } from '../state/GameState.js';
import { AudioManager } from './AudioManager.js';

export const saves = new SaveManager(gameState, platform);
export const ads = new AdManager(gameState, platform, lifecycle, saves);
export let audio;
lifecycle.platform = platform;
platform.on('pause', () => { saves.interrupt(); lifecycle.set('PLATFORM', true); });
platform.on('resume', () => lifecycle.set('PLATFORM', false));
platform.on('accountOpen', () => { saves.suspend('ACCOUNT'); lifecycle.set('AUTH:ACCOUNT', true); });
platform.on('accountClose', () => saves.switchAccount());

export async function initializeRuntime() {
  try { saves.accountReload = sessionStorage.getItem('courier-account-reload') === '1'; sessionStorage.removeItem('courier-account-reload'); } catch { /* Optional guard. */ }
  await platform.initialize();
  if (!localization.initialized) throw new Error('Localization must initialize before game state');
  const result = await saves.initialize();
  audio ??= new AudioManager(gameState, lifecycle);
  document.querySelector('.local-badge').textContent = localization.t(platform.isYandex() ? 'platform.yandex' : 'platform.local');
  document.querySelector('#loading').textContent = localization.t('loading');
  return result;
}

export function bindBrowserLifecycle() {
  const visibility = () => {
    if (document.hidden) saves.interrupt();
    lifecycle.set('VISIBILITY:HIDDEN', document.hidden);
  };
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('blur', () => { saves.interrupt(); lifecycle.set('VISIBILITY:BLUR', true); });
  window.addEventListener('focus', () => { lifecycle.set('VISIBILITY:BLUR', false); visibility(); });
  window.addEventListener('pagehide', () => { saves.interrupt(); lifecycle.set('VISIBILITY:PAGE', true); });
  window.addEventListener('pageshow', () => lifecycle.set('VISIBILITY:PAGE', false));
  document.addEventListener('contextmenu', event => event.preventDefault());
  visibility();
}

let leaderboard;
export function finishLoading(game) {
  if (platform.ready) return;
  // After scene creation and the first rendered frame, remove the blocking overlay.
  game.events.once('postrender', () => {
    document.querySelector('#loading').remove();
    platform.gameReady(); lifecycle.set('BOOT', false);
    leaderboard = new LeaderboardManager(gameState, platform, saves);
  });
}
export function destroyRuntime() { saves.destroy(); leaderboard?.destroy(); audio?.destroy(); }
