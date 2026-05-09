# Tasks

The single list of planned features, improvements, work order and statuses for Tilebreaker.

**How to choose work:** take the first non-struck heading from top to bottom. If a task is too large, it may contain a short checklist, but the separate task order and acceptance still live only in this file.

`todo/current.md` does not contain tasks, next-step, acceptance or statuses. It is only a snapshot of the current version and design context.

---

### ~~[2026-05-08] Define the Tilebreaker core loop~~ DONE

**Status:** core loop redefined in `design/core.md`.

---

### ~~[2026-05-08] Test starting tile feasibility with simulation~~ DONE

**Status:** added `scripts/simulate-tiles.js`; results and conclusions are recorded in `design/tile-feasibility.md`.

---

### ~~[2026-05-08] Day 1: replace the battle placeholder with a playable tile-placement MVP~~ DONE

**Status:** the battle placeholder was replaced by a playable tile-placement round loop: 6x6 board, 7-tile hand from `assets/tiles_v2/tile_manifest.json`, strict edge matching, capture-fill through micro-grid, `area * 2` damage, player/enemy HP, color attacks, round result and board/hand updates. Smoke test completes the full 5-battle loop through real tile placements.

---

### ~~[2026-05-08] Day 1: rebuild the starting deck for capture-fill~~ DONE

**Status:** v2 set lives in `assets/tiles_v2`; `dot/cap` were removed from the MVP deck; simulation uses `assets/tiles_v2/tile_manifest.json`; first battle in strict model: 69/100 wins. Details: `design/tile-feasibility.md`.

---

### ~~[2026-05-08] Day 1: smooth v2 capture-fill volatility~~ DONE

**Status:** `scripts/simulate-tiles.js` switched to `damage = area * 2` and hand smoothing through the best of 3 candidate draws. In the strict model, zero smoothed hands dropped from 94/100 to 75/100, max hit dropped from 144 to 24, and the first battle became 79/100 wins without one-shotting. Details: `design/tile-feasibility.md`.

---

### ~~[2026-05-08] Day 1: move tile-battle parameters into configs~~ DONE

**Status:** v2 tile-battle parameters live in JSON: board, hand, player HP, starting deck size, damage formula and manifest path in `configs/game.json`; enemy HP and color attacks by round in `configs/levels.json`; old `targetScore` values were removed. Smoke test completes the 5-battle loop.

---

### ~~[2026-05-08] Day 1: make readable combat UI~~ DONE

**Status:** combat UI shows player/enemy HP, round number, color attacks, board, hand and round result per color: attack, captured area, capture sum, enemy damage or player damage. Smoke test checks for debug data for per-color results.

---

### ~~[2026-05-08] Day 2: add deck, discard and simple progression between battles~~ DONE

**Status:** starting deck is built from 36 v2 manifest tiles; hands are drawn from draw pile through best-of-3 smoothing, played and remaining tiles go to discard, and an empty draw pile is reshuffled from discard. After a win, the player chooses one of three rewards: add tile, remove tile or boost color multiplier. Smoke test completes the full 5-battle loop with real rewards.

---

### ~~[2026-05-08] Day 2: playtest and tune base balance~~ DONE

**Status:** accepted the persistent board model: between rounds, only closed/scored tiles are cleared, unclosed territory remains for completion, and a full dead-end recovers through fresh start. The simulator reads current JSON configs, collects win rate/rounds/player damage/dead-end rounds and records the balance pass in `design/tile-feasibility.md`. Smoke test completes the full 5-battle loop.

---

### ~~[2026-05-08] Day 3: remove red-square autocomplete and restore fair-run feel~~ DONE

**Status:** normal run now gets a new seed on every start, `guaranteedLoopHands` is off by default, a normal hand is drawn with one fair draw without loop autocompletion from draw pile, and tied attacks no longer choose red as primary color. Smoke test runs through the explicit debug URL `?seed=20260508&guaranteedLoopHands=true`; fair simulation results are recorded in `design/tile-feasibility.md`.

---

### ~~[2026-05-08] Day 3: break minimal-square dominance~~ DONE

**Status:** payoff is now config-driven: minimal area 12 remains the base move, zones larger than 12 receive `largeZoneBonus`, gray micro-cells inside a closed zone receive `grayInteriorBonus`, and combat UI shows the bonus in the result. The simulator compares `close ASAP` vs `payoff`, prints the 2x2 loop versus 3x3 loop with gray tile scenario and metrics for presets `current`, `fewer corners`, `fewer plus`, `fewer both`. Smoke test passes.

---

### ~~[2026-05-08] Day 3: measure minimal-square dominance~~ DONE

**Status:** `scripts/simulate-tiles.js` prints `minimal capture share`, `avg capture area`, `placements before capture`, `zero damage rounds/hands`, `quick 4-corner loop`, first 12 draws and first 12 hand samples by color/shape groups. Baseline is recorded in `design/tile-feasibility.md`: current deck gives 100% small hand captures and 92-98% small captures in battles.

---

### ~~[2026-05-08] Day 3: rebuild starting deck through anti-small-square recipe~~ DONE

**Status:** added `tileBattle.startingDeckRecipe` to `configs/game.json`; game and `scripts/simulate-tiles.js` use one recipe and support duplicate tile ids. Active MVP recipe keeps one copy of each combat v2 tile and adds one extra `tile_gray_blank_01`, 37 tile ids total. Stricter anti-small-square recipes were tested by simulation but postponed: they dry out the first battle faster than they improve zone size. Results are recorded in `design/tile-feasibility.md`; smoke test passes.

---

### ~~[2026-05-08] Day 3: make opening shape bag with cap on corner/plus~~ DONE

**Status:** added `tileBattle.drawBag` to `configs/game.json`: the first 12 future battle draws are reordered from the current draw pile with caps on `corner`/`plus`, minimums for `line`/`tee`, combat color minimums and gray limit. Bag applies once at battle start, remains seedable and does not restore hidden loop guarantee. The simulator compares `current recipe` vs `opening bag`, prints opening composition, zero streak and captures in 3 rounds. Smoke test completes the 5-battle loop.

---

### ~~[2026-05-08] Day 3: try queue mode "current tile + next" with the same metrics~~ DONE

**Status:** added `tileBattle.drawMode` (`hand`/`queue`), URL override `?drawMode=hand`, queue UI with current tile and preview, preview shift after placement, discard for played and skipped queue tiles, debug data and unit test. The simulator supports `DRAW_MODE=queue`, uses beam AI for the smaller decision space and prints the same small-capture/dead-end/zero-streak metrics. Queue is active MVP mode for manual and smoke runs; full-hand remains available for comparison. Active queue starting player HP was raised to 160 so the 5-battle prototype loop remains passable.

**Fix:** after manual check, `offColorLeapOnlyWhenBlocked` was disabled: the selected combat tile can now start a new island one cell away from another color even when direct moves exist elsewhere on the board. This fixes situations where highlighting showed too few valid cells.

**Fix:** gray blank can again be inserted as fill next to colored geometry. The rule is now asymmetric: gray can touch combat tiles when placed, but a combat tile next to already placed gray must still arrive with an empty edge.

---

### ~~[2026-05-08] Day 3: compare hand recipe/bag vs queue and choose MVP mode~~ DONE

**Status:** chose `queue` as active MVP mode, but the problem turned out broader than draw mode: v2 with three colors almost always closed small `area 12` zones. Enabled v3 two-color experiment: `activeCombatColors = ["red", "blue"]`, 25-tile starting deck without `plus`, `gray x1`, opening bag with `corner <= 2`, first two battles without green attacks, add/boost rewards limited to active colors. Simulation `queue + opening bag` on seed `20260508`: battle_01 `21/40` wins, `64%` small captures, `avg area 17.1`. Decision recorded in `design/decisions.md`, `design/tile-feasibility.md`, `todo/current.md` and README.

---

### ~~[2026-05-09] Day 4: build gameplay-variants scaffold and comparison protocol~~ DONE

**Status:** added `tileBattle.gameplayVariant` to `configs/game.json`, URL override `?gameplayVariant=...`/`?variant=a`, shared registry `legacy -> A -> B -> C -> D`, short mode id in combat UI/debug, variant id output in `scripts/simulate-tiles.js`, scorecard in `design/gameplay-variants.md`. Current variant was preserved as `legacy`; `baseline` works as an alias. Main menu temporarily offers `LEG/A/B/C/D`. Smoke test passes the legacy 5-battle loop and the start of the first new variant `placement_payoff`.

---

### ~~[2026-05-09] Day 4 Variant A: placement payoff without closing land~~ DONE

**Status:** `placement_payoff` adds Focus for useful direct-neighbor placement without closure: UI shows `Focus +N` and current cap, Focus does not deal direct damage, accumulates up to `placementPayoff.maxFocus` and is spent only as a bonus to the next closed zone. Also fixed placement legality: free cells without direct neighbors are now valid, and edge conflict is checked only on direct adjacency. Unit/check/smoke pass.

---

### ~~[2026-05-09] Day 4 Variant B: one land color and chain meter for continuous growth~~ DONE

**Status:** `one_color_chain` turns all combat tiles into one land color for placement/capture rules, combines red+blue threat into one land attack, shows `Chain xN` in UI/debug and adds chain bonus to the next capture. Chain grows when continuing the same connected region and resets to base after scoring closure. Unit/check/smoke pass, including smoke completion of the first two battles in Variant B.

---

### ~~[2026-05-09] Day 4 Variant C: points/beacons to connect with land~~ DONE

**Status:** `connect_targets` adds an A/B target pair on the board, treats all combat tiles as one land for connection, combines active attacks into one land lane and gives one-time `connectTargets.bonusDamage` when connected land links both targets. UI/debug highlight targets, distance, connected state and bonus; after successful connection, a new pair appears next round. Unit/check/smoke pass, including smoke completion of the first two battles in Variant C.

---

### ~~[2026-05-09] Day 4 Variant D: road with start and end instead of territory closure~~ DONE

**Status:** `road_mode` is implemented as route-to-target MVP: S/E gates, one-color land, area-capture payoff disabled, short bridge gives only a weak finish bonus, and main damage comes from extra route length beyond the shortest S/E distance: `roadMode.completeBonus + min(extraLength, roadMode.maxScoredExtraLength) * roadMode.damagePerTile`. Scored road-path tiles are cleared between rounds. UI/debug show S/E, distance, road length/extra/damage; after playtest the mode was postponed, and smoke checks URL-playable launch, gates and first placement through `?variant=d`.

---

### ~~[2026-05-09] Day 4: run variants and choose new MVP core~~ DONE

**Status:** manual playtest recorded in `design/gameplay-variants.md` and `design/tile-feasibility.md`. `legacy` chosen as the main rescue candidate; default remains `gameplayVariant: "legacy"`, but `drawMode` changed to `hand`, gray blank removed from active `startingDeckRecipe`, `drawBag.grayMax = 0`. Variant A/mode 2 removed as a standalone direction, one-color/mode 3 postponed, mode 4 kept only as an idea for separate scoring/rotation analysis, mode 5 removed from active comparison. Next favorites: Core 1 Rescue and a separate Kingdomino-like spike.

---

### ~~[2026-05-09] Day 4: Core 1 Rescue - hearts and new-pick cost~~ DONE

**Status:** active `legacy` stays on `drawMode: "hand"` and rescue deck without gray blank; visible combat UI shows only red/blue, HP/damage were converted to hearts, first monster has 3 hearts, minimal 2x2 capture deals 1 heart, and a new pick shows and applies previewed damage `1 + floor(unplayed / 4)` hearts. Pick-pressure scoped to `legacy`, road-mode smoke reduced to URL-playable/gates/first-placement because the mode is postponed. Unit/check/smoke pass.

---

### [2026-05-09] Day 4: Core 1 improvements after hearts

**Idea:** if hearts/pick-pressure gives the battle a clear tempo, strengthen `legacy` with the next core levers: starting universal red/blue center tile, hold one tile, limited rotate and double-color tiles.

**Why:** full-hand already improved agency, and hearts should provide tempo. The next risk is that the player returns to waiting for the one needed card; these levers give more control without restarting the core.

**MVP:**

- add a starting universal red/blue center tile as the plan's anchor;
- add hold for one tile so a bad hand does not turn into full discard;
- test limited rotate as a rare/limited resource, not a free rotate for everything;
- test red/blue double-color tiles as a way to connect plans across two colors;
- introduce levers one at a time and briefly play the first 1-2 battles after each.

**Acceptance:** after the hearts check, one next lever is chosen, enabled in legacy, and the first 3-5 turns give more meaningful decisions without a noticeable return to small-square dominance.

**Priority:** must

**Layer:** MVP

---

### [2026-05-09] Spike: Kingdomino-like colored damage

**Idea:** separately test a Kingdomino-like core: three-color pieces connect by domino logic, colors deal matching damage, and limited piece replacements give control over the draw.

**Why:** if Core 1 Rescue still does not come alive, we need a second favorite built around clear color connection instead of contour closure.

**MVP:**

- describe minimum rules without code: piece format, where the three colors are, how connection works and when damage happens;
- define replacement limit: how many swaps per battle/round and exactly what changes;
- evaluate whether the current tile UI can be reused or a separate quick prototype is needed;
- do not mix with Core 1 until the rescue check gives a stop signal.

**Acceptance:** there is a short rule sketch and lead decision: build a playable spike after Core 1 Rescue or leave it as a post-jam idea.

**Priority:** nice

**Layer:** Jam Stretch

---

### [2026-05-08] Day 3: polish, juice and playable build packaging

**Idea:** bring the prototype to a state where it can be handed to a player without chat explanations.

**Why:** by the end of the 40-hour window, we need a playable build, not only mechanics.

**MVP:**

- valid-cell highlighting;
- captured-area highlighting;
- colored damage numbers;
- clear buttons for ending round and moving on;
- smoke test for launch and main loop completion;
- update README with the current description.

**Acceptance:** the player opens the build, goes through menu -> battle -> result -> upgrade -> next battle and understands the main mechanic without external explanation.

**Priority:** must

**Layer:** MVP

---

### [2026-05-08] Stretch: artifacts and rule breaking

**Idea:** add the first effects that create a Balatro-like feeling of rule breaking.

**Why:** this will strengthen long-term depth, but only after base placement works.

**MVP:**

- 3-5 simple artifacts;
- effects only on multipliers or zone scoring;
- no complex unique enemies.

**Acceptance:** after a win, the player can receive an artifact, and the next battle noticeably changes damage calculation.

**Priority:** nice

**Layer:** Jam Stretch
