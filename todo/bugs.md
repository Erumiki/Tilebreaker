# Bugs For The Programmer

Bugs in game code that need to be fixed. Configs and documentation may already be updated; this file records behavior problems specifically in `src/`.

---

### ~~[2026-05-09] Filled-zone overlay looks like a debug red square~~ FIXED

**Status:** fixed in `src/scenes/battle.js` and `assets/art_mvp`: captured zone interiors now use quiet per-microcell wash plus one zone-scale seal-completion flash, with tile-cell bounds, bright corner bursts and a central compass mark like the accepted style reference, instead of direct rectangle fills or repeated mini-tile stamps.

---

### ~~[2026-05-09] Monster portraits and icons all read as the same silhouette~~ FIXED

**Status:** fixed in `scripts/generate-art-mvp-placeholders.js`: monster generation now branches by battle id into five distinct roster silhouettes: Shadow Leech, Comet Maw, Rift Hound, Broken Constellation Giant and Black Sun Monarch. Regenerated all `monster_portrait_battle_0N.png` and `monster_icon_battle_0N.png` files.

---

### ~~[2026-05-09] Art-backed board cells made valid placement hints unreadable~~ FIXED

**Status:** fixed in `src/scenes/battle.js`: valid/invalid placement hints now render as a separate overlay with corner markers and hover border above the board-cell art, so the stone underlay can stay quiet without hiding clickable cells.

---

### ~~[2026-05-09] Tiles can be placed in any physically valid cell in all scenarios~~ FIXED

---

### ~~[2026-05-08] After the first tile, there may be no valid moves left~~ FIXED

### ~~[2026-05-08] Round result overflows below the panel and shows `-0`~~ FIXED

### ~~[2026-05-08] Gray blank cannot be placed next to a colored tile~~ FIXED

### ~~[2026-05-09] Gray blank can block a colored contour~~ FIXED

### ~~[2026-05-09] Gray blank cannot be inserted into fill cells next to colored geometry~~ FIXED
