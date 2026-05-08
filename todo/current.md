# Current Version

## v0.3 Tile Battle MVP

**Goal:** Replace the battle placeholder with a playable tile-placement combat prototype.

**Task source of truth:** `todo/tasks.md` is the only backlog, task order, next-step, acceptance, and status list. Do not choose work from this file.

**Current design truth:**

- Tile-battle tuning lives in JSON configs, not in code.
- `configs/game.json` stores board size, hand size, starting player HP, starting deck size, damage formula, active tile manifest path, seed and run battle count.
- `configs/levels.json` stores battle list, enemy HP and enemy color attacks.
- The active tile manifest path is `assets/tiles_v2/tile_manifest.json`.
- The starting MVP tile set has `line_h`, `line_v`, four `corner`, four `tee`, and `plus` per combat color, plus 3 gray blanks.
- `dot` and base `cap` tiles are not in the MVP deck.
- A combat color's micro-cells are territory boundaries.
- A fully enclosed empty or filled interior becomes captured land for that color.
- Scoring for the first prototype uses configured `damageFormula.type = areaMultiplier` with `areaMultiplier = 2`.
- The first prototype smooths early hands by selecting the best of 3 candidate draws and discarding the rest.
- Combat UI shows player HP, enemy HP, round number, enemy attacks, board, hand, and per-color round results: enemy attack, captured area, capture sum, enemy damage or player damage.
