# Tilebreaker

Стартовый проект Tilebreaker.

## Запуск

Открой `index.html` через локальный web server, чтобы ES-модули и загрузка конфигов работали корректно.

Пример:

```sh
python3 -m http.server 8000
```

Затем открой `http://localhost:8000`.

## Стек

- HTML + Vanilla JS + WebGL
- Рендеринг и UI через canvas/WebGL
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
