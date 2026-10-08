import ru from '../locales/ru.json' with { type: 'json' };
import en from '../locales/en.json' with { type: 'json' };
export const SUPPORTED_LANGUAGES = Object.freeze(['ru', 'en']);
export const DEFAULT_LANGUAGE = 'ru';
const RUSSIAN_FALLBACK = new Set(['ru', 'be', 'kk', 'uk', 'uz']);
export const resolvePlatformLanguage = code => RUSSIAN_FALLBACK.has(String(code || '').toLowerCase().split(/[-_]/)[0]) ? 'ru' : 'en';
export class LocalizationService {
  constructor(catalogs = { ru, en }) {
    this.catalogs = catalogs; this.language = DEFAULT_LANGUAGE; this.formatters = new Map(); this.missing = new Set(); this.pluralRules = new Map();
    this.nameKeys = new Map(Object.values(catalogs).flatMap(c => Object.entries(c).filter(([key]) => /^company-config\.00[2-9]$/.test(key)).map(([key,value]) => [value,key])));
  }
  initialize(language = DEFAULT_LANGUAGE) {
    this.language = SUPPORTED_LANGUAGES.includes(language) ? language : resolvePlatformLanguage(language);
    if (!this.catalogs[this.language]) {
      console.error(`[Localization] Missing ${this.language} dictionary; falling back to Russian. Fix before release.`);
      this.language = DEFAULT_LANGUAGE;
    }
    this.initialized = true;
    if (typeof document !== 'undefined') {
      document.documentElement.lang = this.language;
      document.title = this.t('game.title');
    }
    return this.language;
  }
  getLanguage() { return this.language; }
  resolvePlatformLanguage(code) { return resolvePlatformLanguage(code); }
  has(key) { return Object.hasOwn(this.catalogs[this.language] || {}, key); }
  displayName(value) {
    const key = this.nameKeys.get(value);
    return key ? this.t(key) : value;
  }
  interpolate(value, variables = {}) {
    return value.replace(/\{\{(\w+)\}\}/g, (match, name) => {
      if (!Object.hasOwn(variables, name)) return match;
      return typeof variables[name] === 'number' ? this.number(variables[name]) : this.displayName(String(variables[name] ?? ''));
    });
  }
  number(value, options = {}) {
    const locale = this.language === 'ru' ? 'ru-RU' : 'en-US';
    const id = `${locale}:${JSON.stringify(options)}`;
    if (!this.formatters.has(id)) this.formatters.set(id, new Intl.NumberFormat(locale, options));
    return this.formatters.get(id).format(value);
  }
  currency(value) { return `${this.number(value)} ₽`; }
  plural(key, count, variables = {}) {
    let form;
    if (typeof Intl.PluralRules === 'function') {
      if (!this.pluralRules.has(this.language)) this.pluralRules.set(this.language, new Intl.PluralRules(this.language));
      form = this.pluralRules.get(this.language).select(count);
    } else {
      // Exact cardinal rules for the two shipped languages; no BigInt dependency.
      const n = Math.abs(count), integer = Number.isInteger(n), last = n % 10, tens = n % 100;
      form = this.language === 'en' ? n === 1 ? 'one' : 'other'
        : !integer ? 'other' : last === 1 && tens !== 11 ? 'one'
        : last >= 2 && last <= 4 && !(tens >= 12 && tens <= 14) ? 'few' : 'many';
    }
    return this.t(this.has(`${key}.${form}`) ? `${key}.${form}` : `${key}.other`, { ...variables, count });
  }
  t(key, variables = {}) {
    if (!this.has(key) && !this.missing.has(`${this.language}:${key}`)) {
      this.missing.add(`${this.language}:${key}`); console.error(`[Localization] Missing ${this.language} key: ${key}`);
    }
    const value = this.catalogs[this.language]?.[key] ?? this.catalogs.ru?.[key];
    if (value === undefined) return key;
    return this.interpolate(value, variables);
  }
  translateDocument(root = document) {
    for (const element of root.querySelectorAll('[data-i18n]')) element.textContent = this.t(element.dataset.i18n);
    for (const attribute of ['aria-label', 'placeholder', 'title']) {
      for (const element of root.querySelectorAll(`[data-i18n-${attribute}]`)) element.setAttribute(attribute, this.t(element.getAttribute(`data-i18n-${attribute}`)));
    }
  }
}
export const localization = new LocalizationService();
export const t = (key, variables) => localization.t(key, variables);
export const formatNumber = (value, options) => localization.number(value, options);
export const formatMoney = value => localization.currency(value);
export function startupLanguage(platform, { development = import.meta.env?.DEV === true, search = globalThis.location?.search || '' } = {}) {
  const detected = platform.isYandex() ? resolvePlatformLanguage(platform.getLanguage()) : DEFAULT_LANGUAGE;
  const override = development ? new URLSearchParams(search).get('lang') : null;
  return SUPPORTED_LANGUAGES.includes(override) ? override : detected;
}
