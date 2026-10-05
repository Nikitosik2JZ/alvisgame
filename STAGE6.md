# Stage 6: company foundation

The existing Phaser courier game continues unchanged: personal deliveries, order types,
events, reputation, XP, districts, equipment, garage, statistics and mobile controls
remain available. Company workers generate mathematical income; there are no employee
sprites, routes or physical delivery simulations.

## Economy and progression

Open **КОМПАНИЯ** from the HUD or secondary mobile menu. Opening requires both player
level **12** and **40,000 ₽**. Enter a name (20 characters, default **Моя доставка**),
then select **ОТКРЫТЬ КОМПАНИЮ** and acknowledge the milestone with **НАЧАТЬ БИЗНЕС**.
The name can be edited afterward in the overview. Names are rendered as text, never HTML.

| Company level | Courier slots | Upgrade from previous level | Career |
| --- | --- | --- | --- |
| 1 | 2 | Opening: 40,000 ₽ | Предприниматель |
| 2 | 4 | 15,000 ₽ | Владелец службы доставки |
| 3 | 6 | 40,000 ₽ | Курьерский босс |

Hiring costs **2,500 ₽**. A candidate uses one of eight generic first names, level 1,
efficiency 1.0 and base income 100 ₽/minute. New hires immediately work on foot.
Full capacity rejects hiring without charging money. No wages, morale, skills or HR systems.

| Employee transport | Company purchase price | Multiplier | Income at 100% efficiency |
| --- | --- | --- | --- |
| Walking | Free | 1.0 | 100 ₽/minute |
| Bicycle | 3,000 ₽ | 1.8 | 180 ₽/minute |
| Moped | 8,000 ₽ | 3.0 | 300 ₽/minute |

The company buys vehicles only in **КОМПАНИЯ → ТРАНСПОРТ КОМПАНИИ**. The personal
garage and its ownership never supply company vehicles. Each fleet entry has its own
ID; several vehicles of the same type can be bought. A vehicle can serve only one
employee. To reassign it, select **Пешком** for its current courier, apply the assignment,
then assign the free vehicle to another courier. Company cars are outside Stage 6.
All opening, hiring, fleet purchases and upgrades spend **personal money**.

Requirements, prices, capacities, name list/limit, timing and caps are centralized in
`src/config/companyConfig.js`. Income values live in `src/config/economyConfig.js`
(`companyBaseIncome`, `companyTransportMultipliers`) and are referenced by companyConfig.
No passive income changes personal order rewards or personal lifetime income counters.

## Income ledger

Per-employee rate is `baseIncome × transportMultiplier × efficiency` ₽/minute.
`WORKING` employees earn income; `IDLE` employees do not. Hire creates `WORKING` couriers;
there is no idle/work scheduling screen in this stage.

One game-wide CompanyManager runs a one-second timer using **monotonic elapsed time**,
independent of Phaser frames. Company ownership survives district scene restarts and
the service is not duplicated. Before hiring, assigning, collecting or upgrading,
elapsed time is settled with the preceding workforce and transport rates.

Income credits whole rubles into `companyBalance`, never directly into personal money.
`companyIncomeRemainder` preserves fractional rubles between ticks, collections and saves.
**ЗАБРАТЬ** transfers the entire integer balance to personal money and resets
`companyBalance` to zero. Employee `totalEarned` tracks fractional attributed income;
company lifetime income tracks credited rubles. Purchases and collections are not earnings.

Storage is limited to **two hours at the current working income rate**, shared by online
and offline earnings. A full ledger pauses credits; missed income is not queued for later.
Changing to a lower rate never removes existing money but can leave the balance above
the new limit until collection. Offline duration and storage duration have separate
config values, initially both two hours.

## Offline income and persistence

Save version **6** retains the existing localStorage key and all previous personal fields.
Added fields: `companyUnlocked`, `companyName`, `companyLevel`, `companyBalance`,
`companyLifetimeEarnings`, `employees`, `companyVehicles`, `lastCompanyUpdateTimestamp`,
`companyStats`, `companyIncomeRemainder`, `companyLog`.

Employee fields: `id`, `name`, `level`, `efficiency`, `assignedTransport` (fleet ID or null),
`baseIncome`, `status` (`WORKING`/`IDLE`), `totalEarned`. Vehicles contain `id` and `type`.
`companyStats` stores `employeesHired` and `totalIncomeCollected`; current workforce,
vehicle count and company level derive from persisted entries. The activity log saves
the last five messages, with opening, hiring, fleet, assignment, upgrade, collection,
offline earnings and occasional delivery flavor messages.

The saved timestamp belongs to the last settled ledger update. Updating it without
settling earnings would lose time, so saves keep the timestamp synchronized with income.
The timer and pagehide/visibility-hidden handlers settle the ledger and trigger the
existing automatic save subscriber. On startup, CompanyManager computes
`min(now - savedTimestamp, offlineCapMs)`, credits only available storage, then updates
and saves the timestamp **before displaying** the offline popup. Reloading or opening
the popup again never credits the same period twice. The popup's **ЗАБРАТЬ** collects
the complete balance; **ПОЗЖЕ** leaves it stored. Notifications are not repeated on
district scene restarts.

Missing, nonnumeric, fractional, nonpositive or future timestamps grant zero offline
income and reset to the current safe timestamp. Invalid balances and IDs are discarded;
duplicate vehicles, couriers and assignments are sanitized. Personal transports cannot
appear as assigned company IDs. Snapshots copy all nested company data.
Older saves default to a closed company, empty workforce/fleet and zero earnings.
Existing personal transport/equipment migrations and statistics remain intact.

## Development controls

Only `import.meta.env.DEV` registers these shortcuts. They are removed by the production
build, require no visible cheat buttons, and do not run while typing into input/selects.

- **Alt+C**: supply the required XP/funds and open a test company.
- **Alt+M**: add 10,000 ₽ to the company balance (requires an open company).
- **Alt+H**: supply the hiring fee and hire a test courier (normal capacity still applies).
- **Alt+O**: settle live income, simulate one hour offline, and queue its popup.

Existing F2–F10 controls remain available. Development credits do not count as earnings.

## Verification

Run `npm test` and `npm run build`.
With playwright-core and Chrome available, start `npm run dev` and run
`node tests/company-browser.cjs` (optional `PLAYWRIGHT_MODULE`, `CHROME_PATH`, `GAME_URL`,
`ARTIFACT_DIR`). It uses fresh isolated browser contexts and does not touch real saves.
It verifies company requirements, naming/HTML safety, movement blocking, hiring, full
slots, separate fleet, assignment/reassignment, actual timer income, collection,
upgrades/careers, personal deliveries, scene restart, reload, old saves, malformed
timestamps, one-hour offline earnings and a 30-day absence limited to two hours.
It checks 1280×800, 390×844, 430×932, 844×390 and 320×568 layouts and console errors.
`node tests/company-runtime-browser.cjs` checks development shortcuts, typing guards,
disabled cheats in the production build and production mobile offline collection.
Start `npm run preview -- --port 5176`; set `PREVIEW_URL` if using another port.

Existing `tests/screens-browser.cjs`, `tests/mobile-ux-browser.cjs` and the Stage 5
browser harness still cover personal screens, joystick, transport, orders and events.

## Limits

Local saves and offline wall time are not server-authoritative: editing localStorage
or deliberately changing the system clock is not prevented. Active income uses a
monotonic clock; invalid/future offline timestamps are rejected and all periods capped.
Multiple concurrently open game tabs are not coordinated. Employee efficiency/level
are stored for future stages but have no skill progression controls. Physical phone
keyboard, notch and browser-toolbar behavior still need device testing. The preexisting
Phaser bundle-size warning remains. No Stage 7, SDK, advertising, monetization or advanced
management systems are implemented.
