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

**Status:** active `legacy` stays on `drawMode: "hand"` and rescue deck without gray blank; visible combat UI shows only red/blue, HP/damage were converted to hearts, early monsters have 3 hearts, minimal 2x2 capture deals 1 heart, and a new pick shows and applies previewed damage `1 + floor(unplayed / 4)` hearts. Pick-pressure scoped to `legacy`, road-mode smoke reduced to URL-playable/gates/first-placement because the mode is postponed. Unit/check/smoke pass.

---

### ~~[2026-05-09] Day 4: Core 1 improvements after hearts~~ DONE

**Idea:** if hearts/pick-pressure gives the battle a clear tempo, strengthen `legacy` with the next core levers.

**Why:** full-hand already improved agency, and hearts should provide tempo. The next risk is that the player returns to waiting for the one needed card; a center anchor and one hold slot give more control without restarting the core.

**MVP:**

- postpone the universal red/blue card to the next task;
- add two existing center cards of different colors instead: red vertical line and blue vertical line;
- increase the arena to 7x7;
- add one Tetris-like hold slot for the selected hand card;
- keep the anchors as ordinary board tiles, not special art or a new universal type;
- keep the held card through a non-lethal new pick, but return it to discard when the battle ends;
- sync logic tests, smoke and simulator with the 7x7 starter board and hold behavior.

**Acceptance:** `legacy` starts on a 7x7 board with two ordinary center anchors, the first hand can immediately continue either color, one selected card can be held/swapped across a new pick, and universal-card work is explicitly queued next.

**Status:** implemented `startingBoardTiles` in config, seeded `legacy` with `tile_red_line_v` at `(3,3)` and `tile_blue_line_v` at `(4,3)`, reset fresh-start recovery to the configured starter board, added `holdEnabled` hand-mode hold/swap that survives non-lethal new picks, updated smoke/unit/simulator coverage and README/current docs.

**Priority:** must

**Layer:** MVP

---

### ~~[2026-05-09] Design pass: hand-submit economy, gold and feedback~~ DONE

**Status:** done as a design pass. Decisions are recorded in `design/gameplay-variants.md`, `design/signs-and-feedback.md`, `design/decisions.md` and synced to `todo/current.md`: `Сдать руку` uses `1 + floor(unplayedHandCards / 4) + floor(handSubmitsThisBattle / 2)`, pays immediately, immediate closure scores at placement time, monster attack damage is removed from active Core 1, gold/strike rewards are specified, and card/shop buying is postponed to a later pass.

---

### ~~[2026-05-09] UIX pass: signs and feedback inventory~~ DONE

**Status:** inventory filled for the next implementation pass in `design/signs-and-feedback.md`, including button labels, battle-log strings, animation timing priorities, gold/strike feedback and debug/test signals. Future shop/buy feedback remains explicitly later.

---

### ~~[2026-05-09] Core 1 implementation: hand submit, immediate closure and gold~~ DONE

**Idea:** implement the new active battle loop from the design pass.

**Why:** "end round, monster attacks, then continue" is no longer the desired mental model. The player should be choosing when to pay hearts for a new hand, while closures resolve immediately and reward gold/strikes.

**Implementation order:**

1. Add config/run state for the new economy: persistent `run.gold = 0`, per-battle `handSubmitsThisBattle`, live submit-cost preview `1 + floor(unplayedHandCards / 4) + floor(handSubmitsThisBattle / 2)`, closure gold `+1`, strike bonus `+strikeCount`, and debug fields for all of them.
2. Split active `legacy` scoring from the old round resolver: after `placeTile`, detect only newly closed/scored zones, apply monster heart damage immediately, award closure gold/strike gold, clear/fade scored tiles through the existing `clearScoredTiles` cleanup, and keep unclosed board state.
3. Replace the old end-round/new-pick flow in active `legacy` with `Сдать руку`: click pays the previewed hearts immediately, increments `handSubmitsThisBattle`, discards played/unplayed hand cards while preserving the held card, redeals, and never applies separate monster attack damage.
4. Rework battle UI feedback around the new loop: button label/cost, player heart loss on submit, monster heart loss on closure, visible gold, strike count, and battle-log rows from `design/signs-and-feedback.md`.
5. Keep archived variants URL-playable by either preserving their old `resolveTileRound` path or gating the new economy to active `legacy`; do not spend this task on balancing Variant A-D.
6. Add focused unit tests first, then smoke coverage: submit-cost math, submit payment/redeal, immediate closure damage, no active monster attack damage, gold/strike rewards, held card surviving submit, and a 5-battle smoke path through the new button.

**MVP boundaries:**

- implement battle earning of gold, but not card shop prices or actual card buying;
- keep the current two center anchors; universal starter and purchasable control cards stay in the later GD/card pass;
- keep hold behavior: held card survives hand submit and returns to discard when the battle ends;
- keep existing heart scale: first monster 3 hearts, player starts with 18 hearts, minimal 2x2 closure is 1 heart.

**Acceptance:** the active `legacy` battle can be played without the old round-end damage model: closing a zone immediately deals/logs damage, submitting the hand immediately costs hearts and redeals with animation, strikes give bonus gold, and the UI clearly explains the new economy.

**Status:** implemented for active `legacy`: `run.gold = 0`, config-driven hand-submit and gold rules, live submit-cost preview, immediate closure scoring after placement, monster heart damage without old attack damage, closure/strike gold, battle log/debug fields, and `Сдать руку` payment/redeal preserving hold. Follow-up fix: an unaffordable dealt hand is now locked as a last-chance hand; if the monster survives and the player cannot pay for the next hand, the battle ends instead of redealing for free. Archived variants keep the old `resolveTileRound` path and remain URL-playable. Unit/check/e2e pass, including the 5-battle smoke path through hand submit.

**Priority:** must

**Layer:** MVP

---

### ~~[2026-05-09] GD pass: universal starter, jokers and purchasable cards~~ DONE

**Status:** done as a design pass in `design/card-pool.md`, synced to `design/gameplay-variants.md`, `design/decisions.md`, `todo/current.md` and README. Accepted: board-only `starter_universal_line_v` wildcard center semantics, staged buyable card candidates with rough costs/rarities, joker/split-card rules, and a validation protocol that tests the universal starter before adding the shop pool.

---

### ~~[2026-05-09] Day 4: Core 1 universal red/blue center card~~ DONE

**Idea:** replace the temporary two-card center anchor with one universal red/blue center card that can support both color plans.

**Why:** the two existing center cards are enough to test the opening feel immediately, but the intended anchor should eventually communicate "start either color here" as one clean rule. Do this after the GD card pass decides the universal starter semantics together with the future purchasable card pool.

**MVP:**

- define the universal card's edge/micro-cell semantics;
- add or generate its visual asset;
- seed it at the center instead of the two temporary cards;
- decide whether it is a special board-only tile or a card that can later enter the deck;
- update placement/scoring tests and the first-battle smoke check.

**Acceptance:** `legacy` starts with one visible universal red/blue center card, both red and blue plans can continue from it, and the two-card bridge is removed.

**Status:** implemented `starter_universal_line_v` as a board-only `specialTiles` config entry at `(3,3)`, replacing the two temporary center anchors, and exported its PNG art at `assets/tiles_v2/starter_universal_line_v.png`. The `*` rule matches active combat colors on edges, blocks flood-fill for the evaluated color, excludes wildcard boundary cells from capture area/damage, and prevents direct red-blue matching. Active immediate scoring keeps the placed tile color for shared wildcard-assisted closures. Unit/check/e2e pass, including the full 5-battle smoke loop.

**Priority:** must

**Layer:** MVP

---

### ~~[2026-05-09] Lead planning pass: beautiful MVP split into economy, shop, UIX and art tracks~~ DONE

**Status:** discussed the next MVP scope with three agents: economy/shop, UIX/mobile layout and art lead. The plan below keeps art unblocked early, extends battle economy with field resources, replaces the old `1 of 3` upgrade screen with a gold card shop, moves UI layout into explicit mockups/config and records a later art-lead audit so hardcoded prototype visuals do not silently remain.

---

### ~~[2026-05-09] MVP Art Track 1: asset contract, placeholder pack and artist tech brief~~ DONE

**Idea:** start the art lane before the rest of the MVP work so mechanics and UI can attach to stable asset ids while the actual art is improved in parallel.

**Why:** the current tile PNGs are file-backed, but most UI, buttons, panels, backgrounds, hearts, gold, monster presentation, board cells, overlays and effects are still hardcoded in Pixi drawing code. The artist needs a contract that says what files may change and which gameplay semantics must not change.

**MVP:**

- create `assets/art_mvp/art_manifest.json` with stable ids and state names for screen backgrounds, level backdrops, board cells, hand/hold slots, card frames, buttons, monster portraits, hearts, gold, strike, deck/discard icons, capture overlays and basic effects;
- create placeholder PNGs with final lowercase underscore filenames, even where the image is still prototype art;
- add `design/art-mvp-brief.md` or `techspec/art-assets.md` with the technical artist instructions: active `legacy` rules, 7x7 board, red/blue boundaries, universal starter, hearts/gold/submit loop, required file sizes, alpha/background rules, naming rules and export checklist;
- explicitly state that tile topology is not art-editable: the `matrix`, `edges`, color, pattern and special semantics in manifests/configs are gameplay data and must not be changed by repainting a PNG;
- list required asset categories: level underlays, screen backgrounds, buttons, closed/unclosed tile states, selected/hover/valid/invalid overlays, monster icons/portraits, gold, hearts, shop cards, deck/discard/hold icons, strike/multiplier icons and capture/closure effects;
- extend the loading plan from tile-only textures toward a general `loadArtAssets` path, without requiring final art before gameplay tasks continue.

**Acceptance:** a developer and an artist can open one art manifest and one technical brief, see every MVP asset id/file/state needed, replace placeholder files without touching gameplay code, and know which visual changes are safe versus gameplay-breaking.

**Parallelization:** after this task, artists can replace files while battle economy, shop logic and UIX layout continue. Mechanics own `matrix/edges/rules`; art owns PNG/state visuals.

**Status:** added `assets/art_mvp/art_manifest.json` with stable ids, states and file names for 78 MVP presentation assets; generated the placeholder PNG pack through `scripts/generate-art-mvp-placeholders.js`; and wrote `design/art-mvp-brief.md` with artist-safe replacement rules, topology locks, required categories, export checklist and the future `loadArtAssets` loading plan. `./scripts/npm.sh run check` passes.

**Priority:** must

**Layer:** MVP

---

### ~~[2026-05-09] Art direction pass: Astral Archive defense~~ DONE

**Status:** accepted the active setting as Astral Archive defense and recorded it in `design/art-direction.md`, `design/art-mvp-brief.md`, `design/decisions.md`, `todo/current.md` and README. The core fantasy is now defensive: the player is the defender of a star archive, red/blue contours are solar/lunar wards, closures seal parts of an invading monster breach, `Сдать руку` overloads the archive mechanism with living light, and monster/level art should show an escalating siege. Accepted fake-screenshot references were saved to `assets/art_refs/`, with `astral_archive_style_portrait.png` as the primary future style target and `astral_archive_style_landscape.png` as secondary.

**Priority:** must

**Layer:** MVP

---

### ~~[2026-05-09] MVP UIX Track 1: coordinate mockup and portrait battle layout~~ DONE

**Idea:** move battle UI layout from ad hoc scene math into an explicit mockup/layout contract optimized for portrait mobile play.

**Why:** the current battle screen is still desktop-first: board on the left, side panel on the right, hand at the bottom. On mobile width this will crowd or leave important controls off-screen. The MVP needs to be playable from a phone in vertical orientation.

**MVP:**

- create a separate UI mockup with coordinates and named slots, either as `design/ui-mockup.md` plus diagrams/tables or as `configs/ui-layout.json` plus a short design note;
- extract battle layout calculation into a pure layout module that returns named rects: `hud`, `monsterBanner`, `board`, `feedback`, `log`, `hold`, `hand[]`, `primaryButton`, `sidePanel` or equivalent;
- add portrait mode for narrow screens: top compact HUD with battle number/player hearts/monster hearts/gold, short event line, centered 7x7 board, 1-2 recent feedback lines, hand grid with 7 cards plus hold slot, and a large bottom `Сдать руку (-N)`/result button;
- keep a desktop layout, but make it use the same named layout contract instead of scene-local coordinate math;
- add touch/pointer input support so mobile layout is not only visually correct;
- define UI states for `battleIntro`, `placing`, `cardSelected`, `holdEmpty`, `holdFilled`, `invalidPlacement`, `closureScored`, `submitPaid`, `submitBlocked`, `lastChanceHand`, `victory` and `defeat`;
- after the coordinate mockup exists, run a UIX agent review over it and fold concrete improvement notes back into this task before implementation is considered done;
- expose debug layout/test data: layout mode, named rects, viewport overflow/safe-area status, feedback type and key visible state.

**Acceptance:** mobile Playwright checks at `390x844`, `360x740` and `430x932` show the board, hand, hold, HUD and primary button inside the viewport with usable tap targets; the same smoke path still works on desktop.

**Art dependency:** use ids from the art manifest when available, but allow placeholder textures so the UIX task does not wait for final art.

**Status:** added `design/ui-mockup.md` and extracted battle coordinates into pure `src/scenes/battleLayout.js` with named slots for `hud`, `monsterBanner`, `board`, `feedback`, `log`, `hold`, `hand[]`, `primaryButton`/`endRoundButton` and `sidePanel`. Active battle rendering now switches between the old desktop composition and a portrait mobile layout with compact HUD, centered board, two-row hand grid plus hold, feedback/log rows and a full-width `Сдать руку` button. Pointer/touch input is enabled, debug exposes layout mode/rects/overflow/safe-area/min touch target and `uiState`, and Playwright covers `390x844`, `360x740` and `430x932` plus the desktop smoke path.

**Priority:** must

**Layer:** MVP

---

### ~~[2026-05-09] MVP UIX Track 2: monster intro before each battle~~ DONE

**Status:** added a standalone `battleIntro` scene between progression screens and battle. It shows the current monster name, portrait/icon, hearts, danger/ante, player hearts/gold and honest pending reward preview from `configs/levels.json`, uses `assets/art_mvp` intro/backdrop/monster ids with fallbacks, exposes `getBattleIntroDebug()`, and routes through one `Битва` button before battle state is created. Smoke covers desktop, portrait viewports and non-final victory routes through intro. Artist/UIX handoff now lives in `design/art-mvp-brief.md`, `design/ui-mockup.md` and `design/monster-roster.md`.

**Priority:** must

**Layer:** MVP

---

### ~~[2026-05-09] MVP Art Pass: make the live game match the Astral Archive fake shot~~ DONE

**Idea:** pause the next mechanics task and make the live game visually read like the accepted fake screenshot.

**Why:** the fake shot already established the intended first impression: ornate star-archive UI, dark observatory backdrop, monster breach pressure, brass-framed board cells, glowing red/blue ward paths, readable hand tray and a large submit-hand control. Before adding more economy, the current game needed to stop looking like a mechanics prototype.

**MVP:**

- regenerate active `assets/tiles_v2` PNGs as brass-framed stone plates with crisp neon red/blue ward lines while preserving `matrix`, `edges`, tile ids and special starter semantics;
- regenerate the MVP art pack in `assets/art_mvp` toward the Astral Archive style: backgrounds, backdrops, board cells, slots, buttons, panels, icons, overlays/effects and monster portraits/icons;
- route normal menu, intro, battle, result and upgrades screens through manifest-backed art where they were still visible prototype rectangles;
- enlarge the portrait battle monster band and use the per-battle backdrop there so the screen composition resembles the portrait fake shot;
- keep board-cell states from drawing fake red/blue exits that could confuse tile topology;
- run art and UIX agent audits, fold concrete notes into the implementation, then verify with checks/e2e and a live portrait screenshot.

**Acceptance:** with the accepted portrait fake shot open beside the game, the current default battle should clearly read as the same direction: dark archive, breach/monster header, brass board, glowing red/blue seal tiles, ornate hand/hold slots and red submit bar. Active topology and tests must remain unchanged.

**Status:** implemented a first live fake-shot match pass. Two audit agents identified the remaining prototype visuals and UIX blockers; their P0/P1 notes were folded into this pass. `scripts/generate-tile-art-v2.js` now emits stone/brass/neon ward tiles without changing topology data, and `scripts/generate-art-mvp-placeholders.js` now emits Astral Archive backgrounds, board cells, slots, panels, buttons, icons, overlays/effects and monster art. Runtime now passes `artTextures` into menu/result/upgrades, uses art-backed backgrounds/buttons/cards, uses asset-backed battle board cells/panels/buttons, and portrait battle now has a larger monster breach banner backed by `level_backdrop_battle_0N`. A visual check caught and fixed a false-exit problem in `board_cell_valid`. Follow-up art-director correction: battle backgrounds, level backdrops and board-cell underlays were redone away from flat star-chart placeholders into darker observatory stone, quieter brass astrolabe marks, richer void breach silhouettes and warmer beveled stone cells. Unit tests, `check` and the 9-test Playwright smoke suite pass.

**Priority:** must

**Layer:** MVP

---

### ~~[2026-05-09] MVP Battle Economy: field gold, hearts and monster kill bounty~~ DONE

**Idea:** make battles develop economically, not only tactically, by adding resources on the board and a clear monster reward.

**Why:** gold already exists as closure/strike income, but it does not yet create a map decision or pay out for killing the monster. Field gold and hearts can make the player care about where and when they close territory.

**MVP:**

- keep the existing closure gold and strike gold as the base income;
- add monster kill bounty paid exactly once on victory, using `battle.reward` from `configs/levels.json`;
- add board resources as underlay data separate from placed tiles: at minimum `gold` and `heart`;
- gold can spawn on empty board cells, remain under a placed tile, be picked up when the player places a tile on it, and also pay a closure bonus if it is still on placed cells or inside a closed field at the moment of closure;
- every gold pickup or closure bonus consumes the resource once, so the same coin cannot pay twice;
- hearts can spawn on the field and restore player hearts only when the player closes a zone containing them;
- add `maxPlayerHp` or equivalent healing cap so hearts do not erase the cost pressure of `Сдать руку`;
- expose resource spawn/collection/heal in debug state and battle log: source, amount, before/after gold, before/after hearts and consumed resource ids/cells;
- update simulator/smoke enough to cover resource collection and kill bounty without needing final balance.

**Acceptance:** a battle can show gold/heart resources under the board layer, resources do not block tile placement, closure can award field bonus gold and healing, monster death awards the configured bounty once, and all income/heal sources are visible in UI/debug/test output.

**Art dependency:** use placeholder `gold` and `heart` icons from `assets/art_mvp`; final icons can be swapped later.

**Status:** implemented for active `legacy`: battles seed configurable `fieldResources` as board underlay data, direct placement on field gold collects it once, closure consumes remaining gold/hearts inside scored cells, heart resources heal up to `hearts.maxPlayerHp`, debug/log output records resource source/amount/before-after values and consumed ids/cells, and monster kill bounty pays `battle.reward` once on victory. Result/intro copy now shows the bounty as real gold. Unit/check pass; smoke covers visible field resources and per-battle bounty accounting.

**Priority:** must

**Layer:** MVP

---

### ~~[2026-05-09] Art Director Task: hand-painted tile atlas pass against the fake shot~~ DONE

**Idea:** replace the remaining procedural-looking `assets/tiles_v2` atlas with a deliberate fake-shot-quality tile paintover while preserving all gameplay topology.

**Why:** the quick generator rescue can make the ward paths thicker and more readable, but it still cannot fully match the accepted fake shot's confident curved neon tubes, carved brass/stone depth, hand-placed glow falloff and per-pattern composition. The tiles are the main repeated object on screen, so they need a dedicated art pass before the MVP first impression is judged final.

**MVP:**

- keep every filename, PNG size, manifest id, `matrix`, edge signature, color, pattern and special starter rule unchanged;
- first paint/test a small proof set: red/blue `line_h`, `line_v`, one corner, one tee and `starter_universal_line_v`;
- compare that proof set in the live portrait battle at `390x844` and desktop, not only on the contact sheet;
- match the fake shot's heavier ward language: thick luminous red/blue channels, elegant rounded turns, bright but controlled hot cores and soft outer glow;
- make tile plates feel richer: darker bevels, warmer brass trim, readable stone grid, less flat empty brown surface;
- avoid fake exits, decorative paths or interior marks that imply changed topology;
- after approval, finish the full red/blue/green/gray atlas and regenerate `tile_contact_sheet.png` / `tile_sprite_sheet_6x6.png`;
- record a before/after screenshot pair in the art notes or task status.

**Acceptance:** at board scale and hand scale, red/blue paths read as strong magical ward channels close to the accepted fake shot, all tile topology remains unchanged, and the live portrait screenshot no longer looks like thin procedural line art on empty slabs.

**Status:** completed a deterministic paintover pass through `scripts/generate-tile-art-v2.js`: all `assets/tiles_v2` PNGs and `starter_universal_line_v.png` were regenerated as darker brass/stone plates with thicker luminous ward channels, hot cores, softer glow, richer bevels and cleaner gray blanks. Filenames, PNG size, manifest ids, matrices, edge signatures, colors, patterns and special starter semantics were preserved; `assets/tiles_v2/tile_manifest.json` has no diff. Before/after records were saved in `assets/art_review/`: `tile_contact_sheet_before_art_director_pass.png`, `tile_contact_sheet_after_art_director_pass.png`, `portrait_battle_before_tile_atlas_pass.png`, `portrait_battle_after_tile_atlas_pass.png` and `desktop_battle_after_tile_atlas_pass.png`. Follow-up fixes: corner tiles now use a rounded elbow through the center micro-cell instead of a rigid L, T tiles now use rounded branch junctions instead of a hard perpendicular join, and `starter_universal_line_v` now uses one balanced red-to-blue gradient column with a violet/gold transition instead of a blue-dominant double stripe. Proof files include `tile_contact_sheet_after_rounded_corner_restore.png`, `portrait_battle_after_rounded_corner_restore.png`, `tile_contact_sheet_after_rounded_tee_restore.png`, `portrait_battle_after_rounded_tee_restore.png`, `starter_universal_line_v_after_gradient_balance.png` and `portrait_battle_after_universal_gradient_balance.png`. `./scripts/npm.sh run check` passes. Playwright smoke rerun is 8/9 with the remaining 5-battle loop failing after battle completion on `Expected "mainmenu", Received undefined`, not on tile art/topology assertions.

**Priority:** must

**Layer:** MVP

---

### ~~[2026-05-09] Art Director Task: board-cell states and placement-hint readability pass~~ DONE

**Idea:** design the board cell states, valid/invalid placement hints and closure overlays as one visual system instead of relying on procedural corner markers.

**Why:** the quick rescue muted the old cyan valid-cell noise, but the board still needs a proper state language. Empty cells, valid targets, hover, invalid, scored, resources and closure overlays must support the tile art instead of competing with it.

**MVP:**

- repaint `board_cell_empty`, `board_cell_hover`, `board_cell_valid`, `board_cell_invalid` and `board_cell_scored` as a coherent brass/stone family;
- decide whether unhovered valid placement is a subtle brass glint, a soft inner wash, or a sparse corner marker, then apply consistently;
- keep invalid placement visibly red and urgent without making normal valid cells louder than red/blue tile paths;
- review `drawPlacementHint` and replace remaining hardcoded markers with manifest-backed overlay assets if the art needs finer control;
- verify field gold/heart icons still read on empty cells and on top of placed tiles;
- check closure overlays against real closed zones so they read as sealed/captured territory, not extra tile exits;
- produce portrait and desktop screenshots with a selected hand tile and at least one hover/invalid example.

**Acceptance:** valid hints are visible enough to play but visually quieter than placed ward paths, invalid/hover/scored states are distinct, and board-cell chrome no longer fights the tile art in the live battle screen.

**Status:** completed the board-cell readability pass. `scripts/generate-art-mvp-placeholders.js` now emits a coherent brass/stone board-cell family for `board_cell_empty`, `board_cell_hover`, `board_cell_valid`, `board_cell_invalid` and `board_cell_scored`; unhovered valid cells use a subtle brass glint; invalid cells use an urgent red state; and `overlay_valid_cell` / `overlay_invalid_cell` carry the main placement-hint artwork. `src/scenes/battle.js` now chooses `board_cell_valid` for unhovered valid targets, keeps the selected-tile preview above valid hover, uses manifest-backed valid/invalid overlays before procedural fallback markers, and exposes board-cell/hint ids in battle debug for tests and art review. Field resource icons still render above cell art, and closure/fill visuals remain on the existing seal-overlay path. Proof screenshots were saved to `assets/art_review/board_cells_portrait_valid_hover_after.png`, `assets/art_review/board_cells_portrait_invalid_hover_after.png`, `assets/art_review/board_cells_desktop_valid_hover_after.png` and `assets/art_review/board_cells_desktop_invalid_hover_after.png`. `./scripts/npm.sh run check` passes; Playwright smoke coverage includes the new art ids.

**Priority:** must

**Layer:** MVP

---

### [2026-05-09] Art Director Task: buyable card and special-tile art pack

**Idea:** give the artist a focused asset task for the implemented shop/card catalog tiles.

**Why:** `configs/cards.json` now defines ordinary buys, plus/cross, `joker_line_v` and staged joker/double candidates, but the live assets still mostly reuse the base atlas or generator output. The implemented shop needs readable card previews and distinct special tiles that feel worth buying without changing gameplay topology.

**MVP:**

- use `configs/cards.json`, `design/card-pool.md` and `assets/art_refs/astral_archive_style_portrait.png` as the source references;
- ordinary buyable cards can reuse the repainted atlas from the hand-painted tile task, but shop previews must still read clearly at card scale;
- paint a distinct `joker_line_v` asset/proof that uses the same universal-boundary topology as the catalog entry: matrix `.*. / .*. / .*.`, active-color wildcard semantics, no direct red-blue merge and no free score area;
- prepare visual concepts for staged joker corner and joker tee cards, but keep them disabled until gameplay and balance explicitly approve them;
- prepare visual concepts for `double_line` and `double_curve`/`double_corner` cards as clearly special two-cell tools, without implying free rotation, extra score or unimplemented placement behavior;
- if new filenames or manifest ids are needed, propose them in the task/status before code consumes them; do not silently rename existing tile ids or PNG files;
- keep all topology locked: art may change pixels, but not `matrix`, edge signatures, card rules, costs, rarity, offer weights or enabled status;
- provide a small contact sheet or screenshot set showing ordinary card, plus/cross, joker line and double-card concepts together in the current shop frame scale.

**Acceptance:** the artist can hand back a tile/card art pack where every active catalog card has a readable preview path, `joker_line_v` has a distinct special-tile visual, staged joker/double concepts are clearly marked as not-yet-enabled, and no gameplay semantics are changed by the art.

**Balance note:** art approval does not enable a card. Every card or card family still needs the card-balance validation task before it stays in the active shop pool.

**Parallelization:** safe to run in a separate art chat. That chat should avoid price, rarity, offer-weight and enabled-status tuning except to flag visual/readability concerns for the balance chat.

**Priority:** must

**Layer:** MVP

---

### ~~[2026-05-09] MVP Card Catalog: prices, offer pool and special-card definitions in JSON~~ DONE

**Idea:** define all buyable cards and prices in data before building the shop UI.

**Why:** between-battle progression should become a gold shop, not a hardcoded reward generator. Prices, rarity, offer counts and special card semantics need to be easy to tune without editing scene code.

**MVP:**

- add `configs/cards.json` as the source of truth for buyable cards, prices and offer rules;
- include fields such as `id`, `tileId` or special tile definition, `name`, `description`, `cost`, `rarity`, `family`, `offerWeight`, `maxPerShop`, `enabledFromBattle`, `assetId` and optional `rules`;
- first card pool must include existing red/blue line, tee and corner cards with prices, plus the returned cross/plus as a controlled buyable card;
- include joker versions as staged entries: at least `joker_line` in the first implementation, with `joker_corner` and `joker_tee` defined or explicitly disabled for later;
- define the requested double-tile families in data: `double_line` and `double_corner`/`double_curve`, including exact placement/scoring semantics before they are enabled;
- keep red/blue as the active early shop colors; green cards stay disabled until a separate reintroduction task;
- record price bands in the JSON and design notes: common plan helpers affordable after a normal win, stronger jokers/doubles expensive enough to require saving or strong gold play;
- add validation so every enabled card references an existing tile/special definition and asset id.

**Acceptance:** the project has a checked-in card catalog with prices for ordinary cards, cross/plus, jokers and double straight/curve candidates; disabled/staged cards are explicit; code/tests can load and validate the catalog before any shop scene uses it.

**Status:** added `configs/cards.json` as the shop catalog: offer count, active red/blue shop colors, rarity weights, price bands, ordinary red/blue line/tee/corner buys, controlled red/blue plus buys, one enabled `joker_line_v` special definition and staged joker/double candidates with explicit semantics. Added `src/entities/cards.js` for catalog validation, enabled-offer filtering and special tile extraction; `loadConfig()` now validates the catalog against tile/special references. Unit/check/e2e pass.

**Priority:** must

**Layer:** MVP

---

### ~~[2026-05-09] MVP Shop: replace 1-of-3 upgrades with card sales~~ DONE

**Idea:** after a won battle, show a shop of random card offers and let the player buy any number they can afford.

**Why:** gold needs a between-battle sink, and the run should feel like deck building instead of choosing one free reward.

**MVP:**

- replace the active `upgrades` flow with a shop scene after non-final victories;
- generate 5 random offers from `configs/cards.json`, respecting rarity, enabled battle, max-per-shop and active colors;
- show card art/preview, name, cost, affordability state and enough rule text to distinguish ordinary cards, jokers, cross/plus and doubles;
- allow buying zero or more cards as long as the player has enough gold;
- buying spends gold immediately and sends the bought card to discard/deck using the same accounting rules as current add-tile rewards;
- unaffordable cards remain visible but cannot be bought;
- add a clear continue button to proceed to the next monster intro;
- remove or hide the old active `add tile/remove tile/boost color` choice flow from the normal MVP path, while keeping any debug-only helpers explicit if needed;
- mark all newly sold cards as balance-unverified in debug/status until their card or family has a recorded balance result;
- expose shop debug state: offers, prices, bought cards, gold before/after, deck/draw/discard counts and next-battle route.

**Acceptance:** a full smoke run can win a battle, enter the shop, buy multiple affordable cards or skip, see gold/deck counts update correctly, then continue to the next monster intro and battle. The old `1 of 3` upgrade screen is no longer the normal between-battle progression.

**Status:** implemented the normal post-victory `shop` flow. `src/entities/run.js` now generates deterministic 5-offer shops from `configs/cards.json`, respecting rarity weights, offer weights, active colors, unlock battle and `maxPerShop`; purchases spend gold immediately, add the bought tile/special tile to deck and discard, record `purchasedCards`/`shopHistory`, and keep `balanceStatus: "unverified"`. Config load exposes enabled catalog special tiles such as `joker_line_v`, and `src/scenes/upgrades.js` now renders the `shop` scene with card art previews, affordability, bought states, skip/continue and debug. Result copy routes to the shop, README/core/current/decisions are synced, and unit/check/e2e pass.

**Priority:** must

**Layer:** MVP

---

### [2026-05-09] MVP Special Cards: jokers, cross and double straight/curve tiles

**Idea:** make the first bought cards tactically exciting without letting every hand solve itself.

**Why:** the player specifically needs shop cards that change planning: joker control, returned cross/plus, and double straight/curve tools.

**MVP:**

- implement enabled special cards one family at a time from `configs/cards.json`;
- support ordinary red/blue buyable tiles first, then cross/plus, then `joker_line`, then one double family;
- joker rules use universal boundary semantics: match active combat colors, block flood-fill for the evaluated color, do not make red and blue match directly and do not add free score area;
- cross/plus returns as a shop card with offer caps and price high enough to watch for small-loop dominance;
- double straight and double curve must have a single clear MVP behavior before implementation, for example a special tile/card with a defined matrix and asset, not an ambiguous two-placement action unless the UI explicitly supports that;
- add unit tests for placement legality, capture scoring and deck accounting for each enabled family;
- add simulation/manual metrics comparing no-shop versus shop: win rate, submit count, gold spent, bought-card use rate, minimal capture share and average captured area;
- do not leave a card enabled only because art/code exists; every active card or card family needs a recorded balance check and a keep/nerf/disable decision.

**Acceptance:** at least one joker, cross/plus and one double straight/curve candidate can be bought, enter discard, appear through normal draw/reshuffle and obey tested placement/scoring rules without direct red-blue merging or runaway small-square closures.

**Priority:** must

**Layer:** MVP

---

### [2026-05-09] MVP Balance Pass: validate every shop card before final pool

**Idea:** test every buyable card and special-card family from `configs/cards.json` before it remains enabled in the active shop.

**Why:** new cards are the biggest balance risk in Core 1 Rescue. Ordinary helpers, plus/cross, jokers and doubles can all reduce hand pressure or revive minimal-square dominance if they are too cheap, too common or too generally useful.

**MVP:**

- establish a no-shop baseline on the same seeds: win rate by battle, submits per battle, gold earned, closure count, minimal capture share, average captured area, dead-end/fresh-start rate and player hearts remaining;
- test ordinary red/blue line cards, tee cards and corner cards separately before judging the combined common pool;
- test plus/cross separately with its current cost, unlock battle, max-per-shop and offer weight, watching specifically for minimal 2x2 loop dominance;
- test `joker_line_v` separately, watching blocked-hand recovery, wildcard-assisted closures and whether it makes red/blue plans merge mentally even if rules forbid it;
- when double cards are implemented, test each double family separately before testing them together;
- for every enabled card or family, record one decision: keep, change cost, change offer weight, delay unlock, cap per shop, nerf rules, or disable;
- write results to `design/tile-feasibility.md` or `design/card-pool.md` and sync any accepted tuning back to `configs/cards.json`;
- if a card cannot be tested yet, keep it staged/disabled and say why.

**Acceptance:** no buyable card stays in the active shop pool without a recorded balance result, and the final MVP pool has documented costs/weights/unlock timing plus a short reason each risky card was kept, nerfed or disabled.

**Parallelization:** safe to run in a separate balance chat after the card catalog exists. That chat should avoid repainting assets and should treat new art as presentation-only unless a card's rules/costs are explicitly changed in `configs/cards.json` with recorded balance rationale.

**Priority:** must

**Layer:** MVP

---

### [2026-05-09] MVP Art Track 3: remaining art extraction cleanup and final art-lead audit

**Idea:** finish the remaining art extraction after the fake-shot pass and verify that the game can be fully reskinned by files/manifests.

**Why:** the fake-shot pass replaced the largest visible prototype look, but some low-level borders, text treatments, debug/variant surfaces and shop elements still use procedural drawing. A beautiful MVP needs the project to select asset ids and states consistently, not hide late prototype visuals in scene code.

**MVP:**

- formalize the ad hoc asset helpers added during the fake-shot pass into shared renderer helpers such as `drawSprite`, `drawNineSlice`, `drawIcon` and `drawStatefulButton`;
- keep `drawText` as a system text layer, but move any remaining panels, buttons, board cells, slots, frames, icons, backgrounds, overlays and resource visuals to files from the art manifest;
- finish manifest-backed presentation extraction for the now-implemented shop and field-resource routes;
- finish battle extraction: capture/closure overlays, resource underlays, richer HUD rails, pressed states and any remaining hardcoded borders;
- remove the procedural tile fallback from active presentation: missing tile art should show an explicit missing asset state or fail validation instead of silently drawing a colored 3x3 fallback;
- add static checks with a small allowlist for remaining hardcoded drawing/color usage in `src/scenes` and `src/render`;
- add manifest validation: unique ids, files exist, lowercase underscore names, expected dimensions and loadable PNGs;
- run an art-lead audit after the extraction pass and record any remaining hardcoded prototype visuals as follow-up tasks.

**Acceptance:** normal MVP screens render from manifest-backed textures for backgrounds, UI chrome, buttons, board/slot states, monsters, resources and tile states; validation catches missing files; the art-lead audit confirms that no major prototype art remains hidden in code except an explicit allowlist.

**Priority:** must

**Layer:** MVP

---

### [2026-05-09] Art Director Task: MVP monster icon and portrait pack

**Idea:** give the artist a concrete monster production order for the implemented battle intro and planned battle HUD.

**Why:** monster intro now exists, but placeholder monsters do not yet sell the Astral Archive breach fantasy. The compact icons will also be reused in the battle HUD, result/shop previews and future art extraction, so they need to be designed as a coherent set.

**MVP:**

- use `design/monster-roster.md` as the source of truth;
- draw all five `monster_icon_battle_0N.png` files first, because they must read at 32px/48px/86px;
- draw `monster_portrait_battle_01.png` next as the first style proof;
- then draw the remaining portraits in battle order;
- keep filenames, dimensions, alpha rules and manifest ids unchanged;
- do not draw fake tile exits, board cells or gameplay contours into monster art.

**Acceptance:** all five monster icons are distinct at HUD scale, the first portrait proves the Astral Archive breach style in the implemented intro screen, and the files can replace placeholders in `assets/art_mvp` without code or manifest changes.

**Progress:** first generated art pass is in place: all five `monster_icon_battle_0N.png` files were replaced with transparent 128x128 Astral Archive breach silhouettes, and `monster_portrait_battle_01.png` was replaced with a transparent 512x512 Shadow Leech style proof. Runtime now also passes manifest art into battle and uses the monster icon pack plus heart/gold/deck/discard/hold/submit/strike HUD icons during normal play. Remaining art work: portraits for battles 2-5 and optional level backdrops.

**Parallelization:** art can start immediately and does not block the next coding task.

**Priority:** must

**Layer:** MVP

---

### [2026-05-09] MVP Polish Pass: feedback, juice and packaging after shop/art foundations

**Idea:** turn the newly expanded MVP into a player-ready build after economy, shop, UIX and art extraction are in place.

**Why:** polish before the shop/art contracts would be throwaway. Once the main loop is stable, the game needs feedback and build packaging that make it understandable without chat explanations.

**MVP:**

- valid-cell highlighting and invalid placement reasons;
- captured-area/closure highlight followed by monster heart loss, gold pickup and strike feedback;
- field gold/heart pickup feedback;
- hand-submit heart loss and last-chance hand warning;
- shop buy, unaffordable and continue feedback;
- monster intro polish for each battle;
- mobile and desktop smoke screenshots with stable seed;
- README/current docs synced to the new MVP loop.

**Acceptance:** a new player can open the build, understand the monster intro, play a battle, read closure/gold/heart feedback, buy cards in the shop and continue the run without external explanation.

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

**Acceptance:** the player opens the build, goes through menu -> battleIntro -> battle -> result -> shop -> battleIntro -> next battle and understands the main mechanic without external explanation.

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
