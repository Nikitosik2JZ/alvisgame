import './style.css';
import './services/BrowserCompatibility.js';
import { platformService } from './services/PlatformService.js';
import { localization, startupLanguage } from './services/LocalizationService.js';
// No gameplay/data module is evaluated until the startup language is known.
// Browser regression tests inspect the initialized game through the entry module.
export let game, lifecycle;
async function bootstrap() {
  await platformService.initialize();
  localization.initialize(startupLanguage(platformService));
  localization.translateDocument();
  if (import.meta.env.DEV) console.info(`[Localization] Language: ${localization.getLanguage()}`);
  try {
    const runtime = await import('./game.js'); game = runtime.game; lifecycle = runtime.lifecycle;
  } catch (error) {
    console.error('[Startup]', error);
    document.querySelector('#loading').textContent = localization.t('startup.error');
  }
}
void bootstrap();
export { platformService };
