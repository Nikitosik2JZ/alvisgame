# Minimum requirements — 1.0.0 release candidate

Date: 2026-10-08. This report separates platform obligations from measured results and proposed testing targets.

## A) Yandex platform compatibility requirements

The [official requirements](https://yandex.ru/dev/games/doc/ru/concepts/requirements) were checked on 2026-10-08 (page revision 2026-09-29). Intended draft platforms are desktop and mobile; TV is not implemented and must not be declared.

The listed environments include Yandex Browser, Chrome, Firefox, Opera, Safari and the Yandex mobile app; Windows Vista/7/8/10 and Mac OS X 10.6+; Android 5.0+ and iOS 9.0+. These are official compatibility expectations, **not tested hardware claims**. Legacy desktop operating systems, Android 5 and iOS 9 are **UNVERIFIED ON PHYSICAL DEVICE**.

The previous modern-only bundle used top-level await and APIs missing in older browsers. The release removes entry top-level await, includes Vite legacy/SystemJS output targeting Chrome 49+, Firefox 52+, Safari/iOS 9+, and provides structuredClone, ResizeObserver, pointer-event, dialog, CSS selector and DOM helper fallbacks. RU/EN plural rules have a tested fallback; cloud byte limits use Blob instead of TextEncoder. Modern and legacy bundles have relative asset paths and ship no source maps. Legacy CSS has basic flex, opaque backgrounds and viewport-unit fallbacks.

Compilation targets do not establish runtime compatibility. The forced legacy loader is smoke-tested in current Chrome; physical old browsers must still test rendering, SDK, Canvas/WebGL, touch, dialogs, audio unlocking, storage and recovery. Phaser AUTO permits Canvas fallback when WebGL is unavailable; no user-facing WebGL warning is added. No unsupported-WebGL system message should be displayed.

## B) Project performance target / recommended minimum

Actually tested: local Windows desktop, installed Chrome in headless Playwright, dev and actual production output, RU/EN, touch-capable **emulated viewports**. Host CPU: AMD Ryzen 5 7500F, six cores/twelve threads, approximately 16 GB RAM. Viewport emulation is not phone hardware emulation. Host resource measurements and final frame/listener counts are recorded in `RELEASE_CHECKLIST.md` and `artifacts/stage12/results.json`.

The release has 3.469 MB uncompressed production content, including both modern and legacy bundles. There are no downloaded audio files, employee sprites or permanent particle emitters. Company work runs as bounded mathematical ticks; UI subscriptions and world objects are checked across repeated district scene restarts. A short requestAnimationFrame sample measures this Chrome host only; it is not a full CPU/GPU benchmark or proof against hours-long leaks.

Proposed acceptance targets (all **UNVERIFIED ON PHYSICAL DEVICE** until tested):

| Platform | Practical test target | Acceptance |
| --- | --- | --- |
| Desktop | WebGL-capable GPU, 2 CPU cores, 4 GB RAM, 1280×720+, supported browser | Aim 60 FPS; stable 30 FPS lower-end floor |
| Mobile | WebGL-capable device, 2 GB RAM, supported Android/iOS browser, 360 CSS px wide | Aim 60 FPS; stable 30 FPS lower-end floor |

These are test targets, not measured minimum hardware specifications. Canvas fallback may be slower; test it separately. A current browser, working local storage and sound enabled by a deliberate gesture are recommended. SDK-dependent cloud saves, server time, advertisements and ranking need network availability; the personal courier loop runs in LOCAL mode when platform initialization is unavailable.

Coverage includes 360×640, 375×667, 390×844, 412×915, 430×932; 640×360, 844×390, 915×412; 1280×720, 1366×768, 1920×1080. Internal dialogs scroll; the game page does not. CSS viewport equivalents cover 80/100/125% browser zoom. Real browser UI zoom, safe areas/notches/Dynamic Island, native keyboard, one-handed reach, audible SFX and old-device performance remain manual.
