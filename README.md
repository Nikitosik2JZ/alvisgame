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

All tuning lives in `src/config/gameBalance.js`. Distance is straight-line restaurant-to-customer pixels multiplied by 0.4, rounded to meters; it does not account for building detours.

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

`GameState.getSaveData()` returns version 2, money, level, total XP, reputation, ownedItems, equippedItems, transport and calculated movementSpeed. Loading old saves defaults to walking with no items; unknown items and invalid slots are discarded and speed/transport are recalculated from equipment. `loadSaveData(data)` validates finite numeric values and derives level from XP to repair inconsistent saved levels. Active orders are excluded. PlatformService retains localStorage support; automatic saving/loading is not enabled. Development-only logs report transitions and rewards without frame spam.

## Verification

`npm test` covers acceptance, proximity, duplicate rewards, expiry before/after pickup, next offers, level thresholds, save validation and all 18 restaurant/customer combinations.

Optional browser integration requires an independently installed `playwright-core` and Chrome. Set `PLAYWRIGHT_MODULE` to the module path, `GAME_URL` to the dev URL, and optionally `CHROME_PATH`, then run `node tests/browser-check.cjs`. It walks a physical delivery route and checks collisions, keyboard pickup, button delivery, rewards, timer, failure and next offers. Repeated deliveries and expiry use accelerated setup for level-up/failure UI checks. Touch-capable responsive checks cover 390×844, 844×390 and 320×568. Browser errors fail the test. Screenshots are ignored local test artifacts.

Build and browser checks pass. Vite retains the existing Phaser bundle warning (roughly 1.2 MB minified), which does not prevent a successful production build.

## Limits

Placeholder city and customer circles, approximate distance, one order, no route planner or automatic saves. Only walking and bicycle transport. No scooters, cars, businesses, employees, inventory grids, skins, multiplayer, Yandex SDK, ads, leaderboards or advanced graphics.

## Stage 3: shop and equipment

Open **МАГАЗИН** or **КУРЬЕР** from the HUD on desktop or mobile. Panels block movement and delivery input; order deadlines continue. Close with the always visible **ЗАКРЫТЬ** button or Escape. The shop scrolls on short screens. HUD and shop show money remaining for the bicycle.

| Item | Price | Requirement | Effect |
| --- | --- | --- | --- |
| Старые кроссовки | 300 ₽ | None | +5% walking speed |
| Хорошие кроссовки | 900 ₽ | Own old shoes | +10% walking speed total |
| Термосумка | 1200 ₽ | None | +10% successful delivery money |
| Велосипед | 3500 ₽ | Level 3 (250 total XP) | Unlock and equip bicycle |

Purchases validate requirements, ownership and money before deducting funds. Each purchase equips its category automatically. Owned items stay owned; use **ЭКИПИРОВАТЬ** in the shop to switch shoes. The profile switches between walking and an owned bicycle for free.

Walking speed is 160 pixels/second, 168 with old shoes, 176 with good shoes. Shoe bonuses replace each other and apply only to walking. Bicycle speed is 250; it uses the same body, collisions, normalized movement, camera and delivery zones with an original drawn bicycle texture. Each category (SHOES, BAG, TRANSPORT) has one equipment slot.

DeliveryRewards calculates rounded modifier lines at successful completion: 200 ₽ base + 20 ₽ bag = 220 ₽. Order offers keep the base payment; failure gives no payout. Money modifiers are additive relative to base reward so later modifiers can be added independently.

Current routes pay 184–290 ₽ (mean about 253 ₽ across all 18 pairs). Old shoes take 2 average deliveries; good shoes another 3–4; bag another 4–5. Saving directly for the bicycle takes about 14 average deliveries, while buying every preceding upgrade takes about 22 total with the bag bonus. Route choice, failures and spending affect these estimates. All tuning is in gameBalance.js.

In development only: **F2** grants 1000 ₽; **F3** grants 100 total XP. Each use logs to the console. These handlers are removed from the production build. No visible cheat buttons.

Added modules: data/shopItems.js, managers/ShopManager.js, managers/DeliveryRewards.js, managers/DevelopmentCheats.js, ui/ModalUI.js, ui/ShopUI.js, ui/PlayerProfileUI.js. GameState owns purchases and equipment transactions; ShopManager supplies item availability and UI states. PlatformService remains the LOCAL adapter and automatic saving remains disabled, matching stage 2.

Progression verification: npm test includes purchase rejection/duplicate protection, equipment replacement, bicycle requirements, completion/failure payouts, snapshot isolation, old/corrupt saves and a representative full upgrade path. Run tests/progression-browser.cjs with the same PLAYWRIGHT_MODULE/GAME_URL setup as browser-check.cjs; optionally set PRODUCTION_URL to a Vite preview URL to verify production cheats are disabled. It physically rides a delivery route and checks shop/profile interaction, collision, deadlines, immediate stats/HUD, modal keyboard blocking, touch recovery, scrolling/close accessibility and screenshots at 1280×800, 390×844, 844×390 and 320×568. Browser errors fail the check. Screenshots are ignored local artifacts.
