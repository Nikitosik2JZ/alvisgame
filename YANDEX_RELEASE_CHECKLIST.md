# Stage 11 release checklist — manual Yandex actions

These actions have **not** been performed by game code or local tests. No app ID is hardcoded. This is technical preparation, not a moderation acceptance claim.

## Console

1. Run `npm install`, `npm test`, `npm run build`. ZIP the contents of `dist` so `index.html` is at the ZIP root. Upload into the existing game draft, preserving its identity.
2. Enable **Desktop** and **Mobile** platforms.
3. Verify portrait and landscape on real Android/iOS devices; choose supported orientation(s) based on those results. Local Chrome tests covered both orientations including 320×568.
4. Declare **Russian / ru only**. Other SDK languages fall back to Russian and are not supported translations.
5. Mark cloud saves as used; verify both guest and authorized Player data.
6. Enable monetization/advertising and configure fullscreen/rewarded placements if Console requires it.
7. Keep **sticky banners disabled** on desktop, portrait and landscape. SDK code never requests banners. Do not enable automatic Console banners.
8. Create leaderboard technical name **`courier_score`**: numeric, descending, decimal offset 0. Give it an appropriate Russian title.
9. Open the actual uploaded game through **Open with debug panel** in Console (or the actual game URL with `debug-mode=16`). Do not substitute a fake app ID or fake SDK.
10. Fill **How to play**: WASD/arrows move, accept an order, E/interaction button at restaurant/customer, analog joystick on mobile, progression through equipment/garage/districts/company/tasks. Result offers optional advertising; Continue starts the next offer.
11. Ensure **Курьерская Империя** / the selected Russian release title matches the in-game title, draft and promotional materials. Resolve any title uniqueness requirements in Console.
12. Supply required screenshots, icon and cover, plus descriptions/categories/version. Existing art remains a prototype; promotional assets are not produced in Stage 11.
13. Submit for moderation only after completing the real-platform/device checks below.

## Debug panel / real platform acceptance

Official sources checked on 2026-10-07: [SDK loading](https://yandex.com/dev/games/doc/en/sdk/sdk-about), [loading/gameplay markup](https://yandex.com/dev/games/doc/en/sdk/sdk-game-events), [Player](https://yandex.com/dev/games/doc/en/sdk/sdk-player), [events](https://yandex.com/dev/games/doc/en/sdk/sdk-events), [ads](https://yandex.com/dev/games/doc/en/sdk/sdk-adv), [server time](https://yandex.com/dev/games/doc/en/sdk/sdk-server-time), [leaderboards](https://yandex.com/dev/games/doc/en/sdk/sdk-leaderboard), [requirements](https://yandex.com/dev/games/doc/en/concepts/requirements).

All checks in this section **REQUIRE YANDEX DEBUG ENVIRONMENT**:

- SDK: inspect `/sdk.js` network load and successful initialization. Loader indicator should report the supported initialized state. There must be no `YaGames is not defined` error and no bundled sdk.js.
- Game Ready: check the debug-panel loading indicator after the rendered city/HUD and removed loading screen. It fires once, including when changing districts. It must not fire at SDK init.
- Language: launch with actual SDK `environment.i18n.lang` values ru/en/tr/de. Russian remains the displayed language for all currently unsupported languages. Confirm `document.documentElement.lang === 'ru'`.
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
