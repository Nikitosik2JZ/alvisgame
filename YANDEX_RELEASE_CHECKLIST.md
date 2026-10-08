# Stage 11 release checklist — manual Yandex actions

These actions have **not** been performed by game code or local tests. No app ID is hardcoded. This is technical preparation, not a moderation acceptance claim.

## Console

1. Run `npm install`, `npm test`, `npm run build`. ZIP the contents of `dist` so `index.html` is at the ZIP root. Upload into the existing game draft, preserving its identity.
2. Enable **Desktop** and **Mobile** platforms.
3. Verify portrait and landscape on real Android/iOS devices; choose supported orientation(s) based on those results. Local Chrome tests covered both orientations including 320×568.
4. In **«Игра переведена на»**, declare **Русский / Russian (`ru`) and English (`en`) only**. Do not select Turkish or any other language. Unsupported SDK language codes use fallback; they are not supported translations.
5. Mark cloud saves as used; verify both guest and authorized Player data.
6. Enable monetization/advertising and configure fullscreen/rewarded placements if Console requires it.
7. Keep **sticky banners disabled** on desktop, portrait and landscape. SDK code never requests banners. Do not enable automatic Console banners.
8. Create leaderboard technical name **`courier_score`**: numeric, descending, decimal offset 0. Prepare suitable Russian and English display titles.
9. Open the actual uploaded game through **Open with debug panel** in Console (or the actual game URL with `debug-mode=16`). Do not substitute a fake app ID or fake SDK.
10. Fill **How to play**: WASD/arrows move, accept an order, E/interaction button at restaurant/customer, analog joystick on mobile, progression through equipment/garage/districts/company/tasks. Result offers optional advertising; Continue starts the next offer.
11. Prepare Console metadata in **both Russian and English**: title (Курьерская Империя / Courier Empire), short description, full description, how to play and promotional text where applicable. Ensure each language's title matches the game and promotional materials. These Console fields cannot be filled by repository code; this item is **NOT COMPLETED**.
12. Supply required screenshots, icon and cover, plus descriptions/categories/version. Existing art remains a prototype; promotional assets are not produced in Stage 11.
13. Submit for moderation only after completing the real-platform/device checks below.

## Debug panel / real platform acceptance

Official sources checked on 2026-10-07: [SDK loading](https://yandex.com/dev/games/doc/en/sdk/sdk-about), [loading/gameplay markup](https://yandex.com/dev/games/doc/en/sdk/sdk-game-events), [Player](https://yandex.com/dev/games/doc/en/sdk/sdk-player), [events](https://yandex.com/dev/games/doc/en/sdk/sdk-events), [ads](https://yandex.com/dev/games/doc/en/sdk/sdk-adv), [server time](https://yandex.com/dev/games/doc/en/sdk/sdk-server-time), [leaderboards](https://yandex.com/dev/games/doc/en/sdk/sdk-leaderboard), [requirements](https://yandex.com/dev/games/doc/en/concepts/requirements).

All checks in this section **REQUIRE YANDEX DEBUG ENVIRONMENT**:

- SDK: inspect `/sdk.js` network load and successful initialization. Loader indicator should report the supported initialized state. There must be no `YaGames is not defined` error and no bundled sdk.js.
- Game Ready: check the debug-panel loading indicator after the rendered city/HUD and removed loading screen. It fires once, including when changing districts. It must not fire at SDK init.
- Language: perform the RU/EN and fallback procedure below. `environment.i18n.lang` is read during SDK initialization; localization must be ready before save initialization, gameplay module evaluation and Game Ready. A production `?lang=` parameter must not replace the SDK language.
- GameplayAPI: check one start when usable, stop on menu/result/ad/auth/focus loss, then start only when all blockers close. Garage → platform pause → platform resume must remain paused until Garage closes.
- Startup ad: verify automatic platform ad using real `game_api_pause/resume`; no manual startup fullscreen call should appear.
- Active timed order: pause/resume through the panel and platform focus changes. Remaining time, pickup state, order identity and movement must survive; no expiry because of an ad, stuck joystick or black screen.
- Cloud: test fresh guest, existing guest, authorized account, empty cloud + old local v1–10 save, cloud/local disagreement, failed Player init, failed getData/setData and rapid transactions. Cloud wins valid conflicts; no currency merging. Failed read cannot lead to cloud writes that replace unknown progress.
- Refresh after delivery, equipment/vehicle purchase, district unlock, company upgrade, achievement/daily claim and rewarded credit. Allow the throttled cloud flush to complete before cross-device verification; local backup updates immediately.
- Account selection: open/cancel/select using actual platform dialog. Ensure synchronization stops immediately; after dialog closes/reload, selected account progress wins. Repeat when the new account has an empty save; old guest progress must not be uploaded into it.
- Optional authorization: cancel and succeed from Rating → benefits → confirmation. No auth appears at startup; guest controls/progress remain usable. Verify privacy-hidden profiles still work without name/avatar.
- Time: cross UTC midnight; daily bonus/tasks/rotating challenge refresh once. Change local device date while on Yandex; no second daily reward or extra offline income. Existing offline cap is two hours. Test temporarily missing server time.
- Interstitial: complete at least four successful personal orders and spend 180 active seconds; press Continue on a finished result. Verify refused/unavailable/shown/error callbacks, 180-second request protection and no immediate retry. No ad during movement, pickup, delivery or a decision dialog.
- Rewarded: verify exact visible money bonus, completion (`onRewarded`), early close, error, duplicate callbacks/button clicks and reload. Only completed impression grants the bonus, once; money only, no XP/reputation. Continue must work without an ad.
- Leaderboard: verify local guest score and optional login, authorized score/rank/top/nearby entries, hidden player, 404 before leaderboard creation, denied availability and network errors. Score writes are at least 10 seconds apart; ranking reads are cached.
- Audio: no content package exists yet. Verify pause/mute routing before Stage 12 audio is added; user mute must survive platform resume. Do not claim actual audio playback verification in this stage.
- Mobile: real touch joystick and interaction, orientation changes, notch/safe areas, viewport fills, internal panel scrolling, no page scroll/refresh gesture/context menu/text selection, UI fit and resumed fresh input after ad/auth. Test advertised browsers including Safari and Yandex mobile app.

Record real results and failures here or in `STAGE11.md`; local SDK doubles are never evidence of actual platform acceptance.

## Required localization debug-panel pass (Stage 11)

Official requirements rechecked on **2026-10-08**: [2.14 — startup SDK language detection](https://yandex.ru/dev/games/doc/ru/requirements/2/14), [8.2.3 — complete gameplay text translation](https://yandex.ru/dev/games/doc/ru/requirements/8/2/3). Requirement 6.9 has no new selector to inspect: this task adds no manual language selector.

1. Open the uploaded draft **with the Yandex debug panel**. Clear stale cache before testing a changed archive.
2. Open **SDK mocks**, select **Ru**, then open/reload the generated Russian game instance.
3. Confirm the **Yandex I18N indicator activates during startup**, before playable UI and before LoadingAPI.ready. Confirm Russian is the first displayed gameplay language, without a later language switch.
4. Select **En** in SDK mocks and open/reload the English instance. Confirm the I18N startup indicator, English first render and localized Game Ready state.
5. In **each instance**, navigate gameplay HUD, offer/active orders, success/failure, all menu screens, Shop, Garage, Courier, Map, district introduction, Company/office/couriers/vehicles/upgrades/log, Tasks/daily bonus/session/rotating/streak, Progress/career/achievements/secret placeholders/records/legacy, Events/history, Leaderboard, authorization explanation/confirmation/cancellation/errors and rewarded-ad offer/unavailable/reward feedback. Test interactive buttons, aria labels and any input placeholders.
6. Trigger every order type, personal/transport/district event and choice, company event and choice, achievement notification, task template and completion/reward, streak milestone, district/company unlock, hire and vehicle purchase. Verify no mixed descriptive text or unresolved variables.
7. Test fallback mocks: **ru/be/kk/uk/uz → Russian**, **en and all other codes → English** (including de/fr/tr/es/zh). Do not declare these fallback languages in Console.
8. Test an old Russian save in English and vice versa. Wallet, XP, owned IDs, unlocks, claims and company employees must survive; generated names, default company name, task labels and company logs must display in the selected language. Preserve custom company/player names.
9. Test **390×844, 430×932, 844×390 and desktop**, followed by real Android/iOS/Safari/Yandex-app devices: wrapping, scrollable dialogs, interaction/reward/Continue buttons, compact HUD and joystick. No translated text may hide an essential action.
10. Confirm no missing translation requests or localization console errors. Complete real cloud/account/ad/ranking checks above in both languages.

Status: **REQUIRES YANDEX DEBUG TEST**. Local Chrome and SDK contract mocks pass; they do not verify the actual Yandex I18N indicator, Console metadata, real ads/accounts or moderation acceptance. See [LOCALIZATION_AUDIT.md](LOCALIZATION_AUDIT.md).
