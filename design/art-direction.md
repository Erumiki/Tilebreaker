# Art Direction: Astral Archive Defense

Date: 2026-05-09.

## North Star

Tilebreaker is a roguelite about a defender of a star archive who builds magical contours on a battle grid to seal invading monsters while their heart holds out.

The player is not simply attacking a monster with tiles. The player is holding a defensive ritual. A closed contour is a completed seal or ward. The monster loses hearts because part of its intrusion has been cut off by the barrier.

## Accepted Style References

The accepted visual direction is captured in project-local reference images:

- `assets/art_refs/astral_archive_style_portrait.png` - primary portrait mobile reference.
- `assets/art_refs/astral_archive_style_landscape.png` - secondary desktop/wide reference.

Future monster portraits, level backdrops, UI chrome, card/shop frames, buttons, slots, icons and effects should use these images as the default style target unless a later art-direction decision replaces them.

The references are authoritative for mood and composition: observatory under siege, strict board-game UI, red/blue ward lines, monster breach pressure, living-light hearts and star-dust gold. They are not authoritative for gameplay geometry. If a reference detail conflicts with the 3x3 tile matrix, edge signatures, portrait layout contract or mobile readability, the implemented rules win.

## Why This Fits The Current Core

- Boundary tiles become protective red and blue seal lines.
- Captured empty space becomes stabilized archive space inside the ward.
- The universal starter becomes the central meridian of the archive device.
- `Сдать руку` becomes overloading the archive mechanism with the player's own life force.
- Hearts are not just HP: they are the defender's remaining living light.
- Gold becomes star dust or archive tokens earned from stabilized space.
- Strikes become consecutive sealing pulses while the defense is in rhythm.
- Monster portraits and level backdrops now have a job: show the escalating siege of the archive.

## Visual Language

### Board And Tiles

- The board is a defensive astral matrix, not farmland and not a road network.
- The 7x7 board can read as a stone or brass floor under an observatory dome.
- Every tile still needs exact 3x3 readability. The art may add material, but the gameplay line language stays strict.
- Red lines are solar seals: warm, sharp, dangerous.
- Blue lines are lunar seals: cold, clean, stabilizing.
- The universal starter is a red-blue central axis, like the archive's meridian needle.

### Monsters

Monsters should feel like intrusions from outside the map rather than ordinary enemies standing on the board.

The production-facing roster lives in `design/monster-roster.md`. It defines each battle's monster name, portrait/icon filenames, level backdrop target, silhouette brief and UIX notes for readability.

Suggested five-battle escalation:

1. `battle_01`: small shadow breach or star leech.
2. `battle_02`: comet maw or many-eyed void scout.
3. `battle_03`: rift beast pressing against the observatory shell.
4. `battle_04`: broken constellation giant or archive-devouring saint.
5. `battle_05`: black sun, void monarch or the living breach itself.

Each monster needs a compact 128px icon and a readable 512px portrait silhouette. The portrait can be strange, but the HUD icon must be simple.

### Screens And Backdrops

The run should feel like the archive is being breached room by room:

- Menu: intact archive, quiet star map, central seal dormant.
- Battle intro: the next intrusion appears outside or above the defensive matrix.
- Battle: active ward floor, monster pressure visible behind the HUD.
- Shop: archive workshop or sealed catalog where gold buys new seal plates.
- Result: stabilizing light after victory or a broken ward after defeat.

Level backdrops can escalate:

1. Outer observatory platform.
2. Hall of charts.
3. Dome chamber.
4. Broken archive stacks.
5. Central engine of the star archive.

## Asset Manifest Mapping

The existing MVP art contract already supports this direction:

- `monster_portrait_*`: invading astral monster portraits.
- `monster_icon_*`: compact breach icons for HUD and battle intro.
- `level_backdrop_*`: archive rooms under escalating siege.
- `overlay_capture_red` and `overlay_capture_blue`: solar and lunar ward fill.
- `effect_capture_flash`: seal-completion pulse.
- `effect_submit_damage`: life-light pulled from the player into the archive device.
- `effect_gold_pickup`: star dust or archive token burst.
- `icon_gold`: archive token, star dust or small sun coin.
- `icon_heart_*`: living light, not generic medical hearts.
- `icon_lock`: locked ward, sealed catalog entry or blocked mechanism.
- `slot_hold_*`: a reserved seal plate in the archive device.

## Guardrails

- Do not make the game look like a generic space shooter. The main activity is drawing seals on a board.
- Do not let glow blur edge signatures. Red and blue exits must remain crisp at small scale.
- Do not let background star noise compete with the 3x3 tile grid.
- Do not make captured overlays look like extra tile exits.
- Do not make the universal starter look red-only or blue-only.
- Avoid heavy decorative constellations inside tile cells unless they follow the existing matrix.

## First Art Pass

The first practical pass should not redraw everything at once. It should prove the direction with a small, high-signal slice:

1. One battle background using the observatory floor.
2. One battle intro background.
3. `monster_portrait_battle_01` and `monster_icon_battle_01`.
4. Red and blue capture overlays as solar and lunar seals.
5. Heart, gold, submit and strike icons in the new language.
6. A restrained tile palette update if it improves readability without changing topology.

Success criterion: a player should describe the battle as "I am sealing a monster breach" before reading any external explanation.

Use `assets/art_refs/astral_archive_style_portrait.png` as the default visual comparison for this pass.
