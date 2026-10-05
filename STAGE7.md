# Stage 7: company management

The existing Phaser game and all personal systems remain in place. CompanyManager
remains the single game-wide income service across district restarts. No Stage 8
systems were added. Opening still requires player level 12 and 40,000 ₽.

## Employees and hiring

| Archetype | Hire | Efficiency | Reliability | Speed | Offline efficiency |
| --- | ---: | --- | --- | --- | ---: |
| Новичок | 2,500 ₽ | 90–102% | 96–104% | 94–104% | 85% |
| Опытный | 5,500 ₽ | 110–122% | 102–112% | 100–110% | 85% |
| Быстрый | 4,200 ₽ | 108–118% | 82–94% | 110–120% | 85% |
| Аккуратный | 5,000 ₽ | 94–104% | 114–120% | 86–98% | 85% |
| Трудоголик | 6,000 ₽ | 104–116% | 98–108% | 98–108% | 100% |

Each batch has three distinct archetypes: random start in the five-type list plus
the next two types. Names and stats are generated separately. Reputation adds at most
three percentage points, within configurable global stat ranges of 80–130% efficiency,
80–120% reliability and 80–120% speed. First refresh is free, later refreshes cost
300 ₽. Candidates, IDs and refresh counters persist. Hiring consumes one candidate;
unknown/consumed IDs, insufficient funds and full capacity reject without charging.
An exhausted candidate list remains exhausted after reload. Quality tiers are omitted.

Every employee stores id, name, archetype, level, efficiency, reliability, speed,
assignedTransport (fleet ID or null), status, totalEarned, successfulDeliveries,
failedDeliveries and currentXp. Extra fields preserve work/failure fractions,
a capped permanent efficiency bonus and active-gameplay unavailability expiry.
Statuses: WORKING, IDLE, TEMPORARILY_UNAVAILABLE.

**ОТКРЫТЬ · ПАРАМЕТРЫ** expands the employee card with XP, all stats, transport,
income, lifetime work, failure risk, offline efficiency and the complete income formula.
There is no employee inventory or visible route simulation.

## Work and income

Per-employee ₽/minute:

```
100 × transport × effective efficiency × speed factor
    × office × company × expected reliability factor × event factor
```

- Effective efficiency = base × (1 + 2% per level above 1 + permanent bonus)
  × (1 + routing). Permanent bonus caps at 6%.
- Reliability gains 0.5 percentage points per level above 1.
- Speed factor = 1 + (speed − 1) × transport influence. Influence is
  0.10/0.25/0.40/0.50 for walking/bicycle/moped/car; no hidden synergy table.
- Company factor = 1 + dispatch + advertising + reputation bonus (at most 5%).
- Failure chance = clamp(2.5% + (1 − reliability) × 0.2 + temporary risk, 0.2%, 8%).
- Expected reliability factor = 1 − failure chance × 0.5.
- Event factor adds temporary bonuses/penalties, with a minimum of 0.5.

Work rate is 2 deliveries/minute × transport × effective efficiency × speed factor.
Fractions accumulate and simulation settles every 10 seconds. A failure accumulator
turns reliability risk into occasional failed deliveries. Each success awards 8 XP
× training. Next-level XP = 100 + (current level − 1) × 50. XP is consumed at level-up;
level 10 caps growth and discards surplus XP. Work XP continues when storage is full.

The existing elapsed-time ledger retains fractional rubles and settles old rates
before changing staffing, assignments, upgrades or effects. Collection moves whole
rubles into personal money. Personal lifetime delivery counters are unaffected.
Storage remains two hours at the permanent workforce rate, ignoring temporary effects
and illness for capacity. Reducing the rate never deletes existing balance. Event
rewards can exceed storage; passive credit waits until there is room.

| Company transport | Price | Multiplier |
| --- | ---: | ---: |
| Walking | Free | 1.0 |
| Bicycle | 3,000 ₽ | 1.5 |
| Moped | 8,000 ₽ | 2.4 |
| Car | 25,000 ₽ | 3.6 |

Personal and company vehicles remain separate. A fleet ID has one employee owner;
release it to walking before assigning it to another employee. Assignment is free.

## Offices and upgrades

| Office | Slots | Income bonus | Cost from previous |
| --- | ---: | ---: | ---: |
| Подвал | 2 | 0% | Included |
| Маленький офис | 4 | +5% | 15,000 ₽ |
| Нормальный офис | 7 | +10% | 45,000 ₽ |
| Бизнес-центр | 12 | +18% | 120,000 ₽ |

The legacy companyLevel mirrors officeLevel for existing career labels. Company rank
uses reputation, separately from office level and player level.

| Upgrade | Levels 1 / 2 / 3 | Costs 1 / 2 / 3 |
| --- | --- | --- |
| Диспетчерская | Income +3% / +6% / +10% | 5,000 / 14,000 / 35,000 ₽ |
| Маршрутизация | Efficiency +2% / +5% / +8% | 4,000 / 12,000 / 30,000 ₽ |
| Обучение курьеров | XP +10% / +20% / +35% | 3,500 / 10,000 / 25,000 ₽ |
| Реклама компании | Income +2% / +4% / +7% | 4,500 / 13,000 / 32,000 ₽ |

All voluntary expenses use personal money. Cards display current/next level,
current/next effect and price. The company has four tabs: ОБЗОР, КУРЬЕРЫ, ТРАНСПОРТ,
УЛУЧШЕНИЯ, with sticky navigation, a fixed modal header, scrolling cards, collapsible
details and at least 44px controls. No giant gameplay tables.

## Business events

CompanyEventManager is independent from personal EventManager. It schedules one event
every 3–5 minutes with working employees, keeps at most one queued event and waits
behind other dialogs/personal events. Results apply once. Movement is blocked during
the business dialog; personal delivery deadlines continue, as in company management.

| Event | Effect |
| --- | --- |
| Курьер месяца | Employee +20% income for 180s; +2 reputation |
| Крупный корпоративный заказ | Company +2,000 ₽; +3 reputation |
| Хороший день | Company +12% income for 180s; +1 reputation |
| Клиент оставил чаевые | Company +400 ₽ |
| Слишком довольный клиент | +4 reputation |
| Курьер опоздал | Employee −15% income for 90s; one failure, −1 reputation |
| Разбитый заказ | Nominal 500 ₽ fine; one failure, −2 reputation |
| Курьер заболел | Unavailable for 180s active gameplay |
| Транспорт подвёл | Transported employee −25% income for 120s |
| Курьер пропал | 45s pause, then «Нашёлся. Просто обедал.» |

Four choice events:

- **Кофе для всех**: pay 1,000 ₽ for company +10% income for 180s, or decline.
- **Курьер разбил заказ**: pay 1,000 ₽ without another penalty, or dispute:
  50% no penalty / 50% nominal 1,800 ₽ company fine, one failure and −2 reputation.
- **Срочный корпоративный заказ**: +18% company income and +2 percentage points
  failure risk for 180s; negative-event weights rise. Decline has no consequences.
- **Курьер просит повышение**: one-time 1,500 ₽ bonus grants permanent +2%
  efficiency (maximum +6%), or refuse for −5% employee income for 120s.

Forced fines only spend company balance, at most 15% of its current amount, never
making personal or company money negative. Unaffordable voluntary choices remain
unresolved with an explanation and their alternative available. Consecutive negative
events and repeated IDs are blocked. Reliability lowers damage/negative event weights.
Durations use active company gameplay time and survive reload. Pending/unresolved
choices are session-only: scene restarts retain them, reload discards them unapplied.

## Reputation and statistics

Company reputation is separate and nonnegative: +0.01 per successful employee delivery,
−0.2 per simulated failure, +3 per office/branch upgrade, plus event effects.
It improves generated stats by at most 3 percentage points, income by at most 5%,
and corporate event weights modestly. Normal hiring has no reputation requirement.
Ranks: Местная доставка (0), Районная служба (30), Городская компания (100),
Крупный оператор (250).

Saves track lifetime income, collected income, employees hired, successful/failed work,
positive/negative events, reputation, highest income/minute, per-employee statistics,
and the most recent 12 activity messages.

## Offline progression and persistence

Save version 7 retains the localStorage key and all personal fields. Stage 6 levels
migrate to officeLevel; level 3 expands from 6 to 7 slots without losing employees.
Old couriers retain IDs, names, efficiency, levels (capped at 10), fleet assignment,
baseIncome and totalEarned; missing archetype/reliability/speed/work become
ROOKIE/1/1/zero. Upgrades and reputation default to zero. Personal-only saves retain
their original migrations and start with a closed company. New nested snapshots
are isolated, and corrupt stats, duplicate IDs/assignments and effects are sanitized.

Offline calculation caps duration at two hours and cash at storage. It freezes
starting permanent income/work rates, applies archetype offline efficiency, credits
cash, then awards employee XP and successful work. No random events, new failures
or fines occur. Illness and temporary effects are ignored for offline earning but
their remaining gameplay durations stay intact. Newly earned levels affect later
income. Timestamps are settled before the popup to prevent duplicate credit.
Invalid/missing/future timestamps give zero income and reset safely. Hidden tabs
suspend active work/events; return uses this same offline path.

## Development controls

Existing F2–F10 and Alt+C/M/H/O remain. New keys, development only:

- Alt+R: free test candidate generation without consuming the normal free refresh.
- Alt+P: +50 company reputation.
- Alt+L: first employee gains one level, respecting level 10.
- Alt+1 / Alt+2 / Alt+3: queue eligible positive / negative / choice events.
- Alt+U: fund and buy the next office upgrade.
- Alt+T: simulate five minutes of company gameplay.

Alt+H funds the actual candidate fee and can refill an exhausted test list. Shortcuts
ignore repeated keys and typing in input/textarea/select. Production has no registered
development shortcut handlers.

## Files and verification

Created: `src/data/companyEvents.js`, `src/managers/CompanyEventManager.js`,
`src/ui/CompanyEventUI.js`, `STAGE7.md`.

Modified: `.gitignore`, `index.html`, `README.md`, `src/config/companyConfig.js`,
`src/config/economyConfig.js`, `src/managers/CompanyManager.js`,
`src/managers/DevelopmentCheats.js`, `src/scenes/GameScene.js`, `src/state/GameState.js`,
`src/state/companyState.js`, `src/style.css`, `src/ui/CompanyUI.js`,
`tests/company.test.js`, `tests/company-browser.cjs`, `tests/company-runtime-browser.cjs`,
`tests/events.test.js`, `tests/mobile-ux-browser.cjs`.

The mobile regression disables personal random events before desktop acceptance,
preventing an unrelated popup from invalidating its movement assertion. Screenshots
and a local Stage 5 runner are ignored under `artifacts/`.

Run `npm test` and `npm run build`. This host lacks npm in PATH; its bundled Node.js
runs the same test suite and Vite build entry point. Browser checks use isolated Chrome
profiles and optional PLAYWRIGHT_MODULE/GAME_URL/PREVIEW_URL settings. Stage 7 tests:
`company-browser.cjs` and `company-runtime-browser.cjs`; personal regressions:
`mobile-ux-browser.cjs`, `screens-browser.cjs`, and the Stage 5 in-browser harness.
Portrait/landscape screenshots are visually inspected.

Verification completed: 64/64 unit tests; Stage 7 company/browser checks at 1280×800,
390×844, 430×932, 844×390 and 320×568; development/production runtime checks; existing
mobile and screen regressions; all Stage 5 physical routes, transport and event checks.
Browser console checks found no runtime errors. Production Vite build passes, retaining
the preexisting large-Phaser-chunk warning. npm itself is unavailable on this host;
the same build entry point was executed with the bundled Node.js.

## Limitations

Prototype balance, local saves/time without server validation, uncoordinated multiple
tabs, session-only unresolved choices, offline income calculated at starting rates.
Physical iOS/Android notch, keyboard and browser toolbar testing remains. The existing
Phaser bundle-size warning remains. No wages, taxes, permanent illness, routes/NPCs,
repairs/fuel, advanced logistics, SDK, ads, monetization, multiplayer or Stage 8.
