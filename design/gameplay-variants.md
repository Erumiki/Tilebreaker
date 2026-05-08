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
| `placement_payoff` | 4 | 4 | 3 | 4 | 4 | 4 | Seed `20260508`: Focus набрался до cap за setup-раунды и дал +12 к первому closure; это заметно, но не ломает closure. |
| `one_color_chain` |  |  |  |  |  |  | Реализован MVP: один land-color, `Chain xN`, single-lane threat; smoke seed `20260508` проходит первые 2 боя. Нужен ручной scorecard. |
| `connect_targets` |  |  |  |  |  |  |  |
| `road_mode` |  |  |  |  |  |  |  |

## Variant A: Placement Payoff

`placement_payoff` добавляет Focus поверх текущего two-color queue/capture-fill:

- полезная постановка рядом с существующей землей, которая еще не закрывает зону, дает `Focus +1`;
- первый изолированный тайл и закрывающая постановка сами по себе Focus не фармят;
- Focus имеет cap из `configs/game.json` (`placementPayoff.maxFocus`);
- Focus не наносит прямой урон на placement и конвертируется только при следующем captured zone;
- при конвертации весь Focus добавляется как flat bonus к самой большой закрытой зоне и сбрасывается;
- UI показывает текущий Focus, всплывающий `Focus +N` и включает Focus в итоговый bonus.

Баланс-прогон `2026-05-09`, seed `20260508`, real playable/debug:

- legacy на том же debug-алгоритме: первый closure в 3-м раунде нанес 24 damage;
- Variant A: 4 useful setup placements, max Focus 4, первый closure в 3-м раунде нанес 36 damage (`24 + Focus 12`);
- вывод: `bonusPerFocus = 3` оставлен без изменения, потому что max Focus дает половину минимального closure damage и не заменяет сам closure;
- риск для следующей проверки: если ручной игрок начнет фармить Focus "лапшой" без желания закрывать землю, первым коротким tuning будет `bonusPerFocus: 2`.

## Variant B: One-Color Chain

`one_color_chain` проверяет гипотезу: убрать цветовое само-наказание и оставить интерес в форме, связности и росте одного участка.

- все combat-тайлы в этом варианте считаются одной землей для edge-match и capture-fill;
- оригинальные tile id/color сохраняются для deck recipe, draw bag и наград, но scoring идет в одну land-линию;
- атаки активных цветов складываются в `red` threat, а `blue/green` threat становятся 0, чтобы игрок не получал unavoidable damage за выключенные цвета;
- Chain растет, когда новый combat-тайл продолжает тот же connected region;
- Chain имеет cap из `configs/game.json` (`oneColorChain.maxChain`);
- при capture следующий захват получает flat bonus `(Chain - 1) * oneColorChain.bonusPerChain`, затем Chain возвращается к базовому состоянию;
- UI показывает `Chain current/max`, `Chain xN` после роста и включает chain bonus в итоговый bonus.

Авто-проверка `2026-05-09`, seed `20260508`, real playable/debug:

- unit-тест проверяет смешанную красно-синюю землю как один land-color, рост chain и chain bonus на захвате;
- smoke-тест проходит первые две битвы через `?variant=b`;
- вывод: MVP технически playable, но ручной scorecard еще нужен, потому что smoke подтверждает проходимость, а не ощущение "хочется растить 5+ клеток".

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

Каркас переключения и протокол сравнения готовы. `placement_payoff` реализован как Focus-эксперимент без прямого урона за placement. `one_color_chain` реализован как one-land-color + Chain MVP. `connect_targets` и `road_mode` пока используют legacy-правила, пока их отдельные задачи не добавят механику.
