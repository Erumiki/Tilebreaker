# Current Version

## v0.8 Opening Draw Bag MVP

**Goal:** Make the first battle draws less swingy: fewer early ready-made closers, more line/tee continuation pieces, still no hidden solver.

**Task source of truth:** `todo/tasks.md` is the only backlog, task order, next-step, acceptance, and status list. Do not choose work from this file.

**Current design truth:**

- Tile-battle tuning lives in JSON configs, not in code.
- `configs/game.json` stores board size, hand size, starting player HP, starting deck size, `startingDeckRecipe`, `drawBag`, damage formula, active tile manifest path, debug hand selection draw count, default loop guarantee toggle, round board cleanup, dead-end recovery, off-color leap placement and run battle count.
- Scoring uses configured `damageFormula.type = areaMultiplier`: base area damage is `area * areaMultiplier`, zones larger than `largeZoneBonus.minArea` gain `largeZoneBonus.bonusPerArea` per extra micro-cell, and gray tile micro-cells inside a closed zone add `grayInteriorBonus.bonusPerCell`.
- `configs/levels.json` stores only the battle list, enemy HP and enemy color attacks.
- The active tile manifest path is `assets/tiles_v2/tile_manifest.json`.
- The active tile catalog still has `line_h`, `line_v`, four `corner`, four `tee`, and `plus` per combat color, plus 3 gray blank ids.
- A new run starts with a recipe-built 37-tile deck: one of each combat tile from the v2 manifest plus one extra `tile_gray_blank_01` copy. The recipe supports duplicate tile ids without changing art or manifest.
- Normal battle hands are drawn honestly from the run draw pile: one hand, no default best-of-3 smoothing, no automatic loop completion from the remaining draw pile.
- At the start of each battle, enabled `drawBag` reorders only the next `openingDraws` future draws from the current draw pile. It caps early `corner`/`plus`, requires `line`/`tee` continuation pieces, keeps at least two tiles of each combat color when available and limits gray count. It does not add tiles, guarantee a loop or solve placement for the player.
- Stable debug/smoke runs use URL overrides such as `?seed=20260508&guaranteedLoopHands=true`; normal player runs generate a fresh seed on each start.
- At round end, played and unplayed hand tiles go to discard; when draw pile is empty, discard is shuffled back into draw pile.
- After each won battle, the player chooses one of three rewards: add a tile to discard/deck, remove a tile from deck, or increase a combat color multiplier.
- `dot` and base `cap` tiles are not in the MVP deck.
- A combat color's micro-cells are territory boundaries.
- A fully enclosed empty or filled interior becomes captured land for that color.
- Between rounds, closed/scored tiles are cleared and unclosed tiles stay on the board, so unfinished territory can be completed later.
- A zero-damage first round is not automatically bad: it can be a valid setup round if the saved board contains useful, buildable contour that converts into captures in later rounds.
- If the next hand cannot continue the saved board at all, the battle uses fresh-start recovery and clears the unclosed board for that hand.
- If a selected combat-color tile has no direct edge-match placement, it can start a new island two cells away from an existing combat tile of another color, with one empty gap cell between them.
- Gray tiles use limited wildcard placement when `grayWildcardPlacement` is enabled: gray can touch gray or a blank combat edge, but it cannot touch/block an open colored boundary edge. Gray blanks are neutral fill/setup pieces, not plugs for color paths.
- Color multipliers are stored on the run and multiply the zone's configured base damage after area and gray bonuses.
- Combat UI shows player HP, enemy HP, round number, enemy attacks, deck/discard counts, board, hand, and per-color round results: enemy attack, captured area, capture sum, multiplier, payoff bonus, enemy damage or player damage.
- A minimal 2x2 corner loop scores area 12 with no size bonus; a larger closed zone can now beat it clearly, especially when a gray blank is enclosed as preparation/fill.
- The simulator reads the same `startingDeckRecipe` and `drawBag` as the game and reports small-capture diagnostics: `minimal capture share`, `avg capture area`, `placements before capture`, zero-damage hands/rounds, zero-damage streak, captures in 3 rounds, quick 4-corner loops, and opening draw/hand composition by color and shape.
- Interpret `zero damage` over a multi-round window, not as an isolated first-round failure. Watch zero-damage streaks, captures within the next 2-3 rounds, dead-end/freshStart rate, win rate and player damage.
- Opening bag is intentionally a draw-shaping MVP, not a bailout. It improves first-window composition, but quick simulation still shows long zero-damage streaks in some seeds and presets, so the next planned lever remains measuring/trying queue mode rather than making the bag into a hidden solver.
