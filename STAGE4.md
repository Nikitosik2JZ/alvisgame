# Courier Empire — development stage 4

The existing Phaser/Vite project is extended. Movement, building collisions, order lifecycle, progression, shop, equipment, bicycle, HUD, mobile controls and LOCAL serialization remain in place. No stage 5 systems are included.

## Events and configuration

`src/data/events.js` contains 17 Russian events. Each record has id, title, description, category, rarity, trigger, weight and possibleEffects; optional requirements and choices are data too. `src/managers/EventManager.js` owns selection, eligibility, outcomes and the last five in-memory results. `src/ui/EventUI.js` is a reusable native dialog with result state, labeled consequences and keyboard/touch input blocking.

| Event | Rarity / timing | Consequence |
| --- | --- | --- |
| Где моя кола?! | Very rare / customer | 250 ₽ fine and −2 reputation; support may cancel both |
| Разлитый суп | Common / pickup | −30% of base payment for this order |
| Не тот подъезд | Common / pickup | −15 seconds |
| Шлагбаум закрыт | Common / pickup | −10 seconds |
| Дождь стеной | Uncommon / pickup | Walking speed −20%, bicycle −25%, for 20 seconds |
| Колесо спустило | Uncommon / pickup | Equipped bicycle only; bicycle speed −35% for 25 seconds |
| Принципиальный клиент | Rare / customer | −1 reputation when at most 10 seconds remain |
| Щедрый клиент | Common / customer | 100–400 ₽ tip before reputation multiplier |
| Спасибо, вы спасли мой вечер! | Common / customer | +3–5 reputation |
| Повышенный спрос | Uncommon / customer | Next three successful orders get +25% of base payment |
| Зелёная волна | Common / pickup | +15% speed for 30 seconds |
| Очень близкий заказ | Uncommon / customer | Next generated offer chooses nearest customer and pays +5% |
| Чаевые от души | Very rare / customer | 800–1200 ₽ tip before reputation multiplier |
| Любимый курьер | Rare / customer | Requires reputation 50; +200 ₽ and +2 reputation |
| Клиент не отвечает | Common / customer | Two choices below |
| Лифт сломан | Uncommon / customer | Two choices below |
| Пахнет картошкой... | Common / pickup | Two choices below |

One rarity roll is made per accepted order: 70% no event, 20% common, 5% uncommon, 3% rare, 2% very rare. Eligible events are then selected by weight. This is a baseline selection distribution, not a guarantee of a popup: missing requirements, near-deadline checks, repeat protection or another modal can suppress an event. Center multiplies each event bucket by 1.15 (65.5% no event). Fragile deliveries have a separate, once-per-order 8% food-damage check at the customer, reduced to 1.6% with a thermobag; protection rules still apply.

After two bad results, the next selected event must be positive or neutral. Risk-bearing choices are also excluded at that point. A very rare negative event is excluded until five subsequent event results have occurred. The immediately preceding event cannot be selected again. Positive weights rise by 50% per consecutive bad result. A canceled support fine counts as a good outcome. Streaks and cooldowns persist across district switches but remain session-only.

## Choices

- **Клиент не отвечает:** calling costs 15 seconds; 90% normal delivery, 10% complaint with −2 reputation. Leaving at the door requires no extra time; 15% complaint with −2 reputation. Delivery resumes once after acknowledging the result.
- **Лифт сломан:** climbing costs 20 seconds and adds 500 ₽ to the final successful payout. Refusing preserves normal reward and reputation. The time penalty can expire the order; in that case no successful payout or stair bonus is awarded.
- **Пахнет картошкой...:** leaving the food alone grants +1 reputation. Eating one is harmless 90% of the time; the other 10% costs 500 ₽ and −5 reputation, with a funny explanation.

Player movement, touch input, acceptance and interaction are blocked while the event dialog is open. The order deadline pauses while reading/choosing; event time losses still count. Escape cannot skip an unresolved choice. Results require acknowledgment. Other shop/profile/district dialogs retain the existing continuing-deadline behavior. Events do not open over another dialog, and double-clicks cannot resolve/pay twice.

Money cannot become negative. A fine shows its nominal amount, actual deduction and “Баланс исчерпан” when funds are insufficient. Reputation retains the existing support for negative values.

## Orders and reputation

| Type | Baseline weight | Money | XP | Reputation | Timer | Requirement |
| --- | ---: | ---: | ---: | --- | ---: | --- |
| STANDARD / ОБЫЧНЫЙ | 65 | ×1 | ×1 | Normal | ×1 | Level 1 |
| URGENT / СРОЧНЫЙ | 20 | ×1.35 | ×1.25 | Normal +1 | ×0.75 | Level 1 |
| FRAGILE / ХРУПКИЙ | 10 | ×1.2 | ×1 | Normal | ×1 | Level 1 |
| DOUBLE / ДВОЙНОЙ ЗАКАЗ | 5 | ×1.85 | ×1.6 | Normal +1 | ×1.5 | Level 3 |

Weights normalize among unlocked types. Thus level 1–2 weights normalize over 95, rather than allowing double orders. Center multiplies urgent weight by 1.5. Reputation multiplies all nonstandard weights by up to 1.15. Double orders use one restaurant and two distinct customers; HUD shows 0/2, 1/2 and 2/2, the marker moves to customer B, and the whole order pays once after the second stop. Deadline loss before the final stop grants no successful payout.

| Reputation | Profile title | Support wins | Tip multiplier | Better-order weight |
| --- | --- | ---: | ---: | ---: |
| Below 20 | Новичок | 10% | ×1 | ×1 |
| 20–49 | Надёжный курьер | 25% | ×1.05 | ×1.05 |
| 50–99 | Любимчик клиентов | 45% | ×1.10 | ×1.10 |
| 100+ | Легенда доставки | 45% | ×1.15 | ×1.15 |

Equipped thermobag reduces soup selection weight by 80% and fragile damage probability by 80%, preserving its existing +10% payment bonus. Equipped good shoes reduce wrong-entrance/barrier selection weight by 20% while walking. Equipped bicycle unlocks puncture; the temporary puncture modifier affects bicycle only and never removes ownership. Duplicate temporary modifier ids refresh rather than accumulate. Demand is a separate persisted remaining-order counter, consumed only on successful eligible orders; the order that triggers demand is excluded.

## Districts, balance and saves

**Спальный район** is free and open from the start: normal money/XP, baseline events/urgent weights, customers selected among the five closest of the six current locations. It retains grass, apartments and open park space.

**Центр** requires **level 4 AND 3000 ₽**. The district panel shows both conditions and only enables purchase when both are met. Purchase deducts 3000 ₽ once, stores ownership and then enables selection. Center has money ×1.30, XP ×1.15, event chance ×1.15 and urgent weight ×1.5, with the full customer pool allowing longer routes. It uses a gray ground palette, additional roads, blue-gray buildings and five extra office blocks. Both districts share the existing city builder, delivery entrances, collisions and player systems.

District switching is disabled during an active order. Switching rebuilds the scene at its safe spawn and generates a new offer. In-memory history, protection state and temporary modifiers survive switching; duplicate UI listeners/buttons are removed on shutdown.

`src/config/economyConfig.js` now owns existing base reward, XP, reputation, item prices/bonuses, travel/timing values and new ORDER_TYPES, DISTRICTS and REPUTATION_TIERS. `gameBalance.js` re-exports BALANCE for compatibility and retains XP/level formulas. `src/config/eventBalance.js` owns probability buckets, risk reductions, fine/tip/reputation amounts, duration/speed effects, demand and choice values, and protection settings.

Save version **3** adds `unlockedDistricts`, `selectedDistrict` and `demandBonusOrders`. Reputation and all previous progression/equipment fields remain. Old v1/v2 data defaults to the residential district and zero demand. Unknown districts and non-finite counters are rejected, selected district must be unlocked, and snapshots clone ownership arrays. No active orders/events, timed speed effects, event history or protection state are serialized. The next-close-order flag is session-only. The existing LOCAL adapter and disabled automatic save/load are preserved: serialization supports district persistence when the adapter is invoked; this stage does not add automatic storage.

Development shortcuts: F2 +1000 ₽, F3 +100 XP, **F4 positive event**, **F5 negative event**, **F6 choice event**, **F7 level 4 / at least 3000 ₽**. Event shortcuts respect eligibility, protection and open dialogs. All handlers are eliminated from production builds; there are no visible cheat buttons.

## Files and verification

Created: `src/config/economyConfig.js`, `src/config/eventBalance.js`, `src/data/events.js`, `src/managers/EventManager.js`, `src/managers/TemporaryModifiers.js`, `src/ui/EventUI.js`, `src/ui/DistrictUI.js`, `tests/events.test.js`, `tests/events-browser.cjs`, `STAGE4.md`.

Modified: `.gitignore`, `README.md`, `src/config/gameBalance.js`, `src/data/shopItems.js`, `src/entities/Courier.js`, `src/managers/OrderManager.js`, `src/managers/DeliveryRewards.js`, `src/managers/DevelopmentCheats.js`, `src/scenes/GameScene.js`, `src/state/GameState.js`, `src/style.css`, `src/ui/ModalUI.js`, `src/ui/OrderUI.js`, `src/ui/PlayerProfileUI.js`, `src/world/createCity.js`, `tests/orders.test.js`, `tests/browser-check.cjs`, `tests/progression-browser.cjs`.

Verification uses the bundled Node runtime because npm is absent from this host's PATH. The package's build script (`vite build`) is executed directly. Unit tests use Node's `--test --test-isolation=none` because sandboxed child-process test isolation is unavailable. Browser checks use the bundled Playwright and headless Chrome.

- 20 unit tests: lifecycle, purchases, saves/migrations, fine clamping, probability buckets, support tiers, equipment risk, demand/expiry, all four order types, choices, streaks, repeat/cooldown protection, timed modifiers and district rewards.
- Existing delivery and shop/equipment browser suites: real physical routes, collisions, bicycle movement, deadlines, keyboard/buttons, rewards, modal input and mobile recovery.
- Stage 4 browser suite: all four deliveries, district purchase and repeated switches, all three choices, positive/negative results, paused deadline, history, F4–F7, modal exclusion, mobile input and 390×844 / 844×390 / 320×568 layouts. Production checks verify F2–F7 do not grant rewards/events.
- Screenshots are local ignored artifacts; the 320×568 event layout was visually inspected. Browser suites assert no runtime/console errors.
- Production build succeeds with the existing large Phaser bundle warning (about 1.24 MB minified).

Limits: placeholder visuals, approximate straight-line distance, shared city geometry with district overlays, no complex damage/durability or route planning, no automatic saves, and session-only event protection/history. Fragile extra risk can produce another event on an order, but never simultaneously. Event rarity percentages describe baseline rolls before eligibility and protection. Economy remains prototype tuning. No scooters, cars, monetization, multiplayer, SDK, daily missions or other stage 5 features were added.
