# Courier Empire 1.0.0 — balance report

Date: 2026-10-08. Yandex label: 1.0.0.0 Release Candidate. Changes are in existing configuration files; no new progression system was added.

## Method and limits

`npm run balance` runs `scripts/simulate-economy.mjs`: deterministic sampling of 2,000 real generated orders per transport/district phase, using actual route distances, type weights, payment and movement speed. It assumes a pickup leg of 65% of delivery distance, 40% road detours and 17 seconds of handling/menu time. A second run adds 30% time per delivery. Level 6+ phases include the thermobag's 10% payment bonus. It does not simulate human navigation, failures, menus, all XP/reputation gates, day boundaries or every event. This is an expected-value sanity check, not a timed playthrough.

Daily/achievement/career money, tips, demand and streak boosts are excluded from the main milestone model. They can accelerate progress; mistakes and exploration slow it. The endgame estimate uses 60% developed-fleet uptime as a ramp-up proxy, not an itemized fleet-investment simulation. Real multi-session progression must still be measured after draft testing.

## Costs and change rationale

The same model previously produced shoes at 0.5 min, bicycle at 6.7 min, moped at 21 min, car at 48 min, company at 78 min and a developed company paying 4,964 ₽/min. Passive income overwhelmed the active loop. Base delivery payments, XP, transport speed and unlock levels are retained; costs and company scaling were adjusted centrally.

| Purchase | Release cost, ₽ | Location |
| --- | ---: | --- |
| Old / good shoes | 3,000 / 6,000 | `economyConfig.js` |
| Thermobag | 5,500 | `economyConfig.js` |
| Bicycle / moped / car | 7,000 / 30,000 / 105,000 | `economyConfig.js` |
| Center / industrial / elite / business district | 6,500 / 24,000 / 60,000 / 140,000 | `districtConfig.js` |
| Company, level 12 | 165,000 | `companyConfig.js` |
| Employees | 2,500–6,000 by archetype | `companyConfig.js` |
| Company bicycle / moped / car | 3,000 / 8,000 / 25,000 | `companyConfig.js` |
| Office levels 2 / 3 / 4 | 15,000 / 45,000 / 120,000 | `companyConfig.js` |
| Dispatch levels | 5,000 / 14,000 / 35,000 | `companyConfig.js` |
| Routing levels | 4,000 / 12,000 / 30,000 | `companyConfig.js` |
| Training levels | 3,500 / 10,000 / 25,000 | `companyConfig.js` |
| Advertising levels | 4,500 / 13,000 / 32,000 | `companyConfig.js` |

Purchases remain voluntary; already owned equipment, vehicles, districts, company and currency are preserved by migration. Old employee base income is normalized through the existing bounded serializer to at most twice the new base (90 ₽/min); veteran employee rates can therefore decrease. No retroactive currency subtraction or ownership removal occurs.

## Main income sources

| Source | Rule / guard |
| --- | --- |
| Standard delivery | 150 + 0.30 ₽/meter, base clamped to 150–290; district/type modifiers then apply |
| Urgent / fragile / double / large / elite | Type multipliers 1.35 / 1.20 / 1.85 / 2.30 / district elite settings; real unlock/transport eligibility retained |
| Tips / positive personal events | Typical tips 100–400, rare large tips 800–1,200; district tips 250–500, corporate bonus 350–650; bounded order-context event selection |
| Demand / equipment / streak | Demand +25% for three successful orders; thermobag +10%; individual streak milestones at most +15%, not an indefinitely compounding streak |
| Daily login bonus | 300 / 700 / 1,500 for early/mid/late tier, once per server-date |
| Daily tasks | Three rewards of 100 / 200 / 350, plus completion bundle 200 / 400 / 700; early full-day money total including login = 800 ₽ |
| Session / rotating challenge | Session 120 ₽, three-delivery target and two-delivery cooldown; rotating reward 350 / 700 / 1,200 with doubled targets and one-time claim |
| Achievements / career | Existing per-entry rewards, claimed IDs persisted; money is finite, Legacy upgrades have capped effects; `data/achievements.js`, `progressionConfig.js`, `legacyConfig.js` |
| Rewarded ads | +50% of the final delivery payment, rounded down, no XP/reputation; one persisted attempt; awarded only on SDK reward callback |
| Company | Base 45 ₽/employee/min; transport ×1 / 1.35 / 1.8 / 2.4; efficiency, speed, reliability, office, upgrades, districts and capped Legacy factors |
| Offline / company storage | Existing two-hour cap, baseline rates, archetype offline factors, capped ledger; server time and persisted last-update timestamp |

The full early-day bundle is only about 1.4 minutes of modeled walking income; the late-day bundle (3,250 ₽) is about 1.4 minutes of business-district active income. These rewards encourage return visits without buying a transport tier instantly. Optional challenges and finite progression rewards do not introduce an unlimited claim loop.

## Estimated milestones

Times include previous modeled purchases: shoes+bicycle; center+bag+moped; industrial+car; elite+company. They are cumulative, with no rewarded advertisements.

| Milestone | Ordinary pace | 30% slower pace | Requested approximate target |
| --- | ---: | ---: | --- |
| First meaningful shoes | 5.3 min | 6.9 min | 5–10 min |
| Bicycle | 17.6 min | 22.9 min | 15–30 min |
| Moped | 62.8 min | 81.7 min | 45–90 min |
| Car | 2.67 h | 3.47 h | 2–4 h |
| Company | 4.61 h | 6.00 h | 3–6 h |
| Magnate proxy | 23.27 h | 24.65 h | 12–25 h |

| Phase | Mean payment/order, ₽ | Orders/hour | Active ₽/min |
| --- | ---: | ---: | ---: |
| Walking / residential | 242 | 141 | 567 |
| Bicycle / center | 436 | 128 | 929 |
| Moped / industrial | 672 | 119 | 1,327 |
| Car / elite | 770 | 150 | 1,926 |
| Car / business | 1,135 | 126 | 2,375 |

The order rates are brisk model assumptions, not measured human throughput. A developed company with eight level-7 car couriers, office 4, level-2 company upgrades and all districts generates approximately **1,489 ₽/min** before temporary events, reputation/Legacy changes and offline factors. That is 63% of the modeled late active income. A starting ordinary walking employee earns approximately 44 ₽/min. Company revenue is useful while active deliveries remain valuable. Maximum-office slots (12), employee levels (10), upgrade levels, permanent efficiency (6%), reputation bonus (5%) and Legacy limits bound scaling; no recursive exponential payout exists.

Rewarding 25% of deliveries adds 12.5% active money: modeled saving time falls about 11.1%, excluding advertisement viewing time. Rewarding every delivery has a theoretical +50% money ceiling, not a progression dependency. No-ad progression remains fully available.

## Event and exploit audit

Personal base rarity buckets now total 20.5% (14% / 3.5% / 2% / 1%) before context, equipment, district and anti-frustration filters. This is not a guaranteed per-minute interruption rate. Tutorial deliveries suppress random personal events. Company events retain their 3–5 active-minute intervals and worker eligibility.

Tests cover idle/reload suppression, order ownership, district transitions, non-stacking choices, repeat exclusions, two-negative streak protection, equipment/district weighting, rare-negative cooldown and protected company penalties. Persisted negative streak now initializes the personal manager correctly after reload.

Double-delivery completion, reward callbacks, task/achievement/Legacy claims and company withdrawals have idempotent guards. Company work is settled before major save snapshots, preventing stale last-update timestamps from paying the same interval offline again. A newer current-account local backup can repair a failed cloud write without merging foreign account money. Editable local storage cannot provide server-authoritative anti-cheat; leaderboards and server-time behavior require real SDK validation. No new anti-cheat backend is claimed.
