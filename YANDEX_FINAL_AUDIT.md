# Yandex final audit — 1.0.0.0 Release Candidate

Checked 2026-10-08 against the [official numbered requirements](https://yandex.ru/dev/games/doc/ru/concepts/requirements), revision 2026-09-29. Short topic labels below identify the numbered sections; implementation evidence is from this repository and local test runs. This is not a moderation certificate.

**PASS** means the stated repository/local scope was inspected or tested. **MANUAL TEST REQUIRED** means the complete claim depends on Console, live SDK, another browser/device or human acceptance. **NOT APPLICABLE** means the feature is absent or the section is withdrawn. No current code-fixable FAIL remains after the local checks documented in `RELEASE_CHECKLIST.md`; manual rows remain release gates.

Evidence abbreviations: U = `npm test` (149 tests); L = `scripts/check-localization.mjs` plus `tests/localization-browser.cjs`; B = `tests/stage12-browser.cjs`; S = `tests/stage11-browser.cjs`; P = `PlatformService.js`; R = `GameRuntime.js`/`LifecycleManager.js`; Save = `SaveManager.js`/`GameState.js`. Browser logs/screenshots/JSON are in ignored `artifacts/`. SDK doubles are explicitly labelled and never treated as a real Yandex result.

## Technical

| Number | Topic | Status | Evidence / remaining action |
| --- | --- | --- | --- |
| 1.1 | SDK | MANUAL TEST REQUIRED | P loads `/sdk.js`, initializes YaGames; U/B contract checks pass. Run actual draft. |
| 1.2 | Authorization | MANUAL TEST REQUIRED | Only SDK login; gameplay works in LOCAL and mocked guest mode. Confirm live guest startup. |
| 1.2.1 | Consent | MANUAL TEST REQUIRED | LeaderboardUI has deliberate login and localized confirmation/benefits; L tests cancellation. Live dialog pending. |
| 1.2.2 | Guest | MANUAL TEST REQUIRED | Save uses account-scoped local backup and Player data; S/U reload checks pass. Live guest/cross-device check pending. |
| 1.3 | Focus/audio | MANUAL TEST REQUIRED | R clears input and blocks clocks; AudioManager stops voices; U overlapping blockers pass. Audible physical-device focus check pending. |
| 1.4 | Payments | NOT APPLICABLE | No IAP or external payment code. In-game ₽ is fictional currency. |
| 1.5, 1.17 | Withdrawn | NOT APPLICABLE | No independent current acceptance gate. |
| 1.6 | Platforms | MANUAL TEST REQUIRED | Declare desktop/mobile only after device checks; do not declare TV. |
| 1.6.1.1 | Fullscreen | MANUAL TEST REQUIRED | Canvas fills the viewport; actual host/browser fullscreen behavior pending. |
| 1.6.1.2 | Keyboard | MANUAL TEST REQUIRED | Company name is a native text input at 16px; verify mobile keyboard and dialog recovery. |
| 1.6.1.3–4 | Withdrawn | NOT APPLICABLE | Covered by current responsive checks where relevant. |
| 1.6.1.5 | Touch | MANUAL TEST REQUIRED | MovementInput normalizes 360° joystick; contextual interaction and menus exercised by S/B. Physical touch acceptance pending. |
| 1.6.1.6 | Player | PASS | No audio/video HTML player; AudioManager uses Web Audio oscillators. |
| 1.6.1.7 | WebGL | PASS | Phaser AUTO; no user-facing WebGL warning. Canvas fallback startup additionally smoke-tested. |
| 1.6.1.8 | Longtap | MANUAL TEST REQUIRED | R prevents game context menu; CSS blocks selection/callout. S/B gesture checks pass; native longtap pending. |
| 1.6.2.1 | Field | PASS | Phaser RESIZE and full-height/width container inspected; desktop B dimensions pass. |
| 1.6.2.2 | Aspect | PASS | Desktop fine-pointer container caps active field at 2:1; extra 2560×1080 / 1000×2400 checks. |
| 1.6.2.3 | Withdrawn | NOT APPLICABLE | See current layout rows. |
| 1.6.2.4 | Keys | PASS | Physical key codes for WASD/arrows/E; U/S and real-key tutorial delivery B. No text-layout-dependent movement. |
| 1.6.2.5 | Player | PASS | No system media-player element. |
| 1.6.2.6 | Shortcuts | PASS | Production has only normal movement/interaction keys. Development cheats are excluded from dist. |
| 1.6.2.7 | Selection | PASS | Canvas context event is canceled in B/S; body selection/drag restrictions inspected. |
| 1.6.3.1–5 | TV | NOT APPLICABLE | TV/remote navigation is not implemented and is not an intended declared platform. |
| 1.7 | S3 | PASS | Source/production inspection: relative assets, no absolute S3 URL. |
| 1.8 | Targets | PASS | Menu/tutorial buttons have 44px minimum, interaction 58px compact; B checks close access at all requested sizes. Native checkbox has a larger label hit area. |
| 1.9 | Persistence | MANUAL TEST REQUIRED | U/S/B immediate transactions/reloads, schema 12, skip and audio preferences pass locally; live cloud/device change pending. |
| 1.10 | Layout | MANUAL TEST REQUIRED | Local requested matrix passes; actual browser zoom, native safe areas and old browsers pending. |
| 1.10.1 | Bounds | PASS | B tests 11 dimensions × RU/EN × dev/production × 3 viewport equivalents; modal bounds and close controls. |
| 1.10.2 | Scroll | MANUAL TEST REQUIRED | Local page overflow/context checks pass and S native touch menu scrolling passes; physical swipe-to-refresh pending. |
| 1.10.3 | Overlap | MANUAL TEST REQUIRED | Modal bounds/overflow checks and inspected representative screenshots; money popup moved clear of reward button. Physical notch/zoom review still needed. |
| 1.10.4 | Reach | MANUAL TEST REQUIRED | Movement and interaction are sequential; compact HUD, bottom joystick and contextual button. Verify comfortable one-handed use physically. |
| 1.11 | Cloud flag | MANUAL TEST REQUIRED | Enable cloud-saving declaration in Console; repository cannot set that field. |
| 1.12 | Monetization | MANUAL TEST REQUIRED | SDK interstitial/rewarded code present; actual ad inventory/Console setup untested. |
| 1.13.1–6 | IAP | NOT APPLICABLE | No IAP SDK use; keep Console IAP inactive/empty. |
| 1.14 | Stability | MANUAL TEST REQUIRED | U/L/S/B pass, rapid resize/history and repeated district restarts checked. Real ads/auth/rotation on declared devices pending. |
| 1.15 | Completion | MANUAL TEST REQUIRED | Complete delivery/company/progression loop and finished localized UI; human draft-quality acceptance remains. RC is an internal release label. |
| 1.16 | Ad integrity | PASS | P passes callbacks to SDK; no custom ad player/overlay or modifications of SDK creative. |
| 1.18 | URL | PASS | Relative Vite assets, no origin whitelist blocking gameplay; preview serves actual dist. Loopback selects LOCAL only. |
| 1.19 | Lifecycle | MANUAL TEST REQUIRED | Central SDK wrapper and blockers; U/B pass. Live callbacks pending. |
| 1.19.1 | Init | MANUAL TEST REQUIRED | `main.js` waits for platform and language before loading gameplay. Actual hosted SDK pending. |
| 1.19.2 | Ready | MANUAL TEST REQUIRED | B/L verify one ready callback after localized first rendered scene; live Game Ready pending. |
| 1.19.3 | Gameplay | MANUAL TEST REQUIRED | R has idempotent start/stop; nested blocker U/B checks pass. Live analytics/debug check pending. |
| 1.19.4 | Pause | MANUAL TEST REQUIRED | Menu+platform+ad blockers retain pause until all clear; U/S/B frozen timer/input checks pass. Live pause/resume pending. |
| 1.20 | Compatibility | MANUAL TEST REQUIRED | Modern and legacy bundles; missing-API and forced legacy smoke checks are local only. See MINIMUM_REQUIREMENTS.md. |
| 1.20.1 | Browsers | MANUAL TEST REQUIRED | Only this host's Chrome is tested; other listed browsers/mobile app remain unverified. |
| 1.20.2 | Desktop OS | MANUAL TEST REQUIRED | Legacy Windows/macOS are unverified. |
| 1.20.3 | Mobile OS | MANUAL TEST REQUIRED | Android/iOS physical hardware, including old OS targets, unverified. |
| 1.20.4 | Android TV | NOT APPLICABLE | Not declared. |
| 1.21 | Size | PASS | `check-build.mjs`: 9 production files, 3,468,517 bytes before final archive creation; below limit. |
| 1.22 | Archive | PASS | One root index.html; ASCII/no-space names; no sources/maps/tests/node_modules/sdk.js; ZIP validation documented in checklist. |
| 1.23 | AI | PASS | No runtime interactive AI, remote chat or generative API in game. |
| 1.24 | Concept | PASS | Existing courier art, districts, fleet/company/Legacy systems preserved; only polish/balance. |

## Experience and content

| Number | Topic | Status | Evidence / remaining action |
| --- | --- | --- | --- |
| 2.1 | Quality | MANUAL TEST REQUIRED | Human moderation judgment; local functional evidence is not platform acceptance. |
| 2.2 | Controls | PASS | Localized guide, contextual labels and once-only tutorial; B actual delivery and skip checks. Console How to Play still to fill. |
| 2.3 | Genre | MANUAL TEST REQUIRED | Choose matching courier/simulation categories in Console. |
| 2.4 | Mechanics | PASS | Actual movement/collision, order pickup/delivery, timed decisions, earning/purchases, company/progression; U/B. |
| 2.5–6, 2.10–12 | Withdrawn | NOT APPLICABLE | Current replacement sections are audited separately. |
| 2.7 | Age | MANUAL TEST REQUIRED | Set appropriate Console rating after reviewing fictional food/courier humor. |
| 2.8 | Progression | PASS | Existing levels, transport/district unlocks, company and Magnate goals; U and BALANCE_REPORT.md. |
| 2.9 | Duration | PASS | Repeatable orders/daily challenges and multi-hour configured progression; no 10-minute terminal end; model limitations documented. |
| 2.13 | Rating | MANUAL TEST REQUIRED | Post-publication operational metric; cannot be verified pre-release. |
| 2.14 | Language | MANUAL TEST REQUIRED | L verifies SDK language ru/en/be/de, first UI and ready; live Debug Panel RU/EN pending. |
| 3.1–3, 3.4.1, 3.8 | Withdrawn | NOT APPLICABLE | Current text/media and IAP sections audited. |
| 3.4.2–6 | Safety | PASS | Source dictionaries/world inspected: fictional delivery humor, no occult/violent/political/religious/prediction content found. |
| 3.5 | Rights | MANUAL TEST REQUIRED | World is existing procedural art; new SFX are original oscillators. Dependencies have licenses; publisher confirms ownership of final promo materials. |
| 3.6 | Originality | MANUAL TEST REQUIRED | Publisher/catalog comparison is external to repository. |
| 3.7 | Prizes | PASS | Fictional ₽ only, no cash-out, physical prizes or real-world rewards. |
| 3.9 | Video | NOT APPLICABLE | No embedded video/YouTube or external player. |

## Advertising and Console

| Number | Topic | Status | Evidence / remaining action |
| --- | --- | --- | --- |
| 4.1 | SDK ads | PASS | AdManager → P SDK only; LOCAL shows no fake ad and pays no mock reward; U/S. |
| 4.2 | Recovery | MANUAL TEST REQUIRED | B/S/U preserve state and nested blockers; live click-through/background return pending. |
| 4.3 | Orientation | MANUAL TEST REQUIRED | Actual SDK creative orientation and rotation pending. |
| 4.4 | Timing | PASS | Only Continue after completed/failed order can consider interstitial: four successes, 180 active seconds; no idle/startup interval ad. U. |
| 4.5 | Voluntary | PASS | Explicit Watch Ad; Continue available without it; B/U. |
| 4.5.1 | Reward clarity | PASS | RU/EN localized exact amount and +50% payment explanation adjacent to Watch Ad; L/B screenshots. |
| 4.5.2 | Optional | PASS | No-ad ordinary economy meets model targets; normal delivery/progression available without ads. |
| 4.6.1–2 | Banners | NOT APPLICABLE | No sticky/RTB/custom banners. |
| 4.7 | Ad pause | MANUAL TEST REQUIRED | AudioManager stops voices, R freezes game; U/B double callbacks/overlap pass. Real rewarded/interstitial audio check pending. |
| 5.1.1, 5.1.1.1–3, 5.1.2 | Promotion | MANUAL TEST REQUIRED | Select actual gameplay captures; final Console materials are not created/approved by code. |
| 5.1.3 | Names | MANUAL TEST REQUIRED | In-game titles exact: Курьерская Империя / Courier Empire; match Console/promos per language. |
| 5.2–4 | Fields | MANUAL TEST REQUIRED | RELEASE_CHECKLIST.md lists text, categories, version, platforms, orientation and asset fields. |
| 5.5, 5.7–8, 5.10 | Withdrawn | NOT APPLICABLE | Current text/media rows apply. |
| 5.6 | Icon/cover | MANUAL TEST REQUIRED | Prepare separate icon and cover, not gameplay screenshots. |
| 5.9, 5.11–12 | Materials | MANUAL TEST REQUIRED | Verify final framing, field text and catalog name uniqueness in Console. |

## Recommended and text/media

| Number | Topic | Status | Evidence / remaining action |
| --- | --- | --- | --- |
| 6.1 | Contact | MANUAL TEST REQUIRED | Publisher contact field to fill. |
| 6.2 | Mute | PASS | SettingsUI 0–100%/mute persist; U/B reload checks. |
| 6.3 | Pause | PASS | Menus pause delivery and movement; R/S/B. |
| 6.4 | Console | PASS | Final Chrome U/L/S/B runs report no runtime/console errors. Build size warning is not a runtime error. |
| 6.5–6 | Title | PASS | Existing concise two-word title in each language. |
| 6.7 | Controls | PASS | Production has functional menus/interaction, no exit/debug buttons; B menu actions. |
| 6.8 | Tutorial | PASS | One real delivery, movement threshold, skip always available; fresh/veteran/future-seen migration U/B. |
| 6.9 | Selector | NOT APPLICABLE | Production has automatic SDK language; local URL override is development-only. |
| 7 | Withdrawn | NOT APPLICABLE | No current independent gate. |
| 8.1 | Scope | MANUAL TEST REQUIRED | Repo content reviewed; final Console text/assets also need review. |
| 8.2.1 | Writing | PASS | All 945 RU/EN dictionary keys reviewed; spelling/wording/terminology corrections, interpolation/plural tests. |
| 8.2.2 | Accuracy | PASS | Payment, time, company, transport unlock and ranking wording checked against implementation; no false real-money claim. |
| 8.2.3 | Translation | PASS | Key/interpolation parity, no visible mixed-language L/B; serialized messages stay language-neutral; both dictionaries ship. |
| 8.2.4 | Profanity | PASS | RU/EN authored strings reviewed; derogatory early achievement renamed. No profanity found. External player names are platform data, not authored game content. |
| 8.2.5 | Safety | PASS | Authored text review; no prohibited subject matter found. |
| 8.3.1–4 | Media | MANUAL TEST REQUIRED | Existing procedural art visually preserved; QA captures inspected. Final icon/cover/screenshots need Console format/framing review. |
| 8.3.5–7 | Media safety | MANUAL TEST REQUIRED | In-repo game art reviewed; publisher must review final external promotional assets. |
| 8.4.1 | Game links | NOT APPLICABLE | No cross-game links. |
| 8.4.2 | External links | PASS | No player-facing external links in source/HTML. |
| 8.4.3, 8.4.3.1–3 | Social links | NOT APPLICABLE | None. |
| 8.4.4 | Redirects | PASS | No external navigation/redirect/prompt to leave the portal. Account reload is same-page. |

## Manual release gates

Live Yandex draft: SDK init, RU/EN environment, Ready/Gameplay/pause events, guest and authorized cloud saves, auth cancel/success/account change, real rewarded/interstitial callbacks, focus return, leaderboard `courier_score` and offline/server-date behavior. Console: cloud flag, monetization, fields/assets, orientation/platform declarations and catalog name uniqueness. Devices: selected browsers, old OS targets, actual 80/100/125% zoom, notches/safe areas, native keyboard, audible sound, longtap/swipe-to-refresh, one-handed play and sustained low-end performance. Do not submit public moderation until those applicable gates pass.
