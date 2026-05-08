# Current Version

## v0.3 Tile Battle MVP

**Goal:** Replace the battle placeholder with a playable tile-placement combat prototype.

**Task source of truth:** `todo/tasks.md` is the only backlog, task order, next-step, acceptance, and status list. Do not choose work from this file.

**Current design truth:**

- Tile assets come from `assets/tiles_v2/tile_manifest.json`.
- The starting MVP tile set has `line_h`, `line_v`, four `corner`, four `tee`, and `plus` per combat color, plus 3 gray blanks.
- `dot` and base `cap` tiles are not in the MVP deck.
- A combat color's micro-cells are territory boundaries.
- A fully enclosed empty or filled interior becomes captured land for that color.
- Scoring for the first prototype uses `capture area * 2`.
- The first prototype smooths early hands by selecting the best of 3 candidate draws and discarding the rest.
