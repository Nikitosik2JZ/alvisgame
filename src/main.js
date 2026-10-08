import './style.css';
import { platformService } from './services/PlatformService.js';
import { localization, startupLanguage } from './services/LocalizationService.js';
// No gameplay/data module is evaluated until the startup language is known.
await platformService.initialize();
localization.initialize(startupLanguage(platformService));
localization.translateDocument();
if (import.meta.env.DEV) console.info(`[Localization] Language: ${localization.getLanguage()}`);
let runtime;
try { runtime = await import('./game.js'); }
catch (error) {
  console.error('[Startup]', error);
  document.querySelector('#loading').textContent = localization.t('startup.error');
}
// Browser regression tests inspect the initialized game through the entry module.
export const game = runtime?.game;
export const lifecycle = runtime?.lifecycle;
export { platformService };
