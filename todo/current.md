# Current Version

## v0.4 Deck Progression MVP

**Goal:** Turn the tile battle prototype into a small run loop with deck draw, discard and post-battle progression.

**Task source of truth:** `todo/tasks.md` is the only backlog, task order, next-step, acceptance, and status list. Do not choose work from this file.

**Current design truth:**

- Tile-battle tuning lives in JSON configs, not in code.
- `configs/game.json` stores board size, hand size, starting player HP, starting deck size, damage formula, active tile manifest path, seed, hand selection draw count and run battle count.
- `configs/levels.json` stores only the battle list, enemy HP and enemy color attacks.
- The active tile manifest path is `assets/tiles_v2/tile_manifest.json`.
- The starting MVP tile set has `line_h`, `line_v`, four `corner`, four `tee`, and `plus` per combat color, plus 3 gray blanks.
- A new run starts with a 36-tile deck built from the active v2 manifest.
- Battle hands are drawn from run draw pile; best-of-3 hand smoothing may complete a loop from cards still in the draw pile, then unchosen candidate hands go to discard.
- At round end, played and unplayed hand tiles go to discard; when draw pile is empty, discard is shuffled back into draw pile.
- After each won battle, the player chooses one of three rewards: add a tile to discard/deck, remove a tile from deck, or increase a combat color multiplier.
- `dot` and base `cap` tiles are not in the MVP deck.
- A combat color's micro-cells are territory boundaries.
- A fully enclosed empty or filled interior becomes captured land for that color.
- Current playtest risk: strict edge matching can dead-end after the first tile, leaving no valid continuation in the current hand.
- Current design hypothesis for the next balance pass: clear only closed/scored tiles between rounds and keep unclosed tiles on the board, so unfinished territory can be completed on later turns.
- Scoring for the first prototype uses configured `damageFormula.type = areaMultiplier` with `areaMultiplier = 2`.
- Color multipliers are stored on the run and multiply captured area damage after base `areaMultiplier`.
- Combat UI shows player HP, enemy HP, round number, enemy attacks, deck/discard counts, board, hand, and per-color round results: enemy attack, captured area, capture sum, multiplier, enemy damage or player damage.
