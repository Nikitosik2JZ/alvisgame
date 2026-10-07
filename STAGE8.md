# Stage 8 — City districts and elite delivery progression

Stage 8 extends the existing game and its single OrderManager/EventManager. Personal deliveries, previous order types/events/choices, reputation/XP, shop, garage, transport, lifetime statistics, company workforce/fleet/income/upgrades/events, mobile joystick, compact HUD and local persistence remain. No Stage 9 systems were added.

## District configuration

`src/config/districtConfig.js` owns district economy, requirements, route ranges, transport recommendations, order/event weights, mastery, company modifiers and elite flavors. economyConfig.js re-exports DISTRICTS for existing callers. Unlocks charge once; failures are atomic. There is no extra requirement to purchase previous districts.

| District | Unlock | Reward | XP | Tip amount | Event chance | Company income |
| --- | --- | --- | --- | --- | --- | --- |
| Спальный район | Start, free | ×1 | ×1 | ×1 | ×1 | +0% |
| Центр | Level 4 + 3,000 ₽ | ×1.3 | ×1.15 | ×1 | ×1.15 | +2% |
| Промзона | Level 7 + 8,000 ₽ | ×1.55 | ×1.3 | ×0.75 | ×1.2 | +3% |
| Элитный район | Level 10 + reputation 40 + 18,000 ₽ | ×1.7 | ×1.35 | ×1.8 | ×1.25 | +4% |
| Деловой квартал | Level 14 + reputation 70 + 45,000 ₽ + owned MOPED or CAR | ×2 | ×1.5 | ×1.25 | ×1.4 | +5% |

Center retains its original unlock even with negative reputation. Business requires ownership, allowing walking/bicycle to be equipped afterward. LARGE retains the equipped-car and level-10 gates; DOUBLE retains bicycle/moped/car and level-3 gates. Normal deliveries in Elite/Business grant +1 extra reputation; normal failures there cost 4 instead of 2 reputation.

| District | Route range, meters | Recommended transport | Map identity |
| --- | --- | --- | --- |
| Residential | 100–400 | Walking / bicycle | Apartment blocks, wide paths, green park |
| Center | 180–700 | Bicycle / moped | Extra streets, dense commercial blocks, offices |
| Industrial | 450–1,050 | Moped / car | Wide merged warehouses, loading yard, few trees |
| Elite | 220–650 | Bicycle / moped / car | Smaller villa footprints, open spaces, formal greenery |
| Business | 550–1,100 | Moped / car | Dense offices, glass bands, formal plaza |

Distances retain the 0.4 meters/pixel estimate. DOUBLE includes both delivery legs and has a configurable 1.5× maximum distance. Transport retains its short/long route preference within each range; Center keeps its broader walking pool. Corporate elite orders prefer longer candidates. Endpoints come from controlled walkable locations, with a nearest-existing-endpoint fallback for sparse custom pools. No coordinates are invented inside buildings.

Each world remains 2,400×2,000 pixels, with 9–16 static building bodies. Layout/painting helpers are shared. Industrial/business use peripheral gates and office entrances. A flood-fill test with body clearance verifies every endpoint connects to spawn; the game has no actual pathfinding simulation.

## Order distribution

District weights multiply existing transport weights, the reputation quality modifier and any existing large-order boost. They are relative weights, not percentages: probabilities vary with transport and eligibility. ELITE uses base weight 1.

| District | STANDARD | URGENT | FRAGILE | DOUBLE | LARGE | ELITE |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Residential | 1 | 1 | 1 | 1 | 1 | 0 |
| Center | 0.8 | 1.5 | 1.2 | 1.3 | 1 | 0 |
| Industrial | 0.7 | 1.1 | 0.5 | 1.5 | 3 | 0 |
| Elite | 0.6 | 1.2 | 3.5 | 0.7 | 0.6 | 5 |
| Business | 0.4 | 2 | 0.8 | 2.5 | 2.5 | 8 |

Starter deliveries remain mostly standard. Center emphasizes urgent/double; industrial emphasizes large with car; elite emphasizes fragile; business emphasizes urgent/double/large and rare elite. Distribution tests verify Business has the highest average offered payout at equal transport/progression.

Offers show district, cargo/flavor, distance, payment, timer, XP, reputation and recommended/required transport. Elite/large orders use restrained gold/blue borders. Mobile summaries retain district/cargo, reward, time and reputation. Mastery is included in the offered reward and stays fixed for that order.

## Elite orders

Eligibility is derived: level 12+, reputation 60+, currently in Elite or Business. Both general and flavor-specific reputation requirements are rechecked at acceptance. No separate unlock flag is necessary, and a particular equipped vehicle is not mandatory.

Money ×3 and XP ×2 multiply district modifiers. Reputation is configurable +5…+10; event chance receives another ×1.35; failure costs 6 reputation. Existing equipment/demand/event payout adjustments remain on the same single-payment path.

| Flavor | Money beyond elite | Timer beyond normal | Reputation | Special condition |
| --- | --- | --- | --- | --- |
| СРОЧНАЯ ДОСТАВКА ДОКУМЕНТОВ | ×1 | ×0.85 | +7 | Strict timer; documents |
| VIP-ДОСТАВКА | ×1 | ×1.3 | +8 | Reputation 70+; tip amount another ×1.5 |
| КОРПОРАТИВНЫЙ ЗАКАЗ | ×1.15 | ×1.6 | +10 | Longer routes; car recommended |

A capped 290 ₽ normal base becomes 1,479 ₽ for documents in Elite or 1,740 ₽ in Business before mastery/equipment. Business corporate base is 2,001 ₽. XP retains its previous base cap before multipliers.

## District events

Effect numbers are in eventBalance.js; district weights are in districtConfig.js. Existing rarity, streak protection, cooldowns, paused choice timers, history, transport and equipment inputs remain active.

| District | Event | Effect |
| --- | --- | --- |
| Residential | Злая собака во дворе | −5 sec |
| Center | Перекрыли улицу | −7 sec; heavier traffic/parking weights |
| Industrial | Охрана не пускает | Call: −8 sec; detour: −14 sec; both safe for reputation |
| Industrial | Пустые дороги | Existing +15% speed for 30 sec |
| Elite | Охрана попросила подождать | −8 sec; reputation 70+ skips delay |
| Elite | Щедрые чаевые | 250–500 ₽ base, then district/reputation/VIP modifiers |
| Business | Пропуск не оформлен | Wait: −12 sec; call: 65% instant, otherwise −5 sec |
| Business | Корпоративный бонус | One-time 350–650 ₽ |

Industrial increases transport mishap weights and reduces generic tip-event weights to 0.6. Elite weights generous/big-tip events at 1.8 and has an extra tip event. Consecutive negative outcomes still receive the original recovery protection.

## Map, transitions, statistics and mastery

Open **КАРТА** through the existing HUD/secondary menu. **КАРТА ГОРОДА** uses five scrolling cards with conditions, transport advice, next-district summary, company bonus, statistics and mastery. Its header/close control stays reachable on mobile. Unlock introductions are acknowledged with **ПОЕХАЛИ** once per district; dismissal before acknowledgment keeps the introduction pending.

Locked districts cannot be selected. Active orders, personal event popups, another modal and an ongoing transition block switches; the map displays **СНАЧАЛА ЗАВЕРШИТЕ ТЕКУЩИЙ ЗАКАЗ**. A 180 ms fade and district label precede scene restart. Existing scene cleanup destroys world objects, physics bodies, DOM controls and subscriptions. Short speed modifiers, pending personal events and the next-close-order flag clear; all progression/company data and event history remain.

Per-district stats are completedOrders, failedOrders, totalEarned, bestDeliveryReward. DOUBLE counts once. totalEarned includes final successful personal payouts and positive personal event money/tips, excluding purchases, company income, cheats and fines. bestDeliveryReward is a final delivery payout; separately credited event cash is excluded.

| Completions | Mastery | Reward bonus |
| --- | --- | --- |
| 0–9 | Новичок района | 0% |
| 10–24 | Знает улицы | +1% |
| 25–49 | Местный профи | +3% |
| 50+ | Легенда района | +5%, capped |

Mastery derives from completedOrders. Company district bonuses add into a separate income factor, maximum +14%, for online/offline income and existing storage limits. Time accrued before unlocking is settled at the old rate. Employees remain mathematical and have no physical district routes. Career title priority: company title, then **Король города** for every district unlocked, then **Премиум-курьер** for elite eligibility in an unlocked advanced district, then existing transport titles.

## Save version 8 and migration

The existing localStorage key `courier-empire-save-v1` remains. unlockedDistricts and selectedDistrict persist; districtIntroductionsSeen and districtStats are added. Mastery and elite eligibility are derived instead of duplicated.

Versions 1–7 retain recognized unlocked districts, selected unlocked district and all personal/company progress. Already-open districts are marked familiar; new districts stay locked. Missing district counters default to zero; historical lifetime completions are not reassigned. Unknown IDs, invalid selections, duplicate flags and negative/non-finite counters are sanitized. Snapshots copy nested stats. Active personal orders and temporary movement effects remain session-only.

## Development controls

Existing F2–F10 and company Alt shortcuts remain. Added shortcuts use Ctrl+Alt:

| Shortcut | Action |
| --- | --- |
| Ctrl+Alt+N | Prepare requirements/funds and unlock next district |
| Ctrl+Alt+A | Unlock all districts |
| Ctrl+Alt+E | Generate elite offer in an advanced district, preparing level/reputation |
| Ctrl+Alt+K | Set current district to 50 completions |
| Ctrl+Alt+D | Switch to next unlocked district with the same guards |

Dev console API: `courierDebug.unlockNext()`, `unlockAll()`, `setReputation(70)`, `setLevel(14)`, `elite('documents'|'vip'|'corporate')`, `mastery(10|25|50)`, `switchDistrict('industrial')`. Elite debug rejects active orders, modals, transitions and non-advanced districts. Shortcuts ignore repeated keys and text inputs. API/shortcuts are excluded from production.

## Files and verification

Created: src/config/districtConfig.js, src/world/districtLayouts.js, tests/districts.test.js, tests/district-browser.cjs, STAGE8.md.

Modified: src/config/{economyConfig,eventBalance,transportConfig}.js; src/data/events.js; src/managers/{CompanyManager,DevelopmentCheats,EventManager,OrderManager}.js; src/scenes/GameScene.js; src/state/GameState.js; src/style.css; src/ui/{CompanyUI,DistrictUI,OrderUI}.js; src/world/{createCity,deliveryLocations}.js; tests/{company.test,events.test,orders.test}.js; tests/company-runtime-browser.cjs; README.md.

Verification: all 78 unit tests pass. Stage 8 browser tests pass on 1280×800, 390×844, 430×932, 844×390 and 320×568: every district × every transport, requirements, introductions, movement/delivery, event popups, elite rewards, mastery, guards, repeated restart cleanup, migration and reload. Production mobile maps/debug exclusion pass. Existing mobile UX, company browser and company runtime regression suites pass, including joystick, keyboard/E, collisions, offline/company progression and save migration. No runtime console errors were observed.

Run `npm test`, `npm run build` and the dev server, then `node tests/district-browser.cjs`. Set PREVIEW_URL for production checks; PRODUCTION_ONLY=1 skips development checks. PLAYWRIGHT_MODULE, CHROME_PATH, GAME_URL and ARTIFACT_DIR are configurable. Screenshots are local ignored artifacts.

The verification host has bundled Node but no npm on PATH. The same package build target was run as `node node_modules/vite/bin/vite.js build`; tests used `node --test --test-isolation=none tests/*.test.js` because sandboxed child-process creation is restricted. No package dependencies or lockfiles were changed.

Known limits: placeholder art, approximate straight-line distances, finite controlled maps, no real traffic/navigation or employee sprites. Personal active jobs/effects do not survive reload. Physical iOS/Android safe-area/browser-toolbar behavior still needs real-device testing. The pre-existing large Phaser bundle warning remains; no SDK, ads, monetization, second city or Stage 9 systems were added.
