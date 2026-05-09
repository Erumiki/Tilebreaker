# MVP Battle UI Layout

This is the implementation contract for the current battle screen. The runtime source of truth is `src/scenes/battleLayout.js`; this note records the named slots and viewport targets so UI, tests and future art replacement stay aligned.

## Accepted Style Reference

Use `assets/art_refs/astral_archive_style_portrait.png` as the primary mood reference for portrait battle UI polish: compact HUD, monster breach banner, centered ward board, feedback rows, hand/hold area and bottom primary action. Use `assets/art_refs/astral_archive_style_landscape.png` only as a secondary reference for desktop atmosphere.

These references guide visual tone, density, icon treatment and monster pressure. They do not override this layout contract, viewport fit, tap targets or the strict 3x3 tile readability rules.

## Named Slots

Every battle layout returns these names:

| Slot | Purpose |
| --- | --- |
| `hud` | Current battle, player hearts, monster hearts and gold. |
| `monsterBanner` | Monster/battle name, round and variant marker. |
| `board` | 7x7 tile board. `cellSize = board.width / boardSize`. |
| `feedback` | One short current event line. |
| `log` | Recent economy/combat events. |
| `hold` | One saved card slot when active hand mode supports hold. |
| `hand[]` | Current hand card slots, or current/next queue slots. |
| `primaryButton` / `endRoundButton` | Main battle action. The old name remains as an alias for existing scene code and tests. |
| `sidePanel` | Desktop-only detailed combat panel. Portrait uses `hud`, `monsterBanner`, `feedback` and `log` instead. |

The debug state exposes `layout.mode`, all named rects, `layout.viewport.overflows`, `layout.safeArea`, `layout.minTouchTarget` and `uiState`.

## Portrait Contract

Portrait mode is selected for narrow screens below `760px` or tall aspect ratios. It is optimized for these smoke targets:

| Viewport | Intent |
| --- | --- |
| `360x740` | Small Android portrait. |
| `390x844` | Common iPhone portrait. |
| `430x932` | Large phone portrait. |

Portrait slot order from top to bottom:

1. compact `hud`;
2. `monsterBanner`;
3. centered board;
4. `feedback`;
5. short `log`;
6. two-row hand grid with `hold` plus seven cards;
7. full-width `primaryButton`.

The portrait hand grid uses four columns, so the active hand has eight stable tap targets: hold + seven cards. Every hand, hold and button rect must stay at least `44px` on its shortest side and stay within the viewport.

## Desktop Contract

Desktop keeps the existing proven battle composition: title in the top-left, board left/center, detailed `sidePanel` on the right, hand at the bottom and primary action above the hand near the side panel. It now uses the same named-slot contract as portrait mode.

## UI States

Battle debug exposes a primary state plus hold/submit facets:

`battleIntro`, `placing`, `cardSelected`, `holdEmpty`, `holdFilled`, `invalidPlacement`, `closureScored`, `submitPaid`, `submitBlocked`, `lastChanceHand`, `victory`, `defeat`.

`battleIntro` is now implemented as a separate pre-battle scene. The battle screen still reports only the in-battle states after the player presses `Битва`.

## Battle Intro Contract

The runtime source is `src/scenes/battleIntro.js`. The intro is presentation-only: it reads the current battle from `configs/levels.json`, shows monster identity, enemy hearts, danger/ante, current player hearts/gold and an honest pending reward preview, then enters battle through one `Битва` button.

Intro debug exposes `layout.mode`, named rects, `layout.viewport.overflows`, `layout.minTouchTarget`, `buttonRect`, `monsterPreview`, `danger`, `rewardPreview`, player hearts/gold, battle number and total battles. Smoke checks the scene on desktop and the same portrait targets as the battle layout.

### UIX Screen: Battle Intro

The UIX target is a one-decision staging screen, not a tutorial page.

Portrait order:

1. compact run HUD: battle number, player hearts and gold;
2. monster name;
3. monster portrait with compact icon overlay;
4. danger/ante and 3-4 stat rows;
5. pending reward preview;
6. fixed full-width `Битва` button.

Desktop order:

1. top-left run title and one-line premise;
2. large backdrop/portrait area in the same visual footprint as the battle board;
3. side details panel for monster name, danger, hearts, ante, player resources and reward preview;
4. primary `Битва` button in the same bottom-right action rhythm as battle.

Copy rules:

- Keep reward copy short: it previews the configured monster kill bounty paid on victory.
- Do not add extra choices, deck previews, attack schedules or lore paragraphs to this screen.
- Monster art guidance and names live in `design/monster-roster.md`; UIX should keep text/layout stable even if final monster names change later.

### Monster Icon Usage

The monster icon inventory lives in `design/monster-roster.md` under `UIX Monster Asset Usage`. Current required icon placements:

- battle intro portrait mobile: compact icon overlay on the portrait;
- battle intro desktop: compact icon in the details panel;
- future Art Track 2 battle HUD: compact icon inside `monsterBanner`;
- future Art Track 2 desktop battle side panel: compact icon before the monster/battle name.

Result and shop monster icons are optional polish until the economy/shop route exists.

## UIX Review Notes

- Keep the detailed combat math in the desktop side panel, but compress portrait to a readable HUD/event/log rhythm.
- Avoid label placement above portrait hand slots; those labels collide with the log on short phones.
- Preserve `endRoundButton` as an alias while tests and older scene code still use that name.
- Treat `layout.viewport.overflows === false` as the first smoke gate before judging visual polish.
