# Stage 11 — Yandex technical integration

**Localization pass, 2026-10-08:** complete bundled RU/EN catalogs, SDK language before gameplay modules, centralized fallbacks, development URL overrides, localized static/dynamic UI, number/plural helpers, language-neutral saved task/log migration and automated audits are now part of Stage 11. See [LOCALIZATION_AUDIT.md](LOCALIZATION_AUDIT.md) and [LOCALIZATION_GLOSSARY.md](LOCALIZATION_GLOSSARY.md). The original integration audit below is retained with startup/localization notes updated. Stage 12 has not begun.

## Baseline audit

The repository was clean on `main`, baseline `d162021` (Stage 10). Architecture: Phaser/Vite, BootScene → GameScene, singleton GameState with version-10 migrations, LOCAL PlatformService using `courier-empire-save-v1`, mathematical CompanyManager with two-hour offline cap, TaskManager/daily bonuses/rotating challenges, native dialog ModalUI plus separate personal/company EventUI, responsive viewport HUD/analog MovementInput. No actual audio package or leaderboard existed. Orders used raw `performance.now()` and continued during hidden tabs/menus; company used a document timer and `Date.now()` timestamps. Progress subscribes to GameState, not individual screens.

Before integration, `npm install` and `npm run build` passed and Stage 10 ran in local Chrome at 1280×800, 390×844, 430×932 and 844×390 with no console/runtime errors. This host had no global npm; the existing npm CLI and bundled Node were used. No project recreation or gameplay data redesign was performed.

## Startup and SDK boundary

The main entry initializes PlatformService, loads `/sdk.js` in an appropriate production host and awaits `YaGames.init()`. PlatformService immediately reads `environment.i18n.lang`, registers lifecycle/account events and gets server time/Player. The entry resolves ru/en, initializes LocalizationService and translates HTML, then dynamically imports the existing Phaser game/data modules. Boot selects/migrates progress before automatic writes, creates the existing company and courier textures, then GameScene builds world/physics/UI/orders. The first `postrender` removes the blocking loading overlay, calls idempotent `LoadingAPI.ready()` once, removes BOOT and starts GameplayAPI if no blocker remains. District restarts do not repeat Ready.

Only PlatformService knows `sdk`: device/language/time, Player/auth/data, advertising and modern `leaderboards`. `player.isAuthorized()` is used; no deprecated getMode/getLeaderboards, downloaded SDK, fake app ID, startup fullscreen request, third-party login/ads, IAP or sticky banners. LOCAL works without SDK, defaults to Russian and local device detection/Date.now, logs its mode once and grants no mock advertising reward. Player failure preserves Yandex lifecycle but blocks cloud writes until a successful next startup.

## Lifecycle and audio

`LifecycleManager` owns BOOT, PLATFORM, ADVERTISEMENT, MENU:<dialog>, AUTH:<flow>, VISIBILITY:<event>, RESULT, TRANSITION and user-added MANUAL reasons. Gameplay start/stop is driven by transitions and is idempotent. All active deadlines and temporary/company effect clocks use `lifecycle.now()`, which advances only without blockers. Scene physics, timers and tweens pause; input and joystick are cleared; keyboard/movement stay blocked until all reasons clear. DOM menus can still receive clicks and scroll. Personal choice-event consequences retain their explicit time penalties. Company UI notes now describe the paused delivery.

Garage → platform pause → platform resume keeps MENU; closing Garage still cannot remove an independent platform/ad/auth/visibility blocker. Company timers skip paused ticks and batch minor saves. Hidden-tab offline income remains capped; hiding during ads/auth/menu does not accrue hidden time as active simulation. User mute is separate from lifecycle pause; scene sound pauses/mutes and resumes only if gameplay is active and user mute is off. **PREPARED**: no music/sound content exists to audition.

## Saves, migration and accounts

Version **11** extends the existing serializer only with a small delivery ad bonus ledger. Cloud key `courierEmpire` contains `{ saveVersion: 11, revision, savedAt, gameState }`. Runtime orders/Phaser objects/temporary personal effects remain excluded. UTF-8 data over the 190,000-byte safety cap is rejected before setData (platform limit 200 KB). Local backups retain the existing flat progression shape plus revision/savedAt, so old local harnesses and migrations remain usable.

Valid cloud wins; empty cloud permits valid account-scoped local backup, then one-time original v1–10 local migration. No array/currency merging. An import marker and Yandex Player ID-scoped backups stop cross-account legacy imports. A selected account reload expressly skips the original guest backup. Unknown/future/nonempty invalid cloud or a failed getData/Player call blocks all cloud writes for the session; local progress continues. Successful old local import is migrated by GameState and uploaded through the normal queue. No default writes happen before save selection.

Important actions synchronously update local backup and request batched cloud synchronization. Cloud debounce is 1.5 s, minimum request interval 5 s, sequential queue, minor company writes at most once per 30 s. Interruption saves are best-effort and do not wait on the network. Failed writes stay dirty for throttled retry. A valid cloud is preferred on restart even if a local backup is newer, by the requested conservative conflict policy.

`ACCOUNT_SELECTION_DIALOG_OPENED` suspends local/cloud synchronization and AUTH gameplay. Closed dialog uses a controlled page reload; SDK/Player and selected cloud are reacquired on startup. In-flight old-player writes retain their old Player reference, queued writes are cancelled, and epoch guards prevent delayed leaderboard/reward callbacks affecting a selected account. Authorization benefits and a deliberate second **ВОЙТИ** confirmation are in Rating. Cancellation restores only AUTH:LOGIN; success reloads to select current cloud. No login is required.

## Trusted time and localization

TaskManager's date adapter is set before loading progress to UTC `YYYY-MM-DD` from `getServerTime()`. Existing saved day/claim high-water guards remain; old same-day task progress is retained. All daily bonus, task set and rotating challenge boundaries use this adapter. The runtime singleton defers daily initialization until platform time is selected. LOCAL uses Date.now but still stable UTC dates. On Yandex, temporary time failure extrapolates the last trusted anchor with a monotonic clock; without any anchor, fresh daily rollover/offline grants are deferred instead of trusting editable device time. Offline company timestamps use the same server source and keep the existing two-hour cap/duplicate protections.

SDK `environment.i18n.lang` initializes LocalizationService at startup, before gameplay/data module evaluation and save selection. `src/locales/ru.json` and `en.json` ship all current gameplay text. Exactly **ru/en** are supported; **ru/be/kk/uk/uz → ru**, **all other SDK codes → en**. LOCAL defaults to ru; Vite development alone accepts `?lang=ru/en`. There is no manual selector. Existing saved IDs remain stable; task strings are reconstructed from IDs and company logs/recovery strings migrate to message descriptors. `deviceInfo.type` complements local detection; actual viewport/media queries still own responsive layout.

## Advertising

Result now pauses gameplay until **ПРОДОЛЖИТЬ**. Only this natural break after a successful or failed personal order can request interstitial. Requirements: no active target/decision/dialog/other blocker, four successful orders since the preceding request, 180 active seconds before first request and 180 active seconds between requests. A refused/failed request consumes the opportunity/cooldown, never immediately retries and does not show a player error. Before requests, progress is backed up, gameplay/audio paused. Callback closure removes ADVERTISEMENT only. SDK automatic startup ads use platform events only.

Successful result offers **СМОТРЕТЬ РЕКЛАМУ**, explicitly showing `floor(finalDeliveryPayment × 0.5)` extra rubles. This includes the already eligible delivery modifiers, excludes event tips/previous rewarded money, and grants no XP/reputation or daily delivery earnings. Multiplier is configurable. One result token and persisted attempted/claimed flags prevent duplicate clicks/callbacks/reopening; current live delivered order must match, so refresh cannot redeem an old result. The money transaction exists only in `onRewarded`. Early closure/failure/local no-op pays nothing and displays **РЕКЛАМА СЕЙЧАС НЕДОСТУПНА**. The attempt is consumed even if unavailable; Continue remains usable.

## Ranking

Technical name **`courier_score`**, modern `ysdk.leaderboards`, authorized methods checked via `isAvailableMethod`. Guest UI shows local score and optional login. Authorized UI fetches own rank and five top/three nearby entries, using safe text nodes/private-name fallback. Missing leaderboard/404/privacy/network denial never crashes gameplay. Score writes: at least 10 s apart and only after a new progression score; failed equal-score writes are not continually retried by passive ticks. Reads share a cached promise for 16 s (entries) / 6 s (own entry), including failures, preventing rapid reopen floods.

Central non-negative integer formula (`platformConfig.score`):

```text
1000 × max(level, recordedHighestLevel)
+ 10 × max(0, reputation, recordedHighestReputation)
+ 100 × completedPersonalOrders
+ 2000 × unlockedDistrictCount
+ 500 × achievementCount
+ 1500 × officeLevel (only if company unlocked)
+ 750 × sum(companyUpgradeLevels)
+ 5 × successfulCompanyEmployeeDeliveries
+ 500 × legacyUpgradeCount
```

Wallet/spending is excluded; reputation penalties cannot reduce recorded score. Config weights and counters normally increase with progression.

## Mobile/build

Existing viewport/compact HUD, actual analog joystick, E/WASD/arrows and responsive canvas survive. Root overflow/overscroll, user selection/callout prevention and context-menu blocking cover game interaction; dialogs retain internal pan-y scrolling and text inputs can select text. Safe areas and portrait/landscape layout are retained. Resize clears input and preserves GameState. No sticky banner is requested; keep Console banners off.

Vite `base: './'` produces relative assets. `scripts/check-build.mjs` rejects non-ASCII/space paths, non-root index, files >=100 MB and bundled SDK/source/tests/node_modules. Current dist has three files, **1,435,552 bytes / 1.436 MB (1.369 MiB)**; exact bytes are printed by every build. ZIP only these files. The existing large Phaser chunk warning is nonfatal. Dist, node_modules and local screenshots/ZIP under artifacts remain git-ignored.

## Verification and audit (2026-10-07)

`npm install`: PASS, no dependency audit vulnerabilities. `npm test`: **129/129 PASS** (110 prior tests + 19 Stage 11 contract tests). `npm run build`: PASS, archive constraints pass. Existing Stage 10 browser regression: PASS at four sizes. Existing mobile UX suite: PASS at four mobile sizes plus desktop keyboard/E/diagonals. Stage 10 production suite: PASS at desktop/portrait/landscape, debug cheats excluded. Stage 11 local suite: PASS at 1280×800, 390×844, 430×932, 320×568, 844×390; nested platform/menu pause, frozen deadline, result/no-op ad, save refresh after delivery/purchase/district/company/achievement/daily claim, resumed controls, orientation and gesture CSS. No local runtime/console errors.

SDK doubles in `platform.test.js` test missing/rejected SDK, failed Player, guest/authorized data, old/empty/conflicting/future/failed cloud, batching/size limits/errors, auth cancellation/success/events, ad reward/closure/errors/duplicates, score/access/404/throttles, UTC/time spoofing and offline cap. These are **contract tests, not real Yandex results**.

| Requirement | Local implementation/test status | Real Yandex acceptance |
| --- | --- | --- |
| SDK | PASS fallback + contract | REQUIRES YANDEX DEBUG ENVIRONMENT |
| Game Ready | PASS first render/one-shot contract | REQUIRES YANDEX DEBUG ENVIRONMENT |
| GameplayAPI | PASS idempotent lifecycle contract | REQUIRES YANDEX DEBUG ENVIRONMENT |
| game_api_pause/resume | PASS translated event/nested local pause | REQUIRES YANDEX DEBUG ENVIRONMENT |
| Guest gameplay | PASS LOCAL | REQUIRES YANDEX DEBUG ENVIRONMENT |
| Guest save | PASS local + Player contract | REQUIRES YANDEX DEBUG ENVIRONMENT |
| Optional authorization | PASS deliberate UI/contract | REQUIRES YANDEX DEBUG ENVIRONMENT |
| Cloud save | PASS migration/conflict/error contract | REQUIRES YANDEX DEBUG ENVIRONMENT |
| Language auto-detection | PASS adapter/fallback contract | REQUIRES YANDEX DEBUG ENVIRONMENT |
| Server time | PASS anchor/UTC/spoofing contract | REQUIRES YANDEX DEBUG ENVIRONMENT |
| Interstitials | PASS natural-break/cooldown/refusal contract | REQUIRES YANDEX DEBUG ENVIRONMENT |
| Rewarded ads | PASS onRewarded/once-only contract | REQUIRES YANDEX DEBUG ENVIRONMENT |
| Leaderboard | PASS score/auth/cache/error contract | REQUIRES YANDEX DEBUG ENVIRONMENT |
| Audio pause | PREPARED; no audio content | Verify when content exists |
| Responsive desktop | PASS Chrome | Cross-browser/device checks manual |
| Mobile portrait | PASS Chrome 390/430/320 | Physical Android/iOS checks manual |
| Mobile landscape | PASS Chrome 844×390 | Physical Android/iOS checks manual |
| Browser scroll disabled | PASS root CSS/browser | Physical device checks manual |
| Swipe-to-refresh prevented | PASS overflow/overscroll/touch setup | Physical device/browser checks manual |
| Long press/context menu | PASS selection/callout/context setup | Physical Android/iOS checks manual |
| Progress survives refresh | PASS listed transactions | Cloud/cross-device checks manual |
| Build under 100 MB | PASS ~1.436 MB | Same uploaded archive must be checked |
| index.html at root | PASS | ZIP contents must preserve root |
| ASCII/no-space production names | PASS | Same uploaded archive must be checked |
| No runtime console errors | PASS local dev/production Chrome | REQUIRES YANDEX DEBUG ENVIRONMENT |

No real platform action is labelled tested. Complete `YANDEX_RELEASE_CHECKLIST.md` before moderation. Physical iOS/Android, other advertised browsers, live ads/auth/cloud/account selection/leaderboard and promotional Console assets remain manual. Cloud read failure safely leaves that session local-only; reconnect requires reload to select cloud. Network writes are best-effort at page hide. Active orders/effects stay session-only as before. No Stage 12 feature work was started.

## File manifest

Created: `src/config/platformConfig.js`, `src/locales/ru.json`, `src/services/LifecycleManager.js`, `src/services/LocalizationService.js`, `src/services/SaveManager.js`, `src/services/GameRuntime.js`, `src/services/LeaderboardManager.js`, `src/managers/AdManager.js`, `src/ui/LeaderboardUI.js`, `vite.config.js`, `scripts/check-build.mjs`, `tests/platform.test.js`, `tests/stage11-browser.cjs`, `STAGE11.md`, `YANDEX_RELEASE_CHECKLIST.md`.

Modified: `README.md`, `package.json`, `index.html`, `src/main.js`, `src/scenes/BootScene.js`, `src/scenes/GameScene.js`, `src/services/PlatformService.js`, `src/state/GameState.js`, `src/managers/CompanyManager.js`, `src/ui/ModalUI.js`, `src/ui/EventUI.js`, `src/ui/CompanyEventUI.js`, `src/ui/OrderUI.js`, `tests/company.test.js`, `tests/events.test.js`, `tests/stage10-browser.cjs`.

Git publication uses the requested message `feat: integrate Yandex Games SDK cloud saves ads and leaderboard` on `main` with normal push to `origin/main`; commit/push results are reported in the final response after verification.
