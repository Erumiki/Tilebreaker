# Tile Feasibility Test

Date: 2026-05-08.

Goal: before implementing and tuning the battle scene, check whether the tile-placement battle idea works at all: can we define a starting deck, deal random hands, close colored boundaries, capture land, deal damage and theoretically clear levels.

## Current Status Note

This file is a chronological feasibility log. The current active truth is the Core 1 Rescue snapshot in `todo/current.md` and the core summary in `design/core.md`: `legacy`, `drawMode: "hand"`, 7x7 board, red/blue active colors, 24-card rescue deck, one universal center starter, hold, hearts, hand submit, immediate closure scoring, field resources, monster bounty and the implemented gold card shop.

Older sections below intentionally preserve the experiments that led here. When they mention 6x6, queue as active mode, three active colors, gray in the starting deck, round-end attack damage or the pre-shop upgrade flow, read those details as historical context unless the current status note or config says otherwise.

## Test Model

Script: `scripts/simulate-tiles.js`.

Current parameters:

- 7x7 board from `configs/game.json`;
- 7-card hand;
- active Core 1 Rescue starting deck: 24 red/blue tiles from `startingDeckRecipe`;
- fair draw without loop autocompletion; debug smoothing remains only for smoke/debug overrides;
- opening `drawBag` may reorder the first 12 future battle draws without adding tiles;
- one board-only `starter_universal_line_v` at the center for active `legacy`;
- active default `drawMode` is `hand`; `queue` remains available for comparison;
- closure damage is still computed from area, then active `legacy` converts it to monster hearts;
- active `legacy` scores closures immediately and removes separate player damage from color attack shortage;
- archived variants and older log sections may still use the old round resolver for comparison.

Temporary tile model for the test: each tile is a 3x3 micro-land grid. Tile edges match by a 3-character signature. The current simulation version counts area capture by colored boundary, not closed colored components.

This is not the final tile format, but it is a good topology check: whether closable zones exist, whether they can be grown, and how often the hand is dead.

## Day 3: tiles v3 two-color experiment

After comparing `hand` and `queue`, it became clear that the main problem was not only draw mode: three combat colors fragment the plan, and actual closures almost always remain minimal `area 12`. Rotation is not used as the base fix because it buffs corners too much and cheapens orientation.

Active v3 experiment without new art:

- `activeCombatColors = ["red", "blue"]`;
- green remains in the manifest and UI, but is not part of the starting deck, early rewards or the first two attack tables;
- starting deck is 25 tiles: for red/blue `line_h x2`, `line_v x2`, each `tee` x1, each `corner` x1, `plus x0`, plus `tile_gray_blank_01 x1`;
- opening bag: `corner <= 2`, `plus <= 0`, `line >= 4`, `tee >= 4`, red/blue minimum 4 each, `grayMax = 1`;
- active mode remains `queue`; `hand` is available through `?drawMode=hand` for comparison.

Short run of active `queue + opening bag`:

```sh
HAND_RUNS=40 FIGHT_RUNS=40 QUEUE_BEAM_WIDTH=16 ./scripts/node.sh scripts/simulate-tiles.js 20260508
```

## Day 4: manual playtest and Core 1 Rescue

Manual playtest on 2026-05-09 showed that `legacy` remains the most playable direction, but active `queue + preview` too often turns the game into waiting for the needed card. Two active colors improved the chance to continue a plan, but did not solve the main problem.

Accepted changes for the next tests:

- `drawMode` switched to `hand` so the player sees the whole hand and can plan instead of only waiting for the next tile;
- gray blank removed from active `startingDeckRecipe` because in the current version it is useless and makes reading harder;
- `drawBag.grayMax = 0` so opening tests do not return a blank tile into the early draw;
- starting rescue deck became 24 tiles: red/blue `line_h x2`, `line_v x2`, each `tee` and `corner` x1, no `plus`, no gray blank.

Core 1 follow-up status:

- hearts/pick-pressure became the current `Сдать руку` hand-submit economy: early monsters have 3 hearts, the tuned final battle has `enemyHp: 4`, minimal 2x2 capture = 1 heart, and submit cost is `1 + floor(unplayedHandCards / 4) + floor(handSubmitsThisBattle / 2)`;
- green is removed from visible legacy combat rows and active attack tables;
- the starting universal red-blue center tile is implemented, so the first move is not "find where to start" but "where to develop";
- one hold slot is implemented in hand mode;
- limited rotate and red/blue double-color cards remain later levers after checking the universal starter and the implemented shop/card-pool economy.

Sanity run after config change:

```sh
./scripts/node.sh scripts/simulate-tiles.js 20260508
```

Active `hand + opening bag`, battle_01: `28/40` wins, `71%` small captures, `avg area 15.4`, `zero streak avg 3.8`, `captures in 3r 26/40`. This does not solve core feel by itself, but confirms that the rescue deck without gray blank assembles and the simulator no longer fails.

Key results for battle_01:

```text
wins 21/40 (53%)
captures 44
minimal captures 28/44 = 64%
avg capture area 17.1
zero streak avg 4.8, p75 7
captures in 3r 17/40
dead-end 28/254 rounds
```

For comparison, before v3 the active queue/opening often stayed around `98%` small captures and `avg area` around 12. Conclusion: two-color v3 noticeably improves zone size and reduces minimal-square dominance, but zero streak is still long; the next lever should be found in queue control or setup-round value, not base rotation.

## Day 4: gameplay variants scaffold

Added shared `gameplayVariant` switch to compare legacy and future variants A-D without forking code. Current `queue + two-color capture-fill` is preserved as `legacy`, and old `baseline` remains an alias. At this step, all non-legacy variants still use legacy rules, but they already launch through config/URL, are selectable on the start screen, are visible in UI/debug and are printed by the simulator.

Comparison order and manual scorecard moved to `design/gameplay-variants.md`. Simulation metrics stay the same: win rate, `minimal capture share`, `avg capture area`, `placements before capture`, zero-damage streak, captures in 3 rounds and dead-end rounds.

## Day 3: queue draw experiment

Added mode `tileBattle.drawMode`:

- `queue` - active MVP mode: the player sees the current tile and next preview; only the current tile can be placed;
- `hand` - comparison mode: the player sees the full hand.

Hand can be opened through `?drawMode=hand`, and the queue simulator can be run with:

```sh
DRAW_MODE=queue ./scripts/node.sh scripts/simulate-tiles.js 20260508
```

For queue mode, the simulator uses beam AI instead of random hand permutation. This is an important difference: with current tile and one preview, there are fewer options, so the test player can inspect all valid cells for the current tile and keep several best branches.

Short check `DRAW_MODE=queue HAND_RUNS=8 FIGHT_RUNS=8 QUEUE_BEAM_WIDTH=16`:

- single queue windows most often place 7/7 tiles;
- for `current deck / opening bag`: 1/8 sampled queue windows produced a capture, `avg damage 3.0`, `minimal capture share 100%`;
- `battle_01 / current deck / opening bag`: 5/8 wins, zero streak `avg 3.6`, captures in 3r `5/8`;
- beam AI is noticeably better than the previous greedy evaluation and confirms that queue is easier to test programmatically;
- when captures appear, they are still mostly small `area <= 12`;
- active MVP switched to `queue` so the normal playable build tests exactly current tile + preview.

Conclusion: queue is implemented, measured and enabled by default for manual feel. It reduces branching and makes autotest potentially more reliable, but by itself does not solve minimal-contour dominance. Next step: compare hand recipe/bag vs queue with equal AI strength and manual feel, then decide whether queue remains the final active `drawMode`.

## Scoring Rule Update After Art Check

After the first asset pack, it became clear that center-exit tiles visually read as colored boundaries, not as already filled land. For the MVP, accept a more "land-like" rule:

```text
colored boundary closes -> interior area fills with that color -> score is counted by area
```

Technically, the simulation counts capture through flood fill:

1. Collect all placed tiles into one `boardSize * 3` micro-grid. The active board is currently 7x7, so active checks use a `21x21` micro-grid.
2. For each combat color separately, treat micro-cells of that color as walls.
3. Run flood fill over all cells that are not this color, starting from the outside frame.
4. All non-color micro-cells that flood fill cannot reach count as captured interior. This includes placed cells and empty interior without tiles.
5. Color strength is counted by area `boundary + captured interior`.

Important simulation clarifications:

- use 4-neighborhood; diagonals do not close an area;
- empty macro-cells on the board count as outside air only if connected to the outside area;
- empty area inside a fully closed boundary becomes captured land and scores;
- placed cells of other combat colors inside a closed boundary count as captured interior for the current color;
- red, blue and green are counted independently;
- visual interior fill does not change tile edge signatures;
- old statistics below are useful for placement/topology checks, but damage balance is recalculated under the new area rule.

## v2 Starting Deck For Next Check

For each combat color - red, blue, green:

- `line_h` - horizontal line;
- `line_v` - vertical line;
- `corner_ur`, `corner_rd`, `corner_dl`, `corner_lu` - turns;
- `tee_u`, `tee_r`, `tee_d`, `tee_l` - T-forks;
- `plus` - boundary crossroads, replacement for old `dot`.

Plus 3 gray blank tiles.

Total: 36 tiles.

v2 does not include an ordinary `dot` with a colored cell only in the center: that tile has no edge exit and does not help build a boundary. Base `cap` tiles are also removed from the starting set because they often create stubs instead of closures. They may return later as special/low-power tiles.

## Day 3: payoff against minimal square

Simulation updated for fair draw, persistent board, fresh-start recovery and formula from `configs/game.json`:

```text
damage = area * 2
largeZoneBonus = max(0, area - 12) * 2
grayInteriorBonus = gray tile micro-cells inside captured interior * 1
grayWildcardPlacement = true
```

Control scenario shows why growing now matters:

```text
minimal 2x2 loop:       area 12, area bonus 0, gray bonus 0, damage 24
3x3 loop with gray tile: area 41, area bonus 58, gray bonus 9, damage 149
```

So the minimal square remains a valid safe move, but a large zone with gray fill becomes a separate bet, not decorative overkill without clear payoff.

Run summary `HAND_RUNS=40 FIGHT_RUNS=40 PLACEMENT_ATTEMPTS=40`:

```text
current deck:      hand captures avg 0.1, zero damage 37/40, battle_01 wins 20/40, avg capture area 12.5
fewer corners:     hand captures avg 0.1, zero damage 37/40, battle_01 wins 17/40, avg capture area 13.3
fewer plus:        hand captures avg 0.1, zero damage 37/40, battle_01 wins 15/40, avg capture area 12.9
fewer both:        hand captures avg 0.0, zero damage 39/40, battle_01 wins 12/40, avg capture area 12.6
```

Conclusions:

- Cutting `plus` and `corner` is not included in the MVP config right now: it lowers win frequency and increases waiting for needed pieces more than it grows average area.
- The payoff fix by itself does not make a random bot regularly build large zones; it makes such zones sharply better when the player or a future draw mode can plan them.
- Gray blank now counts as neutral wildcard on placement: it can be placed next to colored boundary and colored boundary can be built next to it, so `grayInteriorBonus` is an achievable rule, not only a formula.
- Next planned levers are queue mode and fair color/pattern bag: they should more often give the player intermediate choices, not only a rare ready loop.

## Day 3: opening draw bag

The simulator and game now read `tileBattle.drawBag` from `configs/game.json`. Bag applies once at battle start and reorders only the nearest future draw window from the current draw pile:

```text
openingDraws = 12
patternCaps = corner <= 3, plus <= 1
patternMinimums = line >= 3, tee >= 4
combatColorMinimums = red/blue/green >= 2
grayMax = 2
```

Control quick run `HAND_RUNS=8 FIGHT_RUNS=8 PLACEMENT_ATTEMPTS=12` on seed `20260508` showed that the window really receives continuers without a ready 4-corner loop:

```text
current recipe opening: green:plus | blue:tee_l | blue:line_h | green:tee_r | ...
shapes: corner:3, line:2, plus:1, tee:6

opening bag: green:corner_dl | red:tee_u | red:plus | blue:line_h | ...
shapes: corner:3, gray:1, line:3, plus:1, tee:4
```

Battle metrics remained mixed: on the small run, `battle_01` stayed at `2/8` wins in current deck, average zone in some battles can grow to `13.3-14.0`, but zero-damage streak can still reach 8 rounds. Conclusion: opening bag fulfills the MVP task for early-window shape, but must not grow into a hidden solver. If manual feel remains dry, the next experiment is queue mode or separate weakening of the small contour.

## Day 3: minimal-square dominance baseline

The purpose of this run is not to change rules, but to measure how much the current draw and heuristic still lead to small `area <= 12` closure.

The simulator now prints additional diagnostic metrics:

- `minimal capture share`: share of closed zones with `area <= 12`;
- `avg capture area`: average capture area;
- `placements before capture`: how many placed tiles happen before the first hand closure;
- `zero damage hands` and `zero ... rounds`;
- `hands with 4-corner loop`;
- first 12 draws: sequence, colors and shape groups `corner/plus/line/tee/gray`;
- first 12 hand samples: color and shape group counters in the deal.

Baseline command:

```sh
HAND_RUNS=40 FIGHT_RUNS=40 PLACEMENT_ATTEMPTS=40 ./scripts/node.sh scripts/simulate-tiles.js 20260508
```

Baseline for `STRICT edge matching / current deck`, seed `20260508`:

```text
first 12 draws:
colors: blue 6, green 3, red 3
shapes: corner 4, line 4, plus 1, tee 3

40 honest hands:
captures avg 0.2
total damage avg 4.2
avg capture area 12.0
minimal capture share 7/7 = 100%
placements before capture avg 6.0
quick 4-corner loops 0/40
zero damage hands 33/40
all tiles placed 40/40

theoretical battles:
battle_01 wins 23/40, captures 52, minimal 48/52 = 92%, avg area 12.9, zero damage 199/250 rounds
battle_02 wins 20/40, captures 55, minimal 53/55 = 96%, avg area 12.6, zero damage 206/258 rounds
battle_03 wins  7/40, captures 56, minimal 55/56 = 98%, avg area 12.2, zero damage 256/309 rounds
battle_04 wins  8/40, captures 61, minimal 60/61 = 98%, avg area 12.4, zero damage 247/303 rounds
battle_05 wins  3/40, captures 59, minimal 57/59 = 97%, avg area 12.4, zero damage 256/312 rounds
```

Comparison with quick deck presets confirms the old risk: simply removing `corner`/`plus` does not solve the problem and mostly lowers passability. In hand tests, all captures in `current`, `fewer corners`, `fewer plus` and `fewer both` again have `avg capture area 12.0` and `minimal capture share 100%`.

Conclusion: the payoff formula already makes large zones valuable in a controlled scenario, but current fair hand draw almost never leads to large zones by itself. The next task should work with starting deck/recipe composition and then opening bag or queue, not damage.

## Day 3: anti-small-square starting deck recipe

Game and simulator now read one source of starting deck: `tileBattle.startingDeckRecipe` in `configs/game.json`. Recipe expands into an array of tile ids and supports duplicates without changing `assets/tiles_v2/tile_manifest.json`.

Accepted MVP recipe is conservative:

- all combat v2 tiles remain one copy each;
- `tile_gray_blank_01` receives a second copy;
- total starting deck is 37 tile ids;
- `add_tile` adds one copy of id, `remove_tile` removes one copy of id.

A stricter checked version with 44 cards, duplicated `line_h/line_v` and 5 gray blanks reduced ready quick loops but dried the first battle hard: `battle_01 wins 10/40` versus baseline `23/40`. Therefore it is not used as active MVP recipe before opening bag.

Command:

```sh
HAND_RUNS=40 FIGHT_RUNS=40 ./scripts/node.sh scripts/simulate-tiles.js 20260508
```

Results for `STRICT edge matching / current deck (37 tiles)`:

```text
first 12 draws:
colors: blue 4, green 4, red 4
shapes: corner 3, line 2, plus 1, tee 6

40 honest hands:
captures avg 0.1
total damage avg 1.2
avg capture area 12.0
minimal capture share 2/2 = 100%
quick 4-corner loops 1/40
zero damage hands 38/40

theoretical battles:
battle_01 wins 14/40, captures 39, minimal 35/39 = 90%, avg area 13.7, zero damage 248/287 rounds
battle_02 wins 15/40, captures 44, minimal 43/44 = 98%, avg area 12.3, zero damage 235/278 rounds
battle_03 wins  3/40, captures 52, minimal 52/52 = 100%, avg area 12.0, zero damage 257/309 rounds
battle_04 wins  8/40, captures 50, minimal 46/50 = 92%, avg area 13.2, zero damage 249/297 rounds
battle_05 wins  0/40, captures 44, minimal 43/44 = 98%, avg area 12.3, zero damage 277/320 rounds
```

Conclusion: recipe as an isolated lever gives a small shift toward larger closures (`battle_01 avg area 13.7`, minimal share 90% instead of 92%), but does not solve the task fully. Harshly cutting `corner/plus` worsens damage frequency and the first battle faster than it improves zone size. The next task `opening shape-bag with cap on corner/plus` remains must: constrain early closer draw by first-draw window, not only total deck composition.

Important interpretation clarification: `zero damage` in the first round is not failure if persistent board saves a useful contour that closes later. For future simulations, watch not only `zero damage rounds/hands`, but a 2-3 round window: zero-streak length, closures after setup round, `dead-end/freshStart`, win rate and player damage. Do not optimize draw toward guaranteed R1 hit: that would again push the system toward hidden loop guarantee and small squares.

## Smoothed v2 capture-fill results

Simulation uses `assets/tiles_v2/tile_manifest.json`, strict edge matching as the main mode, `damage = area * 2` and hand smoothing through best of 3 candidate hands.

### Strict edge matching

100 smoothed hands:

- placed 7.0 of 7 tiles on average;
- all 7 tiles placed in 97 of 100 hands;
- average captures: 0.3;
- average damage: 6.0;
- 75 of 100 hands dealt no damage;
- maximum hand damage: 24.

Theoretical battles without upgrades:

```text
battle_01: 79/100 wins
battle_02: 39/100 wins
battle_03: 17/100 wins
battle_04:  2/100 wins
battle_05:  0/100 wins
```

Conclusion: this fits the 3-minute MVP better for the first battle. Non-zero hands are more frequent than 6%, the maximum hit no longer one-shots the starting enemy at 35 HP, and late battles without upgrades do not become auto-passable.

### Loose adjacency model

100 smoothed hands:

- placed 7.0 of 7 tiles on average;
- all 7 tiles placed in 100 of 100 hands;
- average captures: 0.1;
- average damage: 2.9;
- 88 of 100 hands dealt no damage;
- maximum hand damage: 24.

Theoretical battles:

```text
battle_01: 28/100 wins
battle_02:  2/100 wins
battle_03:  1/100 wins
battle_04:  0/100 wins
battle_05:  0/100 wins
```

Conclusion: the loose adjacency model is still worse than strict for this heuristic. For the MVP, stay on strict edge matching.

## What This Changes

1. Base formula for the first prototype: `damage = captured area * 2`, not `area * area`.

2. First battle should use starting hand/redraw smoothing: choose the best of 3 candidate deals, send the others to discard. This gives the player more early small captures without breaking the deck idea.

3. For the first battle, current theoretical values remain acceptable: `35 HP`, attacks `1-2`, starting player `45 HP`.

4. Late battles in this check do not need to be fair without upgrades. Their balance should be revisited after rewards/progression implementation.

## Balance Pass: persistent board

Hypothesis: if at the start of the next round only closed/scored tiles are removed and unclosed tiles remain on the board, the player can complete territory over several turns. Expected effect: less dead-end feeling after the first tile, more medium captures, more player damage from color shortages, without returning to auto-win.

MVP decision:

- `roundBoardCleanup = clearScoredTiles`: after round result, tiles whose micro-cells participated in a scored zone are removed from the board; unclosed tiles remain.
- `deadEndRecovery = freshStart`: if a new hand cannot continue the saved board at all, the unclosed board is cleared and the player starts a new island with that hand.
- simulator now reads `configs/game.json` and `configs/levels.json`, runs strict edge matching by default; loose baseline can be enabled with `--with-loose`.

Check: seed `20260508`, strict edge matching, 40 smoothed hands, 40 runs of each battle, 40 random placement attempts per hand, damage `area * 2`, player `120 HP`, current HP/attacks from `configs/levels.json`.

```text
smoothed hands:
placed avg 7.0/7, captures avg 0.2, total damage avg 4.2, zero damage 33/40

battle_01: 34/40 wins, avg 4.3 rounds, avg player damage 15.3, dead-end 9/172 rounds
battle_02: 35/40 wins, avg 4.2 rounds, avg player damage 24.4, dead-end 9/167 rounds
battle_03: 25/40 wins, avg 6.2 rounds, avg player damage 53.6, dead-end 17/246 rounds
battle_04: 28/40 wins, avg 6.0 rounds, avg player damage 65.3, dead-end 19/238 rounds
battle_05: 16/40 wins, avg 7.0 rounds, avg player damage 97.7, dead-end 21/282 rounds
```

Conclusion: accept the hypothesis in the MVP. Persistent board makes unclosed pieces useful between rounds, and `freshStart` removes hard "there is a hand, but continuation is impossible" lockups. First battle is forgiving, 2-3 require at least one normal capture, 4-5 already eat a lot of HP and should rely on rewards. For now, leave deck composition unchanged: the next risk is not math, but readability of valid moves and saved unclosed territory.

### Clarification: off-color leap for a blocked tile

Hypothesis: if the selected combat tile has no direct edge-match continuation, allow placing it through one empty cell away from a tile of another combat color. Expected effect: the player can start a new color island next to a blocked board, while direct contour continuation remains the main move.

MVP decision:

- `offColorLeapPlacement = true`;
- `offColorLeapDistance = 2`;
- `offColorLeapOnlyWhenBlocked = true`;
- gray tiles do not use leap so blanks do not create meaningless islands.

Check: seed `20260508`, strict edge matching, 40 smoothed hands, 40 runs of each battle, 40 random placement attempts per hand.

```text
smoothed hands:
placed avg 7.0/7, captures avg 0.3, total damage avg 6.0, zero damage 30/40

battle_01: 31/40 wins, avg 5.9 rounds, avg player damage 22.3, dead-end 21/236 rounds
battle_02: 33/40 wins, avg 4.5 rounds, avg player damage 26.6, dead-end 11/180 rounds
battle_03: 23/40 wins, avg 5.8 rounds, avg player damage 51.9, dead-end 16/233 rounds
battle_04: 27/40 wins, avg 6.5 rounds, avg player damage 72.4, dead-end 21/258 rounds
battle_05: 15/40 wins, avg 6.9 rounds, avg player damage 95.8, dead-end 24/276 rounds
```

Conclusion: accept as a safety valve. The "always leap" variant worsened simulation because the heuristic scattered the board into extra islands. Restricting leap to "only if the selected tile is blocked" preserves the main contour gameplay and gives a way out of blocking.

## Balance Pass: fair draw without guaranteed loop

Hypothesis: if full-loop autocompletion from draw pile is removed, best-of-3 is disabled by default and a normal player gets a new seed every run, the run becomes less repetitive and stops systematically leading to the first red square.

MVP decision:

- `guaranteedLoopHands = false` in normal config;
- `drawRoundHand` in normal run takes one hand from draw pile and does not replace tiles with missing corner-loop pieces;
- fixed seed moved out of normal config: normal start generates a new seed, debug/smoke uses URL `?seed=20260508&guaranteedLoopHands=true`;
- when attacks are tied, `selectPrimaryAttackColor` returns no primary color instead of red.

Check: seed `20260508`, strict edge matching, 40 fair hands, 40 runs of each battle, 40 random placement attempts per hand, damage `area * 2`, player `120 HP`, current HP/attacks from `configs/levels.json`.

```text
honest hands:
placed avg 7.0/7, captures avg 0.1, total damage avg 1.8, zero damage 37/40
red damage avg 0.6, blue damage avg 0.6, green damage avg 0.6

battle_01: 21/40 wins, avg 6.4 rounds, avg player damage 24.9, dead-end 24/256 rounds
battle_02: 23/40 wins, avg 6.5 rounds, avg player damage 40.5, dead-end 29/258 rounds
battle_03: 10/40 wins, avg 7.5 rounds, avg player damage 70.8, dead-end 33/299 rounds
battle_04: 6/40 wins, avg 7.8 rounds, avg player damage 93.1, dead-end 33/310 rounds
battle_05: 6/40 wins, avg 7.7 rounds, avg player damage 112.0, dead-end 31/307 rounds
```

Conclusion: repetition and red bias are removed at normal-run level: seed changes every start, the generator no longer completes a ready loop, and average red/blue/green damage in simulation is equal. Fairness is expensive: first battle dropped to 53% wins and zero hands became 37/40. Do not revert to autocompletion; the next verifiable path is tasks for queue mode and color/pattern bag, to add variety without hidden solution assembly for the player.

## Archive: v2 capture-fill before smoothing

Simulation uses `assets/tiles_v2/tile_manifest.json`: each combat color has `line_h`, `line_v`, four `corner`, four `tee` and `plus`. Empty area inside a fully closed colored boundary counts as captured land.

### Strict edge matching

100 random hands:

- placed 6.9 of 7 tiles on average;
- all 7 tiles placed in 88 of 100 hands;
- average captures: 0.1;
- average damage: 8.6;
- 94 of 100 hands dealt no damage;
- maximum hand damage: 144.

Theoretical battles without upgrades:

```text
battle_01: 69/100 wins
battle_02: 61/100 wins
battle_03: 41/100 wins
battle_04: 34/100 wins
battle_05: 17/100 wins
```

Conclusion: v2 came alive. Strict edge matching does not suffocate placement, and the first battle became passable without upgrades. But damage is too binary: most single hands close nothing, while a rare capture deals 144 damage and often decides the battle in one burst.

### Loose adjacency model

100 random hands:

- placed 7.0 of 7 tiles on average;
- all 7 tiles placed in 100 of 100 hands;
- average captures: 0.1;
- average damage: 7.2;
- 95 of 100 hands dealt no damage;
- maximum hand damage: 144.

Theoretical battles:

```text
battle_01: 30/100 wins
battle_02: 21/100 wins
battle_03: 11/100 wins
battle_04: 11/100 wins
battle_05:  6/100 wins
```

Conclusion: the loose adjacency model is no longer an auto-win. In this heuristic run, it is even weaker than strict because random placement without edge constraints spreads out more often and forms useful rings less often. For the MVP, stay on strict edge matching.

## What The Old Check Showed

1. The v2 `plus/tee/line/corner` set works better than the old `dot/cap` set: capture-fill now creates wins and big payoff moments.

2. The main problem is no longer missing captures, but volatility. 94-95% of single hands deal no damage, while a rare capture hits for 144.

3. Before the battle scene, smooth the first minutes:

   - add more small guaranteed/near-guaranteed closures;
   - lower or change the `area * area` formula;
   - tune starting enemy HP/attacks for rare big hit;
   - test starting hand/redraw/small tutorial capture.

4. Do not return `dot` to the MVP deck as an ordinary tile. If small stable damage is needed, it is better to make a separate special tile with an explicit rule, not a hidden center cell.

## Archive: strict capture model without empty interior

This was an intermediate check: it counted only placed inner micro-cells and gave no points for empty interior. After discussion, closed emptiness was accepted as land too. Therefore, the numbers below show why the old cautious interpretation is unsuitable, not final balance.

### Strict edge matching

100 random hands:

- placed 7.0 of 7 tiles on average;
- all 7 tiles placed in 99 of 100 hands;
- average captures: 0.0;
- average damage: 0.0;
- 100 of 100 hands dealt no damage.

Theoretical battles without upgrades:

```text
battle_01: 0/100 wins
battle_02: 1/100 wins
battle_03: 0/100 wins
battle_04: 1/100 wins
battle_05: 0/100 wins
```

### Loose adjacency model

100 random hands:

- placed 7.0 of 7 tiles on average;
- all 7 tiles placed in 100 of 100 hands;
- average captures: 0.0;
- average damage: 0.0;
- 100 of 100 hands dealt no damage.

Theoretical battles:

```text
battle_01: 0/100 wins
battle_02: 0/100 wins
battle_03: 0/100 wins
battle_04: 0/100 wins
battle_05: 0/100 wins
```

## Archive: old component model

These results were received before switching to the "boundary captures land" rule. They are useful as a placement and old topology volatility check, but are no longer MVP balance.

### Strict edge matching

100 random hands:

- placed 7.0 of 7 tiles on average;
- all 7 tiles placed in 99 of 100 hands;
- average closed zones: 0.9;
- average damage: 9.4;
- 35 of 100 hands dealt no damage;
- maximum hand damage: 101.

Theoretical battles without upgrades:

```text
battle_01: 64/100 wins
battle_02: 40/100 wins
battle_03: 22/100 wins
battle_04:  6/100 wins
battle_05:  2/100 wins
```

Conclusion: the idea works, but the base deck is very volatile. This is good for risk, but the first battle should be softer, and later battles should assume upgrades. Without upgrades, 5 battles should not be cleared consistently.

### Loose adjacency model

100 random hands:

- all hands dealt damage;
- average closed zones: 3.5;
- average damage: 54.3;
- no zero hands.

Theoretical battles:

```text
battle_01: 100/100 wins
battle_02: 100/100 wins
battle_03: 100/100 wins
battle_04: 100/100 wins
battle_05: 100/100 wins
```

Conclusion: if too-free adjacency is allowed, risk nearly disappears. The player regularly gets many closed zones, and combat turns into an auto-win.

## Archive: old MVP decision

1. Build the MVP with strict edge compatibility, but not with single-color squares.

   Tiles need an internal 3x3 or similar structure: lines, caps, corners, islands. Otherwise, closed zones are either impossible or too random.

2. Do not start with attacks like `red 5, blue 3, green 7`.

   For the starting deck, early threats should be in the 1-3 range. Numbers 5-8 are already post-upgrade or late-battle territory.

3. Keep 7 tiles in hand for the first prototype.

   According to simulation, the hand is almost always fully placeable, so edge matching does not suffocate placement itself.

4. Add safe small closures.

   `dot` tiles give the player minimum damage and a clear example of a closed zone. Without such tiles, there will be too many empty rounds.

5. Accept volatility as part of the design, but smooth the first 3 minutes.

   35% zero hands is too much for the first battle. Possible measures:

   - increase the share of small islands;
   - give the first battle low attacks;
   - give the player one guaranteed closed zone in the starting hand;
   - allow one free hand redraw;
   - later add artifacts/upgrades that reduce risk.

6. Treat the loose adjacency model as a fallback, not the foundation.

   It is useful as emergency fallback if strict topology proves too hard for UX, but in the current form it kills tension.

## What To Do Before The First Battle Task

Implement the battle scene around a concrete tile format, not abstract colored squares:

```text
tile = 3x3 micro-land matrix
edge signature = 3 colors per side
capture boundary = micro-cells of one combat color
captured interior = empty or placed micro-cells cut off by the boundary from outside air
damage = (boundary cells + captured interior cells) * 2
```

The current check shows that the micro-grid format and v2 tile set are suitable for the MVP with strict edge matching, linear `area * 2` damage and hand smoothing through the best of 3 candidate deals.
