# Courier Empire release checklist

Date: 2026-10-08. Package **1.0.0**; intended Yandex version **1.0.0.0**. Recommendation: **READY FOR YANDEX DRAFT**, subject to the manual gates below. This does not mean READY FOR PUBLIC MODERATION.

## Repository release work

- [x] Preserve approved procedural world art and existing gameplay/progression; no new districts, transports, company mechanics or monetization system.
- [x] Eight short localized tutorial steps follow real movement, acceptance, pickup and delivery; the first order is a nearby standard route with at least 120 seconds.
- [x] Skip available on every step; completion/skip immediately writes `tutorialVersionSeen = 1`; future seen versions remain seen. Versions 1–11 with meaningful progress migrate as veterans. No repeat rewards are given by tutorial completion.
- [x] Accept stays disabled until the movement threshold; tutorial excludes random personal interruptions. Menus, platform pauses and input blockers compose correctly.
- [x] Six original oscillator SFX: accept, success, failure, reward, purchase, achievement/level. One context, trusted input unlock, bounded 16 notes, end/disconnect cleanup. No music or downloaded audio.
- [x] Settings: master volume 0–100% and mute persist; focus/platform/ad/auth blockers stop voices independently of user mute.
- [x] One reused short money popup, success pulse and major purchase/level pulse. No accumulating particles/timers; animation cleanup and reduced-motion styling.
- [x] Centralized balance changes and reproducible expected-value model; see BALANCE_REPORT.md.
- [x] RU/EN text review, interpolation/plural/key parity, no authored profanity found. Shipping dictionaries have 945 matching keys.
- [x] Modal flex sizing, wrapping and close controls; tutorial HUD split in landscape; safe-area rules; no page scroll, internal menu scroll retained.
- [x] Save schema 12 and local synchronous backup; newer scoped backup recovers throttled/failed cloud writes, foreign accounts do not merge.
- [x] Active company work settles before save, preventing duplicate offline credit. Hidden time is retained for offline recovery rather than overwritten by pagehide saves.
- [x] Modern + legacy build; top-level await removed; DOM/dialog/resize/pointer/plural/CSS selector fallbacks; Canvas fallback without WebGL warning.
- [x] Hidden CompanyUI does not rebuild every tick; frame updates avoid needless snapshot clones; HUD/tutor ResizeObservers have cleanup.
- [x] Existing order timers, modifiers, choice events, achievement/task toasts and UI subscriptions have scene shutdown cleanup; singleton company ticking stays intentional.
- [x] Production archive validators: one root index.html, names, size, no sources/maps/tests/SDK bundle.

## Local evidence and scope

`npm install`: successful, zero reported vulnerabilities. `npm test`: **149/149 PASS**. `npm run build`: **PASS**, with the expected warning for the bundled Phaser chunk exceeding 500 kB; no build error. `npm run balance`: PASS. Production has nine files and **3,468,517 bytes (3.469 MB / 3.308 MiB)** uncompressed, including legacy output; exact bytes and ZIP hash are recorded below after final packaging.

Actual environment: **Chrome 154.0.8037.98 on this Windows host**, AMD Ryzen 5 7500F (6 cores/12 threads), approximately 16 GB physical RAM. Browser runs are automated/headless; mobile viewports are emulated, not physical phones.

`tests/stage12-browser.cjs`: new RU/EN desktop/mobile tutorials with real input and pickup/delivery, skip/completion/reload; LOCAL dev and actual production with labelled SDK doubles, ten panels and inner tabs; audio settings/reload; voluntary rewarded bonus, duplicate SDK reward callback, nested platform/menu/ad pauses; twelve district restarts; actual production LOCAL and forced legacy loader.

Requested viewport matrix, both languages:

| Portrait mobile | Landscape mobile | Desktop |
| --- | --- | --- |
| 360×640 | 640×360 | 1280×720 |
| 375×667 | 844×390 | 1366×768 |
| 390×844 | 915×412 | 1920×1080 |
| 412×915 | | |
| 430×932 | | |

80/100/125% were checked through equivalent CSS viewport sizes, not operating the browser's actual zoom UI. Actual browser zoom remains a manual gate.

`tests/localization-browser.cjs`: all personal/company events and choice outcomes, menu tabs, 84 tier/task labels, 37 achievement notifications, transaction feedback, cross-language reload, production SDK ru/en/be/de selection and auth cancellation/error strings. `tests/stage11-browser.cjs`: five LOCAL sizes including 320×568, transaction/reload, touch menu scrolling, blur/focus, nested blockers, no-op advertisements and gesture restrictions.

Reproduce additional checks with `npm run test:compatibility` and tutorial geometry with `npm run test:tutorial-layout` (same PLAYWRIGHT_MODULE / CHROME_PATH / GAME_URL / PREVIEW_URL setup). Additional production checks: 2560×1080 / 1000×2400 desktop field aspect, 25 rapid orientation resizes and browser-history navigation; startup without WebGL; startup with structuredClone, ResizeObserver, CSS.escape, Intl.PluralRules and native dialog methods disabled. Both forced legacy and missing-API checks use current Chrome and do not certify old browsers. Tutorial geometry was measured over 64 step/language/viewport combinations after the landscape fix.

Screenshots were visually inspected for representative narrow portrait, landscape, Settings, Company and tutorial rewards. Layout automation checks viewport bounds, horizontal overflow and accessible close buttons; it does not prove every font/hardware rendering combination. No final local browser console/runtime errors were observed.

Observed district-restart counts: **15 state listeners, 2 lifecycle listeners, 13 dialogs, 1 dynamic physics body**; district-specific static bodies **11/16** and children **54/64**, returning to the same counts rather than increasing. Short 180-frame sample: median **13.3 ms**, p95 **13.4 ms**, JavaScript heap approximately **21.7 MB** on this host. This is an rAF observation, not measured phone FPS or proof of long-session heap stability. Final raw data: `artifacts/stage12/results.json`; logs: `artifacts/unit-test.log`, `build-final.log`, `stage12-browser.log`, `localization-final.log`, `stage11-final.log`, `stage12-extra.log`. Artifacts are generated locally and intentionally not committed.

## Save and ad audit

Unit/browser evidence covers successful delivery, equipment purchase, transport ownership, district unlock, company upgrade, achievement claim, task claim, rewarded bonus and reload. Significant state changes persist locally immediately; company minor updates batch at 30 seconds. Cloud writes debounce 1.5 seconds and remain at least five seconds apart; movement/frame updates never request cloud writes. Cloud errors, missing Player, future schemas, malformed data, account switch, guest migration, server date and two-hour offline caps have tests. No distributed cross-device merge/anti-cheat server is claimed.

Advertisements use SDK methods only. Interstitial eligibility is checked at Continue after an order, with four completions and 180 active seconds. Rewarded pays half final delivery reward only on `onRewarded`, once, without XP/reputation. LOCAL grants no pretend ad reward; close/error/duplicate callback paths are covered by contract doubles. Real SDK inventory, auth, cloud transport and leaderboard remain untested.

## Manual Console fields and promotional assets

- [ ] Create/update a Yandex **draft**, upload the ZIP of dist contents, set version **1.0.0.0**.
- [ ] Titles per language: **Курьерская Империя** / **Courier Empire**. Use the identical titles in corresponding assets/text.
- [ ] Enable cloud-saving declaration; configure SDK monetization.
- [ ] Create leaderboard **courier_score**, numeric descending, zero decimals; check guest and authorized UI.
- [ ] Fill title, short description, About, How to Play, categories, age rating, contact, supported platforms and orientation. No repository operation fills these fields automatically.
- [ ] Set desktop/mobile only after acceptance checks; do not select TV. Confirm selected orientation(s) with real ads and rotation.
- [ ] Prepare icon and cover separately. [Official promotion rules](https://yandex.ru/dev/games/doc/ru/concepts/requirements) require suitable real-gameplay screenshots and separate icon/cover materials. Review current per-field formats in Console.
- [ ] Choose actual gameplay RU screenshots and EN screenshots for the declared localized draft where required. QA menu screenshots are evidence, not a completed promotional set. Avoid OS/portal UI, inappropriate framing and misleading gameplay.
- [ ] Confirm catalog name uniqueness, publisher rights, correct genre and age declaration.

Suggested Console text to review/edit to field limits:

RU short: «От первых доставок до собственной курьерской компании.»

RU About: «Начните пешим курьером: забирайте заказы в ресторанах и доставляйте их вовремя. Зарабатывайте на экипировку и транспорт, открывайте районы, нанимайте сотрудников и развивайте свою службу доставки. Выполняйте задания и собирайте достижения. Реклама за дополнительную награду необязательна.»

RU How to Play: «На компьютере двигайтесь с помощью WASD или стрелок. На телефоне используйте джойстик слева. Примите заказ, следуйте к маркеру ресторана, затем к клиенту. Рядом с точкой нажмите E или кнопку действия. Магазин, гараж, компанию и настройки можно открыть через меню. Меню и реклама приостанавливают доставку.»

EN short: “Start with local deliveries and build your own courier company.”

EN About: “Pick up restaurant orders and deliver them on time. Earn equipment and vehicles, unlock districts, hire couriers, and grow your delivery company. Complete challenges and collect achievements. Rewarded advertisements offer optional extra money.”

EN How to Play: “Move with WASD or the arrow keys on desktop, or the left joystick on mobile. Accept an order, follow the restaurant marker, then deliver to the customer. Press E or the action button when close enough. Open equipment, vehicles, company and sound settings through the menu. Menus and advertisements pause delivery.”

## RELEASE BLOCKERS — manual gates remaining

1. Real Yandex Debug Panel: init, RU/EN language, Ready, Gameplay, pause/resume; actual guest/cloud saving, auth success/cancel/account switch, rewarded/interstitial and leaderboard.
2. Console declarations and final icon/cover/screenshots/text/rights/name checks.
3. Physical declared browser/OS coverage, including older required environments; actual zoom, safe areas/Dynamic Island, native keyboard, longtap/swipe-to-refresh, audible sound and one-handed interaction.
4. Sustained physical low-end performance, long-session memory and real multi-session progression measurements. Targets: typical 60 FPS, stable lower-end 30 FPS; unverified hardware must be labelled **UNVERIFIED ON PHYSICAL DEVICE**.

No known local code-fixable blocker remains once final automated logs pass. Keep this as a draft candidate until the applicable manual gates have been completed. Deferred content is in POST_RELEASE_IDEAS.md; do not begin it as part of this release.

## Final packaging record

Archive: `artifacts/courier-empire-1.0.0.0-rc.zip` (952,931 compressed bytes), validated with nine files and one root index.html. Uncompressed content: **3,468,517 bytes**. SHA-256: `56664fac021ff3df6d08c4922e2c469f97624ff78d652d1edd07ac08c55d39d3`. Runtime dependency license notices ship as `licenses.txt`. Git release uses the requested message `release: prepare Courier Empire 1.0 release candidate`; the final response reports the actual commit hash and origin/main push result.


## Files created

- `BALANCE_REPORT.md`
- `MINIMUM_REQUIREMENTS.md`
- `POST_RELEASE_IDEAS.md`
- `RELEASE_CHECKLIST.md`
- `YANDEX_FINAL_AUDIT.md`
- `public/licenses.txt`
- `scripts/simulate-economy.mjs`
- `src/managers/TutorialManager.js`
- `src/services/AudioManager.js`
- `src/services/BrowserCompatibility.js`
- `src/ui/FeedbackUI.js`
- `src/ui/SettingsUI.js`
- `src/ui/TutorialUI.js`
- `tests/release-compat-browser.cjs`
- `tests/release.test.js`
- `tests/stage12-browser.cjs`
- `tests/tutorial-layout-browser.cjs`

## Files modified

- `.gitignore`
- `README.md`
- `index.html`
- `package-lock.json`
- `package.json`
- `scripts/check-build.mjs`
- `src/config/companyConfig.js`
- `src/config/districtConfig.js`
- `src/config/economyConfig.js`
- `src/config/eventBalance.js`
- `src/game.js`
- `src/input/MovementInput.js`
- `src/locales/en.json`
- `src/locales/ru.json`
- `src/main.js`
- `src/managers/CompanyManager.js`
- `src/managers/EventManager.js`
- `src/managers/OrderManager.js`
- `src/scenes/BootScene.js`
- `src/scenes/GameScene.js`
- `src/services/GameRuntime.js`
- `src/services/LifecycleManager.js`
- `src/services/LocalizationService.js`
- `src/services/PlatformService.js`
- `src/services/SaveManager.js`
- `src/state/GameState.js`
- `src/style.css`
- `src/ui/CompanyUI.js`
- `src/ui/GarageUI.js`
- `tests/company.test.js`
- `tests/districts.test.js`
- `tests/events.test.js`
- `tests/long-term-progression.test.js`
- `tests/platform.test.js`
- `tests/progression.test.js`
- `tests/statistics.test.js`
- `tests/transports.test.js`
- `vite.config.js`
