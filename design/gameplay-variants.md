# Gameplay Variants Scorecard

Каркас вариантов нужен для честного сравнения core-feel, а не для параллельной разработки пяти игр сразу. Все варианты запускаются через один билд и один порядок.

## Порядок Сравнения

1. `legacy` / `LEG` — сохраненный текущий `queue + two-color capture-fill`.
2. `placement_payoff` / `A` — placement payoff без прямого урона за каждый ход.
3. `one_color_chain` / `B` — один цвет земли и chain meter за непрерывный рост.
4. `connect_targets` / `C` — видимые цели/маяки, которые нужно соединить землей.
5. `road_mode` / `D` — дорога с началом и концом вместо обязательного закрытия территории.

## Запуск

Config default лежит в `configs/game.json`:

```json
"gameplayVariant": "legacy"
```

URL override для ручного плейтеста:

```text
http://127.0.0.1:5173/?seed=20260508&gameplayVariant=placement_payoff
```

Короткие алиасы тоже валидны: `legacy`, `baseline`, `a`, `b`, `c`, `d`. `baseline` оставлен как совместимый алиас для `legacy`.

Вход в игру временно показывает picker `LEG/A/B/C/D` на main menu. После выбора нового core этот шаг можно убрать.

Симулятор печатает active variant и общий порядок:

```sh
GAMEPLAY_VARIANT=placement_payoff DRAW_MODE=queue ./scripts/node.sh scripts/simulate-tiles.js 20260508
```

## Ручной Scorecard

Оценки ставятся после первых 1-2 боев. Шкала: `1` плохо, `3` терпимо, `5` хочется повторить.

| Variant | Хочется растить 5+ клеток | Цель хода понятна | Нулевые ходы редки/терпимы | Damage читается | Analysis не вязкий | Еще один забег? | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `legacy` |  |  |  |  |  |  |  |
| `placement_payoff` |  |  |  |  |  |  |  |
| `one_color_chain` |  |  |  |  |  |  |  |
| `connect_targets` |  |  |  |  |  |  |  |
| `road_mode` |  |  |  |  |  |  |  |

## Симуляционные Метрики

Для каждого варианта записывать рядом с ручными наблюдениями:

- win rate по `battle_01` и `battle_02`;
- `minimal capture share`;
- `avg capture area`;
- `placements before capture`;
- `zero damage rounds` и `max zero streak`;
- `captures in 3r`;
- `dead-end` rounds;
- короткий вывод: "вариант усиливает желание строить больше 4 клеток: да/нет/сомнительно".

## Текущий Статус

На этом шаге реализован только каркас переключения и протокол сравнения. `placement_payoff`, `one_color_chain`, `connect_targets` и `road_mode` пока используют legacy-правила, пока их отдельные задачи не добавят механику.
