# Gameplay Variants Scorecard

The variant scaffold exists to compare core feel fairly, not to develop five games in parallel. All variants launch through one build and one order.

## Comparison Order

1. `legacy` / `LEG` - preserved current `two-color capture-fill`, now tested as `hand` by default.
2. `placement_payoff` / `A` - placement payoff without direct damage for every move.
3. `one_color_chain` / `B` - one land color and chain meter for continuous growth.
4. `connect_targets` / `C` - visible targets/beacons that must be connected with land.
5. `road_mode` / `D` - road with start and end instead of mandatory territory closure.

## Manual Playtest 2026-05-09

General rule for next tests: remove gray blank from the active starting deck and opening bag. In the current form, the blank tile does not create an interesting choice and adds noise to an already fragile draw.

Results across the five tested directions:

- `legacy` / mode 1 - the most playable. Problem: the gameplay imagined in the head too often becomes waiting for the right card. Two colors improved the situation but did not remove it. Next minimum fixes: full-hand instead of queue, starting universal tile in the center, then hold/limited rotate/double colors only if the first pair of fixes does not revive planning.
- `placement_payoff` / mode 2 - does not feel like a separate mode. Focus/balance support may become a local mechanic inside Core 1, but does not solve the main problem on its own. Remove it as a separate direction.
- `one_color_chain` / mode 3 - no idea yet for making one color interesting. Keep in the idea archive, do not spend the next jam slot on it.
- mode 4 - needs separate analysis and likely scoring rotation/redefinition: points can currently feel counted for a chain of cells without a real connection. Do not take as the main core until the target rule becomes fair and readable.
- mode 5 - not interesting; remove from active comparison.

Candidates after the test:

- **Core 1 Rescue** - number one favorite: `legacy`, no gray blank, full-hand, starting universal center like Carcassonne. The fix goal is not "add rules", but remove waiting for the card and give the player a plan from the first move.
- **Kingdomino Combat Spike** - second favorite: three-color pieces/dominoes, color connection as the source of colored damage, limited number of piece replacements. Build as a separate short spike if Core 1 still does not start after rescue.
- **Fiords-like Spike** - potential reference branch, but not first: a full card-by-card Fiords transfer looks too much like a new project and risks eating the playable build.

### Agent And Lead Comments

Game Design Agent: Core 1 conditionally passes, but currently feels like a draw lottery; Kingdomino is promising as a separate prototype, Fiords and double colors are better postponed. Verdict: take Core 1 Rescue and cut scope.

Developer Simplifier: first work order - remove gray blank, hide/close weak modes, enable full-hand, add a central universal starting tile. Stop signal: if after these steps the first 3-5 turns still do not create decisions, switch to a Kingdomino-like core.

Lead position: do not fix all variants at once. The next work slice should be small and testable: Core 1 Rescue. Kingdomino is recorded as a separate review idea, not parallel development.

## Legacy Development: Hearts And Pick Cost

New playtest signal: with a full hand, `legacy` immediately became more playable. This confirms that the problem was not only scoring, but agency: the player needs to see options and plan instead of waiting for the next tile.

Status 2026-05-09: hearts/pick-pressure MVP is implemented in active `legacy`.

Next design turn for `legacy`:

- green removed from visible legacy combat rows: active combat shows red/blue;
- legacy HP/damage are shown as hearts;
- first monster: `3 hearts`;
- small 2x2 square = `1 heart` damage;
- larger closed zones give more hearts through `tileBattle.hearts.zoneDamagePerHeart`;
- every new pick/refill of the hand deals monster damage;
- unplayed tiles increase incoming damage from a new pick through `floor(unplayed / unplayedTilesPerDamage)`;
- battle goal reads as: kill the monster in fewer picks.

Desired new player question: "Should I draw a new hand and take the hit, or can I squeeze one more useful move out of this hand?"

Accepted MVP slice:

1. Heart conversion and pick-pressure apply only to `legacy` so hidden variants do not inherit the new tempo rule.
2. A new pick costs `1 + floor(unplayed / 4)` hearts, with preview shown before confirmation.
3. Minimal matching capture now really hits the monster for 1 heart: equal defense by color counts as enough, instead of requiring strictly beating the threat.
4. Road-mode remains URL-playable, but its smoke is reduced to launch/gates/first placement because the mode was removed from active rescue comparison.
5. The next manual playtest should decide whether hearts/pick-pressure creates clear battle tempo without starting center/hold/rotate.

Risks:

- if a new pick is too scary, the player will stop experimenting and feel system punishment;
- if hearts are too discrete, large zones may stop feeling richer than a small square;
- if the unplayed-tile penalty is not visible before the action, it will feel like a hidden trap.

Next playtest criterion: the player understands how many hearts the monster has left, how many hearts they will lose on a new pick, and can explain victory/defeat by the number of extra picks.

## Launch

Config default lives in `configs/game.json`:

```json
"gameplayVariant": "legacy"
```

URL override for manual playtest:

```text
http://127.0.0.1:5173/?seed=20260508&gameplayVariant=placement_payoff
```

Short aliases are also valid: `legacy`, `baseline`, `a`, `b`, `c`, `d`. `baseline` is kept as a compatible alias for `legacy`.

The game entry temporarily shows only variants kept for discussion. Modes removed after playtest remain available through URL/debug, but are not shown in the menu.

The simulator prints active variant and overall order:

```sh
GAMEPLAY_VARIANT=placement_payoff DRAW_MODE=queue ./scripts/node.sh scripts/simulate-tiles.js 20260508
```

## Manual Scorecard

Scores are given after the first 1-2 battles. Scale: `1` bad, `3` tolerable, `5` want to repeat.

| Variant | Want to grow 5+ cells | Turn goal is clear | Zero turns rare/tolerable | Damage readable | Analysis not sticky | One more run? | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `legacy` | 4 | 3 | 3 | 2 | 3 | 4 | Full-hand immediately improved the game. Next focus: remove green UI noise, switch to hearts, make every new pick a decision with cost. |
| `placement_payoff` | 2 | 2 | 2 | 3 | 3 | 1 | Does not feel like a separate mode. Focus can remain as possible Core 1 support, but remove the direction from active choice. |
| `one_color_chain` |  |  |  |  |  |  | One color does not yet have a clear interesting stake. Archive until there is a new idea. |
| `connect_targets` |  |  |  |  |  |  | Needs separate mode 4 analysis: scoring/goal should require real connection, maybe rotate is needed. |
| `road_mode` |  |  |  |  |  |  | Not interesting in the current form; remove from active comparison. |

## Variant A: Placement Payoff

`placement_payoff` adds Focus on top of the current two-color queue/capture-fill:

- useful placement next to existing land that does not close a zone gives `Focus +1`;
- the first isolated tile and the closing placement do not farm Focus by themselves;
- Focus has a cap from `configs/game.json` (`placementPayoff.maxFocus`);
- Focus does not deal direct damage on placement and converts only on the next captured zone;
- on conversion, all Focus is added as a flat bonus to the largest closed zone and then resets;
- UI shows current Focus, floating `Focus +N` and includes Focus in the final bonus.

Balance run `2026-05-09`, seed `20260508`, real playable/debug:

- legacy on the same debug algorithm: first closure on round 3 dealt 24 damage;
- Variant A: 4 useful setup placements, max Focus 4, first closure on round 3 dealt 36 damage (`24 + Focus 12`);
- conclusion: `bonusPerFocus = 3` is unchanged because max Focus gives half of minimal closure damage and does not replace closure itself;
- risk for the next check: if a manual player starts farming Focus as "spaghetti" without wanting to close land, the first short tuning will be `bonusPerFocus: 2`.

## Variant B: One-Color Chain

`one_color_chain` tests the hypothesis: remove color self-punishment and keep interest in shape, connectivity and growth of one plot.

- all combat tiles in this variant count as one land for edge-match and capture-fill;
- original tile id/color is preserved for deck recipe, draw bag and rewards, but scoring goes into one land lane;
- active color attacks are summed into `red` threat, and `blue/green` threat becomes 0 so the player does not take unavoidable damage from disabled colors;
- Chain grows when a new combat tile continues the same connected region;
- Chain has a cap from `configs/game.json` (`oneColorChain.maxChain`);
- on capture, the next capture receives flat bonus `(Chain - 1) * oneColorChain.bonusPerChain`, then Chain returns to base;
- UI shows `Chain current/max`, `Chain xN` after growth and includes chain bonus in the final bonus.

Auto-check `2026-05-09`, seed `20260508`, real playable/debug:

- unit test checks mixed red-blue land as one land color, chain growth and chain bonus on capture;
- smoke test completes the first two battles through `?variant=b`;
- conclusion: MVP is technically playable, but manual scorecard is still needed because smoke confirms passability, not the feeling of "I want to grow 5+ cells".

## Variant C: Connect Targets

`connect_targets` tests the hypothesis: large land is clearer if the board has an external route goal instead of only abstract closed area.

- an active A/B cell pair exists on the board;
- all combat tiles in this variant count as one land for edge-match, capture-fill and connected land;
- active color attacks are summed into `red` threat, and `blue/green` threat becomes 0;
- if both target cells contain combat tiles and they belong to one connected region, the round gains `connectTargets.bonusDamage`;
- target bonus triggers once per pair, appears in round result/debug and is added to land damage;
- after successful scoring, a new pair appears next round;
- UI highlights A/B on the board, shows distance or bonus in the side panel and gives feedback when connected.

Auto-check `2026-05-09`, seed `20260508`, real playable/debug:

- unit test checks mixed red-blue connected land between A/B, single-lane threat and one-time bonus;
- smoke test completes the first two battles through `?variant=c`;
- conclusion: MVP is technically playable, but manual scorecard is still needed because smoke confirms passability, not manual readability of the goal.

## Variant D: Road Mode

`road_mode` tests the hypothesis: instead of closing territory, it may be clearer and more pleasant for the player to build a route between visible gates.

- an active S/E gate pair exists on the board;
- all combat tiles count as one land for edge-match and connected road;
- area-capture payoff is disabled: closed contours are not the main source of damage in this variant;
- active color attacks are summed into `red` threat, and `blue/green` threat becomes 0;
- if connected land links S/E, the round gains a weak finish bonus and road damage for extra route length;
- `roadLength` is counted as the shortest path through already placed combat tiles between S/E, not the size of the whole connected component;
- `extraLength = max(0, routeEdges - gateDistance)`, so a short direct bridge barely pays, while a detour route hits harder;
- extra bonus is capped by `roadMode.maxScoredExtraLength` so the optimum does not become mandatory infinite winding;
- scored road-path tiles are cleared between rounds, then a new gate pair appears next round;
- UI highlights S/E, shows distance or road bonus in the side panel and includes road length/extra/damage in round result/debug.

Auto-check `2026-05-09`, seed `20260508`, real playable/debug:

- unit test checks short direct bridge as weak finish, detour mixed red-blue road as extra-length payoff, disabled area-capture payoff, single-lane threat and clearing scored road-path tiles;
- smoke test checks that `?variant=d` starts, shows S/E gates and accepts first placement;
- conclusion: the mode remains URL/debug-accessible, but after manual playtest it is not an active rescue candidate. Returning to it requires a separate scoring/rotation review.

## Simulation Metrics

For each variant, record next to manual observations:

- win rate for `battle_01` and `battle_02`;
- `minimal capture share`;
- `avg capture area`;
- `placements before capture`;
- `zero damage rounds` and `max zero streak`;
- `captures in 3r`;
- `dead-end` rounds;
- short conclusion: "variant strengthens the desire to build more than 4 cells: yes/no/uncertain".

## Current Status

The switching scaffold and comparison protocol are ready, but after the manual playtest pass the active choice is narrower. `legacy` as full-hand already feels better, and hearts/pick-pressure MVP is enabled to check battle tempo. Next decision: if tempo became clear, choose one next rescue lever from starting universal center, hold, limited rotate or double-color tiles; if not, move to the Kingdomino-like spike.
