# Current Version

## v0.6 Payoff MVP

**Goal:** Make bigger closed zones and gray setup tiles meaningfully better than always closing the smallest possible square.

**Task source of truth:** `todo/tasks.md` is the only backlog, task order, next-step, acceptance, and status list. Do not choose work from this file.

**Current design truth:**

- Tile-battle tuning lives in JSON configs, not in code.
- `configs/game.json` stores board size, hand size, starting player HP, starting deck size, damage formula, active tile manifest path, debug hand selection draw count, default loop guarantee toggle, round board cleanup, dead-end recovery, off-color leap placement and run battle count.
- Scoring uses configured `damageFormula.type = areaMultiplier`: base area damage is `area * areaMultiplier`, zones larger than `largeZoneBonus.minArea` gain `largeZoneBonus.bonusPerArea` per extra micro-cell, and gray tile micro-cells inside a closed zone add `grayInteriorBonus.bonusPerCell`.
- `configs/levels.json` stores only the battle list, enemy HP and enemy color attacks.
- The active tile manifest path is `assets/tiles_v2/tile_manifest.json`.
- The starting MVP tile set has `line_h`, `line_v`, four `corner`, four `tee`, and `plus` per combat color, plus 3 gray blanks.
- A new run starts with a 36-tile deck built from the active v2 manifest.
- Normal battle hands are drawn honestly from the run draw pile: one hand, no default best-of-3 smoothing, no automatic loop completion from the remaining draw pile.
- Stable debug/smoke runs use URL overrides such as `?seed=20260508&guaranteedLoopHands=true`; normal player runs generate a fresh seed on each start.
- At round end, played and unplayed hand tiles go to discard; when draw pile is empty, discard is shuffled back into draw pile.
- After each won battle, the player chooses one of three rewards: add a tile to discard/deck, remove a tile from deck, or increase a combat color multiplier.
- `dot` and base `cap` tiles are not in the MVP deck.
- A combat color's micro-cells are territory boundaries.
- A fully enclosed empty or filled interior becomes captured land for that color.
- Between rounds, closed/scored tiles are cleared and unclosed tiles stay on the board, so unfinished territory can be completed later.
- If the next hand cannot continue the saved board at all, the battle uses fresh-start recovery and clears the unclosed board for that hand.
- If a selected combat-color tile has no direct edge-match placement, it can start a new island two cells away from an existing combat tile of another color, with one empty gap cell between them.
- Gray tiles use wildcard placement when `grayWildcardPlacement` is enabled: they can touch any edge, and colored tiles can touch gray edges, so gray blanks work as neutral fill/setup pieces.
- Color multipliers are stored on the run and multiply the zone's configured base damage after area and gray bonuses.
- Combat UI shows player HP, enemy HP, round number, enemy attacks, deck/discard counts, board, hand, and per-color round results: enemy attack, captured area, capture sum, multiplier, payoff bonus, enemy damage or player damage.
- A minimal 2x2 corner loop scores area 12 with no size bonus; a larger closed zone can now beat it clearly, especially when a gray blank is enclosed as preparation/fill.
