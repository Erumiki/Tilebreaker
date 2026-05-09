# MVP Art Asset Brief

Date: 2026-05-09.

Goal: give Tilebreaker a stable MVP art contract before final art lands. The current prototype draws most UI chrome, board states and feedback directly in Pixi code. From this point on, gameplay and UI work can refer to named art ids in `assets/art_mvp/art_manifest.json`, while artists can replace PNGs without touching rules.

## Scope

This brief covers presentation assets for the active Core 1 MVP:

- `legacy` two-color capture-fill combat;
- 7x7 board;
- red and blue active combat colors;
- one board-only universal red-blue starter at the center;
- full-hand draw, one hold slot, `Сдать руку`, hearts, gold and strikes;
- implemented static monster intro, plus later shop and field resource tasks.

## Accepted Art Direction

The active setting is **Astral Archive Defense**. Tilebreaker is a roguelite about a defender of a star archive who builds magical contours on a battle grid to seal invading monsters while their heart holds out.

The player is not simply attacking a monster with tiles. The player is holding a defensive ritual. A closed contour is a completed seal or ward; the monster loses hearts because part of its intrusion has been cut off by the barrier.

Art language:

- red boundaries are solar seals;
- blue boundaries are lunar seals;
- the universal starter is the archive's red-blue meridian;
- captured areas are stabilized archive space inside a ward;
- `Сдать руку` is an overload of the archive mechanism paid with living light;
- gold is star dust or archive tokens;
- monster portraits show escalating breaches into the archive.

Detailed direction lives in `design/art-direction.md`.

Accepted style references live in `assets/art_refs/`:

- `astral_archive_style_portrait.png` is the primary reference for portrait battle UI, monster presentation and overall mood.
- `astral_archive_style_landscape.png` is the secondary reference for desktop composition and broader backdrop atmosphere.

Future art prompts and replacement passes should cite these references unless a later art-direction decision supersedes them.

The tile topology itself remains owned by gameplay data. Tile `matrix`, `edges`, `color`, `pattern`, `special` rules and scoring semantics live in `assets/tiles_v2/tile_manifest.json` and `configs/game.json`. Repainting a PNG must not change any of those values.

## Source Files

- Art manifest: `assets/art_mvp/art_manifest.json`
- Accepted style references: `assets/art_refs/`
- Placeholder generator: `scripts/generate-art-mvp-placeholders.js`
- Tile topology and tile PNG pack: `assets/tiles_v2/tile_manifest.json`
- Active rules/config: `configs/game.json`
- Battle definitions: `configs/levels.json`
- Monster roster for painting: `design/monster-roster.md`

Run this after changing manifest entries:

```sh
./scripts/node.sh scripts/generate-art-mvp-placeholders.js
```

## Naming And Replacement Rules

- Files are lowercase `snake_case.png`.
- Asset ids are lowercase `snake_case`.
- Replace files in place; do not rename ids or paths without updating the manifest and code references.
- Transparent assets must keep transparent backgrounds.
- Backgrounds and level backdrops are full-bleed and opaque.
- UI states must remain visually distinct at mobile size: default, hover/focus, selected, invalid, disabled, bought and scored/fading.
- Do not paint false tile exits, fake red/blue boundaries or decorative micro-cells into UI overlays.

## Required Categories

The manifest already reserves ids and files for these MVP categories:

- Screen backgrounds: menu, battle intro, battle, shop and result.
- Level backdrops: one per configured battle id.
- Board cells: empty, hover, valid, invalid and scored.
- Tile states: unclosed, closed and scored fade overlays.
- Hand and hold slots: empty, hover, selected and filled.
- Card frames and shop offer states: common, uncommon, rare, disabled, affordable, unaffordable, bought.
- Buttons: primary and secondary, with default/hover/pressed/disabled states.
- Monster portraits and compact monster icons: one per configured battle id.
- Icons: hearts, gold, strike, deck, discard, hold, multiplier, submit and lock.
- Capture overlays: red/blue capture, valid/invalid placement, selected/hover tile, target/gate markers.
- Basic effects: capture flash, gold pickup, heart heal, strike burst and submit damage.

## Artist Screen: Battle Intro

Runtime source: `src/scenes/battleIntro.js`.

Purpose: show the next archive intrusion before the board appears. The player should understand "this is the thing I am sealing" before seeing the tile grid.

The intro screen currently uses these MVP art ids:

| Screen element | Asset id pattern | File pattern | Notes |
| --- | --- | --- | --- |
| Full-screen intro background | `screen_background_battle_intro` | `screen_background_battle_intro.png` | Generic pre-battle mood. Keep it quiet enough for text and portrait readability. |
| Per-battle backdrop | `level_backdrop_battle_0N` | `level_backdrop_battle_0N.png` | Archive room under siege. Also used as a battle-intro visual field on desktop. |
| Monster portrait | `monster_portrait_battle_0N` | `monster_portrait_battle_0N.png` | 512x512 transparent portrait. See `design/monster-roster.md` for each monster. |
| Monster icon | `monster_icon_battle_0N` | `monster_icon_battle_0N.png` | 128x128 transparent HUD/icon silhouette. Must read at phone size. |
| Primary button | `button_primary_*` | `button_primary_*.png` | Future Art Track 2 will route buttons through these states. Current intro still has drawn fallback buttons. |

Portrait composition priority:

1. Monster silhouette.
2. Monster name and danger/ante text.
3. Player hearts/gold.
4. Pending reward preview.
5. `Битва` button.

Do not draw detailed board cells or tile-like red/blue exits inside the monster portrait or backdrop. Red/blue ward light is fine as atmosphere, but it must not look like a playable tile contour.

Monster icon/portrait usage and the art director production task live in `design/monster-roster.md`. Draw the five `monster_icon_battle_0N.png` files first; they are needed by both the implemented intro and the planned battle HUD.

## Gameplay-Safe Vs Gameplay-Breaking Changes

Safe art changes:

- palette, texture, silhouette and polish inside existing PNG bounds;
- clearer icons and frame treatments;
- alternate monster portraits and level backdrops;
- stronger state readability and animation source frames;
- replacing placeholder labels/patterns with final art.

Gameplay-breaking changes:

- changing tile filenames without updating manifests;
- repainting tile boundaries so their visible exits contradict `matrix`/`edges`;
- making the universal starter look like a normal red-only or blue-only tile;
- adding visuals that imply gray blank tiles are active in the starting deck;
- changing dimensions for assets that code expects to stretch as frames or icons without updating the manifest.

## Loading Plan

The current runtime loads tile textures directly from `tile_manifest.json`. The MVP art path should become:

1. Load `assets/art_mvp/art_manifest.json`.
2. Validate unique ids/files, lowercase names, declared states and existing PNGs.
3. Load all referenced PNGs into a `Map<assetId, texture>`.
4. Route low-risk screens first through manifest ids: menu, result, battle intro and shop. The current runtime already loads the manifest for `battleIntro` and uses the reserved intro/backdrop/monster ids with drawn fallbacks.
5. After the UI layout contract exists, route battle board cells, slots, buttons, monster portraits, resource icons and overlays through the same asset map.
6. Keep tile topology and tile PNG loading separate, but allow card/shop frames to compose with tile textures.

Until Art Track 2, the placeholders are a contract and a replacement pack, not a full renderer integration.

## Export Checklist

- PNG opens and has the expected dimensions from the manifest.
- Filename is lowercase snake case.
- Transparent asset has a transparent background.
- Opaque background fills the canvas edge to edge.
- State is readable at phone scale.
- Art does not contradict the active rules: two colors, universal starter, hearts/gold, hand submit, capture-fill closure.
- If a tile PNG is changed, compare it against its `matrix` and `edges` before committing.
