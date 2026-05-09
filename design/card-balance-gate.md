# MVP Card Balance Gate

Date: 2026-05-09.

Purpose: decide which shop card families are safe enough for the jam MVP before the config sync pass. This is a balance gate, not the final config update.

## Protocol

Command:

```sh
CARD_BALANCE_RUNS=40 ./scripts/node.sh scripts/simulate-card-balance.js
```

Fixed seeds:

- full-run scenarios: `20260508 + run_index * 9973`, 40 runs;
- forced-draw probes: same seeds plus `555555`;
- starting config: active `legacy`, 7x7 board, full hand, universal center starter, hold enabled in config but the balance bot does not use hold;
- bought ordinary-card use is family-level after first purchase because ordinary bought cards share ids with starting-deck cards;
- bought special-card use is exact by id for `joker_line_v` and `double_red_line_h`;
- forced top-deck probes inject one bought card into the target battle's next draw. Use those probes to judge card risk/readiness, not shop economy.

Bot limitation: the bot is a deterministic comparison player, not a human playtest. It is good for relative risk signals: whether a family increases small closures, reduces submits, creates dead ends, or wastes shop money under fixed conditions.

## No-Shop Baseline

| Battle | Reached | Wins | Submits avg | Gold avg | Closures avg | Minimal share | Avg area | Dead-end submits | Fresh starts | HP avg |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| battle_01 | 40 | 20/40 (50%) | 5.5 | 5.5 | 1.2 | 28/47 (60%) | 17.7 | 35/220 (16%) | 8 | 6.9 |
| battle_02 | 20 | 8/20 (40%) | 4.3 | 4.9 | 0.8 | 7/16 (44%) | 21.1 | 8/87 (9%) | 0 | 4.5 |
| battle_03 | 8 | 0/8 (0%) | 3.1 | 3.3 | 0.4 | 3/3 (100%) | 12.0 | 3/25 (12%) | 0 | 2.6 |

Read: the baseline bot can prove battle 1 and battle 2, but battle 3 is still outside this bot's reliable full-run reach. Late-card decisions therefore lean on forced-draw probes.

## Full-Run Shop Signals

| Scenario | Purchases | Bought families | Battle 2 wins | Battle 3 wins | Key signal |
| --- | ---: | --- | ---: | ---: | --- |
| forced line | 24 | line:24 | 4/20 (20%) | 0/4 (0%) | Repeated line buying diluted the run; do not overweight lines. |
| forced tee | 26 | tee:26 | 6/20 (30%) | 0/6 (0%) | Tees did not rescue enough to justify high offer pressure. |
| forced corner | 28 | corner:28 | 6/20 (30%) | 2/6 (33%) | Best common late signal, but still needs cap/cost discipline. |
| forced common pool | 49 | corner:14, line:18, tee:17 | 5/20 (25%) | 0/5 (0%) | Buying too many commons is actively bad for this bot. |
| forced plus/cross | 28 | plus:28 | 8/20 (40%) | 1/8 (13%) | Neutral-to-positive; no small-loop explosion in full-run. |
| forced joker line | 24 | joker_line:24 | 4/20 (20%) | 0/4 (0%) | Guaranteed joker is a bad spend in this protocol. |
| forced double line | 9 | double_line:9 | 8/20 (40%) | 1/8 (13%) | Too little full-run exposure; not enough to approve. |
| live generated shop | 46 | joker_line:26, line:5, tee:15 | 5/20 (25%) | 1/5 (20%) | Current live shop over-buys guaranteed joker/tee and underperforms baseline. |

## Forced-Draw Probes

| Probe | Target battle | Wins | Submits avg | Closures avg | Minimal share | Avg area | Dead-end submits | Bought-use placements | HP avg |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| common line | battle_02 | 17/40 (43%) | 5.5 | 1.1 | 28/46 (61%) | 17.9 | 45/222 (20%) | 35% | 6.2 |
| common tee | battle_02 | 17/40 (43%) | 5.7 | 1.1 | 29/46 (63%) | 17.0 | 44/227 (19%) | 36% | 5.8 |
| common corner | battle_02 | 15/40 (38%) | 6.0 | 0.9 | 25/38 (66%) | 16.8 | 57/241 (24%) | 36% | 5.0 |
| plus/cross | battle_02 | 19/40 (48%) | 5.4 | 1.2 | 29/48 (60%) | 17.6 | 42/216 (19%) | 4% | 6.7 |
| joker line | battle_02 | 14/40 (35%) | 6.0 | 1.0 | 27/41 (66%) | 17.1 | 50/238 (21%) | 4% | 5.0 |
| double line | battle_03 | 6/40 (15%) | 6.3 | 0.8 | 23/32 (72%) | 16.3 | 82/250 (33%) | 3% | 4.0 |

## Decisions

| Family | Decision | Sync action | Rationale |
| --- | --- | --- | --- |
| Common line | Keep, but do not increase pressure. | Keep cost 2 and max 2; lower/keep conservative offer weight. | Forced-draw is neutral/slightly above battle 2 baseline, but repeated forced buys harmed battle 2. Useful as a cheap bridge, not a dominant buy. |
| Common tee | Keep with lower offer pressure. | Keep cost 3; reduce offer weight from the current aggressive common value. | Tees are readable branch tools, but full-run and live-shop results show too many tee buys dilute the deck. |
| Common corner | Keep with cap discipline. | Keep cost 4, max 1 per shop, low offer weight. | Corners are the best common late signal and did not create automatic 2x2 dominance, but the forced probe still had 66% minimal closures. |
| Combined common pool | Keep only as a restrained pool. | Avoid tuning that encourages two common buys per shop. | Forced common pool underperformed baseline: battle 2 fell to 25% and battle 3 to 0/5. |
| Plus/cross | Keep for MVP. | Keep cost 6, unlock battle 2, max 1, low offer weight. | It was neutral in full-run and best in battle 2 probe (48%) without raising minimal share above baseline. Low use rate suggests it is a situational tool, not an auto-solver. |
| Guaranteed `joker_line_v` | Disable/stage for MVP. | Remove guaranteed offer and set the family staged/disabled unless a human lead explicitly overrides. | Forced and live-shop runs were worse than baseline; the guaranteed shop bought it often, but use stayed low and battle 2 fell to 20-25%. It did not prove blocked-hand recovery. |
| `double_red_line_h` | Disable/stage for MVP. | Set staged/disabled for final MVP. | Full-run exposure was thin, and the battle 3 forced probe was weak: 15% wins, 72% minimal closures, 33% dead-end submit rate. The two-cell placement/readability risk is not justified for jam final. |
| Stronger joker/double candidates | Keep staged. | Leave `joker_corner`, `joker_tee` and `double_curve` disabled/staged. | The weaker joker and first double-line did not pass the gate, so stronger variants should not enter MVP by inertia. |

Final MVP card-pool decision before sync: ordinary red/blue line, tee, corner and plus/cross can remain in the active MVP shop with restrained weights/caps; `joker_line_v`, its guarantee and `double_red_line_h` should leave the final MVP active pool.

Sync result: `configs/cards.json` now removes the guaranteed joker offer, lowers common offer pressure, carries final `mvp_keep_*` statuses for active families and stages `joker_line_v`/`double_red_line_h` with `mvp_staged_after_gate` rationale.
