# Current Version

## v0.14 Variant C Connect Targets

**Goal:** Keep `legacy`, Variant A and Variant B available while testing Variant C: visible A/B targets give the player an external reason to grow connected land across the board.

**Task source of truth:** `todo/tasks.md` is the only backlog, task order, next-step, acceptance, and status list. Do not choose work from this file.

**Current design truth:**

- Tile-battle tuning lives in JSON configs, not in code.
- `configs/game.json` stores board size, hand size, `drawMode`, `gameplayVariant`, `activeCombatColors`, starting player HP, starting deck size, `startingDeckRecipe`, `drawBag`, damage formula, `placementPayoff`, `oneColorChain`, `connectTargets`, active tile manifest path, debug hand selection draw count, default loop guarantee toggle, round board cleanup, dead-end recovery, legacy off-color leap placement settings and run battle count.
- Active default `gameplayVariant` is `legacy`. It is the preserved current `queue + two-color capture-fill` ruleset.
- Variant ids are centralized in `src/entities/gameplayVariants.js`: `legacy`, `placement_payoff`, `one_color_chain`, `connect_targets`, `road_mode`. Old `baseline` URLs are accepted as an alias for `legacy`.
- URL overrides accept `?gameplayVariant=placement_payoff` and short aliases `?variant=a`, `?variant=b`, `?variant=c`, `?variant=d`.
- The main menu temporarily shows a variant picker (`LEG/A/B/C/D`) before starting a run. This is a jam comparison aid and can be removed after the new core is chosen.
- The combat UI and debug state show the short variant id (`LEG`, `A`, `B`, `C`, `D`) so manual playtests do not get mixed.
- `scripts/simulate-tiles.js` reads `GAMEPLAY_VARIANT` or config default and prints the active variant plus comparison order before the usual metrics.
- Manual comparison protocol and scorecard live in `design/gameplay-variants.md`.
- Variant A (`placement_payoff`) adds Focus: a useful direct-neighbor placement that extends existing land without closing a zone gives `Focus +1`, up to `placementPayoff.maxFocus`.
- Focus does not damage the enemy on placement. It is converted only when a later round result contains a captured zone, adding `placementFocus * placementPayoff.bonusPerFocus` to the largest captured zone and then resetting Focus to 0.
- Variant A UI shows `Focus current/max` in the side panel, immediate `Focus +N` feedback after setup placement and includes Focus in the round bonus/debug result.
- Variant B (`one_color_chain`) treats all combat tile symbols as one land-color for edge matching and capture-fill, while preserving original tile ids/colors for deck composition and rewards.
- In Variant B a new run uses one active combat lane (`red`) for rewards/multipliers, and round attacks combine the active configured threats into one land threat so blue/green lanes do not cause unavoidable HP drain.
- Variant B adds Chain: placing combat tiles into the same connected region increases `Chain xN` up to `oneColorChain.maxChain`; the next captured zone receives `(chain - 1) * oneColorChain.bonusPerChain` as flat bonus damage, then Chain returns to base.
- Variant B UI shows `Chain current/max`, immediate `Chain xN` feedback and includes chain bonus in round result/debug. Smoke covers the first two battles through `?variant=b`.
- Variant C (`connect_targets`) places an active A/B target pair on board cells. If connected combat land links both targets, the round gains one-time `connectTargets.bonusDamage`.
- Variant C uses one-color land for edge matching/scoring like Variant B, but does not use Chain. A new run uses one active combat lane (`red`) for rewards/multipliers, and round attacks combine active configured threats into one land threat.
- Variant C UI highlights target cells, shows distance/bonus in the side panel, gives immediate connected feedback, includes target bonus in round result/debug, and respawns a new pair on the next round after scoring. Smoke covers the first two battles through `?variant=c`.
- Variant D currently launches as a scaffold using legacy mechanics until its dedicated task implements the actual rule change.
- Scoring uses configured `damageFormula.type = areaMultiplier`: base area damage is `area * areaMultiplier`, zones larger than `largeZoneBonus.minArea` gain `largeZoneBonus.bonusPerArea` per extra micro-cell, and gray tile micro-cells inside a closed zone add `grayInteriorBonus.bonusPerCell`.
- `configs/levels.json` stores only the battle list, enemy HP and enemy color attacks.
- The active tile manifest path is `assets/tiles_v2/tile_manifest.json`.
- The active tile catalog still has `line_h`, `line_v`, four `corner`, four `tee`, and `plus` per combat color, plus 3 gray blank ids.
- Active MVP `activeCombatColors` are `red` and `blue`. Green remains in the manifest and UI model, but is not in the starting deck, early reward color cycle or the first two battle attack tables.
- A new run starts with a recipe-built 25-tile v3 experiment deck: for red and blue, `line_h x2`, `line_v x2`, each `tee` x1, each `corner` x1, no `plus`; plus one `tile_gray_blank_01`. The recipe supports duplicate tile ids without changing art or manifest.
- Active MVP `drawMode` is `queue`. The player sees only the current tile and one preview tile. Only the current tile can be placed; after placement, preview becomes current and a new preview is drawn from the hidden round queue. The round can end by button or after up to `handSize` queue placements.
- The old full-hand mode remains available for comparison through `?drawMode=hand`.
- At the start of each battle, enabled `drawBag` reorders only the next `openingDraws` future draws from the current draw pile. In v3 it caps early `corner` at 2, forbids early `plus`, requires `line`/`tee` continuation pieces, keeps at least four red and four blue tiles when available and limits gray count to 1. It does not add tiles, guarantee a loop or solve placement for the player.
- Stable debug/smoke runs use URL overrides such as `?seed=20260508&guaranteedLoopHands=true`; normal player runs generate a fresh seed on each start.
- At round end, played and unplayed hand or queue tiles go to discard; when draw pile is empty, discard is shuffled back into draw pile.
- Starting player HP is 160 while queue is active, because queue has less immediate control than full-hand mode and needs a little more runway for the 5-battle prototype loop.
- After each won battle, the player chooses one of three rewards: add a tile to discard/deck, remove a tile from deck, or increase a combat color multiplier. Add/boost rewards respect `activeCombatColors`, so the v3 start does not offer green before the game reintroduces it deliberately.
- `dot` and base `cap` tiles are not in the MVP deck.
- A combat color's micro-cells are territory boundaries.
- A fully enclosed empty or filled interior becomes captured land for that color.
- Between rounds, closed/scored tiles are cleared and unclosed tiles stay on the board, so unfinished territory can be completed later.
- A zero-damage first round is not automatically bad: it can be a valid setup round if the saved board contains useful, buildable contour that converts into captures in later rounds.
- If the next hand cannot continue the saved board at all, the battle uses fresh-start recovery and clears the unclosed board for that hand.
- Placement is broad by default: a tile can be placed in any empty cell with no direct neighbors; if it has direct neighbors, all touching edges must match. This supersedes the older off-color leap as the main escape from artificial placement narrowing.
- Gray tiles use asymmetric wildcard placement when `grayWildcardPlacement` is enabled: a gray blank can be placed as fill next to gray or combat tiles, while a combat tile placed next to an existing gray blank must touch it with a blank edge. Gray blanks are neutral fill/setup pieces for larger interiors.
- Color multipliers are stored on the run and multiply the zone's configured base damage after area and gray bonuses.
- Combat UI shows player HP, enemy HP, round number, enemy attacks, deck/discard counts, board, hand, and per-color round results: enemy attack, captured area, capture sum, multiplier, payoff bonus, enemy damage or player damage.
- A minimal 2x2 corner loop scores area 12 with no size bonus; a larger closed zone can now beat it clearly, especially when a gray blank is enclosed as preparation/fill.
- The simulator reads the same `startingDeckRecipe` and `drawBag` as the game and reports small-capture diagnostics: `minimal capture share`, `avg capture area`, `placements before capture`, zero-damage hands/rounds, zero-damage streak, captures in 3 rounds, quick 4-corner loops, and opening draw/hand composition by color and shape. It can be forced into queue simulation with `DRAW_MODE=queue`; queue uses a small beam AI because the decision space is narrower than full-hand play.
- Interpret `zero damage` over a multi-round window, not as an isolated first-round failure. Watch zero-damage streaks, captures within the next 2-3 rounds, dead-end/freshStart rate, win rate and player damage.
- Queue remains the active MVP mode. The v3 two-color recipe with `corner` cap 2 moved the active queue opening from near-total small-loop dominance toward larger areas: quick sim on seed `20260508` showed battle_01 at 21/40 wins, `64%` small captures and `avg area 17.1` for `queue + opening bag`.
