# Stage 11 — complete RU/EN localization audit

Date: **2026-10-08**. Existing Courier Empire project preserved. **Stage 12 has not begun.** No gameplay features, districts, vehicles, economy rebalance or progression reset were added.

## Results

| Check | Result |
|---|---|
| Russian translation keys | **919** |
| English translation keys | **919** |
| Missing RU / EN keys | **0 / 0** |
| Matching key structures and interpolation parameters | **PASS** |
| Hardcoded user-facing Cyrillic outside approved contexts | **0** |
| Hardcoded user-facing English outside approved contexts | **0** |
| Mixed-language catalogs and exercised UI | **PASS** |
| Startup SDK detection, first localized render, Ready ordering | **PASS — local SDK contract mocks** |
| Actual Yandex I18N/debug-panel verification | **REQUIRES YANDEX DEBUG TEST** |
| Unit/contract/gameplay regression tests | **137 PASS, 0 FAIL** |
| Production build and archive checks | **PASS** |

The source checker parses JavaScript literals/templates and recognizes translation calls, presentation fields, text assignments, Phaser text and accessibility labels. It also checks HTML translation references, CSS-generated text, key parity, non-empty values, matching interpolation parameters and unintended cross-language text. Whitelisted contexts are internal IDs/enums, module/DOM/CSS/font/input identifiers, developer diagnostics/comments and intentional proper names/abbreviations/universal symbols. This is a syntax/whitelist audit plus browser coverage, not proof about every possible future code path.

## Architecture and startup (requested items 1–6, 14–15)

`src/services/LocalizationService.js` owns exactly `SUPPORTED_LANGUAGES = ['ru', 'en']`, bundled JSON dictionaries, `initialize`, `getLanguage`, `has`, `t`, `resolvePlatformLanguage`, document translation, cached number formatting and plural rules. Dictionary lookup is local and lightweight; there are no translation API calls or external dictionary requests.

`PlatformService.initialize()` awaits `YaGames.init()` and immediately reads **`sdk.environment.i18n.lang`**, before Player/save/gameplay work. `src/main.js` loads the neutral spinner styles, awaits the platform, selects language, initializes localization, translates HTML/title/aria labels, then dynamically imports `src/game.js`. Gameplay data/configuration modules are evaluated only after the language is known. BootScene initializes saves/company/assets; GameScene renders playable UI; the first postrender removes loading and calls `LoadingAPI.ready()` once. No Russian-to-English gameplay flash occurs.

Central Yandex fallback: **ru, be, kk, uk, uz → ru**; **en and every other unsupported code → en** (including de/fr/es/tr/it/pt/zh/ja). Regional code prefixes are normalized. LOCAL without SDK defaults to **ru**. Only Vite development permits `?lang=ru/en`; production retains SDK precedence. No language selector was added.

Whole templates use **`{{variable}}`**. `t(key, variables)` formats numeric variables and substitutes string variables without translated fragment concatenation for sentence word order. Example: `t('company-manager.007', { v0: 3 })` → `Требуется уровень 3` / `Level 3 required`. Task templates defer count interpolation until instantiation; typed orders, deliveries, tips/event counts use plural forms. `Intl.PluralRules` selects `one/few/many/other`; both catalogs contain the same form keys (unused English few/many entries match its plural). Examples: `1 заказ / 2 заказа / 5 заказов`, `1 delivery / 2 deliveries`. `Intl.NumberFormat` produces `12 500 ₽` / `12,500 ₽`, including rewards, wallets, scores, records and decimals. Countdown strings retain universal leading-zero `mm:ss` formatting.

Both dictionaries ship in the production bundle. Build validation rejects missing/mismatched keys, and archive validation checks RU/EN title/event content in generated JavaScript. A missing language dictionary falls back to Russian with an explicit release-blocking developer error; missing keys also log an error. Production must pass the audit with both complete catalogs.

## Translation coverage (requested items 7–13)

- HUD/title/menu, balance/level/XP/reputation/streak, full order offers/details/interaction/countdown/results/modifiers, double-order progress and all **6 order types**; elite variants/documents/VIP/corporate cargo.
- Courier profile, equipment/statistics/reputation/career/title/next-goal labels; Shop's **3 items**, descriptions, requirements, purchase/equipment/error feedback; Garage's **4 transport options**, benefits, weather/risk, milestones and celebrations.
- All **5 districts**, map/unlock/introduction/mastery/company bonuses, customer locations, restaurant descriptive wrappers and dynamically rendered world building labels. Restaurant brands remain intentional proper names. There are no bitmap assets with baked gameplay text: existing graphics are Phaser shapes with localized text rendered separately.
- **All 31 personal events**, including transport/district events: title, description, every choice/consequence and all resolution messages. Humor is adapted naturally (cola investigation, soup aquarium, missing fry, GPS lying).
- Entire company UI, **5 employee archetypes**, **4 offices**, vehicles, **4 upgrade branches**, candidate/stat/income/offline/log labels and feedback; **all 14 company events**, including every choice and outcome.
- **All 37 achievements**, descriptions/categories/progress/rewards/secret placeholders and notifications; the career path, global goals, records, legacy upgrades and titles. “Уже не бомж” becomes **Moving Up in the World**.
- **All 28 daily/rotating task templates**, all progression tiers, **3 session challenge templates**, daily bonus/set completion, claims, streak milestones and notifications.
- Leaderboard score/rank/empty/errors/private-name fallback, optional authorization explanation/confirmation/cancellation, rewarded advertisement offer/buttons/unavailable/bonus feedback and Continue. Existing movement/interaction/joystick/tutorial hints and accessibility text are localized. No separate settings screen or additional tutorial system exists to translate.

Terminology is documented in [LOCALIZATION_GLOSSARY.md](LOCALIZATION_GLOSSARY.md).

## Saves and migration (requested items 16–17)

Save version remains **11**. Items, transports, districts, order types, achievements, career selections, archetypes and task IDs already used language-neutral identifiers; they remain unchanged. No currency, XP, unlocked content, claim ledger or employee ID is reset.

- Task `title`/`description` are omitted from new serialized saves. Existing saved strings are ignored and reconstructed from the same template ID, tier and counters by the existing task loader.
- New company log entries/effect results use structured `{ key, variables }` messages, with nested message descriptors when needed. Known old RU/EN log and recovery strings migrate to descriptors; rendering uses the current language. Unrecognized historical log/recovery text is retained in legacyText metadata and displayed as a localized earlier-version placeholder. Details of these unknown historical entries are not shown; no text is deleted or guessed. Current gameplay emits known descriptors.
- The generated default company name is serialized as `null` and rebuilt in the current language. Both prior default spellings are recognized; custom company names are preserved.
- Generated employee names display through paired Cyrillic/transliterated mappings; their existing names/IDs remain intact in saved state. Platform names and custom names remain user data.
- Snapshot copying includes nested messages/recovery data. Cloud wrapper, account scoping, schema validation, save key and synchronization policies stay compatible.

RU→EN and EN→RU browser reloads preserve wallet, completed orders and owned transport IDs; unit/gameplay regression checks cover the rest of the save ledgers and migration sanitization.

## Testing and moderation (requested items 18–22, 25, 28)

Before translation, the existing game built through Vite and the existing Stage 11 Chrome regression passed at desktop and mobile sizes. The initial global `npm` command was unavailable; the existing local npm CLI was subsequently located at `artifacts/tools/package/bin/npm-cli.js`. Final **`npm run build` and `npm test`** were run through that CLI with bundled Node. No dependency or lockfile change was required.

Commands for normal developer environments:

```sh
npm run dev
# http://localhost:5173/?lang=ru
# http://localhost:5173/?lang=en
npm run test:localization
npm test
npm run build
npm run preview
```

Browser harness: `tests/localization-browser.cjs`; environment variables `PLAYWRIGHT_MODULE`, `CHROME_PATH`, `GAME_URL`, `PREVIEW_URL` are configurable. It tests:

- RU and EN at **1280×800, 390×844, 430×932, 844×390**: HUD/order/joystick, all major dialogs and company/task/progress sub-tabs; visible text, interpolation and dialog bounds/horizontal overflow. Screenshots are in ignored `artifacts/localization/` and representative portrait/landscape views were visually inspected.
- All order types, active/result/failure states, optional ad unavailability and double progress in each viewport.
- All personal/company events on desktop in both languages, every choice and deterministic low/high rolls; choice dialogs and outcome text.
- Every achievement's notification, every task template at levels 1/6/20, task completion/reward, equipment/vehicle purchase, district/company unlock introduction and hire feedback in both languages.
- Old RU save loading, localized logs/names/default company name, then switching via a reload to the other local language without losing progression.
- Production **labelled SDK contract mocks** for ru/en/be/de, opposite `?lang` parameters, I18N getter observed before Ready, correct language in the first playable UI/Ready snapshot, guest authorization/cancellation and ranking-unavailable UI. These are not real Yandex sessions.
- Existing `tests/stage11-browser.cjs` regression also passes **1280×800, 390×844, 430×932, 320×568, 844×390**: nested pauses/timers/results/local ads/purchases/migration/persistence/joystick/orientation/browser gestures.

No localization-related runtime/console errors or missing-file requests occurred in the browser checks. Production archive: **5 files, approximately 1.531 MB**, with root index.html, ASCII filenames and both dictionary contents. Vite retains the existing large Phaser/game chunk warning; the build succeeds and remains below the Yandex archive size limit.

Requirement **2.14** code/contract audit:

- [x] Language from `sdk.environment.i18n.lang` immediately after YaGames.init.
- [x] During startup, before gameplay/data modules and save initialization.
- [x] Both RU/EN and all required fallback mappings tested.
- [x] Localized UI before Game Ready; no manual-only detection.
- [x] Yandex debug-panel instructions documented.
- [ ] Actual uploaded draft's Yandex I18N indicator/real startup test — **REQUIRES YANDEX DEBUG TEST**.

Requirement **8.2.3** repository/local audit:

- [x] Interactive buttons, gameplay/currency/orders/control hints, all existing menus and accessibility labels.
- [x] Events/choices/outcomes/notifications; Shop/Garage/Profile/Map/Company/Tasks/Progress/Achievements/Legacy.
- [x] Rewarded-ad wording, leaderboard/auth explanation/errors/empty states; no untranslated existing input placeholders.
- [x] RU/EN key parity, source text audit and exercised UI mixed-language checks.
- [ ] Real Yandex moderation/device/cloud/ad/account acceptance in both declared languages.

Requirement **6.9**: no existing manual selector and none added, so selector-specific work is not applicable. Automatic detection remains mandatory and implemented.

Remaining manual work: use **Open with debug panel → SDK mocks → Ru**, reload/open the generated instance and confirm startup I18N; repeat with **En** and inspect every listed system. Test fallback codes and real mobile browsers. In Console declare **only Русский and English**. Prepare English title/short/full descriptions/how-to-play/promotional metadata separately; repository code has **not completed Console metadata**. Follow [YANDEX_RELEASE_CHECKLIST.md](YANDEX_RELEASE_CHECKLIST.md) for actual ads/auth/cloud/ranking tests. No moderation acceptance is claimed.

## Files and Git (requested items 23–24, 26–27)

Created: `src/game.js` (existing Phaser setup moved behind startup), `src/locales/en.json`, `src/services/LocalizedMessages.js`, `scripts/check-localization.mjs`, `tests/localization.test.js`, `tests/localization-browser.cjs`, `LOCALIZATION_GLOSSARY.md`, this report.

Modified: `index.html`, `package.json`, `scripts/check-build.mjs`, `README.md`, `STAGE11.md`, `YANDEX_RELEASE_CHECKLIST.md`; `src/main.js`, `src/style.css`, `src/locales/ru.json`; config modules company/district/economy/legacy/progression/transport; data modules achievements/companyEvents/dailyTasks/events/shopItems; managers Achievement/CompanyEvent/Company/DeliveryRewards/DevelopmentCheats/Event/Shop/Task; `GameScene`; services GameRuntime/Localization/Platform; state GameState/companyState; UI CompanyEvent/Company/District/EventHistory/Event/Garage/HUD/Leaderboard/Order/PlayerProfile/Progress/Shop/Tasks; world deliveryLocations/districtLayouts; existing tests company/platform/stage11-browser.

Commit requested: **`feat: add complete Russian and English localization`**, target **origin/main**, normal push without history rewriting. The final chat response records the resulting commit hash and push status after execution (a commit cannot contain its own hash).
