# Tilebreaker

Tilebreaker — быстрый roguelite tile-placement battler. Игрок выкладывает тайлы-границы, замыкает территории, захватывает землю цветом границы и отбивает цветовые атаки врага.

Текущий MVP строится вокруг v2 capture-fill модели:

- тайлы: `assets/tiles_v2/tile_manifest.json`;
- поле: 6x6 macro-тайлов, каждый тайл — 3x3 micro-cells;
- легальность: соседние края должны совпадать по 3-cell edge signature;
- scoring: замкнутая цветная граница захватывает пустую или заполненную внутренность;
- урон сейчас считается от площади захвата через формулу из `configs/game.json`.

## Где Что Хранится

- `configs/game.json` — глобальные настройки tile-battle: размер поля, размер руки, стартовое HP игрока, размер стартовой колоды, формула урона, путь к активному tile manifest, seed и число битв в забеге.
- `configs/levels.json` — список битв, HP врагов, цветовые атаки по раундам и награды.
- `assets/tiles_v2/tile_manifest.json` — активный набор тайлов MVP.
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
