# Tilebreaker

Tilebreaker is a fast roguelite tile-placement battler. The player places boundary tiles, closes territories, captures land with the boundary color and counters enemy color attacks.

The current MVP after the manual playtest pass is built around the `legacy` rescue iteration: two-color capture-fill without gray blank, with a full hand by default, two colored center anchors and one hold slot.

- active gameplay variant: `gameplayVariant: "legacy"`; this is the current rescue candidate `hand + two-color capture-fill + hearts/pick-pressure`; Variant A (`placement_payoff`) and Variant D (`road_mode`) were removed from favorites after manual testing, Variant B (`one_color_chain`) is postponed until it has a stronger idea, and Variant C (`connect_targets`) remains an option for separate thought;
- tiles: `assets/tiles_v2/tile_manifest.json`;
- active starting combat colors: `red` and `blue`; `green` remains in the manifest, but is not part of the starting deck, active attacks or visible legacy combat rows;
- board: 7x7 macro tiles, each tile is 3x3 micro-cells;
- legacy battles start with two regular center anchors from the existing tile set: red vertical line at `(3,3)` and blue vertical line at `(4,3)`; the future universal red/blue card is deliberately postponed;
- legality: if a cell has direct neighbors, adjacent edges must match by 3-cell edge signature; an empty cell with no direct neighbors is valid as a new island;
- gray blank tiles remain in the manifest as technical/future material, but are removed from the active starting deck and opening tests;
- scoring: a closed colored boundary captures the empty or filled interior;
- legacy damage is shown as hearts: the first monster has 3 hearts, a minimal 2x2 capture deals 1 heart, and larger zones can deal more through `tileBattle.hearts.zoneDamagePerHeart`;
- a new hand pick in `legacy` has an explicit cost: before confirmation, the UI shows incoming damage from the base cost and unplayed tiles;
- active hand mode has one hold slot: the selected card can be set aside, swapped with another card later and carried across a new pick; it returns to discard when the battle ends;
- active MVP draw mode is `drawMode: "hand"`: the player sees the full hand because queue/playtest too often turned planning into waiting for the right card;
- battle start uses `drawBag`: the early draw window is reordered from the current draw pile to cap `corner` at 2, prevent early `plus`, provide more `line`/`tee` continuation pieces and avoid becoming a hidden loop guarantee;
- queue mode remains available as debug/comparison through `?drawMode=queue`;
- between rounds, closed/scored tiles are cleared and unclosed territory stays for future completion;
- in Variant A, a useful placement without closure next to existing land gives `Focus +1`; Focus does not deal direct damage, accumulates to a cap and is spent as a bonus on the next capture;
- in Variant B, all combat tiles count as one land color for placement/capture rules, attacks are merged into one land lane, and continuing the same connected region increases `Chain xN`; chain is spent as bonus damage on the next capture;
- in Variant C, all combat tiles also count as one land color, but the board has A/B targets instead of Chain: if connected land links both cells, the round gains one-time `connectTargets.bonusDamage`, and a new pair appears next round;
- in Variant D, all combat tiles count as one land color, the board has S/E gates, area-capture payoff is disabled, a short bridge gives a weak finish bonus, and a completed road deals its main damage from extra route length: `roadMode.completeBonus + min(extraLength, roadMode.maxScoredExtraLength) * roadMode.damagePerTile`;
- the run uses a starting deck from `startingDeckRecipe`, draw pile, discard pile and rewards between battles; the starting rescue deck is now 24 tiles: red/blue lines x2, red/blue tees/corners x1, no plus and no gray blank.

## Where Things Live

- `configs/game.json` - global tile-battle settings: board size, hand size, `drawMode`, `holdEnabled`, `gameplayVariant`, `activeCombatColors`, `startingBoardTiles`, starting player hearts, heart conversion and pick-pressure settings, starting deck size/recipe, opening `drawBag`, damage formula, `placementPayoff` for Variant A, `oneColorChain` for Variant B, `connectTargets` for Variant C, `roadMode` for Variant D, active tile manifest path, debug draw smoothing, gray wildcard placement, board cleanup between rounds, dead-end recovery, legacy off-color leap settings and run battle count.
- `configs/levels.json` - battle list, enemy hearts and red/blue color attacks by round.
- `assets/tiles_v2/tile_manifest.json` - active MVP tile set.
- `src/entities/run.js` - run state: deck, draw pile, discard pile, rewards and color multipliers.
- `todo/tasks.md` - the only backlog, work order, next-step, acceptance and status list.
- `todo/current.md` - current version snapshot and design context without a task list.

## Run

The project runs through Vite. Node.js LTS is installed locally in `.tools/`, so use the wrapper script:

```sh
./scripts/npm.sh run dev
```

Then open the address Vite prints. By default:

```sh
http://127.0.0.1:5173
```

## Checks

```sh
./scripts/npm.sh run check
./scripts/npm.sh run test:e2e
```

A normal run creates a new seed for every run. For a stable debug/smoke run, open:

```sh
http://127.0.0.1:5173/?seed=20260508&guaranteedLoopHands=true
```

Queue mode for comparison:

```sh
http://127.0.0.1:5173/?seed=20260508&drawMode=queue
```

Gameplay variant for manual comparison:

```sh
http://127.0.0.1:5173/?seed=20260508&gameplayVariant=placement_payoff
```

Variant B:

```sh
http://127.0.0.1:5173/?seed=20260508&variant=b
```

Variant C:

```sh
http://127.0.0.1:5173/?seed=20260508&variant=c
```

Variant D:

```sh
http://127.0.0.1:5173/?seed=20260508&variant=d
```

Or run the simulation:

```sh
DRAW_MODE=hand ./scripts/node.sh scripts/simulate-tiles.js 20260508
```

With a variant id:

```sh
GAMEPLAY_VARIANT=placement_payoff DRAW_MODE=hand ./scripts/node.sh scripts/simulate-tiles.js 20260508
```

The start screen temporarily keeps only variants that are active for discussion; modes removed after playtest remain available through URL/debug, but do not add noise to the menu.

## Stack

- HTML + Vanilla JS + Pixi.js
- Rendering and UI through canvas/Pixi.js
- Balance and settings through JSON configs
- Documentation and working rules in Markdown
- All repository records are written in English, regardless of conversation language

## Structure

```text
src/       - game code
assets/    - assets
configs/   - balance, levels, UI settings
design/    - game design and architectural decisions
techspec/  - technical specifications
todo/      - tasks and bugs
```

Before starting work, read `CLAUDE.md`, `todo/tasks.md`, `todo/current.md`, `todo/bugs.md` and `design/decisions.md`. Task order and next-step live only in `todo/tasks.md`.
