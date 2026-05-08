# Current Version

## v0.9 Queue Draw Experiment

**Goal:** Make the playable build use queue draw by default so each move is "place current tile with next tile preview" instead of full-hand solving.

**Task source of truth:** `todo/tasks.md` is the only backlog, task order, next-step, acceptance, and status list. Do not choose work from this file.

**Current design truth:**

- Tile-battle tuning lives in JSON configs, not in code.
- `configs/game.json` stores board size, hand size, `drawMode`, starting player HP, starting deck size, `startingDeckRecipe`, `drawBag`, damage formula, active tile manifest path, debug hand selection draw count, default loop guarantee toggle, round board cleanup, dead-end recovery, off-color leap placement and run battle count.
- Scoring uses configured `damageFormula.type = areaMultiplier`: base area damage is `area * areaMultiplier`, zones larger than `largeZoneBonus.minArea` gain `largeZoneBonus.bonusPerArea` per extra micro-cell, and gray tile micro-cells inside a closed zone add `grayInteriorBonus.bonusPerCell`.
- `configs/levels.json` stores only the battle list, enemy HP and enemy color attacks.
- The active tile manifest path is `assets/tiles_v2/tile_manifest.json`.
- The active tile catalog still has `line_h`, `line_v`, four `corner`, four `tee`, and `plus` per combat color, plus 3 gray blank ids.
- A new run starts with a recipe-built 37-tile deck: one of each combat tile from the v2 manifest plus one extra `tile_gray_blank_01` copy. The recipe supports duplicate tile ids without changing art or manifest.
- Active MVP `drawMode` is `queue`. The player sees only the current tile and one preview tile. Only the current tile can be placed; after placement, preview becomes current and a new preview is drawn from the hidden round queue. The round can end by button or after up to `handSize` queue placements.
- The old full-hand mode remains available for comparison through `?drawMode=hand`.
- At the start of each battle, enabled `drawBag` reorders only the next `openingDraws` future draws from the current draw pile. It caps early `corner`/`plus`, requires `line`/`tee` continuation pieces, keeps at least two tiles of each combat color when available and limits gray count. It does not add tiles, guarantee a loop or solve placement for the player.
- Stable debug/smoke runs use URL overrides such as `?seed=20260508&guaranteedLoopHands=true`; normal player runs generate a fresh seed on each start.
- At round end, played and unplayed hand or queue tiles go to discard; when draw pile is empty, discard is shuffled back into draw pile.
- Starting player HP is 160 while queue is active, because queue has less immediate control than full-hand mode and needs a little more runway for the 5-battle prototype loop.
- After each won battle, the player chooses one of three rewards: add a tile to discard/deck, remove a tile from deck, or increase a combat color multiplier.
- `dot` and base `cap` tiles are not in the MVP deck.
- A combat color's micro-cells are territory boundaries.
- A fully enclosed empty or filled interior becomes captured land for that color.
- Between rounds, closed/scored tiles are cleared and unclosed tiles stay on the board, so unfinished territory can be completed later.
- A zero-damage first round is not automatically bad: it can be a valid setup round if the saved board contains useful, buildable contour that converts into captures in later rounds.
- If the next hand cannot continue the saved board at all, the battle uses fresh-start recovery and clears the unclosed board for that hand.
- A selected combat-color tile can start a new island two cells away from an existing combat tile of another color, with one empty gap cell between them. This off-color leap remains available even when the tile also has direct edge-match placements elsewhere.
- Gray tiles use asymmetric wildcard placement when `grayWildcardPlacement` is enabled: a gray blank can be placed as fill next to gray or combat tiles, while a combat tile placed next to an existing gray blank must touch it with a blank edge. Gray blanks are neutral fill/setup pieces for larger interiors.
- Color multipliers are stored on the run and multiply the zone's configured base damage after area and gray bonuses.
- Combat UI shows player HP, enemy HP, round number, enemy attacks, deck/discard counts, board, hand, and per-color round results: enemy attack, captured area, capture sum, multiplier, payoff bonus, enemy damage or player damage.
- A minimal 2x2 corner loop scores area 12 with no size bonus; a larger closed zone can now beat it clearly, especially when a gray blank is enclosed as preparation/fill.
- The simulator reads the same `startingDeckRecipe` and `drawBag` as the game and reports small-capture diagnostics: `minimal capture share`, `avg capture area`, `placements before capture`, zero-damage hands/rounds, zero-damage streak, captures in 3 rounds, quick 4-corner loops, and opening draw/hand composition by color and shape. It can be forced into queue simulation with `DRAW_MODE=queue`; queue uses a small beam AI because the decision space is narrower than full-hand play.
- Interpret `zero damage` over a multi-round window, not as an isolated first-round failure. Watch zero-damage streaks, captures within the next 2-3 rounds, dead-end/freshStart rate, win rate and player damage.
- Queue is now selected as the active MVP mode for manual feel and autoplay testing. Beam simulation shows queue is easier to autoplay and can improve early conversion in some presets, but most captures are still small `area <= 12`; the next task is comparing hand recipe/bag vs queue before deciding whether to keep queue as final MVP default.
