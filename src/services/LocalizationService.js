import ru from '../locales/ru.json' with { type: 'json' };
export class LocalizationService {
  constructor() { this.catalogs = { ru }; this.language = 'ru'; }
  initialize(platformLanguage) {
    this.platformLanguage = platformLanguage;
    this.language = Object.hasOwn(this.catalogs, platformLanguage) ? platformLanguage : 'ru';
    if (typeof document !== 'undefined') document.documentElement.lang = this.language;
    return this.language;
  }
  t(key) { return this.catalogs[this.language][key] ?? ru[key] ?? key; }
}
export const localization = new LocalizationService();
