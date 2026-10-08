import ResizeObserverPolyfill from 'resize-observer-polyfill';
import dialogPolyfill from 'dialog-polyfill';
import escapeSelector from 'css.escape';
import 'dialog-polyfill/dist/dialog-polyfill.css';
import 'pepjs';

globalThis.CSS ||= {};
globalThis.CSS.escape ||= escapeSelector;

// Saved game structures are plain JSON; no transferable objects are cloned.
if (!globalThis.structuredClone) globalThis.structuredClone = value => JSON.parse(JSON.stringify(value));
if (!globalThis.ResizeObserver) globalThis.ResizeObserver = ResizeObserverPolyfill;
for (const prototype of [Element.prototype, DocumentFragment.prototype]) {
  if (!prototype.append) prototype.append = function (...nodes) { nodes.forEach(node => this.appendChild(typeof node === 'string' ? document.createTextNode(node) : node)); };
  if (!prototype.replaceChildren) prototype.replaceChildren = function (...nodes) { while (this.firstChild) this.removeChild(this.firstChild); this.append(...nodes); };
}
if (!Element.prototype.remove) Element.prototype.remove = function () { this.parentNode?.removeChild(this); };
if (!Element.prototype.matches) Element.prototype.matches = Element.prototype.webkitMatchesSelector || Element.prototype.msMatchesSelector;
if (!Element.prototype.closest) Element.prototype.closest = function (selector) { let node = this; while (node) { if (node.matches(selector)) return node; node = node.parentElement; } return null; };
const media = globalThis.matchMedia?.('(pointer: coarse)');
if (media && !media.addEventListener) {
  const prototype = Object.getPrototypeOf(media);
  prototype.addEventListener = function (type, handler) { if (type === 'change') this.addListener(handler); };
  prototype.removeEventListener = function (type, handler) { if (type === 'change') this.removeListener(handler); };
}
const registerDialogs = () => document.querySelectorAll('dialog').forEach(dialog => { if (!dialog.showModal) dialogPolyfill.registerDialog(dialog); });
registerDialogs();
new MutationObserver(registerDialogs).observe(document.body, { childList: true });
if (!globalThis.CSS?.supports?.('display', 'grid')) document.documentElement.classList.add('legacy-css');
