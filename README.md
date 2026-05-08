# Tilebreaker

Tilebreaker — быстрый roguelite tile-placement battler. Игрок выкладывает тайлы-границы, замыкает территории, захватывает землю цветом границы и отбивает цветовые атаки врага.

Текущий MVP строится вокруг v3 two-color capture-fill эксперимента на v2-арте:

- active gameplay variant: `gameplayVariant: "legacy"`; это сохраненный текущий `queue + two-color capture-fill`; варианты `A-D` уже можно выбрать в меню для будущих экспериментов, но пока они используют legacy-правила до своих отдельных задач;
- тайлы: `assets/tiles_v2/tile_manifest.json`;
- активные стартовые боевые цвета: `red` и `blue`; `green` остается в manifest, но не входит в стартовую колоду и ранние атаки;
- поле: 6x6 macro-тайлов, каждый тайл — 3x3 micro-cells;
- легальность: соседние края должны совпадать по 3-cell edge signature;
- серые тайлы — нейтральная земля: при включенном `grayWildcardPlacement` серый blank можно ставить как fill рядом с серым или боевым тайлом, а боевой тайл рядом с уже лежащим серым должен приходить пустым краем;
- scoring: замкнутая цветная граница захватывает пустую или заполненную внутренность;
- урон считается от площади захвата через формулу из `configs/game.json`: area damage, бонус за размер зоны сверх минимума, бонус за серые тайлы внутри зоны и множитель цвета в текущем забеге;
- активный MVP-режим выдачи — `drawMode: "queue"`: игрок видит текущий тайл и preview следующего, ставить можно только текущий;
- старт боя использует `drawBag`: раннее окно добора переставляется из текущего draw pile так, чтобы ограничить `corner` до 2, не давать ранний `plus`, дать больше `line`/`tee` продолжателей и не превращаться в hidden loop guarantee;
- queue-раунд заранее берет до 7 тайлов из draw pile, но показывает только текущий и preview; несыгранный хвост очереди уходит в discard при конце раунда;
- между раундами закрытые/засчитанные тайлы очищаются, а незакрытая территория остается для достраивания;
- боевой тайл можно поставить через одну пустую клетку от тайла другого боевого цвета, даже если у него есть прямые продолжения в другой части доски;
- забег использует стартовую колоду из `startingDeckRecipe`, draw pile, discard pile и награды между боями; стартовая v3-колода сейчас 25 тайлов: red/blue lines x2, red/blue tees/corners x1, один gray blank, без plus.

## Где Что Хранится

- `configs/game.json` — глобальные настройки tile-battle: размер поля, размер руки, `drawMode`, `gameplayVariant`, `activeCombatColors`, стартовое HP игрока, размер стартовой колоды/recipe, opening `drawBag`, формула урона, бонусы за большую зону и серые тайлы внутри закрытия, путь к активному tile manifest, debug-сглаживание добора, gray wildcard placement, очистка доски между раундами, восстановление после dead-end, off-color leap и число битв в забеге.
- `configs/levels.json` — список битв, HP врагов и цветовые атаки по раундам.
- `assets/tiles_v2/tile_manifest.json` — активный набор тайлов MVP.
- `src/entities/run.js` — состояние забега: колода, добор, сброс, награды и цветовые множители.
- `todo/tasks.md` — единственный backlog, порядок работы, next-step, acceptance и статусы.
- `todo/current.md` — снимок текущей версии и дизайн-контекст без списка задач.

## Запуск

Проект запускается через Vite. Node.js LTS установлен локально в `.tools/`, поэтому используй wrapper-скрипт:

```sh
./scripts/npm.sh run dev
```

Затем открой адрес, который покажет Vite. По умолчанию:

```sh
http://127.0.0.1:5173
```

## Проверки

```sh
./scripts/npm.sh run check
./scripts/npm.sh run test:e2e
```

Обычный запуск создает новый seed для каждого забега. Для стабильного debug/smoke-прогона можно открыть:

```sh
http://127.0.0.1:5173/?seed=20260508&guaranteedLoopHands=true
```

Hand-режим для сравнения можно открыть так:

```sh
http://127.0.0.1:5173/?seed=20260508&drawMode=hand
```

Gameplay-вариант для ручного сравнения можно открыть так:

```sh
http://127.0.0.1:5173/?seed=20260508&gameplayVariant=placement_payoff
```

Или прогнать симуляцию:

```sh
DRAW_MODE=queue ./scripts/node.sh scripts/simulate-tiles.js 20260508
```

С variant id:

```sh
GAMEPLAY_VARIANT=placement_payoff DRAW_MODE=queue ./scripts/node.sh scripts/simulate-tiles.js 20260508
```

На стартовом экране временно есть выбор `LEG/A/B/C/D`; позже этот picker можно убрать, когда будет выбран новый core.

## Стек

- HTML + Vanilla JS + Pixi.js
- Рендеринг и UI через canvas/Pixi.js
- Баланс и настройки через JSON-конфиги
- Документация и рабочие правила в Markdown

## Структура

```
src/       — код игры
assets/    — ассеты
configs/   — баланс, уровни, UI-настройки
design/    — геймдизайн и архитектурные решения
techspec/  — технические спецификации
todo/      — задачи и баги
```

Перед началом работы читай `CLAUDE.md`, `todo/tasks.md`, `todo/current.md`, `todo/bugs.md` и `design/decisions.md`. Порядок задач и next-step есть только в `todo/tasks.md`.
