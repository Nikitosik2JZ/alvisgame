# Courier Empire / Курьерская Империя

A playable courier loop built on the existing Phaser 3 / Vite city, Arcade Physics collisions, shared GameState and LOCAL PlatformService. All visuals are original placeholder shapes.

## Run

Node.js 22.12+ or 20.19+ and npm:

```sh
npm install
npm run dev
npm run build
npm run preview
npm test
```

Open the URL printed by Vite. The dev server supports phone testing over the same LAN. The canvas resizes with the window and orientation.

## Controls and gameplay

- Move with WASD / arrows. Touch devices or narrow screens show direction buttons; holding two allows normalized diagonal movement.
- Click **ПРИНЯТЬ** to accept the offer. Orders are never automatically accepted; offers do not expire.
- Follow the yellow restaurant ring and edge arrow. HUD shows distance and remaining time.
- Within 60 pixels of the entrance, press **E** or **ЗАБРАТЬ ЗАКАЗ**.
- Follow the blue customer marker. Press **E** or **ПЕРЕДАТЬ ЗАКАЗ** within its zone.
- Success grants money, total XP and reputation once. Level-up appears in the result.
- After 3 seconds a new offer appears and requires acceptance.

To test failure, accept an order and let its timer reach zero (60–120 seconds). Failure grants no money or XP and subtracts 2 reputation. Negative reputation is supported. After 3 seconds another offer appears. An expired order cannot be delivered on the expiry frame.

The timer starts at acceptance and continues during pickup. A monotonic wall-clock deadline continues while the tab is inactive; expiry is processed on resume. Movement stops on blur or visibility loss.

## Balance and progression

Economy tuning lives in `src/config/economyConfig.js`; gameBalance.js preserves the BALANCE export and level formulas. Event tuning lives in `src/config/eventBalance.js`. Distance is straight-line restaurant-to-customer pixels multiplied by 0.4, rounded to meters; it does not account for building detours.

- Money: round(150 + distance × 0.30), clamped to 150–290 ₽.
- XP: round(15 + distance × 0.025), clamped to 15–40.
- Reputation: 1 + floor(distance / 250), clamped to 1–4.
- Time: round(60 + distance / 12), clamped to 60–120 seconds.
- Total XP for level L: 25 × (L − 1) × (L + 2). Levels 2, 3, 4 require 100, 250, 450 total XP. XP is never consumed.

## Structure

```text
index.html                         Accessible HUD, offer, result, touch buttons
src/main.js                        Phaser setup and scenes
src/scenes/BootScene.js             LOCAL initialization, courier texture
src/scenes/GameScene.js             World, collisions, camera, system composition
src/entities/Courier.js             Existing keyboard/touch movement
src/world/createCity.js            Existing city and static building bodies
src/world/deliveryLocations.js     3 restaurants, 6 customers, reachable entrances
src/managers/OrderManager.js        Generation, transitions, deadlines, rewards
src/ui/OrderUI.js                   DOM HUD, offer, interaction, result, level-up
src/ui/ObjectiveMarker.js           Pulsing ring and off-screen direction
src/config/gameBalance.js           Economy, timing, interaction, levels
src/state/GameState.js              Shared progression and serialization
src/services/PlatformService.js     Existing LOCAL adapter
tests/orders.test.js                Lifecycle, failure, rewards, levels, saves
tests/browser-check.cjs              Browser integration and responsive checks
```

Order states: AVAILABLE → ACCEPTED → PICKED_UP → DELIVERED. ACCEPTED and PICKED_UP can transition to FAILED. Only one offer or active order exists. Restaurants reuse existing colored buildings and their static bodies; entrances and customers sit outside obstacles on walkable ground.

`GameState.getSaveData()` returns version 8 with district introduction flags and district statistics plus all personal fields and company workforce, fleet, ledgers, statistics, office, upgrades, candidates, reputation and gameplay-time business effects. Equipment uses only SHOES/BAG; personal vehicles appear only in ownedTransports. Levels and speed are derived rather than trusted. Legacy bicycle saves migrate even when they only contain transport=BICYCLE. Unknown vehicles and invalid equipment are discarded. BootScene loads through the existing LOCAL PlatformService and saves progression changes automatically. Active personal orders/effects remain session-only; resolved business effects persist. See [STAGE5.md](STAGE5.md) for personal migration and [STAGE7.md](STAGE7.md) for company persistence and offline progression, including Stage 6 migration. See [STAGE8.md](STAGE8.md) for current city progression and save version 8.

## Verification

`npm test` covers acceptance, proximity, duplicate rewards, expiry before/after pickup, next offers, level thresholds, save validation and all 18 restaurant/customer combinations.

For the current browser integration checks, run the dev server and open `/tests/stage5-browser.html`. Click **Run Stage 5 browser checks**. The development-only harness verifies purchases, four physical delivery routes, narrow passages, collisions, directional movement, all eligible order types, events, switching restrictions, local saves and district restarts. It restores the starting progression afterward. The older `.cjs` browser scripts retain Stage 2–4 assumptions; use the Stage 5 harness for the current gameplay rules.

Build and browser checks pass. Vite retains the existing Phaser bundle warning (roughly 1.2 MB minified), which does not prevent a successful production build.

## Limits

Placeholder city and customer circles, approximate distance, one order, no route planner. Transport includes walking, bicycle, moped and car. Company workers generate mathematical income without physical routes. Local saves are automatic; active orders and temporary effects do not survive reload. No fuel resource, maintenance, realistic driving, advanced business simulation, multiplayer, Yandex SDK, ads, leaderboards or monetization.

## Stage 3: shop and equipment

Open **МАГАЗИН** for equipment, **ГАРАЖ** for transport, **КУРЬЕР** for read-only statistics, or **СОБЫТИЯ** for session event history. On mobile these screens open through the secondary menu. Panels block movement and delivery input; order deadlines continue. Close with the always visible **ЗАКРЫТЬ** button or Escape. The shop scrolls on short screens. HUD and garage show money remaining for the next transport.

| Item | Price | Requirement | Effect |
| --- | --- | --- | --- |
| Старые кроссовки | 300 ₽ | None | +5% walking speed |
| Хорошие кроссовки | 900 ₽ | Own old shoes | +10% walking speed total |
| Термосумка | 1200 ₽ | None | +10% successful delivery money |

Purchases validate requirements, ownership and money before deducting funds. Each purchase equips its category automatically. Owned items stay owned; use **ЭКИПИРОВАТЬ** in the shop to switch shoes. All transport purchases and free switching are available only in the garage. The profile displays equipped items and transport without purchase/equip controls.

Walking speed is 160 pixels/second, 168 with old shoes, 176 with good shoes. Shoe bonuses replace each other and apply only to walking. Bicycle speed is 250; it uses the same body, collisions, normalized movement, camera and delivery zones with an original drawn bicycle texture. Each equipment category (SHOES, BAG) has one slot. Transport uses its own ownedTransports/equippedTransport fields.

DeliveryRewards calculates rounded modifier lines at successful completion: 200 ₽ base + 20 ₽ bag = 220 ₽. Order offers keep the base payment; failure gives no payout. Money modifiers are additive relative to base reward so later modifiers can be added independently.

Current routes pay 184–290 ₽ (mean about 253 ₽ across all 18 pairs). Old shoes take 2 average deliveries; good shoes another 3–4; bag another 4–5. Saving directly for the bicycle takes about 14 average deliveries, while buying every preceding upgrade takes about 22 total with the bag bonus. Route choice, failures and spending affect these estimates. All tuning is in gameBalance.js.

In development only: **F2** grants 1000 ₽; **F3** grants 100 total XP. Each use logs to the console. These handlers are removed from the production build. No visible cheat buttons.

Added modules in Stage 3: data/shopItems.js, managers/ShopManager.js, managers/DeliveryRewards.js, managers/DevelopmentCheats.js, ui/ModalUI.js, ui/ShopUI.js, ui/PlayerProfileUI.js. Stage 5 extends GameState with separate vehicle ownership and enables automatic saving through the existing LOCAL adapter.

Progression verification: npm test includes purchase rejection/duplicate protection, equipment replacement, vehicle requirements, completion/failure payouts, snapshot isolation, old/corrupt saves and a representative bicycle upgrade path. Stage 5 adds transport-pool, weather, fragile protection, progression and active-order restriction tests. Screenshots are ignored local artifacts.


## Stage 4: events, order types and districts

See [STAGE4.md](STAGE4.md) for the historical Stage 4 implementation and balance reference.

## Stage 5: garage and transport progression

See [STAGE5.md](STAGE5.md) for personal prices, speeds, order pools, transport events, weather, fragile protection, save migration, debug controls and verification. Open **ГАРАЖ** from the HUD to buy permanent personal vehicles or switch freely after completing an active order. The personal bicycle is available only in the garage, alongside walking, moped and car.

## Stage 6: company foundation (historical)

See [STAGE6.md](STAGE6.md) for the complete company configuration, data model, income ledger, offline safety, debug controls and verification. Open **КОМПАНИЯ** from the HUD or secondary mobile menu at level 12 for 40,000 ₽. Hire generic named couriers for 2,500 ₽, buy a separate company bicycle (3,000 ₽) or moped (8,000 ₽), and assign free vehicles. Walking/bicycle/moped employees earn 100/180/300 ₽ per minute at 100% efficiency. Income waits in the company balance until collected; online storage and offline duration are limited to two hours. Levels 1/2/3 allow 2/4/6 couriers, with upgrades costing 15,000/40,000 ₽. Personal gameplay remains available.

Stage 6 introduced company transactions, elapsed-time income, collection, caps and migration, plus development-only Alt+C/M/H/O. Current company tests and features are described below.

## Stage 7: company management

See [STAGE7.md](STAGE7.md) for all configurable prices, formulas, events, save rules and debug shortcuts. Hire three generated candidates with five archetypes, compare efficiency/reliability/speed, expand employees to level 10, buy separate company cars and grow four office levels (2/4/7/12 slots). Dispatch, routing, training and advertising have three levels each. Company reputation and business rank are separate from personal progression.

The four company tabs use scrolling cards and collapsible employee details. Rare business events include positive bonuses, temporary setbacks and four decisions, with protected company-only forced fines. Offline progression remains capped at two hours and now awards employee XP without random events or negative fines. Stage 6 company saves migrate without losing workforce, vehicles or balances.

`npm test` covers Stage 7 rules and all personal systems. With the development server running, `node tests/company-browser.cjs` checks desktop plus 390×844, 430×932, 844×390 and 320×568, including personal deliveries, events, reload and migration. `node tests/company-runtime-browser.cjs` checks shortcuts, typing guards, their exclusion from production and production mobile offline/hiring screens; start `npm run preview -- --port 5176` or set `PREVIEW_URL`. Existing mobile/screens checks and the Stage 5 harness remain available. Screenshots are local ignored artifacts.

## Mobile UX pass

Compact layout uses `(max-width: 900px), (pointer: coarse)` without user-agent detection. It starts with a 50px status bar; the chevron shows/hides existing HUD details and remembers the choice for the session, including district restarts. The menu contains shop, read-only profile, garage, session event history and districts. Desktop defaults to the expanded HUD and retains WASD, arrow keys and E.

Mobile offers are bottom cards; active objectives sit below the HUD with optional details. Safe-area padding protects the HUD and bottom controls. Dialog content scrolls internally while its header/close control stays reachable. Menus and dialogs clear movement and block gameplay actions; closing requires fresh joystick input.

The fixed bottom-left joystick has a 100–128px translucent base (108px in narrow landscape). `src/input/MovementInput.js` configures a 12% dead zone and maximum 44px radius, capped at `base width / 2 - 20px` to keep the stick inside the base. Beyond the dead zone, strength scales linearly to one; keyboard diagonals and joystick magnitude are capped at one. Transport, equipment, weather and temporary effects still determine speed. Pointer release, cancellation, lost capture, blur, visibility loss and resize reset input.

Run `npm test` and `npm run build`. With an installed playwright-core and Chrome, run `node tests/mobile-ux-browser.cjs` (`PLAYWRIGHT_MODULE`, `CHROME_PATH`, `GAME_URL` optional). Browser checks cover 390×844, 430×932, 844×390, 320×568 and desktop, touch input, modal blocking, delivery, transport speeds and console errors. Screenshots go to `ARTIFACT_DIR` or the system temporary directory. Physical iOS/Android notch and browser-toolbar behavior still need device testing.

## Screen responsibilities and lifetime statistics

The shop catalog and equipment APIs accept only personal items; transport cannot be purchased/equipped through them. The garage is the sole vehicle purchase/selection screen. Courier reads centralized progression, equipment and transport data. Events opens existing session history as a separate read-only dialog.

Save version 5 adds completedOrders, failedOrders, totalMoneyEarned, totalTipsEarned, totalFinesPaid and totalDistanceDelivered. OrderManager records one completion per whole order (including double orders), one failure per expiry, the final payout and the offered route distance in meters. EventManager records actual cash bonuses/tips and actual fines paid after balance clamping. Earnings include successful payouts and positive event money; tips are a subset. Purchases, development credits and loading saves do not count as income. Distance is the sum of completed-order route estimates, not an odometer.

Old counters default to zero; historical totals are not reconstructed. Legacy bicycle entries in ownedItems/equippedItems.TRANSPORT migrate to ownedTransports/equippedTransport and are discarded from equipment. The existing localStorage key remains unchanged. Current saves contain no duplicate vehicle ownership in equipment. Unit checks cover counters, single payment/failure, API separation and old-save migration; `tests/screens-browser.cjs` verifies purchases, read-only profile, menus and automatic reload on desktop and mobile.

## Stage 9: long-term progression

Stage 9 adds **ПРОГРЕСС** with career, achievements, records and non-destructive legacy. There are ten configurable career milestones, 32 achievements across eight categories, eight global goals, a suggested next goal, manual one-time reward claims and selectable cosmetic titles. Five permanent legacy upgrades give modest 3–5% bonuses. The final **Курьерский магнат** milestone celebrates once and allows continued play. Existing assets, company, districts, levels and saves are preserved and migrated to version 9.

See [STAGE9.md](STAGE9.md) for the complete requirements/rewards, achievement list, legacy sources/effects, migration, debug API, files, validation and limitations. `npm test` includes the Stage 9 progression tests. With the dev server and production preview running, `node tests/stage9-browser.cjs` verifies desktop/mobile progression, old saves, claims, records, legacy and endgame; set `GAME_URL`, `PREVIEW_URL`, `PLAYWRIGHT_MODULE`, `CHROME_PATH` or `ARTIFACT_DIR` if needed. No Stage 10 systems are included.

## Stage 8: city progression and elite deliveries

See [STAGE8.md](STAGE8.md) for district requirements, order/event weights, elite variants, mastery, company income modifiers, migration, debug controls and verification. Open **КАРТА** from the existing HUD/menu for five manageable districts: Спальный район, Центр, Промзона, Элитный район and Деловой квартал. Scene transitions retain progression and clear short movement effects.

District unlocks require levels 1/4/7/10/14 and cost 0/3,000/8,000/18,000/45,000 ₽; Elite needs personal reputation 40, Business needs 70 and an owned moped or car. Rare elite orders require level 12, reputation 60 and an advanced district; VIP requires reputation 70. Lightweight mastery grants at most +5% delivery money. All advanced districts together add +14% company income. Save version 8 migrates existing Center unlocks without losing lifetime statistics or company/personal progress.

`npm test` includes 78 tests. Run `node tests/district-browser.cjs` with a dev server; set `PREVIEW_URL` for production checks, or `PRODUCTION_ONLY=1` to run only those checks. The harness uses isolated test saves and checks desktop and four mobile sizes, all 20 district/transport combinations, district events, elite orders, mastery, blocked switches, repeated restart cleanup and save reload. Existing mobile, company and company-runtime browser regression checks remain passing.
