import { localization } from './LocalizationService.js';
// Persist message keys and variables, never the language in which a log was shown.
export const message = (key, variables = {}) => ({ key, variables });
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
let patterns;
function catalogPatterns() {
  return patterns ??= Object.values(localization.catalogs).flatMap(catalog => Object.entries(catalog).map(([key, text]) => {
    const names = [...text.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]);
    const parts = text.split(/\{\{\w+\}\}/);
    return { key, text, names, weight: parts.join('').length, pattern: new RegExp(`^${parts.map(escape).join('([\\s\\S]*?)')}$`, 'i') };
  })).sort((a,b) => b.weight-a.weight);
}
export function encodeMessage(value, depth = 0) {
  if (typeof value !== 'string' || depth > 8) return value;
  for (const p of catalogPatterns()) {
    if (!p.names.length && p.text.toLowerCase() === value.toLowerCase()) return message(p.key);
  }
  if (/^-?\d+(?:[\s,]\d{3})*(?:\.\d+)?$/.test(value)) return { number: Number(value.replace(/[\s,]/g,'')) };
  for (const p of catalogPatterns()) {
    if (!p.names.length || p.weight < 4) continue;
    const match = value.match(p.pattern);
    if (match && match.slice(1).every(v => v !== value)) return message(p.key, Object.fromEntries(p.names.map((name,i) => [name, encodeMessage(match[i+1], depth+1)])));
  }
  if (value.includes('\n')) return { parts: value.split('\n').map(v => encodeMessage(v,depth+1)), separator: '\n' };
  return value; // Custom names and developer-supplied log entries remain user data.
}
export function migrateSavedMessage(value) {
  const encoded = encodeMessage(value);
  // Preserve unrecognized historical text as metadata, with a localized UI label.
  return typeof encoded === 'string' && /[A-Za-zА-Яа-яЁё]/.test(encoded)
    ? { ...message('company.log.legacy'), legacyText: encoded } : encoded;
}
export function renderMessage(value, depth = 0) {
  if (depth > 12) return '';
  if (typeof value === 'number') return localization.number(value);
  if (typeof value === 'string') return localization.displayName(value);
  if (!value || typeof value !== 'object') return '';
  if (Number.isFinite(value.number)) return localization.number(value.number);
  if (Array.isArray(value.parts)) return value.parts.map(v=>renderMessage(v,depth+1)).join(value.separator || '');
  if (!localization.has(value.key)) return '';
  return localization.t(value.key, Object.fromEntries(Object.entries(value.variables || {}).map(([key,v]) => [key, renderMessage(v,depth+1)])));
}
export function validMessage(value, depth = 0) {
  if (depth > 12) return false;
  if (typeof value === 'string') return value.length <= 2000;
  if (typeof value === 'number') return Number.isFinite(value);
  if (!value || typeof value !== 'object') return false;
  if (Number.isFinite(value.number)) return true;
  if (Array.isArray(value.parts)) return value.parts.length <= 30 && ['', '\n', ' · '].includes(value.separator) && value.parts.every(v=>validMessage(v,depth+1));
  return localization.has(value.key) && value.variables && typeof value.variables === 'object' && Object.keys(value.variables).length <= 20 && Object.values(value.variables).every(v=>validMessage(v,depth+1));
}
