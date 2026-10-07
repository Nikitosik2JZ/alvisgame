# Stage 9 — Achievements, career goals and non-destructive legacy

## Implemented

The existing game continues: courier movement/joystick, orders and events, XP/reputation, shop/equipment, personal garage, districts/mastery/elite orders, company/employees/fleet/upgrades/events, online/offline income, compact mobile HUD and local saves. No reset, new game, prestige reset, ads/SDK, daily/weekly quests, monetization or Stage 10 work.

**ПРОГРЕСС** opens through the existing HUD/secondary menu and uses the same native dialog, input blocking, Escape/focus handling and internal scrolling. Tabs: **КАРЬЕРА**, **ДОСТИЖЕНИЯ**, **РЕКОРДЫ**, **НАСЛЕДИЕ**. Includes overall achievement percentage, career stage count/next milestone, current recommended goal, full career path, eight global goals, cosmetic title selection, category filtering, records and permanent upgrades. Achievement/career notifications are compact non-blocking toasts.

## Career requirements and one-time rewards

| Career milestone | Requirements (all required) | Reward |
| --- | --- | --- |
| 1. Новичок | Default | Титул |
| 2. Пеший курьер | Доставки: 5 | +150 ₽ · +20 XP |
| 3. Велокурьер | Велосипед: 1; Доставки: 15 | +500 ₽ · +40 XP |
| 4. Профи доставки | Уровень: 6; Репутация: 25 | +600 ₽ · +60 XP |
| 5. Автокурьер | Автомобиль: 1 | +800 ₽ · +80 XP |
| 6. Предприниматель | Компания открыта: 1 | +1500 ₽ · +1 очк. наследия |
| 7. Владелец службы доставки | Уровень компании: 2; Сотрудники: 4 | +1500 ₽ · +100 XP |
| 8. Курьерский босс | Уровень компании: 4; Доход компании за всё время: 250 000 | +2000 ₽ · +2 очк. наследия |
| 9. Король города | Районы: 5; Доставки в одном районе: 50 | +3 очк. наследия |
| 10. Курьерский магнат | Уровень: 20; Автомобиль: 1; Районы: 5; Репутация: 100; Уровень компании: 4; Сотрудники: 8; Личный доход за всё время: 500 000; Доход компании за всё время: 1 000 000; Доставки: 100; Открытые обычные достижения: 15 | +5 очк. наследия |

Milestones are independent, irreversible completions: the highest completed milestone provides the canonical career status through the existing careerTitle function. Lower unfinished stages remain visible and claimable later. Transport ownership and company office level alone no longer create conflicting status names. A selected cosmetic title only changes the Courier screen, never gates or gameplay HUD.

States: LOCKED, IN_PROGRESS, COMPLETED, CLAIMED. Completion unlocks titles; money, XP, reputation and legacy points require **ПОЛУЧИТЬ НАГРАДУ**. Every claim validates availability and records the claimed ID before crediting the reward, then persists the entire state via the existing save subscriber. Rewards never count as lifetime personal/company earnings or receive legacy reward multipliers.

## Achievement categories, full list and rewards

ДОСТАВКИ · ДЕНЬГИ · ТРАНСПОРТ · РЕПУТАЦИЯ · РАЙОНЫ · КОМПАНИЯ · СОБЫТИЯ · СЕКРЕТНЫЕ

| Achievement | Category | Requirement | Reward |
| --- | --- | --- | --- |
| Первый заказ | ДОСТАВКИ | Выполните 1 доставку | +50 ₽ · +10 XP |
| Набираю темп | ДОСТАВКИ | Выполните 25 доставок | +200 ₽ · +30 XP |
| Работа есть работа | ДОСТАВКИ | Выполните 100 доставок | +400 ₽ · +60 XP |
| Машина доставки | ДОСТАВКИ | Долгосрочная цель: 500 доставок | +1 очк. наследия |
| Первая тысяча | ДЕНЬГИ | Заработайте лично 1 000 ₽ за всё время | +100 ₽ |
| Уже не бомж | ДЕНЬГИ | Заработайте лично 10 000 ₽ за всё время | +200 ₽ · +20 XP |
| Деньги пошли | ДЕНЬГИ | Заработайте лично 100 000 ₽ за всё время | +500 ₽ |
| Полмиллиона | ДЕНЬГИ | Заработайте лично 500 000 ₽ за всё время | +1 очк. наследия |
| Два колеса | ТРАНСПОРТ | Купите велосипед | +100 ₽ |
| Моторизован | ТРАНСПОРТ | Купите мопед | +200 ₽ |
| Четыре колеса | ТРАНСПОРТ | Купите автомобиль | +300 ₽ |
| Гараж мечты | ТРАНСПОРТ | Соберите весь личный транспорт | +1 очк. наследия |
| Меня уже знают | РЕПУТАЦИЯ | Достигните репутации 25 | +30 XP |
| Любимчик клиентов | РЕПУТАЦИЯ | Достигните репутации 50 | +60 XP |
| Легенда доставки | РЕПУТАЦИЯ | Достигните репутации 100 | +1 очк. наследия · Титул: Легенда доставки |
| Из района в центр | РАЙОНЫ | Откройте Центр | +100 ₽ |
| Знаю город | РАЙОНЫ | Откройте все районы | +2 очк. наследия |
| Как у себя дома | РАЙОНЫ | Достигните максимального мастерства в одном районе | +100 XP |
| Везде свой | РАЙОНЫ | Выполните по 25 доставок в каждом районе | +1 очк. наследия |
| Сам себе начальник | КОМПАНИЯ | Откройте компанию | +50 XP |
| Первый сотрудник | КОМПАНИЯ | Наймите первого сотрудника | +100 ₽ |
| Маленькая команда | КОМПАНИЯ | Соберите 5 сотрудников одновременно | +300 ₽ |
| Бизнес пошёл | КОМПАНИЯ | Компания заработала 100 000 ₽ за всё время | +500 ₽ |
| Империя растёт | КОМПАНИЯ | Компания заработала 1 000 000 ₽ за всё время | +1 очк. наследия |
| Не ваша кола | СОБЫТИЯ | Выиграйте спор с поддержкой | +20 XP |
| Одну картошку... | СОБЫТИЯ | Попадитесь после выбора съесть картошку | +20 XP |
| Везунчик | СОБЫТИЯ | Получите очень редкое положительное событие | +1 реп. |
| Чёрная полоса | СОБЫТИЯ | Переживите два отрицательных исхода подряд | +20 XP |
| Картошка под охраной (hidden) | СЕКРЕТНЫЕ | Откажитесь от соблазна съесть картошку | +15 XP |
| Невидимая картошка (hidden) | СЕКРЕТНЫЕ | Съешьте картошку и останьтесь незамеченным | +15 XP |
| Империя на своих двоих (hidden) | СЕКРЕТНЫЕ | Завершите доставку пешком, владея компанией | +30 XP |
| Особый клиент | ДОСТАВКИ | Завершите элитную доставку | +50 XP |

There are 32 achievements, including three secrets. Locked secrets show **??? / Секретное достижение**, concealing title, description, requirement and reward. The Magnate requirement counts ordinary achievements only; secrets cannot be mandatory. The 500-delivery achievement explicitly identifies its long-term scope.

Definitions live in src/data/achievements.js, career/global requirements and record eligibility in src/config/progressionConfig.js, legacy costs/effects in src/config/legacyConfig.js. No achievement decision logic lives in UI. AchievementManager updates on GameState mutations, not Phaser frames. Completed IDs are skipped and unchanged progress sources are skipped using signatures. Company accrual is still mathematical at the existing interval; progression does not simulate routes or employees.

## Personal and company records

Personal: fastest successful delivery; highest final single delivery payment; biggest single tip; largest money earned from one order (final payout plus separately credited positive event income); highest reputation; highest player level; completed and failed deliveries; lifetime personal income; delivered route distance; rare/very rare personal events experienced.

Fastest delivery uses monotonic elapsed time from acceptance to successful final handoff, including approach, waiting and event dialogs. It requires a route of at least **200 game meters**, configurable as RECORD_SETTINGS.minimumRouteMeters. Zero/invalid time and shorter routes are ineligible. Worse results never overwrite a record. Double deliveries produce a single full-route record at final completion. Company collections, development wallet credits and progression rewards do not inflate personal lifetime income.

Company: peak actual income per minute; lifetime earnings; maximum simultaneous employee count; highest employee level; highest lifetime earnings of an individual employee. Historical maxima survive load, employee state changes and district scene restarts. Records are read-only in the UI.

## Global goals and suggested main goal

1. Купить автомобиль
2. Открыть компанию
3. Нанять 5 курьеров
4. Открыть все районы
5. Выполнить 100 заказов
6. Заработать 500 000 ₽ лично
7. Заработать 1 000 000 ₽ компанией
8. Стать Курьерским магнатом

Suggested goal updates automatically: next unowned personal transport, next district (live level/reputation/wallet/transport requirements), company opening, incomplete career/global goal, mastery across all districts, remaining ordinary achievement, then improving personal/company records after all fixed goals are complete. Suggestions do not force player actions.

## Magnate and continued play

The final milestone requires all ten configured conditions: level 20, car owned, all five districts, current reputation 100, company level 4, eight simultaneous employees (office capacity is 12), 500,000 ₽ lifetime personal income, 1,000,000 ₽ lifetime company income, 100 successful personal deliveries, 15 ordinary achievements unlocked. Already completed milestones stay complete if reputation later drops.

The one-time celebration appears inside Progress when first viewed after completion. magnateCelebrationSeen is persisted when displayed, preventing repeats after closing/reopening/reload/district restarts. The cosmetic title unlocks on completion; the +5 legacy reward still requires an explicit claim. There is no game-over state. Deliveries, company income, district mastery, other achievements and records continue.

## Legacy points, upgrades and modifiers

Point sources (all manually claimed): Entrepreneur +1, Boss +2, City King +3, Magnate +5; Machine Delivery +1, Half Million +1, Dream Garage +1, Delivery Legend +1, Know the City +2, Everywhere Familiar +1, Empire Grows +1. Available and lifetime-earned points are persisted separately; upgrades charge once.

| Upgrade | Cost in points | Permanent effect |
| --- | --- | --- |
| Опытный курьер | 1 | +3% личного опыта |
| Хорошая репутация | 2 | +5% наград репутации |
| Деловая хватка | 2 | +3% дохода компании, включая офлайн |
| Щедрые клиенты | 3 | +5% чаевых |
| Знание города | 3 | +3% скорости движения |

All upgrades are one-time. ProgressionModifiers centralizes effects. XP/reputation rewards retain fractional remainders across saves, so +3%/+5% remain accurate even for small integer rewards. Negative reputation/fines are unaffected; claimed progression rewards are unaffected. Tips multiply existing district/reputation/VIP modifiers and round once. Movement multiplies the existing transport/shoe speed and still composes with weather/temporary event modifiers. Company income applies to online/offline work and event bonuses, including storage calculations; elapsed company time is settled at the old rate before purchasing an upgrade. Company event UI reports the actual credited amount.

## Migration and existing achievement derivation

Save version is now 9 with the unchanged localStorage key courier-empire-save-v1. Existing migration logic for earlier equipment, transports, company workforce/fleet and districts remains. New fields default safely: empty completion/claim arrays, zero points, empty upgrades, null selected title, false celebration flag, zero event counters/reward fractions, empty records. Existing totalMoneyEarned is the lifetime personal earnings source; it is never replaced by wallet money. Existing companyLifetimeEarnings remains the company source.

On load, valid IDs are deduplicated and unknown IDs rejected. Claimed IDs prove completion. Owned vehicles, unlocked districts, company state, proven delivery/lifetime earnings counters, current reputation/level and district mastery derive all achievements/milestones already earned, silently, with no automatic payout. Known district best payout migrates into delivery/order records; current employees derive employee records; current reputation/level derive their maxima. Existing saved record maxima are retained. Missing timing, single-tip or historical event data defaults safely instead of inventing facts or requiring already proven achievements to be repeated. Claimed rewards, legacy points/upgrades and cosmetic title survive reload. Session-only negative event streaks are not reconstructed across offline breaks.

The tests use isolated Chrome contexts and synthetic historical saves; the user's actual browser profile/save is never overwritten.

## Development controls

Existing shortcuts remain. Development-only console API:

`courierDebug.progression.completeNextCareer()` — satisfy the next incomplete milestone's configured requirements.

`courierDebug.progression.addLegacy(amount = 1)` — add points.

`courierDebug.progression.unlockAchievement(id = 'first-order')` — unlock one definition and test its toast.

`courierDebug.progression.setLifetimeEarnings(personal, company)` — set known lifetime counters without adding wallet money.

`courierDebug.progression.setDeliveries(count)` — set delivery count.

`courierDebug.progression.testMagnate()` — satisfy every configured endgame requirement without resetting assets.

`courierDebug.progression.rederiveAchievements()` — clear/rebuild unlock IDs while preserving claimed reward ledgers, legacy and all assets. Proven statistics immediately restore corresponding achievements. No reward-farming reset is provided.

All controls use import.meta.env.DEV and are absent in production. Normal gameplay and UI provide no debug button.

## Created files

- src/config/progressionConfig.js
- src/config/legacyConfig.js
- src/data/achievements.js
- src/managers/AchievementManager.js
- src/managers/ProgressionModifiers.js
- src/state/progressionState.js
- src/ui/ProgressUI.js
- tests/long-term-progression.test.js
- tests/stage9-browser.cjs
- STAGE9.md

## Modified files

- index.html
- README.md
- src/config/transportConfig.js
- src/managers/CompanyManager.js
- src/managers/CompanyEventManager.js
- src/managers/DevelopmentCheats.js
- src/managers/EventManager.js
- src/managers/OrderManager.js
- src/scenes/GameScene.js
- src/state/GameState.js
- src/style.css
- src/ui/CompanyUI.js
- src/ui/OrderUI.js
- src/ui/PlayerProfileUI.js
- tests/company.test.js
- tests/company-runtime-browser.cjs
- tests/districts.test.js
- tests/district-browser.cjs
- tests/events.test.js
- tests/orders.test.js
- tests/transports.test.js

Historical tests were updated only where Stage 9 intentionally changes the save version, career gates or adds records/completion IDs to full snapshot comparisons. Other gameplay assertions remain.

## Validation and known limits

The initial production build and existing physical movement/collision/pickup/delivery/timer/failure browser harness passed before implementation. The final test suite includes 92 passing tests (78 existing plus 14 Stage 9 tests). It covers claims/reload/duplicate rejection, migration/defaults/snapshot isolation, current career requirements and cosmetic titles, hidden achievements/event outcomes/negative protection, best/worse/short-route records, all five bonuses, small fractional XP/reputation, online/offline company rates, all-district completion, every Magnate gate, ordinary achievement counting, one-time celebration, changing main goals and continued deliveries.

Stage 9 Chrome checks cover 1280×800, 390×844, 430×932 and 844×390: legacy save preservation, all tabs/categories, hidden reveal, unlock notifications, actual claim and upgrade buttons, title selection/Courier display, reload, Magnate celebration and non-duplication, actual delivery input/records, company and district screens, scrolling bounds and reachable close controls. Production checks cover 1280×800, 390×844 and 844×390 with migration, real claim/upgrade buttons, reload and development API absence. Screenshots in ignored artifacts/stage9 were visually inspected. Existing Stage 8 browser checks cover five districts × four transports, events, elite orders, mastery, transitions/restarts/reload and five viewports including 320×568. Existing company runtime checks cover development typing guards, production/offline XP/candidates/hiring/upgrades. Browser runtime/console errors: none.

Build: successful, existing Phaser bundle-size warning remains (about 1.36 MB minified / 367 KB gzip). npm is absent from this host PATH/runtime, so the exact package.json build script was executed using bundled pnpm run build and Vite; tests used bundled Node (the final package test script also works with process permission). No dependencies or lockfile were changed. Git commit/push result is reported in the delivery message.

Limitations: local-only saves and leaderboards remain as before; localStorage can still be manually edited, so duplicate-claim protection is consistency protection, not server security. No historical timing/tip/event facts can be reconstructed when old saves never stored them. Fastest time measures game-route eligibility, not validated physical pathfinding (the prototype has no pathfinding). Legacy is permanently additive with no reset or respec. Notification toasts are session UI; achievements/claims persist. Balance values are configurable prototype defaults.
