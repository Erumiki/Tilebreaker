# MVP Monster Roster

Date: 2026-05-09.

This roster is the art-facing source for the five MVP monsters used by `configs/levels.json`. Runtime level data now has separate `name` and `monsterName` fields: `name` is the encounter/stage label, while `monsterName` is the player-facing monster title.

## Shared Rules

- Setting: Astral Archive Defense.
- Monsters are intrusions breaching the archive, not ordinary creatures standing on the board.
- Each battle needs one 512x512 transparent portrait and one 128x128 transparent icon.
- Use the existing asset ids and filenames from `assets/art_mvp/art_manifest.json`.
- Portraits may be expressive and strange; icons must remain simple silhouettes at HUD size.
- Do not paint fake red/blue tile exits, board cells or gameplay contours into monster art.
- Escalation should be readable without text: small breach, scout, beast, giant, cosmic final.

## UIX Monster Asset Usage

This is the current UIX inventory for where monster art appears or is planned to appear. Required assets should be drawn first; optional assets can wait until result/shop polish.

| Screen / slot | Required art | Runtime/source | Current status | UIX constraint |
| --- | --- | --- | --- | --- |
| Battle intro, portrait mobile | 512px portrait + 128px icon | `src/scenes/battleIntro.js`, `layout.portrait`, `layout.icon` | Implemented now | Portrait is the main visual read. Icon overlays the lower-right of the portrait at roughly 56-72px on phone screens. |
| Battle intro, desktop | 512px portrait + 128px icon + level backdrop | `src/scenes/battleIntro.js`, `layout.backdrop`, `layout.portrait`, `layout.icon` | Implemented now | Portrait sits in the board-sized visual field. Icon appears in the details panel at roughly 86px. |
| Battle HUD / monster banner | 128px icon | `src/scenes/battleLayout.js`, `monsterBanner` | Planned for Art Track 2 | Icon should read at 32-48px and support quick battle identity while the board stays dominant. |
| Battle side panel, desktop | 128px icon or cropped portrait | `src/scenes/battleLayout.js`, `sidePanel` | Planned for Art Track 2 | Use icon first. Avoid large portrait here unless it does not steal space from combat math. |
| Result screen | 128px icon | `src/scenes/result.js` | Optional polish | Can echo the defeated monster, but not required before economy/shop work. |
| Future shop / next-battle preview | 128px icon | future shop scene | Optional later | Use the next monster icon only if it helps route clarity. No new asset size needed. |

Icon readability target: each `monster_icon_battle_0N.png` must remain recognizable as a flat silhouette at 32px, 48px and 86px. Avoid tiny eyes, thin constellation lines or details that vanish in the battle HUD.

## Roster

| Battle | Runtime name | Art monster name | Portrait asset | Icon asset | Level backdrop | Visual brief | UIX emphasis |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `battle_01` | First Round | Shadow Leech | `monster_portrait_battle_01.png` | `monster_icon_battle_01.png` | `level_backdrop_battle_01.png` | A small ink-black astral parasite slipping through a hairline crack in the archive dome. One clear head/body shape, faint star motes in the body, weak but hungry. | First monster must be instantly readable and not more impressive than the player. Keep the icon as a simple curled leech silhouette. |
| `battle_02` | Higher Stakes | Comet Maw | `monster_portrait_battle_02.png` | `monster_icon_battle_02.png` | `level_backdrop_battle_02.png` | A fast void scout shaped like a comet with a split mouth and two or three bright eyes. It feels mobile, sharp and louder than battle 1. | Show that danger increased while hearts remain approachable. Icon can be a crescent mouth plus comet tail. |
| `battle_03` | Complex Board | Rift Hound | `monster_portrait_battle_03.png` | `monster_icon_battle_03.png` | `level_backdrop_battle_03.png` | A quadruped or serpentine rift beast pressing its claws/muzzle against the observatory shell from outside. Cracks and pressure are more important than anatomy. | Communicate mid-run pressure. Portrait should point inward toward the board, but leave UI stat zones visually quiet. |
| `battle_04` | Build Check | Broken Constellation Giant | `monster_portrait_battle_04.png` | `monster_icon_battle_04.png` | `level_backdrop_battle_04.png` | A large humanoid or saint-like figure made from broken constellation lines and archive debris. Elegant, dangerous, partly sacred, partly ruined. | This is the penultimate wall. Keep a strong head/torso silhouette for the icon; avoid tiny constellation details at 128px. |
| `battle_05` | Final Stakes | Black Sun Monarch | `monster_portrait_battle_05.png` | `monster_icon_battle_05.png` | `level_backdrop_battle_05.png` | The living breach itself: a black sun with a crown-like corona, an eye or void core, and red/blue ward light struggling at the edge. Cosmic final boss, not a creature with limbs. | Final screen should feel like the archive engine is about to fail. Icon can be a black disc with a broken corona. |

## Backdrop Escalation

| Battle | Backdrop target | Notes |
| --- | --- | --- |
| `battle_01` | Outer observatory platform | Mostly intact, calm star map, first crack visible. |
| `battle_02` | Hall of charts | More moving light, papers/maps lifted by breach wind. |
| `battle_03` | Dome chamber | Shell visibly under pressure, cracks around the ward floor. |
| `battle_04` | Broken archive stacks | Shelves, tablets and star charts fractured by intrusion. |
| `battle_05` | Central archive engine | Bright central mechanism, strong contrast, final breach above/behind it. |

## First Replacement Slice

For the first real art pass, draw only:

1. `monster_portrait_battle_01.png`
2. `monster_icon_battle_01.png`
3. `level_backdrop_battle_01.png`
4. `screen_background_battle_intro.png` if the current generic intro background fights the portrait.

This proves style, silhouette readability and intro-screen composition before committing to all five monsters.

## Art Director Task: MVP Monster Icon And Portrait Pack

Owner: Art Director / Artist.

Goal: replace placeholder monster art with a coherent five-monster Astral Archive breach set that works in the implemented battle intro and future battle HUD.

Deliverables:

1. Five compact transparent icons:
   - `assets/art_mvp/monster_icon_battle_01.png`
   - `assets/art_mvp/monster_icon_battle_02.png`
   - `assets/art_mvp/monster_icon_battle_03.png`
   - `assets/art_mvp/monster_icon_battle_04.png`
   - `assets/art_mvp/monster_icon_battle_05.png`
2. Five transparent portraits:
   - `assets/art_mvp/monster_portrait_battle_01.png`
   - `assets/art_mvp/monster_portrait_battle_02.png`
   - `assets/art_mvp/monster_portrait_battle_03.png`
   - `assets/art_mvp/monster_portrait_battle_04.png`
   - `assets/art_mvp/monster_portrait_battle_05.png`
3. Optional if time allows: five level backdrops from the backdrop escalation table.

Priority order:

1. All five 128px icons first, because they support intro, future battle HUD and future result/shop previews.
2. `battle_01` portrait next, to prove the style on the first player-facing monster.
3. Remaining portraits in battle order.
4. Level backdrops only after the monster silhouettes are stable.

Acceptance:

- The five icons are distinct from one another at 32px.
- The five portraits clearly escalate from minor breach to final cosmic threat.
- All files keep existing filenames, dimensions and alpha expectations from `assets/art_mvp/art_manifest.json`.
- The art does not imply playable tile paths, fake red/blue exits or changed gameplay topology.
