# Rendering Pipeline

Technical specification for Tilebreaker's rendering system.

## Overview

All game rendering goes through Pixi.js inside a single `canvas`. DOM elements are not used for game visuals, including UI.

```text
JSON/configs -> Pixi Application -> Scene containers -> Screen
```

## Pixi Application

`src/core/renderer.js` creates `PIXI.Application`, attaches it to `canvas#game`, enables window resize and sets the base background color.

`src/main.js` uses `app.ticker` as the main frame loop: it updates the current scene and asks it to redraw the Pixi UI.

## Scenes

Each scene owns its screen structure and must not create DOM directly.

Current minimum loop:

```text
menu -> battle -> result -> upgrades -> next battle -> final
```

## UI

`src/render/ui.js` is a thin helper over Pixi:

- `PIXI.Container` for the UI layer;
- `PIXI.Graphics` for panels, backgrounds and buttons;
- `PIXI.Text` for text;
- hit testing through rectangles until the full Pixi event pipeline is needed.

## Assets

Future sprites, tiles, particles and effects should be added through Pixi assets/sprites. Do not return to manual WebGL for game visuals without a separate architectural decision.

The current tile set for the battle MVP lives in:

```text
assets/tiles_v2/
assets/tiles_v2/tile_manifest.json
```

Battle code must read matrices and edge signatures from the manifest instead of duplicating the tile list in JS. `assets/tiles/` is the first art pack archive.

## Asset Naming Convention

All asset files are named in lowercase with underscores:

```text
tile_blue_plus.png
tile_red_corner_ur.png
tile_green_tee_l.png
ball_default.png
button_start.png
```

Do not use spaces, hyphens, CamelCase, UPPERCASE or mixed case.

## UI Configs

UI values are not hardcoded in JS. Sizes, positions, colors, fonts, spacing and texture paths should gradually move into JSON configs as the interface stabilizes.
