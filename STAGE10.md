# Stage 10 — Daily tasks, challenges and delivery streaks

The existing Courier Empire project was extended. Personal courier movement, orders, Double/Elite orders, events/choices, districts/mastery, Shop/Garage, statistics, company/employees/upgrades/events, online/offline income, achievements/career/global goals/records, Legacy, joystick/mobile HUD and local saves remain in place. Stage 11 has not started.

## Navigation and availability

**ЗАДАНИЯ** uses the existing secondary menu and ModalUI input/focus/Escape handling. Tabs: **ЕЖЕДНЕВНЫЕ**, **ЧЕЛЛЕНДЖИ**, **СЕРИЯ**. The menu shows the number of claimable rewards, including the daily bonus and completion bonus. Cards scroll vertically, progress bars have accessible labels, and claim buttons are at least 44 pixels tall. The close button remains outside the scrolling area. There is no mandatory tracker over the city.

| System | Player level |
| --- | --- |
| Today's bonus | 1 |
| Three daily tasks | 2 |
| One session challenge | 3 |
| One rotating challenge | 5 |

The first Tasks visit after level 2 shows an introduction explaining that missing a day has no penalty; **ПОНЯТНО** permanently acknowledges it. Thresholds are in `src/config/taskConfig.js`.

## Daily templates: all 28

Targets use the EARLY (levels 1–5), MID (6–11), LATE (12+) tiers, frozen when each task set is generated. `N` is the configured target. Every template has an ID, title, description, category/type, target, progress, reward, requirements, completed/claimed flags and tier. Runtime filters are taken from canonical definitions; saved rewards/targets are not trusted.

| ID | Task | Category / target key |
| --- | --- | --- |
| deliveries | Выполнить N заказов | DELIVERY / delivery |
| earnings | Заработать N ₽ на доставках | MONEY / money |
| reputation | Получить N репутации в игре | REPUTATION / reputation |
| type-STANDARD | Выполнить N обычных заказов | ORDER_TYPE / type |
| type-URGENT | Выполнить N срочных заказов | ORDER_TYPE / type |
| type-FRAGILE | Выполнить N хрупких заказов | ORDER_TYPE / type |
| type-DOUBLE | Выполнить N двойных заказов | ORDER_TYPE / type |
| type-LARGE | Выполнить N крупных заказов | ORDER_TYPE / type |
| type-ELITE | Выполнить N элитных заказов | ORDER_TYPE / type |
| transport-WALKING | Выполнить N заказов пешком | TRANSPORT / transport |
| transport-BICYCLE | Выполнить N заказов на велосипеде | TRANSPORT / transport |
| transport-MOPED | Выполнить N заказов на мопеде | TRANSPORT / transport |
| transport-CAR | Выполнить N заказов на автомобиле | TRANSPORT / transport |
| district-residential | Выполнить N заказов: Спальный район | DISTRICT / district |
| district-center | Выполнить N заказов: Центр | DISTRICT / district |
| district-industrial | Выполнить N заказов: Промзона | DISTRICT / district |
| district-elite | Выполнить N заказов: Элитный район | DISTRICT / district |
| district-business | Выполнить N заказов: Деловой квартал | DISTRICT / district |
| tips | Получить чаевые N раз | EVENT / tips |
| no-failure | Выполнить N заказов подряд без провала | STREAK / streak |
| reach-streak | Достичь серии N в новых доставках | STREAK / streak |
| company-collect | Забрать N ₽ дохода компании | COMPANY / company |
| company-generate | Компания заработает N ₽ | COMPANY / company |
| positive-event | Получить N положительных событий | EVENT / event |
| choice-success | Успешно решить N событий с выбором | EVENT / event |
| fast-delivery | Выполнить N заказов с запасом 20 секунд | DELIVERY / fast |
| session-money | Заработать N ₽ за сегодняшнюю смену | MONEY / money |
| no-complaints | Выполнить N заказов без потери репутации | STREAK / clean |

The saved daily shift can be continued after reopening the game. Session challenges themselves use the current app session.

| Target key | EARLY | MID | LATE |
| --- | ---: | ---: | ---: |
| delivery | 3 | 5 | 8 |
| money (₽) | 800 | 3000 | 8000 |
| reputation | 4 | 10 | 18 |
| type | 1 | 2 | 2 |
| transport | 2 | 3 | 5 |
| district | 2 | 3 | 4 |
| tips | 1 | 2 | 3 |
| streak | 3 | 4 | 5 |
| company (₽) | 1000 | 3000 | 5000 |
| event | 1 | 1 | 2 |
| fast | 1 | 2 | 3 |
| clean | 3 | 5 | 7 |

Exactly three distinct categories are selected. Canonical ownership/unlocks and order eligibility filter transports, districts, Double/Large and Elite. Elite requires level/reputation and at least one unlocked eligible district, rather than the currently selected district. Company income generation needs employees. Collection needs employees or enough existing company balance to complete the target. No spending/hiring/purchase requirements are generated. Date-seeded ordering avoids reload rerolls and prefers definitions outside the previous set.

## Rewards and collection

| Reward | EARLY | MID | LATE |
| --- | --- | --- | --- |
| One daily task | 100 ₽ + 10 XP | 200 ₽ + 20 XP | 350 ₽ + 30 XP |
| All three completed | 200 ₽ + 20 XP + 1 reputation | 400 ₽ + 40 XP + 2 reputation | 700 ₽ + 60 XP + 3 reputation |
| Today's bonus | 300 ₽ | 700 ₽ | 1500 ₽ |
| Rotating challenge | 350 ₽ + 35 XP + 2 reputation | 700 ₽ + 60 XP + 3 reputation | 1200 ₽ + 100 XP + 4 reputation |

Task/rotating/completion rewards are frozen for the generated tier. Today's bonus uses the current tier at claim time. Bonus, tasks and completion bonus have separate one-time claim ledgers. A claim marks the ledger before crediting money/XP/reputation and publishes one state refresh through the existing automatic save subscriber. Opening screens, switching districts and reloading cannot pay a reward twice. Tasks count completion when completed, not when claimed.

Rewards do not count as personal or company lifetime income, do not advance money/reputation tasks, and receive no Legacy multiplier. Normal tasks pay less than typical core delivery earnings for their targets. Stage 10 tasks do not award Legacy points. There is no claim-all control.

## Session and rotating challenges

Only one session challenge is offered/active/completed at a time. All offers are opt-in through **ПРИНЯТЬ** or **ПОЗЖЕ**. No decline penalties. After a claimed reward or postponement, two more completed personal deliveries are required before the next offer. A completed challenge remains available until claimed during that session.

1. **СЕРИЯ ЗАКАЗОВ** — 3 consecutive successful deliveries; failures restart current challenge progress.
2. **БЕЗ ОПОЗДАНИЙ** — next 3 deliveries on time; failures restart current challenge progress. In the current game, late orders fail.
3. **СКОРОСТНАЯ ДОСТАВКА** — one Urgent order with at least 20 seconds remaining.

Each gives **120 ₽ + 10 XP**, manually claimed. Session challenges survive district scene restarts but do not survive a full reload. Historical challenge completion records persist.

One rotating challenge refreshes with daily tasks from: deliveries, bicycle deliveries, Urgent orders, Center deliveries, Industrial deliveries, orders without reputation complaints, personal delivery income. Its target is twice the normal template target and its reward is the tier's rotating reward. Examples: 6/10/16 deliveries, 4/6/10 bicycle deliveries, 2/4/4 Urgent orders, 1600/6000/16000 ₽ earned. Locked bicycle/district tasks are filtered. No seasons, weeks or countdown panels.

## Delivery streak and reward pipeline

Every successful final personal order increments `currentDeliveryStreak` once. Double's intermediate customer handoff changes neither task progress nor streak; the final handoff counts once. Failed orders reset the streak once and keep `bestDeliveryStreak`. Random-event fines or reputation penalties do not reset the streak unless the order actually fails. Missing days or restarting the app does not reset it. There is no extra money fine for streak loss.

| Exact milestone delivery | Automatic reward |
| --- | --- |
| 3 | 10 XP |
| 5 | +5% of that order's base offered payment |
| 10 | +10% of that order's base offered payment + 1 reputation |
| 20 | +15% of that order's base offered payment + 30 XP + 2 reputation |

The bonus cap is **15%**, and the counter can increase indefinitely without increasing money modifiers. These are one-shot milestones within each streak, not permanent multipliers on every subsequent order. A compact **🔥 N** appears from streak 3. Significant thresholds and failures have small notifications.

The existing pipeline remains:

1. Offer: bounded distance payment × order-type/Elite variant × district × district mastery × close-order modifier.
2. Final payout: offered payment + rounded equipment line + rounded temporary demand line + payment-damage line + flat stairs bonus + rounded capped streak line.
3. Streak money uses the same offered-payment base as equipment and demand; they do not multiply each other. Elite and Double use the identical payout pipeline.
4. Delivery XP/reputation still use the existing Legacy modifiers and fractional remainders. Flat streak XP/reputation are added separately, without Legacy amplification. Event tips and company income retain their existing Legacy pipelines.

Task progress receives final personal delivery payment, transport, district/type, actual gameplay reputation, remaining deadline seconds and whether a negative reputation event occurred. Events advance positive-event/choice/tip/reputation goals when resolved. Company income changes and actual collections advance company goals. No task scan runs on every Phaser frame. A 30-second calendar check plus focus/visibility and state mutations handles midnight.

## Achievements and records

Five canonical achievement definitions were added (37 total achievements):

| Achievement | Requirement | Reward |
| --- | --- | --- |
| Разогрелся | Best streak 5 | 20 XP |
| Без ошибок | Best streak 10 | 40 XP |
| Всё по плану | Complete one daily set | 100 ₽ + 15 XP |
| Трудовой день | Complete 25 daily tasks total | 60 XP |
| Люблю челленджи | Complete 10 session/rotating challenges combined | 60 XP |

Rewards are claimed through the existing achievement UI. Records now include best delivery streak, daily tasks completed, total session/rotating challenges completed, and rotating challenges completed. Existing records are preserved.

## Calendar and persistence

Save version **10** adds `dailyTaskDate`, `lastDailyResetDate`, `dailyTasks`, `dailyRewardTier`, `dailyTaskSetCompleted`, `dailyTaskCompletionBonusClaimed`, `lastDailyBonusClaimDate`, `currentDeliveryStreak`, `bestDeliveryStreak`, `rotatingChallenge`, `rotatingChallengeDate`, `rotatingChallengeProgress`, `tasksIntroductionSeen`, `dailyTasksCompleted`, `dailySetsCompleted`, `totalChallengesCompleted`, `rotatingChallengesCompleted`. Task rows include completion and claim states. Session challenge state is deliberately in memory.

`localTaskDate()` is the local calendar adapter. `TaskManager` accepts an injected date provider, so a later stage can replace the source without changing task/reward logic. Validated ISO local date strings are compared against a saved high-water date. An unchanged or earlier date keeps the current set and claim ledger. A later date refreshes daily/rotating tasks and makes one bonus available; no catch-up bonus is paid for missed days. Current/best streak, career, company, statistics and Legacy stay intact.

Loading sanitizes task IDs, categories, targets, tiers, progress, rewards, booleans, counters and calendar dates. Last reset is reconstructed from the latest valid task/rotating/bonus/reset date. Invalid dates are repaired using the current valid local date. Older saves retain every previous asset/system and get zero/default task records plus an eligible current set. No older progress is erased and no historical deliveries count toward newly generated tasks.

## Development controls

Console API, **development build only**:

```js
courierDebug.tasks.regenerate()
courierDebug.tasks.completeDaily(0) // daily card index, default 0
courierDebug.tasks.completeAll()
courierDebug.tasks.nextDay() // advances the injected local date once, preserving ledgers
courierDebug.tasks.setStreak(5)
courierDebug.tasks.resetStreak()
courierDebug.tasks.completeRotating()
courierDebug.tasks.claimBonus() // normal once-per-date validation
```

Debug controls intentionally can regenerate daily sets; they are not present in production. Existing debug controls remain available during development.

## Files

Created: `src/config/taskConfig.js`, `src/data/dailyTasks.js`, `src/managers/TaskManager.js`, `src/state/taskState.js`, `src/ui/TasksUI.js`, `tests/tasks.test.js`, `tests/stage10-browser.cjs`, `STAGE10.md`.

Modified: `index.html`, `src/state/GameState.js`, `src/managers/OrderManager.js`, `src/managers/DeliveryRewards.js`, `src/managers/CompanyManager.js`, `src/managers/EventManager.js`, `src/managers/AchievementManager.js`, `src/data/achievements.js`, `src/managers/DevelopmentCheats.js`, `src/scenes/GameScene.js`, `src/ui/ProgressUI.js`, `src/style.css`, `README.md`, `tests/company.test.js`, `tests/events.test.js`, `tests/orders.test.js`, `tests/long-term-progression.test.js`, `tests/stage9-browser.cjs`, `tests/company-runtime-browser.cjs`. Existing assertions were updated for save version 10, 37 achievements and explicit flat streak rewards; their original gameplay checks remain.

## Verification and limits

`npm run build` succeeds. The existing large Phaser bundle warning remains. `npm test` passes all **110 tests**, including 18 new Stage 10 domain tests. Browser suites exercise desktop 1280×800, portrait 390×844 and 430×932, and landscape 844×390; production checks use desktop/portrait/landscape. Screenshots are saved in ignored `artifacts/stage10/`. Verified daily/login/completion claims, actual deliveries and Double, payout thresholds/failures, sessions/rotating, mobile scrolling, saved reward ledgers, old saves, records/achievements, company, district restarts and debug exclusion. The existing Stage 9 browser suite checks achievements/Legacy/career and delivery/company behavior. No runtime or console errors were reported.

Local storage and the device calendar remain the source of truth. This is simple backward-clock protection, not server-backed anti-cheat. A far-future device date preserves that high-water date after correction until the calendar catches up. Refresh replaces the old daily/rotating set, including its unclaimed rewards. Session challenges restart on full reload. Optional pinning and claim-all are omitted. The current scene's deadlines continue while task dialogs are open, as in existing menus. No platform SDK, monetization, real-world notifications, seasons or Stage 11 systems were added.
