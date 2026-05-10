# Architectural Decision Log

Important decisions are recorded with date and rationale so any team member or Claude can understand why something was done this way.

## Format

```text
### YYYY-MM-DD - Decision title

**Context:** What caused it.
**Decision:** What was decided.
**Rationale:** Why this option was chosen.
```

---

### 2026-05-10 - Final jam build uses relative Vite production assets

**Context:** The itch.io HTML5 upload needs a production `dist/` folder whose root contains `index.html` and whose asset references still work after the files are zipped and hosted from a project page.
**Decision:** Add `./scripts/npm.sh run build` as the release build path using `vite build --base=./`, keep `dist/` as generated output and use local `vite preview` for production-route QA and final screenshot capture.
**Rationale:** Relative asset URLs make the build portable for itch.io without changing runtime asset loading in development. Keeping `dist/` generated avoids mixing source history with build artifacts while preserving a repeatable release path.

### 2026-05-09 - MVP card balance sync stages joker and double line

**Context:** The fixed-seed balance gate showed that the live guaranteed joker shop and `double_red_line_h` did not outperform the no-shop baseline enough to justify final-MVP risk.
**Decision:** Remove the guaranteed `card_joker_line_v` offer, stage `card_joker_line_v` and `card_double_line`, lower common offer pressure and keep only restrained ordinary line/tee/corner plus plus/cross in the active shop. Active families now carry final `mvp_keep_*` balance statuses from `configs/cards.json`.
**Rationale:** The jam build needs one clear active card pool. Keeping the implemented special-card definitions staged preserves future work without letting unapproved control tools stay active by inertia.

### 2026-05-09 - Joker line is guaranteed for playtesting

**Context:** `joker_line_v` was technically enabled in the shop, but the weighted offer pool made it appear in only a tiny fraction of manual shops, so the player could easily never see the first wildcard control card.
**Decision:** Add `shop.guaranteedOffers` to `configs/cards.json` and guarantee `card_joker_line_v` as one offer from the battle 2 shop onward. It remains paid, capped at one per shop and marked balance-unverified.
**Rationale:** A control card cannot be evaluated if it is invisible. Guaranteeing one slot preserves price pressure while making the next balance pass about the card's actual feel, not whether RNG happened to show it.

### 2026-05-09 - First double card uses macro-tile placement

**Context:** The shop already sells ordinary red/blue helpers, controlled plus/cross cards and `joker_line_v`, but the planned double-card family still needed one concrete behavior before it could enter the playable build.
**Decision:** Enable `card_double_line` as `double_red_line_h` from battle 3. It is bought and drawn as one card id, then placement expands it into two adjacent ordinary `tile_red_line_h` board segments. Both segment cells must be empty; the internal edge and all outside edges use normal edge legality; scoring treats those board segments like ordinary red line tiles with no bonus multiplier.
**Rationale:** This gives the player a clear control tool without adding a second placement click, free rotation or special damage. Keeping the first double family red, horizontal, expensive and low-weight lets the next balance pass test whether reach/control helps planning or revives automatic small closures.

### 2026-05-09 - Between-battle progression becomes a gold card shop

**Context:** Battles now pay closure gold, field resources and monster bounties, and the card catalog is validated data. The old `1 of 3` free upgrade screen no longer fits the deck-building loop.

**Decision:** Replace the normal post-victory upgrade route with a `shop` scene. Each non-final victory generates 5 offers from `configs/cards.json` for the next battle, using rarity weights, card offer weights, active colors, unlock battle and `maxPerShop`. The player can buy zero or more affordable cards, and each purchase spends gold immediately and adds the bought tile or special tile to the persistent deck and discard pile.

**Rationale:** Gold now has a clear between-battle sink without hardcoding reward families in scene code. Sending buys to discard preserves the existing deck accounting tempo, while `balanceStatus: "unverified"` keeps bought cards visibly provisional until the separate card-balance pass approves each family.

### 2026-05-09 - Card catalog becomes validated data before shop UI

**Context:** Gold and monster bounty now exist, but between-battle spending still needs a stable data source before replacing the old upgrade screen.

**Decision:** Add `configs/cards.json` as the source of truth for shop offers. The catalog defines offer count, rarity weights, active red/blue shop colors, price bands, ordinary red/blue line/tee/corner buys, controlled red/blue plus buys, initially one enabled `joker_line_v` special-card definition and explicitly staged joker/double candidates. `src/entities/cards.js` validates the catalog during config load, checks enabled tile/special/asset references and exposes enabled-offer filtering plus special tile extraction for the shop. Later passes added `shop.guaranteedOffers` for visible control-card playtesting and enabled the first double-card family as `double_red_line_h`.

**Rationale:** This lets the shop consume data instead of hardcoding prices or offer families in a scene. Keeping stronger joker/double cards staged protects the closure puzzle while making the planned control-card direction concrete and testable.

### 2026-05-09 - Field resources and kill bounty extend battle economy

**Context:** Closure and strike gold made battle income visible, but gold still had no map-level decision and monsters did not pay their configured victory reward.

**Decision:** Active `legacy` seeds configurable board-underlay field resources from `tileBattle.fieldResources`. Gold on a placed cell is collected immediately and consumed once; remaining gold and hearts inside scored closure cells are consumed by closure. Hearts heal only through closure and respect `hearts.maxPlayerHp`. Monster victory pays `battle.reward` from `configs/levels.json` once as kill bounty.

**Rationale:** This makes board position matter economically without changing tile topology or adding the shop early. The player can choose between direct gold pickup, sealing resources into a larger contour and preserving heart pressure from `Сдать руку`.

### 2026-05-09 - Monster intro is a presentation-only route

**Context:** The active Core 1 loop needs a readable beat before each battle so the player sees the incoming monster, hearts, danger and pending reward before the board appears.

**Decision:** Add a standalone `battleIntro` scene between menu/shop progression and battle. It reads the current `configs/levels.json` battle data, uses `assets/art_mvp` intro/backdrop/monster placeholder ids with drawn fallbacks and exposes `getBattleIntroDebug()`. The intro has one action, `Битва`, and does not create tile-battle state.

**Rationale:** A separate scene strengthens the first-minute fantasy without touching combat rules or deck accounting. The later battle-economy task now pays the previewed bounty on victory.

### 2026-05-09 - Art direction is Astral Archive defense

**Context:** The MVP art contract now has monster portraits, level backdrops, board overlays, heart/gold/submit effects and shop/card frames. A generic tile art skin would not explain why the monster matters or why the player pays hearts to continue.

**Decision:** Move the active setting toward Astral Archive defense. Tilebreaker is a roguelite about a defender of a star archive who builds magical red and blue contours on a battle grid to seal invading monsters while their heart holds out. A closed contour is a completed seal or ward, not a direct weapon swing. The monster loses hearts because part of its intrusion is cut off by the barrier. `Сдать руку` is an overload of the archive mechanism paid with living light.

**Rationale:** This direction gives every reserved MVP art asset a clear job: monster portraits are escalating breaches, level backdrops are archive rooms under siege, capture overlays are solar/lunar wards, hearts are living light, gold is star dust or archive tokens, and the universal starter is the archive's red-blue meridian. It preserves the strict 3x3 tile readability while adding a stronger defensive fantasy.

**Style reference:** The accepted fake screenshots are stored in `assets/art_refs/`: `astral_archive_style_portrait.png` is the primary reference for future portrait UI, monster and effect work; `astral_archive_style_landscape.png` is secondary for desktop/backdrop mood. They guide style and composition but do not override gameplay topology or layout constraints.

### 2026-05-09 - Core 1 uses one universal red-blue center starter

**Context:** The two temporary center anchors made the opening playable, but they looked like ordinary deck tiles and split the "start either color here" rule across two objects. The card GD pass already narrowed the next control card test to one board-only universal vertical starter.
**Decision:** Replace the two ordinary center anchors with `starter_universal_line_v`, defined in config as a special board-only tile with matrix `.*. / .*. / .*.`. The `*` symbol matches active combat colors on edges, blocks flood-fill for the evaluated color, does not add wildcard cells to score area and does not let red and blue match directly. Active immediate scoring keeps only the placed tile's color if a shared wildcard-assisted closure would otherwise score both colors.
**Rationale:** This tests the desired opening communication without adding the shop, rotation or broader wildcard deck power. The starter should improve first-turn direction while staying a connector, not a free damage source.

### 2026-05-09 - Card GD pass defines universal starter and buyable controls

**Context:** Core 1 Rescue now has full-hand planning, hold, heart-scale hand submit, immediate closure scoring and visible gold. The remaining problem is control: the temporary two-tile center bridge communicates poorly, and gold will not matter until the between-battle card pool gives the player meaningful purchases.
**Decision:** Record the card design in `design/card-pool.md`. The first implementation target is a board-only `starter_universal_line_v`: a vertical wildcard boundary with rule matrix `.*. / .*. / .*.` that can match active combat colors, blocks flood-fill for the evaluated color and does not make red and blue match directly. The later shop pool should begin with ordinary red-blue line/tee/corner buys plus an uncommon `joker_line`; stronger red-blue split corners, joker corners, joker tees and gold-seal cards are staged as later tests with rough prices from 5 to 7 gold.
**Rationale:** The starter solves the opening communication problem without adding a full shop at the same time. Keeping wildcard power narrow protects the closure puzzle from becoming automatic, while the priced card list gives gold a planning role once the starter has been checked.

### 2026-05-09 - Core 1 Rescue replaces round end with hand submit and immediate closure

**Context:** The latest playable Core 1 Rescue build already plays better with full hand, center anchors, hold and hearts, but the old round-end model still mixes delayed scoring, monster attack damage and unclear new-pick language. The next implementation needs one clear tempo rule instead of old combat leftovers.

**Decision:** Active `legacy` replaces the old end-round/new-pick action with `Сдать руку`. The button previews and immediately charges `submitCost = 1 + floor(unplayedHandCards / 4) + floor(handSubmitsThisBattle / 2)`, then redeals. Separate monster attack damage is removed from active Core 1; the player loses hearts only through hand submit in this MVP pass. Closed zones score immediately after the placement that closes them, before any later action. Each closed zone gives `+1 gold`; closures on consecutive valid placements award strike bonus gold equal to the current strike count. Gold is saved for a later between-round card/shop pass, not spent in this implementation pass.

**Rationale:** This keeps the rescued Core 1 focused on one readable pressure: "Can I close something with this hand, or do I surrender the hand and pay hearts?" Immediate closure makes the cause/effect legible, while gold and strike reward fast tactical closures without reintroducing old monster attack bookkeeping.

**Superseded 2026-05-09:** Gold is no longer only saved. The later between-battle progression decision implemented the card shop, so gold is now spent on catalog cards after non-final victories.

### 2026-05-09 - Core 1 Rescue uses hearts and new-pick cost

**Context:** Manual playtest showed that `legacy + hand` remains the most playable core, but large numbers and extra green UI noise make battle tempo hard to read. The player needs a simple goal: kill the monster in fewer hand picks.

**Decision:** In active `legacy`, convert HP/damage to hearts: first monster has 3 hearts, minimal 2x2 capture is 1 heart, larger zones convert through `tileBattle.hearts.zoneDamagePerHeart`. Visible combat rows are limited to active red/blue colors. A new hand pick deals previewed damage `newPickBaseDamage + floor(unplayedTiles / unplayedTilesPerDamage)` and is applied only after confirming the new pick. Pick-pressure and heart conversion are scoped to `legacy` so hidden variants do not inherit the new tempo rule.

**Rationale:** This is the shortest way to test the main Core 1 Rescue playtest question: does a clear tempo of "close now or take a costly new pick" appear without adding hold, rotate, double-color and starting universal center.

### 2026-05-08 - Starting project structure

**Context:** Tilebreaker starts as a separate game project with working rules similar to Mercatante.

**Decision:** Use modular structure `src/core`, `src/entities`, `src/render`, `src/scenes`, `src/utils`; store balance in `configs/`, design in `design/`, technical specifications in `techspec/`, tasks and bugs in `todo/`.

**Rationale:** This structure reduces conflicts during parallel work, makes the needed context easy to find and keeps the project convenient for Claude Code.

### 2026-05-08 - Run prototype through battles and meta upgrades

**Context:** The game moves away from the current example and will be built as a level-based run: battle, battle result, then upgrade after victory.

**Decision:** Introduce run state in `src/entities/run.js`, separate battle/result/upgrade scenes, and store battle and upgrade lists in `configs/levels.json`.

**Rationale:** This loop is close to Balatro's structure: short build check, explicit outcome, then a meta choice before the next battle. It gives a clear base for future rules, rewards and defeats.

### 2026-05-08 - Three-role game jam process

**Context:** During the game jam, new ideas need to quickly become playable decisions without losing design coherence.

**Decision:** Run all new ideas through Game Designer, Developer and Lead. The Game Designer strengthens the fantasy and checks coherence, the Developer cuts scope and defines MVP, and the Lead makes the final decision and assigns the layer `MVP`, `Jam Stretch` or `Post-jam`.

**Rationale:** This process leaves room for strong ideas while protecting the project from scope creep and helps end every day with a working build.

### 2026-05-08 - Close completed agent threads

**Context:** Discussions with the Game Designer and Developer use background agents. If completed threads are not closed, the active agent limit can be reached quickly.

**Decision:** After receiving the final answer from a background agent, close its thread.

**Rationale:** This keeps the workflow fast and prevents blocking future parallel discussions.

### 2026-05-08 - Required agent checks for work tasks

**Context:** For the jam, it is important not only to write code quickly, but also to constantly check that a feature remains a game and that implementation does not grow faster than the playable build.

**Decision:** When starting any new feature, balance iteration or major UI change, Codex acts as lead and starts at least two background agents: a Game Design Agent to check playable fantasy, risk/reward and result readability; and a Developer Simplifier to check scope, technical simplicity and protection of the main loop. Additional permanent agents are added only after their role is recorded in `CLAUDE.md`.

**Rationale:** This makes the process independent of a particular thread's memory: every meaningful change receives a game and technical check, while the final decision remains with the lead.

### 2026-05-08 - v0.2 Pixi foundation

**Context:** Manual WebGL quickly becomes expensive for UI, text, sprites and future juice. The current base is still small, so moving the render layer is cheap.

**Decision:** Move rendering and game UI to Pixi.js, installed as a local npm dependency and served through Vite, while preserving the current loop `menu -> battle -> result -> upgrades -> final` without new features.

**Rationale:** Pixi.js provides containers, text, graphics, sprites and ticker, which speeds up 2D development and reduces the risk of drowning in a custom renderer during the game jam.

### 2026-05-08 - Pivot to tile-placement battle MVP

**Context:** The user formulated a new game idea: a mix of Balatro and Carcassonne where the enemy attacks in three colors and the player assembles captured colored territories from tiles.

**Decision:** For the MVP, replace the arcade battle placeholder with tile-placement combat: fixed board, tile hand, enemy color attacks, closed colored boundaries, land capture, multiplier from captured area and HP battle.

**Rationale:** This mechanic directly tests the main project risk: close a small area now or grow a large one for a strong multiplier.

### 2026-05-08 - Auto-approval for project edits during jam work

**Context:** The user wants to step away from the computer and not confirm every normal project edit.

**Decision:** Within the current jam process, Codex treats ordinary project file changes needed to execute an agreed plan as pre-approved by the user: documentation, configs, code, tests and local checks.

**Rationale:** This speeds work in the 40-hour window and reduces idle time. Exceptions: destructive actions, external system permissions, network installs or operations that require explicit approval under sandbox rules.

### 2026-05-08 - Center-exit tiles vs land-mass tiles

**Context:** The first tile art pack from `design/tile-art-brief.md` showed a visual risk: some `corner` tiles, such as `tile_blue_corner_lu`, can read as a colored road on gray background rather than a piece of land. Filling the inner gray corner with the same color makes the tile look more like a solid land mass.

**Decision:** Do not change the current asset pack without another simulation. Record this as a separate `land mass` hypothesis for the next iteration: filled corners/shapes must be designed as a new consistent set of edge signatures, not as a point art fix.

**Rationale:** Filling the "orphan" gray corner changes the tile edges: for example, `corner_lu` changes from `.X.`/`.X.` to `XX.`/`XX.`. This affects compatibility with `cap`, `line` and other `corner` tiles, changing closure frequency, zone size and starting deck balance.

### 2026-05-08 - Closed boundary captures enclosed land

**Context:** Discussion of center-exit tiles showed that current assets work better as colored territory boundaries. The user suggested: if a blue line fully closes, everything inside is painted blue and counts as score.

**Decision:** Accept this as the MVP scoring/fill rule. Colored micro-cells remain boundaries. When a combat color boundary fully cuts an inner area off from outside air, that area is temporarily captured by that color. Score is counted by area `boundary + captured interior`.

**Rationale:** This makes the fantasy closer to land and territory capture, not road building. It also avoids urgent edge signature and first asset pack changes: strict edge compatibility remains the placement rule, and capture is counted as a separate layer after placement. Risk: the `area * area` formula becomes stronger, so attacks and simulation need to be recalculated.

### 2026-05-08 - Empty interior scores and dot leaves MVP deck

**Context:** Resimulation of the strict interpretation where empty interior gave no points showed 0 damage in 100/100 random hands. The user accepted that closed empty interior also becomes land and pointed out the `dot` problem: a colored cell in the center does not touch an edge and does not help build a boundary.

**Decision:** For the MVP, count empty area inside a fully closed colored boundary as captured land. Remove `dot` from the starting combat tile set. Update the v2 art task to the set `line_h`, `line_v`, four `corner`, four `tee` and `plus` for each combat color.

**Rationale:** The new rule lets the player build a ring around emptiness instead of filling the inside with tiles first. `dot` was useful for the old "colored cell itself scores" model, but in capture-fill it pollutes the hand. `plus` and `tee` increase deck connectivity and help create real closures.

### 2026-05-08 - v2 tile set is active, volatility is next risk

**Context:** The user prepared `assets/tiles_v2`, and the simulation switched to `assets/tiles_v2/tile_manifest.json`. In the strict model, the first battle passes 69/100 times, but 94/100 random hands deal no damage and a rare capture can hit for up to 144.

**Decision:** Treat `assets/tiles_v2/tile_manifest.json` as the active tile source for the MVP. The next must step before implementing battle is smoothing v2 capture-fill volatility through damage formula, starting hand/redraw, tutorial small capture or first-battle balance.

**Rationale:** v2 already proves that capture-fill can work, but the current dynamics feel too much like a jackpot: many empty hands and rare one-shots. The first 3-minute experience needs more frequent small payoff.

### 2026-05-08 - Deck/discard run progression

**Context:** After playable tile-battle MVP, combat was still an isolated puzzle: every hand was generated fresh from manifest, and the upgrade screen showed old placeholders.

**Decision:** Store deck, draw pile, discard pile, RNG and color multipliers in `src/entities/run.js`. A starting run builds a 36-tile deck from the active v2 manifest. A round draws a hand from draw pile through best-of-3 smoothing, discards played and remaining tiles, and reshuffles empty draw pile from discard. After victory, dynamically offer three rewards: add tile, remove tile or boost color multiplier.

**Rationale:** This moves the prototype from a single battle into a Balatro-like run loop without heavy meta: the player sees that the post-victory decision changes future hands, and implementation remains local and smoke-testable.

### 2026-05-08 - Persistent board between rounds

**Context:** In the strict edge-signature model, the player could place a starting tile and receive a hand with no valid continuation. Clearing the whole board every round amplified the problem: unclosed contours had no future payoff.

**Decision:** For the MVP, after round result remove only tiles that participated in scored capture zones, and keep unclosed tiles on the board. If the next hand cannot continue the saved board at all, enable `freshStart`: clear the board and let the player start a new island with the same hand.

**Rationale:** This preserves the value of building territory over several turns while removing hard dead-ends. Simulation shows that early battles remain forgiving, late battles need HP/upgrades, and dead-end rounds become a rare recoverable state.

**Clarification:** Zero damage in the first round is not failure by itself. It is a valid setup round if the saved contour remains readable, buildable and converts into closures in the next 2-3 rounds. Evaluate not an isolated `zero damage`, but zero streaks, dead-end/freshStart and future conversion of the unclosed board.

### 2026-05-08 - Off-color leap as a way out of blocking

**Context:** Even with persistent board, strict edge compatibility can block a specific selected tile: it has no direct valid cell, even though the board has space for a new color island.

**Decision:** If the selected combat tile has no direct edge-match position, allow placing it through one empty cell away from a tile of another combat color. Gray tiles do not use this rule. In config, the rule is stored as `offColorLeapPlacement`, `offColorLeapDistance` and `offColorLeapOnlyWhenBlocked`.

**Rationale:** This gives the player a clear escape from board blocking without replacing the main contour gameplay. The "always leap" variant worsened simulation: the board scattered into islands, so the rule is limited to the case where the selected tile is truly blocked.

### 2026-05-08 - Fair normal run without loop autocomplete

**Context:** After deck/discard progression, the normal run felt too controlled: fixed seed and `guaranteedLoopHands=true` often pushed the player toward the same red square, and the generator completed a ready loop from draw pile.

**Decision:** Turn off `guaranteedLoopHands` by default for normal run. A hand is now drawn with one fair draw from run draw pile without best-of-3 selection and without loop autocompletion. Every normal start gets a new random seed. Determinism remains only as a debug/smoke path through URL overrides: `?seed=20260508&guaranteedLoopHands=true`. When color attacks tie, primary color no longer selects red automatically.

**Rationale:** The MVP should first test the interest of fair placement, not demonstrate a preassembled loop. Persistent board, `freshStart` and off-color leap remain safety valves, and stable smoke testing remains possible without affecting normal runs.

### 2026-05-08 - Playtest: minimal square dominates because of payoff structure

**Context:** Manual testing showed that the optimal strategy is now to avoid extra tiles, almost never play gray, and close the contour as quickly as possible. As a result, the minimal square becomes the only stable figure, and the promise of `small now or big zone later` does not emerge.

**Decision:** The next must experiment should change payoff, not only tile draw: test a bonus for closed zone size and simple usefulness for gray tiles inside a zone. Queue mode and color/pattern bag remain important, but come after checking the incentive to build beyond the minimal square.

**Rationale:** If the reward for risk and area is not visible, any draw mode will still push the player toward the shortest closure. Gray must become understandable preparation or an amplifier, otherwise it remains trash in hand.

**Addition:** A slightly rarer draw of `corner` and 4-way/`plus` tiles can be tested as a second lever against ready minimal squares. It cannot be treated as a replacement for payoff fixes: if we simply cut closers, the player will still want the same minimal square, just wait longer for the pieces. Success should be measured not only by lower minimal-square frequency, but also by higher average capture area without more dead-end/empty hands.

### 2026-05-08 - Large zone and gray tiles get explicit payoff

**Context:** The minimal 2x2 corner loop had area 12 and dealt 24 damage with `areaMultiplier = 2`. Without additional incentive, closing that square immediately was optimal, and gray blanks almost always felt like trash.

**Decision:** Extend `damageFormula` in `configs/game.json`: zones larger than `largeZoneBonus.minArea = 12` receive extra damage for every extra micro-cell, and gray tile micro-cells inside a closed zone give fixed `grayInteriorBonus`. The zone's final base damage is then multiplied by the run color multiplier.

**Rationale:** This keeps the minimal square as a safe base move, but makes growing a large zone and preparing with a gray tile a clearly readable bet. The simulator now separately prints the minimal 2x2 loop versus 3x3 loop with gray fill scenario, `close ASAP` versus `payoff`, and minimal capture/deck-mix preset metrics.

### 2026-05-08 - Gray blanks as wildcard fill

**Context:** After adding `grayInteriorBonus`, it turned out that a gray blank with edge `...` could not be placed next to `plus` and many colored boundary tiles because the strict edge-signature model requires a full edge match. Gray had payoff, but could not reliably enter a future zone.

**Decision:** Add `grayWildcardPlacement` to `configs/game.json`. When the rule is enabled, gray tiles can touch gray or empty edges of colored tiles, and colored tiles can touch gray only with an empty edge. Gray cannot close a colored boundary output. All other color-color matches remain strict.

**Rationale:** In the MVP, gray should be neutral land/fill, not separate road geometry. The wildcard rule makes it an understandable setup tile for large zones without breaking the main colored boundary puzzle.

**Clarification 2026-05-09:** Playtest showed that gray blank should be insertable as fill even next to colored geometry. The rule became asymmetric: when placing gray, it can touch a combat tile on any edge; when placing a combat tile next to already placed gray, the combat tile must arrive with an empty edge. This preserves gray's role as land/fill without making it a continuation of a colored path.

### 2026-05-08 - Starting deck is built through recipe

**Context:** Baseline showed that the starting deck "one tile from manifest each" preserved dominance of small `area <= 12` closures. At the same time, harsh removal of `corner/plus` quickly dried out the first battle and broke the feeling that the player can almost always build a useful contour.

**Decision:** Add `startingDeckRecipe` to `configs/game.json` and use it as the single source for the starting deck in the game and `scripts/simulate-tiles.js`. Recipe expands into an array of tile ids and supports duplicates. Active MVP recipe keeps one copy of each combat v2 tile and adds one extra copy of `tile_gray_blank_01`, without changing manifest or art.

**Rationale:** This introduces the needed infrastructure for controlled deck composition and tests a gentle anti-small-square shift without failing smoke/debug. Simulation showed that recipe alone is not enough: the next lever should constrain the early draw window through opening shape-bag/caps, not only through total tile frequency.

### 2026-05-09 - Opening draw bag without hidden solver

**Context:** Playtest showed that a fair starting-deck shuffle can give either ready closers or a murky set with no clear continuation. Returning `guaranteedLoopHands` is not allowed: it makes the game invisibly controlled and again assembles the solution for the player.

**Decision:** Add `tileBattle.drawBag` to `configs/game.json` and apply it once at battle start to the nearest future draws from the current draw pile. Bag reorders already existing tiles: caps early `corner`/`plus`, requires minimum `line`/`tee`, keeps combat color minimums and limits gray. It does not add tiles, guarantee a closed loop or look at the board as a solver.

**Rationale:** This is the shortest way to reduce early volatility and give the player more contour continuations without changing the core loop, discard economy and smoke/debug path. Simulation after the change shows correct opening composition, but does not remove the risk of long zero-damage streaks; if the feel is still dry, the next lever is queue mode or small-contour value, not making the bag into hidden autocomplete.

### 2026-05-09 - Queue draw enabled as active MVP mode

**Context:** We needed to test whether "current tile + next preview" would reduce full-hand dominance, where the player immediately searches for a ready small contour.

**Decision:** Add `tileBattle.drawMode` with values `hand` and `queue`, enable `queue` as active MVP mode, keep full-hand available through `?drawMode=hand`, add queue UI and simulator support for queue through `DRAW_MODE=queue`. Use beam AI for queue simulation: with current tile and preview, the decision space is smaller, so it can be tested more strongly than a random full-hand order.

**Rationale:** Manual checking needs queue visible in the normal build, not only through debug URL. Queue makes choice more sequential and is genuinely easier for the test AI. After replacing greedy evaluation with beam, queue metrics became noticeably fairer: early conversion is better in some runs. The main design problem remains: closures are still most often small `area <= 12`, so the next task must still compare queue and hand before choosing the final active `drawMode`.

**Superseded 2026-05-09:** Core 1 Rescue switched the active MVP default back to `drawMode: "hand"` after manual playtest. Queue remains available through debug/URL comparison, but it is no longer the current MVP posture.

### 2026-05-09 - Off-color leap is available beyond full blocking

**Context:** In queue mode, the player can see several islands of different colors on the board. If the selected tile has at least one direct move near its own island, the old rule `offColorLeapOnlyWhenBlocked = true` forbade starting a new island one cell away from another color, even though those cells look visually free and useful.

**Decision:** Turn off `offColorLeapOnlyWhenBlocked`: a combat tile can use off-color leap even when direct edge-match moves exist elsewhere on the board. Restrictions remain: another combat color is needed at distance 2 and an empty gap cell must be between them.

**Rationale:** This makes valid-cell highlighting closer to player expectation and reduces the feeling that the game artificially forbids obvious setup positions. The risk of scattering the board is accepted as part of the queue experiment and will be measured in the next mode comparison.

### 2026-05-09 - Tiles v3 starts with two combat colors

**Context:** Simulations and v2 playtest showed that three combat colors in the starting deck fragment the player's plan, gray blanks often feel like trash, and almost all real closures remain minimal `area 12` loops. Simple rotation is risky: it buffs corners and makes the small square even more stable.

**Decision:** Enable a v3 experiment without new art: `activeCombatColors = ["red", "blue"]`, 25-tile starting deck from v2 manifest (`line_h/line_v x2` per active color, each `tee` and `corner` x1, `plus x0`, `gray_blank x1`). The first two battles no longer attack green. Opening bag for v3 keeps `corner <= 2`, `plus <= 0`, `line >= 4`, `tee >= 4`, red/blue minimum 4 each and `grayMax = 1`. Add/boost rewards are limited to active colors so green does not return randomly before a separate decision.

**Rationale:** Two colors give the player more continuations for one plan and less "tax without tool." In a quick sim on seed `20260508`, active `queue + opening bag` with `corner cap 2` gave battle_01: 21/40 wins, `64%` small captures and `avg area 17.1`, compared to prior v2 values near `98%` small captures and `avg area` near 12. Rotation is kept as a future reward/artifact, not the base MVP fix.

### 2026-05-09 - Gameplay variants are compared through one switch

**Context:** v3 playtest showed that point balance levers no longer answer the main question: which base turn fantasy actually makes the player want to build land larger than 4 cells.

**Decision:** Add `tileBattle.gameplayVariant` and shared id registry: `legacy`, `placement_payoff`, `one_color_chain`, `connect_targets`, `road_mode`. Current `queue + two-color capture-fill` is preserved as `legacy`; the old term `baseline` remains a URL alias. Variant is selected from config, through URL `?gameplayVariant=...`/`?variant=a` or temporarily on the main menu, shown in combat UI/debug and printed by the simulator with one shared comparison order. Manual playtest scorecard lives in `design/gameplay-variants.md`.

**Rationale:** One switch lets us test different core-feel hypotheses in the same playable build without forking code and without confusing manual observations. Legacy records the current game feel as the control mode, and the temporary picker speeds manual comparison. At the first step, non-legacy variants are scaffolds; their mechanics are added as separate tasks.

### 2026-05-09 - Variant A uses Focus instead of placement damage

**Context:** Playtest showed that growing land to 5+ cells feels like losing tempo: the player invests tiles into a plan but gets no visible result until closure.

**Decision:** In `placement_payoff`, a useful placement next to existing land without closing a zone gives `Focus +1`. Focus has a cap, does not deal direct damage and is spent only on the next capture, adding a flat bonus to the largest closed zone.

**Rationale:** The setup move gets immediate readable feedback, while the main payoff still belongs to closure/capture. Cap and conversion only through capture protect the variant from infinite "damage per click" farming.

### 2026-05-09 - Free cells without neighbors are valid for placement

**Context:** A known bug narrowed the board: after placing a tile, highlighting sometimes left only 1-2 cells, even though distant free cells physically conflicted with no edge.

**Decision:** Treat any empty cell with no direct neighbors as valid. If direct neighbors exist, all touching edges must still match. The old off-color leap is no longer the main way to start a new island.

**Rationale:** Gameplay variants A-D should compare core feel, not fight a hidden placement restriction. Broad legality makes the player's intent clearer while preserving the edge puzzle only where actual adjacency exists.

### 2026-05-09 - Variant B tests one land-color through Chain

**Context:** Variant A made setup turns visible through Focus, but two colors can still fragment the player's plan and bring back the feeling of "I am building wrong" when the player wants to grow one large plot.

**Decision:** Implement `one_color_chain` as a separate gameplay variant: all combat symbols count as one land for edge-match and capture-fill, active threats are summed into one land lane, and continuing the same connected region grows `Chain xN`. Chain gives a flat bonus to the next capture and resets to base after scoring closure.

**Rationale:** This is the shortest MVP for testing "shape and continuous growth matter more than color" without new assets, new deck or separate battle mode. Legacy and Variant A remain next to it for comparison, and Chain balance lives in `configs/game.json`.

### 2026-05-09 - Variant C provides an external goal through connect targets

**Context:** Variant A and B test internal bonuses for setup and continuous growth, but the player still needs a visible reason to grow land in a specific direction.

**Decision:** Implement `connect_targets` as a separate gameplay variant: the board receives a pair of A/B targets, all combat tiles count as one land for edge-match/capture-fill, active threats are summed into one land lane, and connected land between A/B gives a one-time flat bonus from `configs/game.json` (`connectTargets.bonusDamage`). After scoring, a new pair appears next round.

**Rationale:** This is the minimum test of the "reach the beacon" fantasy without new assets and without a separate road system. The target is readable on the board, payoff does not require contour closure, and legacy/A/B remain available for comparison through the same variant switch.

### 2026-05-09 - Variant D tests road-mode through S/E gates

**Context:** After Variant C, a separate hypothesis remained: it may be clearer for the player to build an actual road between start and end, not just connect two targets for a bonus. Full road tiles, end pieces, turns, forks and route purity are too large for MVP.

**Decision:** Implement `road_mode` as a route-to-target MVP over one-color land: the board has S/E gates, area-capture payoff is disabled, active threats are summed into one land lane, and a completed connected road deals a weak finish bonus plus main damage for extra route length. Formula from `configs/game.json`: `roadMode.completeBonus + min(extraLength, roadMode.maxScoredExtraLength) * roadMode.damagePerTile`, where `extraLength = max(0, routeEdges - gateDistance)`. Length is counted by the shortest placed S/E path, and scored road-path tiles are cleared between rounds.

**Rationale:** This is the shortest way to test the "I am building a road" fantasy in the same playable build. The variant keeps the existing placement, queue, deck/discard and UI infrastructure, but removes the main contour-fill incentive so manual playtest can fairly compare route payoff with A-C.

### 2026-05-09 - Playtest pivot to Core 1 Rescue

**Context:** Manual run through five gameplay directions showed that `legacy` remains the most playable, but current queue-flow too often feels like waiting for the right card. Variant A does not feel standalone, one-color has no strong stake yet, the road/target branch needs scoring/rotation review, and one tested mode is uninteresting.

**Decision:** Narrow the next MVP to Core 1 Rescue: keep default `gameplayVariant: "legacy"`, switch default `drawMode` to `hand`, remove gray blank from the active starting deck, set `drawBag.grayMax = 0`, and make the next must step a starting universal red/blue tile in the center. Record Kingdomino-like combat as a separate spike and do not mix it with capture-fill.

**Rationale:** This preserves the liveliest direction and targets the main playtest risk: the player should have a plan from the first moves. Full-hand and starting center are cheaper and easier to test than adding rotate, double-color tiles, Fiords-like maps or a new Kingdomino core all at once.

### 2026-05-09 - Legacy moves to hearts and new-pick cost

**Context:** Manual playtest after switching `legacy` to full-hand showed that the game immediately improved: visible hand restores planning to the player. The next pain is that combat is still read through large numbers and extra green UI noise, and a new hand draw does not have a clear enough cost.

**Decision:** For the next legacy iteration, remove the third/green color from active legacy interfaces, replace large damage numbers with a hearts scale, start the first monster with 3 hearts, count minimal 2x2 capture as 1 heart, and make every new pick/refill a source of incoming damage. Unplayed tiles should increase this damage, but only with explicit preview before the action.

**Rationale:** This turns battle from abstract damage accounting into a clear tempo race: kill the monster in fewer picks. New-pick cost ties hand, tempo and health together, but preview is mandatory so the player feels responsible for the decision instead of secretly punished.

**Superseded wording 2026-05-09:** the implemented pressure remains useful, but the next active Core 1 pass renames the action to `Сдать руку`, removes separate monster attack damage and uses the newer hand-submit formula recorded above.
