# Tile Art Brief

Date: 2026-05-08.

Goal: produce a v2 tile asset pack for the Tilebreaker MVP. Tiles must match the simulation results from `design/tile-feasibility.md`: 3x3 micro-land matrix, strict edge compatibility, large captured areas as the main risk and reward.

Current active gameplay uses the v2 pack as a source library, not as a full starting deck. Core 1 Rescue uses a 7x7 board, red/blue active colors, no gray blank in the starting deck, no plus in the starting deck and one board-only universal starter from `configs/game.json`. Green, gray and plus remain in the manifest for tooling, archived variants, future rewards and shop work.

## Short Brief For AI Artist

Draw a set of top-down game tiles for a 2D board-game interface. Each tile is a square piece with a clearly readable `3x3` micro-land grid inside it.

Micro-land colors:

- `red` - red land;
- `blue` - blue land;
- `green` - green land;
- `gray` - neutral gray land.

The most important thing is not isolated beauty, but exact gameplay readability:

- the player must see which 3 micro-cells exit on each tile edge;
- matching edges must visually connect without a break;
- decoration must not create false colored exits;
- all 9 micro-cells must remain readable at small size on the active 7x7 board.

## Technical Model

Each tile has a `3x3` matrix:

```text
a b c
d e f
g h i
```

Tile edges:

```text
top    = a b c
right  = c f i
bottom = g h i
left   = a d g
```

Adjacent tiles are compatible only if their touching edges match across all 3 micro-cells.

## Visual Style

- Strict top-down view.
- No perspective, no isometry, no 3D relief.
- Clean board-game UI, not a diorama or photorealism.
- Outer tile contour should be stronger than inner dividers.
- Inner 3x3 grid must be visible, but neighboring cells of the same color may softly merge into one zone.
- Colors should differ not only by hue, but also by brightness/pattern.
- Red, blue, green and gray must not be confused when scaled down.
- Textures are allowed only if subtle: they should help distinguish lands, not fight the shape.
- Shadows should be short and UI-like. No long cast shadows.
- No tiny objects, highlights, heavy gradients, noisy hand-painted lines or decorative frames that make the 3x3 structure harder to read.

## Important Concern: Land Or Roads

After the first asset review, there was a risk that current `corner` tiles read not as land patches, but as closed colored roads on gray background. Example: `tile_blue_corner_lu`.

Current scheme:

```text
.X.
XX.
...
```

Visually, it has a lone gray micro-cell in the upper-left corner. It sits between two blue exits and may read as a hole in the land rather than a plot boundary. If that gray corner is filled with the same color, the tile will look more like a land mass:

```text
XX.
XX.
...
```

But this is not a purely artistic change. It changes gameplay topology:

- old `corner_lu` has edges `top = .X.`, `left = .X.`;
- filled `corner_lu` would have edges `top = XX.`, `left = XX.`;
- so it no longer matches current `cap`, `line` and `corner` tiles built around exiting only through the edge center;
- the zone becomes a thick land mass instead of a thin road, which may better support the "land" fantasy, but requires a new starting deck and another simulation.

Preliminary conclusion:

- for the MVP, the current center-exit model can remain because it is already simulated and gives understandable small closures;
- for the next art iteration, test a `land mass` variant where corners and possibly caps have filled 2x2/2x3 shapes;
- do not mix both models without an explicit decision: center-exit tiles and filled-land tiles have different edge signatures and will feel like different languages;
- if the goal is "lands, not roads", first make an alternative `v2_land_mass` set, run the same `scripts/simulate-tiles.js`, and only then replace the main pack.

This concern is closed by the decision below: for the MVP, keep colored cells as boundaries, allow capture of empty interior and rebuild the tile set around connectable contours.

## Accepted MVP Rule: Boundary Fills Land

For the current MVP, center-exit tiles remain valid, but they should be read not as "roads that score by themselves", but as colored territory boundaries.

When a colored boundary fully closes an area, the whole interior is temporarily filled with that boundary color and counted as captured land. For example, if a blue line closes around gray or empty interior, that interior visually becomes blue and contributes to the blue score. Empty spaces connected to the outside remain outside air; empty spaces inside a closed contour become owner land.

Art consequences:

- current thin `line`, `corner`, `tee` and `plus` shapes are acceptable because they mark the boundary of a future capture;
- after closure, a separate visual state is needed: captured fill over inner micro-cells;
- interior fill should be softer/smoother than the original colored boundary so the player can see both contour and captured area;
- do not manually repaint "orphan" gray corners inside the PNGs until a separate `land mass` decision is made;
- a future battle-scene preview should show not only tiles in hand, but also the post-capture state, otherwise the land fantasy will be lost.

## v2 Decision: Only Connectable Boundaries

Tiles with a combat cell only in the center no longer fit the MVP deck:

```text
...
.X.
...
```

Such a `dot` has no colored edge exit, does not help build a closed boundary and pollutes the hand. For the MVP it should be replaced by `plus/cross`:

```text
.X.
XXX
.X.
```

General rule for v2 combat tiles: every red/blue/green tile must have at least one colored exit to an edge. The MVP should not contain ordinary combat tiles that do not connect to neighbors. `dot` can return later only as a special bonus/resource tile with a separate rule.

The new set should be a language of territory boundaries, not roads or isolated islands. Pattern priority:

- `line` - perimeter growth;
- `corner` - small and medium closures;
- `tee` - forks and risk of larger areas;
- `plus` - universal node, replacement for old `dot`.

## Sizes And Export

Preferred tile size: `256x256 px`.

Deliver:

- separate transparent PNG for each tile;
- contact sheet / preview of all tiles in a labeled grid;
- if possible, one transparent PNG sprite sheet `6x6`.

Requirements:

- all PNGs same size;
- transparent background;
- lowercase filenames, underscores, no spaces;
- land edges must reach the tile edge where the micro-cell exits on that edge;
- do not add decorative transparent inset inside the tile itself.

## Tile Set

Need 36 tiles for the full v2 manifest.

The active Core 1 Rescue starting deck is a 24-card red/blue subset built by `startingDeckRecipe`: red/blue `line_h x2`, `line_v x2`, each `tee` x1, each `corner` x1, no `plus` and no gray blank.

For each combat color `red`, `blue`, `green`, need 11 patterns. Gray cells are marked `.`. Combat color is marked `X`.

v2 no longer has `dot`, `cap_l`, `cap_r`, `cap_u`, `cap_d` in the starting set. They were useful for the old component model, but work poorly in the capture-fill model. The new set is built from straights, corners, T-forks and plus.

### plus

Boundary crossroads. Replacement for old `dot`.

```text
.X.
XXX
.X.
```

Filenames:

```text
tile_red_plus.png
tile_blue_plus.png
tile_green_plus.png
```

### line_h

Horizontal line through the center, exits at the center of left and right edges.

```text
...
XXX
...
```

Filenames:

```text
tile_red_line_h.png
tile_blue_line_h.png
tile_green_line_h.png
```

### line_v

Vertical line through the center, exits at the center of top and bottom edges.

```text
.X.
.X.
.X.
```

Filenames:

```text
tile_red_line_v.png
tile_blue_line_v.png
tile_green_line_v.png
```

### corner_ur

Corner connecting up and right through the center. No exits down or left.

```text
.X.
.XX
...
```

Filenames:

```text
tile_red_corner_ur.png
tile_blue_corner_ur.png
tile_green_corner_ur.png
```

### corner_rd

Corner connecting right and down through the center. No exits up or left.

```text
...
.XX
.X.
```

Filenames:

```text
tile_red_corner_rd.png
tile_blue_corner_rd.png
tile_green_corner_rd.png
```

### corner_dl

Corner connecting down and left through the center. No exits up or right.

```text
...
XX.
.X.
```

Filenames:

```text
tile_red_corner_dl.png
tile_blue_corner_dl.png
tile_green_corner_dl.png
```

### corner_lu

Corner connecting left and up through the center. No exits right or down.

```text
.X.
XX.
...
```

Filenames:

```text
tile_red_corner_lu.png
tile_blue_corner_lu.png
tile_green_corner_lu.png
```

### tee_u

T-fork connecting left, up and right. No exit down.

```text
.X.
XXX
...
```

Filenames:

```text
tile_red_tee_u.png
tile_blue_tee_u.png
tile_green_tee_u.png
```

### tee_r

T-fork connecting up, right and down. No exit left.

```text
.X.
.XX
.X.
```

Filenames:

```text
tile_red_tee_r.png
tile_blue_tee_r.png
tile_green_tee_r.png
```

### tee_d

T-fork connecting left, right and down. No exit up.

```text
...
XXX
.X.
```

Filenames:

```text
tile_red_tee_d.png
tile_blue_tee_d.png
tile_green_tee_d.png
```

### tee_l

T-fork connecting up, left and down. No exit right.

```text
.X.
XX.
.X.
```

Filenames:

```text
tile_red_tee_l.png
tile_blue_tee_l.png
tile_green_tee_l.png
```

### gray blank

Three variants of a fully gray neutral tile. They may differ slightly in decoration, but must not contain red, blue or green active elements.

```text
...
...
...
```

Filenames:

```text
tile_gray_blank_01.png
tile_gray_blank_02.png
tile_gray_blank_03.png
```

## Result Check

After generating assets, check:

- all 36 files exist;
- all tiles have one size;
- background is transparent;
- every pattern matches its 3x3 scheme;
- red/blue/green versions of one pattern have identical geometry;
- color does not exit through extra edges;
- the starting v2 set has no `dot` tiles without an edge exit;
- `corner` connects two neighboring sides through the center, not diagonally;
- `tee` has exactly three exits;
- `plus` has exactly four exits;
- gray tile does not look like an active color;
- tiles remain readable when scaled down to game-board size.

## Common Mistakes To Avoid

- Add an extra colored stroke on an edge.
- Draw a corner as a diagonal without orthogonal connection through the center.
- Bring back an ordinary `dot` with a single colored cell in the center.
- Make different shapes for red/blue/green versions of one pattern.
- Blur edges so much that the 3-segment signature becomes ambiguous.
- Overdecorate the gray tile so it looks like a special combat type.
- Use perspective or isometry that stops the 3x3 grid from being exact.
