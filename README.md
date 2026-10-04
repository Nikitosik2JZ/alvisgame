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

- Money: round(100 + distance × 0.22), clamped to 100–300 ₽.
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

`GameState.getSaveData()` returns money, level, total XP and reputation. `loadSaveData(data)` validates finite numeric values and derives level from XP to repair inconsistent saved levels. Active orders are excluded. PlatformService retains localStorage support; automatic saving/loading is not enabled. Development-only logs report transitions and rewards without frame spam.

## Verification

`npm test` covers acceptance, proximity, duplicate rewards, expiry before/after pickup, next offers, level thresholds, save validation and all 18 restaurant/customer combinations.

Optional browser integration requires an independently installed `playwright-core` and Chrome. Set `PLAYWRIGHT_MODULE` to the module path, `GAME_URL` to the dev URL, and optionally `CHROME_PATH`, then run `node tests/browser-check.cjs`. It walks a physical delivery route and checks collisions, keyboard pickup, button delivery, rewards, timer, failure and next offers. Repeated deliveries and expiry use accelerated setup for level-up/failure UI checks. Touch-capable responsive checks cover 390×844, 844×390 and 320×568. Browser errors fail the test. Screenshots are ignored local test artifacts.

Build and browser checks pass. Vite retains the existing Phaser bundle warning (roughly 1.2 MB minified), which does not prevent a successful production build.

## Limits

Placeholder city and customer circles, approximate distance, one order, no route planner or automatic saves. No vehicles, businesses, employees, inventory, skins, multiplayer, Yandex SDK, ads, leaderboards or advanced graphics.
