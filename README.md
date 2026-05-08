# Tilebreaker

Стартовый проект Tilebreaker.

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

Перед началом работы читай `CLAUDE.md`, `todo/tasks.md`, `todo/bugs.md` и `design/decisions.md`.
