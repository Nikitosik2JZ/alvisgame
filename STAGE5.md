# Stage 5 — personal transport progression

This stage extends the existing game. Movement, Arcade collisions, interaction radius, objective markers, equipment, XP/levels, reputation, shops, choice events and districts remain in place. No Stage 6 company systems are implemented.

## Transport configuration and progression

`src/config/transportConfig.js` defines IDs, Russian names, allowed types, distance pools, event/weather/fragile modifiers, visual/body dimensions, career titles and celebrations. Prices, speeds, levels and order weights come from `economyConfig.js`; event consequences remain in `eventBalance.js`. Ownership belongs to the player, separately from equipment slots.

| Transport | Price | Level | Total XP required | Base speed (px/s) | Career status |
| --- | ---: | ---: | ---: | ---: | --- |
| ПЕШКОМ | 0 ₽ | 1 | 0 | 160 | Новичок |
| ВЕЛОСИПЕД | 3500 ₽ | 3 | 250 | 250 | Велокурьер |
| МОПЕД | 9000 ₽ | 6 | 1000 | 340 | Опытный курьер |
| АВТОМОБИЛЬ | 28000 ₽ | 10 | 2700 | 420 | Профи доставки |

Walking shoes still provide 168 / 176 px/s. Vehicles ignore shoe speed bonuses. The thermobag retains its +10% successful-delivery payment and risk protection. Vehicles do not add a universal payment multiplier: earnings improve through speed, longer routes and better order pools.

The garage lists all four transports with ownership/equipped states, speed, price, required level and benefits/disadvantages. Failed purchase attempts explain the level/money requirement. Transactions deduct funds once, permanently add ownership and equip immediately. Duplicate purchases are rejected. Moped/car purchases show a large celebration with ПОЕХАЛИ; background cards are hidden during the celebration to prevent keyboard focus behind it.

Switching owned transport is free. GameState rejects both switching and purchases that would equip a vehicle while ACCEPTED or PICKED_UP. Transport controls now exist only in the garage; F10 also respects this guard. Completion/failure releases the guard. An idle vehicle switch replaces the available offer, and acceptance rechecks eligibility.

The HUD shows current transport/speed and the next major goal with remaining money and level progress. Full transport money/cost details appear in the garage. Career follows the highest permanently owned vehicle, independent of the current equipment choice. The next goal advances beyond that vehicle. Level 6 / 10 availability notices are displayed once and recorded when shown, with a configurable eight-second duration.

## Orders and districts

Initial relative weights in the residential district, before reputation adjustments:

| Transport | Standard | Urgent | Fragile | Double | Large |
| --- | ---: | ---: | ---: | ---: | ---: |
| Walking | 65 | 20 | 10 | — | — |
| Bicycle | 55 | 23 | 12 | 10 | — |
| Moped | 40 | 35 | 10 | 15 | — |
| Car | 25 | 30 | 10 | 15 | 20 |

Weights are normalized after eligibility filtering. Center retains ×1.5 urgent weighting, ×1.3 payment, ×1.15 XP and ×1.15 event frequency. Reputation still increases non-standard weights. Level requirements remain enforced.

Customers are sorted by delivery distance from the restaurant. Configured rank pools are walking 0–67%, bicycle 0–85%, moped 20–100%, car 40–100%. Fractions round to whole customer entries; the existing six-customer map gives coarse pools. Center expands the upper bound by its district pool difference, capped at 100%. Double's second customer is distinct and selected from the same pool. Existing close-order events override distance selection with the nearest customer.

Large orders require an equipped car and level 10. They select the distant 60–100% rank pool unless an existing close-order bonus is active. `ORDER_TYPES.LARGE` uses ×2.3 base reward, ×2 XP, +2 reputation and ×1.8 timer. The base reward/distance/timer calculations and district/equipment/event modifiers remain shared with all other orders. Example residential base offers are roughly 345–667 ₽ before equipment/event bonuses; the timer is 108–216 seconds. Large has one pickup and one drop-off, representing a bulky multi-package load. Offers show distance, payment, time and required Автомобиль; normal offers show a transport recommendation.

Walking/bicycle remain usable in residential. Car is allowed everywhere; Center raises the relative weights of car traffic and parking events by ×1.6. There is no traffic simulation or district prohibition.

## Weather, fragile protection and events

| Transport | Rain speed factor | Rain penalty | Fragile base risk | With thermobag |
| --- | ---: | ---: | ---: | ---: |
| Walking | 0.80 | −20% | 8% | 1.6% |
| Bicycle | 0.75 | −25% | 8.8% | 1.76% |
| Moped | 0.90 | −10% | 6.4% | 1.28% |
| Car | 0.98 | −2% | 2.8% | 0.56% |

Rain lasts 20 seconds and adapts to the equipped vehicle if switching after the order. Fragile risk = max(0.3%, 8% × transport fragile factor × thermobag factor). Transport factors are 1 / 1.1 / 0.8 / 0.35; bag factor is 0.2. The general soup event's relative weight is also reduced by transport and bag protection; these figures describe the separate fragile damage check, not total event frequency. Existing streak/cooldown/no-repeat protection can suppress a damage event.

New data-driven events:

| Transport | Event | Effect |
| --- | --- | --- |
| Moped | БЕНЗИН НА НУЛЕ? | −6 seconds of order time; flavor only |
| Moped | Идеальный маршрут | +15% speed for 30 seconds |
| Car | ПРОБКА | −15% speed for 12 seconds |
| Car | ПАРКОВКИ НЕТ | −8 seconds of order time |
| Car | ЗЕЛЁНЫЙ КОРИДОР | +15% speed for 30 seconds |
| Car | БОЛЬШОЙ ЗАКАЗ | ×3 Large weight on the next generated car offer |

The Large boost persists until an eligible car offer is generated, then is consumed regardless of the rolled type. It does not guarantee a Large order. Temporary transport events apply only to their permitted transport; rain follows the current one. Existing event dialogs pause movement and the deadline, while explicit time penalties still apply. Duplicate temporary effects refresh by event ID. No fuel bars, petrol purchases, permanent breakdowns, durability or maintenance are added.

## Movement and UI

Original Phaser primitive textures distinguish all four transports. Car visual: 58×76 pixels; moped: 48×56. All transports use the same centered 22×24 collision body, normalized directions, world bounds, camera and 60-pixel pickup/drop-off zones. No inertia, steering wheel or realistic driving.

Garage/profile/shop use the existing native dialog focus trap, input blocking and scrollable content. The close button stays reachable on short screens. The subsequent mobile UX pass uses a fixed analog joystick, contextual interaction button, collapsible HUD, compact objectives and a secondary menu. Shop is equipment-only; garage is transport-only; courier is read-only; event history opens separately. See README.md for the current mobile layout and screen responsibilities.

## Save schema and backward compatibility

Save version is now 5 following the screen separation correction. Existing key `courier-empire-save-v1` and PlatformService JSON/localStorage adapter are preserved. BootScene loads once before starting gameplay and subscribes to progression changes for automatic saves.

Version 5 additionally persists completedOrders, failedOrders, totalMoneyEarned, totalTipsEarned, totalFinesPaid and totalDistanceDelivered; missing legacy counters default to zero.

Transport fields: `ownedTransports` (always includes WALKING), `equippedTransport`, `transportMilestones` (shown notices), `largeOrderBoost` (pending next-car weighting). Existing money, XP, level, reputation, districts, demand, ownedItems and equipment remain. `transport` remains an alias for compatibility, and old bicycle equipment/item entries migrate to the transport domain without remaining duplicated in equipment. Vehicle ownership has its own domain suitable for future separation from company vehicles.

Legacy `transport: BICYCLE`, bicycle item ownership or an equipped bicycle slot restores permanent bicycle ownership even if old saves omit ownedItems. Old bicycle equipment restores cycling; an explicit equippedTransport selection takes precedence. Unknown IDs, duplicate ownership and invalid equipped vehicles are sanitized. Level and movement speed are recalculated. New moped/car saves roundtrip all progression fields. Active orders, modal state, collision/input state and temporary speed effects are not serialized. Storage remains local to each origin; unavailable localStorage returns failure through the existing adapter.

## Development controls

Existing F2 +1000 ₽, F3 +100 XP, F4 positive event, F5 negative event, F6 choice event and F7 Center-test preparation remain.

- F8: raise XP/funds to at least the configured moped purchase requirement; buy it in the garage.
- F9: raise XP/funds to at least the configured car purchase requirement; buy it in the garage.
- F10: cycle owned transports, respecting the active-order guard.

All shortcuts are registered only in development and the setup function also checks DEV. Console messages describe transport shortcuts. No production key handlers are registered.

## Verification and limits

34 unit tests pass, including existing progression/order/event regression cases plus purchases, all switching paths, car-only eligibility, all transport/type delivery combinations, district pools, temporary effects, fragile/thermobag composition, save roundtrips/migration and career goals. On hosts that block Node worker spawning, run `node --test --test-isolation=none tests/*.test.js`.

`/tests/stage5-browser.html` is a development-only integration harness, excluded from the production bundle. It drives four physical pickup/drop-off routes, checks all vehicle collision bodies and narrow passages, directional/touch movement paths, garage transactions, all eligible types, transport events, rain, active-order guards, local saves and district restarts. It restores the starting progression on completion. Manual UI verification additionally covers desktop, 390×844, 320×568 and 844×390 layouts, garage scrolling/switching, profile/district/event dialogs and production shortcut rejection.

`npm run build` succeeds with the existing Phaser bundle-size warning (about 1.26 MB minified). Known prototype limits: three restaurants, six customer points, straight-line distance rather than actual path length, coarse distance pools, placeholder visuals, intentionally preliminary economy. Active orders and temporary effects reset on reload. Fuel, repairs, company systems and all Stage 6 work are intentionally absent.
