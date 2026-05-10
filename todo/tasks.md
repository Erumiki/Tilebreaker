# Tasks

The single list of planned features, improvements, work order and statuses for Tilebreaker.

**How to choose work:** take the first non-struck heading from top to bottom. If a task is too large, it may contain a short checklist, but the separate task order and acceptance still live only in this file.

`todo/current.md` does not contain tasks, next-step, acceptance or statuses. It is only a snapshot of the current version and design context.

---

### ~~[2026-05-09] MVP Balance Gate: validate shop cards and decide final pool~~

**Idea:** turn the current balance-unverified shop into a deliberate MVP card pool.

**Why:** shop cards are now the largest remaining Core 1 risk. Ordinary helpers, plus/cross, guaranteed `joker_line_v` and `double_red_line_h` can rescue dry hands, but they can also erase hand-submit pressure or bring back automatic 2x2 closures.

**MVP:**

- establish a no-shop baseline on fixed seeds: win rate by battle, submits per battle, gold earned, closure count, minimal capture share, average captured area, fresh-start/dead-end rate and player hearts remaining;
- add the smallest useful shop-card test protocol: either extend `scripts/simulate-tiles.js` enough to model forced purchases/use-rate, or record a manual seeded protocol that captures gold spent, bought-card use, submits and closure size;
- test common red/blue line, tee and corner buys separately before judging the combined common pool;
- test plus/cross separately with current cost, unlock battle, max-per-shop and offer weight, watching for minimal-loop dominance;
- test guaranteed `joker_line_v`, watching blocked-hand recovery, wildcard-assisted closures and whether players mentally merge red/blue plans despite the rules;
- test `double_red_line_h`, watching whether reach/control creates real planning or only cheap closes;
- for every enabled card or family, record one decision: keep, change cost, change offer weight, delay unlock, cap per shop, nerf rules, or disable;
- if a card cannot be tested in time, mark it staged/disabled rather than leaving it active-final by inertia.

**Acceptance:** every active shop card family has a recorded keep/nerf/disable decision with the metrics or manual observations that justified it; risky cards that cannot be validated are explicitly removed from the final MVP pool.

**Parallelization:** safe as a balance-lane task. The balance lane owns `configs/cards.json`, simulation/test helpers and balance notes; it must not repaint assets or change card visuals.

**Priority:** must

**Layer:** MVP

**Completed 2026-05-09:** added `scripts/simulate-card-balance.js`, ran `CARD_BALANCE_RUNS=40 ./scripts/node.sh scripts/simulate-card-balance.js`, and recorded the final family decisions in `design/card-balance-gate.md`. Gate result: keep restrained ordinary line/tee/corner and plus/cross; stage/disable guaranteed `joker_line_v` and `double_red_line_h` in the next config sync.

---

### ~~[2026-05-09] MVP Balance Sync: apply card decisions to config and docs~~

**Idea:** apply the balance-gate decisions cleanly after measurement, without mixing the measuring pass with final tuning.

**Why:** the jam build needs one clear source of truth for active shop cards. A card should not stay enabled only because code and art exist.

**MVP:**

- update `configs/cards.json` with accepted costs, offer weights, unlock battles, per-shop caps, enabled/staged state and final `balanceStatus` values;
- update `design/card-pool.md` and `design/tile-feasibility.md` with the final card-family decisions and short rationale;
- add or adjust focused tests only where the accepted decision changes behavior, for example disabling a family, changing guaranteed offers or changing special-card availability;
- keep stronger joker/double candidates staged unless the balance gate explicitly accepts them;
- run `./scripts/npm.sh run check`, targeted unit coverage and the relevant shop smoke path.

**Acceptance:** the active MVP shop contains only approved card families, all remaining active cards have documented final balance status, and docs/configs agree on what is enabled for the jam build.

**Priority:** must

**Layer:** MVP

**Completed 2026-05-09:** synced `design/card-balance-gate.md` into `configs/cards.json` and docs. Active MVP shop now keeps restrained line/tee/corner and plus/cross with final `mvp_keep_*` statuses; guaranteed `joker_line_v`, `double_red_line_h` and stronger joker/double candidates are staged with `mvp_staged_after_gate`. Runtime shop offers and purchase history now propagate catalog balance statuses. Verified with `./scripts/npm.sh run check`, `./scripts/node.sh --test tests/tileBattle.logic.js` and `./scripts/npm.sh run test:e2e -- --grep "shop sells an affordable card"`.

---

### ~~[2026-05-09] Final MVP Path Lock: normal route, variants and shop mobile safety~~

**Idea:** remove player-facing debug ambiguity before the final polish pass.

**Why:** the normal jam build should present Core 1 Rescue confidently. Temporary variant controls, hidden old reward helpers and untested shop overflow can confuse a first player even if the rules are technically correct.

**MVP:**

- keep the normal menu focused on `legacy` Core 1 Rescue; move Variant A-D access to URL/debug only unless the lead explicitly wants a visible picker for the jam build;
- verify the normal route is `menu -> battleIntro -> battle -> result -> shop -> battleIntro -> next battle -> final`;
- add a small portrait/mobile shop overflow check comparable to the battle layout smoke coverage;
- verify old add/remove/boost reward helpers do not appear in the normal path;
- leave legacy filenames such as `src/scenes/upgrades.js` alone unless they create player-facing confusion.

**Acceptance:** a normal player sees one coherent Core 1 path, can use the shop on phone-sized screens without overflow or hidden controls, and the archived variants remain reachable only through explicit debug URLs.

**Priority:** must

**Layer:** MVP

**Completed 2026-05-09:** locked the normal menu to a single Core 1 Rescue start with no player-facing variant picker; archived variants remain reachable through explicit `?variant=` / `?gameplayVariant=` debug URLs. Tightened shop layout/debug for portrait overflow, continue-button overlap and minimum touch targets, and added smoke coverage for a 360x740 shop path. Normal-route smoke now verifies `menu -> battleIntro -> battle -> result -> shop -> battleIntro -> next battle -> final`, active shop-card offers, and that old add/remove/boost reward helpers do not appear in the player path. Verified with `./scripts/npm.sh run check`, `./scripts/node.sh --test tests/tileBattle.logic.js` and targeted `./scripts/npm.sh run test:e2e`.

---

### ~~[2026-05-09] Monster Art Completion: portraits 2-5 and optional backdrops~~

**Idea:** finish the remaining monster presentation assets now that the intro, HUD icon path and first portrait proof exist.

**Why:** the battle intro sells the Astral Archive breach fantasy, but placeholder or repeated monster art weakens the first-minute read. The icon pack and first portrait already prove the direction; the remaining work is production completion.

**MVP:**

- use `design/monster-roster.md` as the source of truth;
- keep the five completed `monster_icon_battle_0N.png` files unless an art-lead audit finds a readability problem;
- replace `monster_portrait_battle_02.png` through `monster_portrait_battle_05.png` in battle order;
- optionally improve `level_backdrop_battle_0N.png` files only if it is cheap and does not delay balance/polish;
- keep filenames, dimensions, alpha rules and manifest ids unchanged;
- do not draw fake tile exits, board cells or gameplay contours into monster art.

**Acceptance:** all five battle intros show distinct monster portraits that match the roster and remain readable in portrait and desktop layouts; the files replace placeholders in `assets/art_mvp` without code or manifest changes.

**Progress:** all five monster icons and `monster_portrait_battle_01.png` are already generated and wired into runtime. Remaining art work is portraits for battles 2-5 and optional backdrop refinement.

**Completed 2026-05-10:** replaced `monster_portrait_battle_02.png` through `monster_portrait_battle_05.png` with distinct Astral Archive breach portraits for Comet Maw, Rift Hound, Broken Constellation Giant and Black Sun Monarch. Kept existing filenames, 512x512 RGBA dimensions, transparent corners and manifest ids unchanged; optional backdrop refinement remains deferred to Art Track 3/final audit. Verified with local PNG alpha/dimension checks, `./scripts/npm.sh run check` and `./scripts/npm.sh run test:e2e -- --grep "player can complete the 5-battle prototype loop"`.

**Parallelization:** safe as an art-lane task. The art lane owns assets and art generators only; it must not change topology, rules, prices or enabled card status.

**Priority:** must

**Layer:** MVP

---

### ~~[2026-05-09] MVP Art Track 3: asset validation, cleanup and final art-lead audit~~

**Idea:** finish only the art extraction work that protects the final build from hidden missing assets or obvious prototype chrome.

**Why:** the fake-shot and tile passes handled the major visual read. The remaining risk is quieter: missing PNGs silently falling back to procedural drawing, hardcoded prototype surfaces that appear in normal play and shop/resource states that are not covered by validation.

**MVP:**

- add manifest validation for unique ids, existing files, lowercase underscore filenames, expected dimensions where practical and loadable PNGs;
- replace missing active-presentation fallbacks with explicit validation failures or an obvious missing-asset state, rather than silently drawing a colored prototype substitute;
- finish manifest-backed extraction for normal-path shop, field-resource, HUD, button and closure/overlay states that are still visibly procedural;
- add a small allowlist for remaining procedural drawing that is intentionally kept, such as text or debug-only surfaces;
- keep any renderer helper refactor small and local; do not turn this into a second fake-shot repaint;
- run an art-lead audit and record remaining prototype visuals as follow-up tasks only if they are visible in normal play.

**Acceptance:** validation catches missing normal-path assets, the visible MVP screens render from manifest-backed art except for an explicit allowlist, and the art-lead audit confirms no major prototype visuals remain in the jam path.

**Completed 2026-05-10:** added `scripts/validate-art-assets.js` and wired it into `./scripts/npm.sh run check` so normal-path art ids, PNG loadability, dimensions, opaque backgrounds, configured battle assets, active tile PNGs and enabled shop-card tile references fail fast. Added `src/render/art.js` missing-art rendering, runtime art load diagnostics and smoke coverage through `getArtDebug()`. Routed remaining normal-path surfaces for battle HUD panels, field resources, closure overlays, shop cards/buttons and result panels/buttons through manifest-backed art or explicit missing-art states. Recorded the final allowlist and audit in `design/art-track-3-audit.md`. Verified with `./scripts/npm.sh run check` and targeted Playwright coverage for the 5-battle loop, shop buy path and portrait shop layout.

**Priority:** must

**Layer:** MVP

---

### ~~[2026-05-09] MVP Readability And Juice Pass: first-player feedback~~

**Idea:** make the current loop understandable through moment-to-moment feedback, not a tutorial wall.

**Why:** Core 1 now has enough systems that a player must understand cause and effect quickly: why a placement is valid, why a closure hurt the monster, where gold came from, why `Сдать руку` costs hearts and what the shop card changed.

**MVP:**

- add or tighten invalid-placement reasons in the feedback/log layer: occupied cell, edge mismatch, outside macro-card footprint or no selected card;
- make the closure sequence clear: captured area/seal highlight -> monster heart loss -> closure gold/field resource/strike feedback -> cleanup;
- make field gold and heart pickup feedback visible both for direct placement and closure collection;
- make hand-submit heart loss and last-chance hand warning urgent and unambiguous;
- make shop buy, unaffordable and continue states readable on desktop and portrait screens;
- polish monster intro copy/visual hierarchy for each battle without adding a separate rules tutorial;
- capture desktop and portrait screenshots with a stable seed for battle, intro, shop and result after the pass.

**Acceptance:** a new player can infer the loop from the UI feedback: select/place a card, close a contour, see monster hearts drop, understand gained gold/hearts/strike, decide whether to submit the hand and buy or skip shop cards.

**Completed 2026-05-10:** added explicit invalid-placement reasons for no selected card, occupied cells, edge mismatches and macro-card footprint overflow; routed those reasons into battle feedback/log/debug. Tightened closure feedback with visible event badges for monster heart loss, gold, heart heal and strike, clearer closure summary text, ordered closure/resource/strike battle-log rows and direct placement pickup for field gold/heart resources. Made last-chance hands more urgent with lock-state logs, red feedback/chrome and clearer submit copy. Improved shop affordability/buy/continue feedback, intro battle-specific microcopy and screenshot capture coverage. Captured stable-seed desktop screenshots for intro, battle closure, result and shop, plus portrait screenshots for intro, battle, result and shop under `release/itch/art/`. Verified with `./scripts/npm.sh run check`, `./scripts/node.sh --test tests/tileBattle.logic.js`, full `./scripts/npm.sh run test:e2e`, and the screenshot capture script.

**Priority:** must

**Layer:** MVP

---

### [2026-05-09] Final Jam Build, screenshots and submission checklist

**Idea:** produce the jam-ready build and final verification pass after balance, normal-path lock, art cleanup and readability polish.

**Why:** the end of the jam needs a playable package, not only a working dev server.

**MVP:**

- add or verify an npm build path if needed, then run a production build and preview it locally;
- run `./scripts/npm.sh run check` and the full Playwright smoke suite;
- verify the production preview loads all assets through the normal route with no missing textures or console errors;
- save final desktop and portrait screenshots for menu, intro, battle, result and shop using a stable seed;
- sync README, `todo/current.md` and design notes with the final MVP rules, controls, known limitations and run commands;
- write a short known-issues list if anything remains intentionally rough.

**Acceptance:** the jam build can be opened from a clean production preview, the normal loop works through final victory or defeat, screenshots are captured, and docs describe exactly how to run and judge the submitted MVP.

**Priority:** must

**Layer:** MVP

---

### [2026-05-10] Itch.io Release Execution: package, page setup and art handoff

**Idea:** turn the final jam build into a browser-playable itch.io page without improvising upload settings, copy or marketing art at the last minute.

**Why:** itch release has a separate failure surface from the local build: HTML5 ZIP structure, relative asset paths, mobile/fullscreen embed behavior, cover/screenshot requirements, page metadata, and jam visibility/submission steps.

**MVP:**

- use `todo/itch-release-plan.md` as the executor-facing release specification;
- build and package the production `dist/` contents into an itch HTML5 ZIP with top-level `index.html`;
- verify relative asset paths, case-sensitive filenames, ZIP size/file limits and no missing runtime assets;
- fill the itch project fields, description, tags, launch instructions and theme choices from the spec;
- upload the required cover, header, embed background, page background and 3-5 final build screenshots from the art brief;
- keep the project private until the itch-hosted browser build has been tested logged in and logged out/incognito;
- if this is a jam submission, submit the saved project to the jam and verify the submission badge before making the page public.

**Acceptance:** the itch.io page is public or jam-submitted as required, the browser build launches from itch on desktop and mobile, and every visible field/art asset came from `todo/itch-release-plan.md` or a recorded lead-approved change.

**Priority:** must

**Layer:** MVP

---

### [2026-05-09] Stretch: rotate token design note

**Idea:** evaluate a limited rotate token as a small control tool instead of adding free rotation to every tile.

**Why:** orientation frustration is real, but full rotation can over-buff corners and revive small-square dominance. A scarce token could relieve the worst hands while preserving tile identity.

**MVP:**

- write a short design note only: source, cost, timing, whether it rotates before placement or converts one card, and how many tokens can exist;
- compare it against shop cards already in the MVP pool so it does not duplicate `joker_line_v` or double-card control;
- define one stop signal: if it makes the best play always "rotate into the smallest loop", it stays post-jam.

**Acceptance:** there is a lead decision to either build a tiny rotate-token task after submission or leave rotation as post-jam.

**Priority:** nice

**Layer:** Jam Stretch

---

### [2026-05-09] Spike: Kingdomino-like colored damage

**Idea:** keep a separate fallback core on paper: colored domino-like pieces connect by color, colors deal matching damage, and limited replacements control the draw.

**Why:** if Core 1 Rescue still fails after the balance/readability gate, the project needs one second-favorite direction that does not inherit contour-closure baggage.

**MVP:**

- describe minimum rules without code: piece format, color layout, connection rule, damage timing and replacement limit;
- evaluate whether the current tile UI can be reused or whether this needs a separate quick prototype;
- do not mix this with Core 1 unless the lead calls a stop signal on the rescue loop.

**Acceptance:** there is a short rule sketch and lead decision: build a playable spike after Core 1 Rescue or leave it as a post-jam idea.

**Priority:** nice

**Layer:** Jam Stretch

---

### [2026-05-08] Post-jam: artifacts and rule breaking

**Idea:** add the first effects that create a Balatro-like feeling of rule breaking after the jam MVP is stable.

**Why:** artifacts can strengthen long-term depth, but adding another rule layer before the current shop/cards are validated would dilute the finish.

**MVP:**

- define 3-5 simple artifact candidates after the final MVP build;
- keep first effects on multipliers, closure scoring or shop economy;
- avoid complex unique enemies until the base loop is proven.

**Acceptance:** after a win, the player can receive an artifact, and the next battle noticeably changes damage calculation without breaking the core placement loop.

**Priority:** dream

**Layer:** Post-jam

---

## Completed Archive

- [2026-05-08] Define the Tilebreaker core loop
- [2026-05-08] Test starting tile feasibility with simulation
- [2026-05-08] Day 1: replace the battle placeholder with a playable tile-placement MVP
- [2026-05-08] Day 1: rebuild the starting deck for capture-fill
- [2026-05-08] Day 1: smooth v2 capture-fill volatility
- [2026-05-08] Day 1: move tile-battle parameters into configs
- [2026-05-08] Day 1: make readable combat UI
- [2026-05-08] Day 2: add deck, discard and simple progression between battles
- [2026-05-08] Day 2: playtest and tune base balance
- [2026-05-08] Day 3: remove red-square autocomplete and restore fair-run feel
- [2026-05-08] Day 3: break minimal-square dominance
- [2026-05-08] Day 3: measure minimal-square dominance
- [2026-05-08] Day 3: rebuild starting deck through anti-small-square recipe
- [2026-05-08] Day 3: make opening shape bag with cap on corner/plus
- [2026-05-08] Day 3: try queue mode "current tile + next" with the same metrics
- [2026-05-08] Day 3: compare hand recipe/bag vs queue and choose MVP mode
- [2026-05-09] Day 4: build gameplay-variants scaffold and comparison protocol
- [2026-05-09] Day 4 Variant A: placement payoff without closing land
- [2026-05-09] Day 4 Variant B: one land color and chain meter for continuous growth
- [2026-05-09] Day 4 Variant C: points/beacons to connect with land
- [2026-05-09] Day 4 Variant D: road with start and end instead of territory closure
- [2026-05-09] Day 4: run variants and choose new MVP core
- [2026-05-09] Day 4: Core 1 Rescue - hearts and new-pick cost
- [2026-05-09] Day 4: Core 1 improvements after hearts
- [2026-05-09] Design pass: hand-submit economy, gold and feedback
- [2026-05-09] UIX pass: signs and feedback inventory
- [2026-05-09] Core 1 implementation: hand submit, immediate closure and gold
- [2026-05-09] GD pass: universal starter, jokers and purchasable cards
- [2026-05-09] Day 4: Core 1 universal red/blue center card
- [2026-05-09] Lead planning pass: beautiful MVP split into economy, shop, UIX and art tracks
- [2026-05-09] MVP Art Track 1: asset contract, placeholder pack and artist tech brief
- [2026-05-09] Art direction pass: Astral Archive defense
- [2026-05-09] MVP UIX Track 1: coordinate mockup and portrait battle layout
- [2026-05-09] MVP UIX Track 2: monster intro before each battle
- [2026-05-09] MVP Art Pass: make the live game match the Astral Archive fake shot
- [2026-05-09] MVP Battle Economy: field gold, hearts and monster kill bounty
- [2026-05-09] Art Director Task: hand-painted tile atlas pass against the fake shot
- [2026-05-09] Art Director Task: board-cell states and placement-hint readability pass
- [2026-05-09] Art Director Task: buyable card and special-tile art pack
- [2026-05-09] MVP Card Catalog: prices, offer pool and special-card definitions in JSON
- [2026-05-09] MVP Shop: replace 1-of-3 upgrades with card sales
- [2026-05-09] MVP Special Cards: jokers, cross and double straight/curve tiles
- [2026-05-08] Day 3: polish, juice and playable build packaging
