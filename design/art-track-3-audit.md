# MVP Art Track 3 Audit

Date: 2026-05-10.

## Result

The normal Core 1 path now has a hard asset gate:

- `scripts/validate-art-assets.js` validates `assets/art_mvp/art_manifest.json` ids, filenames, duplicate ids/files, declared states, existing PNGs, PNG CRC/loadability, expected dimensions and opaque-background alpha rules.
- The same validator checks the configured battle ids for `level_backdrop_*`, `monster_portrait_*` and `monster_icon_*` coverage.
- Active tile art is also checked through `configs/game.json:tileBattle.manifestPath`, `tileBattle.specialTiles` and enabled ordinary shop-card tile references.
- `npm run check` runs this validation before syntax checks.

Runtime behavior is no longer silent when required presentation art is unavailable. `src/render/art.js` draws an obvious `MISSING ART` block with the missing id, and `window.__tilebreakerDebug.getArtDebug()` exposes load counts and failures for smoke tests.

## Normal-Path Manifest Coverage

The following visible surfaces are now manifest-backed or validated as required assets:

- menu, battle intro, battle, shop and result backgrounds;
- battle intro monster portraits, icons and level backdrops;
- battle board cells, placement overlays, target/gate markers, closure seal overlays and capture flash;
- hand and hold slots;
- battle HUD/panel surfaces, resource pickup effects and resource icons;
- shop offer cards, shop buttons and missing tile previews;
- result panel, result background and result action button;
- normal-path buttons and core HUD icons.

## Procedural Allowlist

These code-drawn pieces remain intentional for the jam build:

- localized text, numbers, logs and labels;
- menu logo lettering and simple scalable decorative strokes;
- thin borders, corner brackets, dim overlays and hover glints layered over manifest surfaces;
- semantic combat rows and color bars in the side panel;
- closure interior micro-cell shimmer, which is data-derived feedback over the manifest seal overlay;
- one-color debug-variant tile recoloring, because normal `legacy` tile art remains PNG-backed and validated.

## Art-Lead Notes

No missing normal-path PNGs were found by validation. The remaining visible procedural pieces are functional overlays or text/data rendering rather than hidden placeholder art. Optional post-jam polish can still replace combat-row bars, logo strokes or closure shimmer with authored assets, but they are not blocking the MVP submission path.
