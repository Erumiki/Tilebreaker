# Current Version

## v0.17 Core 1 Rescue Hearts

**Goal:** Rescue the most playable core: `legacy` two-color capture-fill, without gray blank, with full-hand draw by default, heart-scale combat, and a visible cost for every new pick/refill.

**Task source of truth:** `todo/tasks.md` is the only backlog, task order, next-step, acceptance, and status list. Do not choose work from this file.

**Current design truth:**

- Tile-battle tuning lives in JSON configs, not in code.
- `configs/game.json` stores board size, hand size, `drawMode`, `gameplayVariant`, `activeCombatColors`, starting player hearts, heart conversion/pick-pressure settings, starting deck size, `startingDeckRecipe`, `drawBag`, damage formula, `placementPayoff`, `oneColorChain`, `connectTargets`, `roadMode`, active tile manifest path, debug hand selection draw count, default loop guarantee toggle, round board cleanup, dead-end recovery, legacy off-color leap placement settings and run battle count.
- Active default `gameplayVariant` is `legacy`. It is the preserved two-color capture-fill ruleset and the main rescue candidate.
- Variant ids are centralized in `src/entities/gameplayVariants.js`: `legacy`, `placement_payoff`, `one_color_chain`, `connect_targets`, `road_mode`. Old `baseline` URLs are accepted as an alias for `legacy`.
- URL overrides accept `?gameplayVariant=placement_payoff` and short aliases `?variant=a`, `?variant=b`, `?variant=c`, `?variant=d`.
- The main menu temporarily shows only the still-useful variant picker options. Modes removed from active playtest stay URL/debug-addressable but are hidden from the menu.
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
- Variant D (`road_mode`) places active S/E gates on board cells. All combat tiles count as one land color for edge matching and connected road checks.
- Variant D disables area-capture payoff: closed contours do not deal the main damage in this mode.
- Variant D scores a completed connected road between S/E gates once per pair. Damage uses the shortest placed S/E path, not whole connected component size: `roadMode.completeBonus + min(extraLength, roadMode.maxScoredExtraLength) * roadMode.damagePerTile`, where `extraLength = max(0, routeEdges - gateDistance)`. Short direct bridges are deliberately weak; longer real routes are the main payoff.
- Variant D attacks are combined into one land threat like B/C, and a new run uses one active combat lane (`red`) for rewards/multipliers.
- Variant D UI highlights S/E gates, shows gate distance or road bonus in the side panel, gives immediate connected-road feedback, includes road length/extra/damage in result/debug, clears scored road-path tiles, and respawns a new pair on the next round after scoring. Smoke covers the first two battles through `?variant=d`.
- Scoring uses configured `damageFormula.type = areaMultiplier`: base area damage is `area * areaMultiplier`, zones larger than `largeZoneBonus.minArea` gain `largeZoneBonus.bonusPerArea` per extra micro-cell, and gray tile micro-cells inside a closed zone add `grayInteriorBonus.bonusPerCell`.
- `configs/levels.json` stores only the battle list, enemy HP and enemy color attacks.
- The active tile manifest path is `assets/tiles_v2/tile_manifest.json`.
- The active tile catalog still has `line_h`, `line_v`, four `corner`, four `tee`, and `plus` per combat color, plus 3 gray blank ids in the manifest.
- Active MVP `activeCombatColors` are `red` and `blue`. Green remains in the manifest and UI model, but is not in the starting deck, early reward color cycle or the first two battle attack tables.
- A new run starts with a recipe-built 24-tile rescue deck: for red and blue, `line_h x2`, `line_v x2`, each `tee` x1, each `corner` x1, no `plus`, no gray blank. The recipe supports duplicate tile ids without changing art or manifest.
- Active MVP `drawMode` is `hand`. The player sees the full `handSize` hand because queue made the best mode feel too much like waiting for a card instead of planning.
- Legacy combat now uses hearts in the playable layer: the first monster has 3 hearts, the player starts with 18 hearts, a minimal 2x2 capture is 1 heart, and larger zones can convert into more hearts through `tileBattle.hearts.zoneDamagePerHeart`.
- Legacy UI shows only active red/blue combat rows. Green remains in the manifest and old/debug structures, but no longer consumes visible combat-result space in the active rescue path.
- Ending a non-lethal legacy round previews the cost of the next pick before the player confirms it. New pick damage is `newPickBaseDamage + floor(unplayedTiles / unplayedTilesPerDamage)`, currently `1 + floor(unplayed / 4)`.
- Pick-pressure is intentionally scoped to `legacy`; hidden/archived variants stay URL-playable without inheriting this new tempo rule.
- Manual playtest after switching to full-hand: `legacy` immediately feels better. The next legacy goal is not more variants, but a cleaner battle loop: hide irrelevant green UI, show monster/player hearts, make a new pick/refill deal incoming damage, and let unplayed tiles increase that incoming damage.
- Queue remains available for comparison through `?drawMode=queue`, but it is no longer the default playtest posture.
- At the start of each battle, enabled `drawBag` reorders only the next `openingDraws` future draws from the current draw pile. In the rescue deck it caps early `corner` at 2, forbids early `plus`, requires `line`/`tee` continuation pieces, keeps at least four red and four blue tiles when available and limits gray count to 0. It does not add tiles, guarantee a loop or solve placement for the player.
- Stable debug/smoke runs use URL overrides such as `?seed=20260508&guaranteedLoopHands=true`; normal player runs generate a fresh seed on each start.
- At round end, played and unplayed hand or queue tiles go to discard; when draw pile is empty, discard is shuffled back into draw pile.
- Starting player hearts are 18 in the active rescue build.
- After each won battle, the player chooses one of three rewards: add a tile to discard/deck, remove a tile from deck, or increase a combat color multiplier. Add/boost rewards respect `activeCombatColors`, so the v3 start does not offer green before the game reintroduces it deliberately.
- `dot` and base `cap` tiles are not in the MVP deck.
- A combat color's micro-cells are territory boundaries.
- A fully enclosed empty or filled interior becomes captured land for that color.
- Between rounds, closed/scored tiles are cleared and unclosed tiles stay on the board, so unfinished territory can be completed later.
- A zero-damage first round is not automatically bad: it can be a valid setup round if the saved board contains useful, buildable contour that converts into captures in later rounds.
- If the next hand cannot continue the saved board at all, the battle uses fresh-start recovery and clears the unclosed board for that hand.
- Placement is broad by default: a tile can be placed in any empty cell with no direct neighbors; if it has direct neighbors, all touching edges must match. This supersedes the older off-color leap as the main escape from artificial placement narrowing.
- Gray tiles still have asymmetric wildcard placement support in rules/tests, but active playtests remove gray blank from the starting deck because it currently adds confusion without useful decisions.
- Color multipliers are stored on the run and multiply the zone's configured base damage after area and gray bonuses.
- Combat UI shows player hearts, monster hearts, round number, red/blue enemy attacks, deck/discard counts, board, hand, and per-color round results: enemy attack, captured area, heart hit, multiplier, payoff bonus, monster damage or player damage.
- A minimal 2x2 corner loop scores area 12 with no size bonus; a larger closed zone can beat it through the large-zone bonus, but the gray-fill route is no longer part of active tests.
- The simulator reads the same `startingDeckRecipe` and `drawBag` as the game and reports small-capture diagnostics: `minimal capture share`, `avg capture area`, `placements before capture`, zero-damage hands/rounds, zero-damage streak, captures in 3 rounds, quick 4-corner loops, and opening draw/hand composition by color and shape. It can be forced into queue simulation with `DRAW_MODE=queue`; queue uses a small beam AI because the decision space is narrower than full-hand play.
- Interpret `zero damage` over a multi-round window, not as an isolated first-round failure. Watch zero-damage streaks, captures within the next 2-3 rounds, dead-end/freshStart rate, win rate and player damage.
- Manual playtest result on 2026-05-09: `legacy` is the most playable variant, but still collapses into waiting for the right card. Two colors helped but did not fully fix it. Variant A did not feel meaningfully different and is not a standalone direction; Variant B lacks a strong one-color idea; Variant D/road-style scoring needs rethinking/rotation before more tests; the fifth tested direction is cut. Current favorites are Core 1 rescue and a separate Kingdomino-like combat spike.
- Updated legacy target after hearts implementation: judge the encounter by "how many picks did it take to kill the monster?" before adding start-center, hold, rotate or double-color control tools.
