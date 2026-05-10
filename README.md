# Tilebreaker

Tilebreaker is a fast roguelite tile-placement battler about a defender of a star archive. The player places boundary tiles as magical red and blue wards, closes contours to seal invading monsters, stabilizes space inside those seals and survives by spending hearts only when a new hand is worth the cost.

The current MVP after the manual playtest and fake-shot art pass is built around the `legacy` rescue iteration: two-color capture-fill without gray blank, with a full hand by default, one universal red-blue center starter, one hold slot, Astral Archive presentation and a gold card shop between battles.

- active gameplay variant: `gameplayVariant: "legacy"`; this is the current rescue candidate `hand + universal starter + two-color capture-fill + hearts + hand-submit + field-resource economy`; Variant A (`placement_payoff`) and Variant D (`road_mode`) were removed from favorites after manual testing, Variant B (`one_color_chain`) is postponed until it has a stronger idea, and Variant C (`connect_targets`) remains an option for separate thought;
- active art direction: Astral Archive defense; closed contours are completed seals/wards, monsters lose hearts when their intrusion is cut off, `Сдать руку` is an archive overload paid with living light, detailed guidance lives in `design/art-direction.md`, and accepted style references live in `assets/art_refs/`;
- tiles: `assets/tiles_v2/tile_manifest.json`;
- MVP art contract: `assets/art_mvp/art_manifest.json`, with Astral Archive PNGs generated toward the fake-shot style and artist instructions in `design/art-mvp-brief.md`;
- battle UI layout contract: `design/ui-mockup.md`; runtime coordinates come from `src/scenes/battleLayout.js` and support desktop plus portrait phone layouts;
- battle intro: every battle now starts from a `battleIntro` scene using `configs/levels.json` plus `assets/art_mvp` intro/backdrop/monster art, then enters the board with one `Битва` button;
- active starting combat colors: `red` and `blue`; `green` remains in the manifest, but is not part of the starting deck, active attacks or visible legacy combat rows;
- board: 7x7 macro tiles, each tile is 3x3 micro-cells;
- legacy battles start with one board-only `starter_universal_line_v` at `(3,3)`: a vertical `*` boundary with matrix `.*. / .*. / .*.` that red or blue vertical continuations can attach to;
- universal `*` matches active combat colors for edge legality, blocks flood-fill for the evaluated color, does not make red and blue match directly, and does not add its wildcard cells to capture area/damage;
- legality: if a cell has direct neighbors, adjacent edges must match by 3-cell edge signature; an empty cell with no direct neighbors is valid as a new island;
- gray blank tiles remain in the manifest as technical/future material, but are removed from the active starting deck and opening tests;
- scoring: a closed colored boundary captures the empty or filled interior;
- legacy damage is shown as hearts: early monsters have 3 hearts, the tuned final battle has `enemyHp: 4`, a minimal 2x2 capture deals 1 heart, and larger zones can deal more through `tileBattle.hearts.zoneDamagePerHeart`;
- active `legacy` scores closures immediately after placement: monster hearts, gold and strike feedback update before the next placement or hand submit;
- field resources are board underlays in active `legacy`: gold can be picked up by placing on it or sealed inside a closure, hearts heal only when sealed, and healing is capped by `hearts.maxPlayerHp`;
- monster kill bounty pays the configured `configs/levels.json` `reward` once on victory;
- after non-final victories, the run enters a card shop with 5 offers from `configs/cards.json`; the final MVP active pool is restrained red/blue line, tee, corner and plus/cross cards, while joker/double-card candidates are staged; the player may buy any number they can afford or skip, and bought cards go to discard while also increasing the persistent deck and carrying their final `balanceStatus`;
- `Сдать руку` in `legacy` has an explicit cost: `1 + floor(unplayedHandCards / 4) + floor(handSubmitsThisBattle / 2)`, paid immediately before the hand is redealt;
- an unaffordable dealt hand is a last-chance hand: if the monster survives and the player cannot pay for another hand, the battle ends instead of redealing for free;
- active hand mode has one hold slot: the selected card can be set aside, swapped with another card later and carried across a hand submit; it returns to discard when the battle ends;
- active MVP draw mode is `drawMode: "hand"`: the player sees the full hand because queue/playtest too often turned planning into waiting for the right card;
- battle start uses `drawBag`: the early draw window is reordered from the current draw pile to cap `corner` at 2, prevent early `plus`, provide more `line`/`tee` continuation pieces and avoid becoming a hidden loop guarantee;
- queue mode remains available as debug/comparison through `?drawMode=queue`;
- after immediate scoring, closed/scored tiles are cleared and unclosed territory stays for future completion;
- in Variant A, a useful placement without closure next to existing land gives `Focus +1`; Focus does not deal direct damage, accumulates to a cap and is spent as a bonus on the next capture;
- in Variant B, all combat tiles count as one land color for placement/capture rules, attacks are merged into one land lane, and continuing the same connected region increases `Chain xN`; chain is spent as bonus damage on the next capture;
- in Variant C, all combat tiles also count as one land color, but the board has A/B targets instead of Chain: if connected land links both cells, the round gains one-time `connectTargets.bonusDamage`, and a new pair appears next round;
- in Variant D, all combat tiles count as one land color, the board has S/E gates, area-capture payoff is disabled, a short bridge gives a weak finish bonus, and a completed road deals its main damage from extra route length: `roadMode.completeBonus + min(extraLength, roadMode.maxScoredExtraLength) * roadMode.damagePerTile`;
- the run uses a starting deck from `startingDeckRecipe`, draw pile, discard pile, persistent gold, field resources and card purchases between battles; the starting rescue deck is now 24 tiles: red/blue lines x2, red/blue tees/corners x1, no plus and no gray blank;
- buyable card data lives in `configs/cards.json`: common red/blue line/tee/corner buys, plus/cross as a controlled uncommon buy, price bands, offer rules, final MVP balance statuses and staged joker/double candidates.

## Where Things Live

- `configs/game.json` - global tile-battle settings: board size, hand size, `drawMode`, `holdEnabled`, `gameplayVariant`, `activeCombatColors`, `specialTiles`, `startingBoardTiles`, starting/max player hearts, heart conversion, hand-submit cost, gold/strike economy, field resources, starting deck size/recipe, opening `drawBag`, damage formula, `placementPayoff` for Variant A, `oneColorChain` for Variant B, `connectTargets` for Variant C, `roadMode` for Variant D, active tile manifest path, debug draw smoothing, gray wildcard placement, board cleanup between rounds, dead-end recovery, legacy off-color leap settings and run battle count.
- `configs/levels.json` - battle list, enemy hearts, intro ante/reward preview, kill bounty reward and red/blue color attacks by round.
- `configs/cards.json` - buyable card catalog, shop offer rules, prices, final balance statuses and staged future joker/double semantics.
- `assets/tiles_v2/tile_manifest.json` - active MVP tile set.
- `assets/art_mvp/art_manifest.json` - stable presentation asset ids, states, filenames and Astral Archive PNG contract for the beautiful MVP track.
- `assets/art_refs/` - accepted Astral Archive fake-screenshot references for future monster, UI, backdrop and effect work.
- `assets/art_review/` - visual proof screenshots and contact-sheet checks for art passes, including board-cell valid/invalid hover examples and the buyable-card special pack.
- `design/core.md` - current Core 1 Rescue gameplay summary and boundaries.
- `design/art-direction.md` - accepted Astral Archive defense setting, visual language, monster escalation and asset mapping.
- `design/art-mvp-brief.md` - technical artist brief: safe replacement rules, topology locks, required asset categories and future art-loading plan.
- `design/monster-roster.md` - art-facing list of the five MVP monsters with portrait/icon/backdrop ids and silhouette notes.
- `design/card-pool.md` - accepted GD pass for the universal starter, joker/split card semantics, rough shop costs and validation protocol.
- `design/ui-mockup.md` - named battle layout slots, portrait viewport contract and debug UI states.
- `src/entities/cards.js` - card catalog validation, enabled-offer filtering and special tile extraction for the shop.
- `src/entities/tileBattle.js` - tile placement/scoring rules, including catalog special tiles and two-cell macro-card placement.
- `src/entities/run.js` - run state: deck, draw pile, discard pile, gold, shop offers, card purchases and old debug reward helpers.
- `src/scenes/upgrades.js` - current between-battle card shop scene; the filename is legacy, but the scene name/debug state is `shop`.
- `src/scenes/battleIntro.js` - pre-battle monster presentation scene and responsive intro layout.
- `src/scenes/battleLayout.js` - pure battle layout calculation for desktop and portrait mode.
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

Production build and local preview:

```sh
./scripts/npm.sh run build
./scripts/npm.sh run preview
```

The production build uses relative Vite asset paths (`--base=./`) so the generated `dist/` contents can be packaged as an itch.io HTML5 upload with `index.html` at the ZIP root.

## Checks

```sh
./scripts/npm.sh run check
./scripts/npm.sh run test:e2e
./scripts/npm.sh run build
```

For release QA, run `./scripts/npm.sh run preview` after the build and verify the normal route from the production preview:

```text
menu -> battleIntro -> battle -> result -> shop -> battleIntro -> final
```

Full smoke against an already-running production preview:

```sh
./scripts/npm.sh run test:e2e:preview
```

Regenerate and validate MVP art:

```sh
./scripts/node.sh scripts/generate-art-mvp-placeholders.js
```

Regenerate active tile art without changing tile topology:

```sh
./scripts/node.sh scripts/generate-tile-art-v2.js
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

## Known Limitations

- The current public build is a jam/MVP prototype, not a long progression game.
- Controls are mouse/touch only; keyboard and gamepad controls are not implemented.
- Red and blue ward readability is required; there is no separate colorblind mode yet.
- Best tested in current Chrome, Firefox and Safari.
- Variant URLs remain for debugging, but the normal player route is the `legacy` Core 1 Rescue path.

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
