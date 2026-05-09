# MVP Battle UI Layout

This is the implementation contract for the current battle screen. The runtime source of truth is `src/scenes/battleLayout.js`; this note records the named slots and viewport targets so UI, tests and future art replacement stay aligned.

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

`battleIntro` is reserved for the next intro-scene task; the battle screen currently reports the in-battle states.

## UIX Review Notes

- Keep the detailed combat math in the desktop side panel, but compress portrait to a readable HUD/event/log rhythm.
- Avoid label placement above portrait hand slots; those labels collide with the log on short phones.
- Preserve `endRoundButton` as an alias while tests and older scene code still use that name.
- Treat `layout.viewport.overflows === false` as the first smoke gate before judging visual polish.
