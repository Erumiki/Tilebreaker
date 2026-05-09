# Tilebreaker

Game project "Tilebreaker".

## Project Structure

```text
Tilebreaker/
├── src/
│   ├── core/       - game core (game loop, renderer, input, scene manager)
│   ├── entities/   - game entities (player, blocks, bonuses, projectiles)
│   ├── render/     - rendering systems (atlas, sprite batching, effects)
│   ├── scenes/     - screens and scenes (menu, game, pause, results)
│   └── utils/      - shared utilities and helpers
├── assets/         - game assets (sprites, sounds, fonts, tilemaps)
├── configs/        - configuration files (balance, levels, UI, rules)
├── design/         - game design documentation (GDD, UI, mechanics, progression)
├── techspec/       - technical specifications (rendering, atlas format)
└── todo/           - tasks and bugs for the programmer
```

## Technical Stack

- **HTML + Vanilla JS + Pixi.js** - no UI frameworks and no full game engines.
- **Vite** - primary dev server and npm dependency resolution.
- **Playwright** - smoke tests for the playable build in a browser.
- **All game rendering goes through canvas/Pixi.js**, including UI - do not use DOM elements for the game interface.
- Single entry point: `index.html`; all logic lives in `src/`.
- Code, comments, documentation and durable project notes are written in English.

## Language Rule

No matter which language the conversation uses, all repository records must be written in English: Markdown documentation, task notes, bug reports, decisions, specs, changelog/history entries, code comments and any other durable project text.

## Local Tools

Node.js LTS is installed locally in `.tools/` and is not committed. Use the wrapper scripts for npm/node:

```sh
./scripts/npm.sh run dev
./scripts/npm.sh run check
./scripts/npm.sh run test:e2e
```

If a command directly requires `node` or `npm`, first add the local Node to `PATH` through a wrapper or explicit `env PATH=...`.

After changes that affect the playable build, scenes, UI or frontend behavior, Codex starts the local dev server itself with `./scripts/npm.sh run dev`, opens the current local URL in a browser for the user and reports the address. Do not push this step to the user unless it is blocked by sandbox/approval or a broken build.

## Rendering Pipeline

- **Pixi Application** - the single rendering, resize and ticker entry point.
- **Pixi Containers** - scenes, UI layers, game layers and future effects are composed through containers.
- **Pixi Graphics/Text/Sprites** - buttons, panels, text, game HUD elements and future sprites are drawn inside canvas.

## Team Workflow

- `main` - stable branch, merge only through Pull Request.
- `feature/<name>` - new features.
- `fix/<name>` - bug fixes.
- PRs should be small and focused.

## Parallel Work Contract

Parallel chats are allowed only when their ownership is explicit. If two chats start from the same checkpoint, each chat must read this section before editing and must stay inside its lane.

### Art Chat

The art chat owns presentation only:

- Allowed files: `assets/**`, art generators in `scripts/generate-*-art*.js`, art/design notes such as `design/art-*.md`, `design/monster-roster.md`, screenshot/contact-sheet notes and task statuses in `todo/tasks.md`.
- Allowed work: repaint tiles, card previews, board-cell states, monster art, shop/card frames, icon/readability passes and visual screenshots.
- Forbidden without explicit lead approval: changing gameplay topology or balance data, including tile `matrix`, edge signatures, `color`, `pattern`, `special` rules, `configs/cards.json` costs, rarity, offer weights, unlock battle, enabled/staged status, deck recipes, scoring, hand rules or shop rules.
- If new asset ids or filenames are needed, propose them in Markdown first. Do not silently rename existing ids or files that runtime/configs already reference.
- Art approval does not make a card active-final. New card art is presentation-only until the balance chat records a keep/nerf/disable decision.

### Balance Chat

The balance chat owns testing and tuning:

- Allowed files: `configs/cards.json`, simulation/test scripts when needed, balance notes in `design/tile-feasibility.md` or `design/card-pool.md`, and task statuses in `todo/tasks.md`.
- Allowed work: run no-shop versus shop baselines, test card families, record metrics, tune cost/offer weight/unlock/max-per-shop/enabled status with rationale, and mark cards keep/nerf/disable.
- Forbidden without explicit lead approval: repainting assets, changing visual style files, renaming asset ids, modifying tile topology, or changing card visuals as a shortcut for balance.
- Every active shop card or card family must have a recorded balance result before it is considered final: keep, change cost, change offer weight, delay unlock, cap per shop, nerf rules or disable.

### Integration Rule

- Do not merge art and balance changes into the same commit unless the user explicitly asks for an integration commit.
- If both chats touch `todo/tasks.md`, merge task-status text carefully and preserve both outcomes.
- If both chats need `configs/cards.json`, the balance chat owns the final value. The art chat may only request asset-id changes in Markdown until the lead accepts them.
- Before finishing either lane, run the relevant checks and report exactly which files were touched and which lane owned them.

## Game Jam Workflow

During the game jam, every new idea and decision passes through three roles:

- **Game Designer** - expands the idea, checks its coherence, and formulates the fantasy, player emotion and place in the broader design.
- **Developer** - checks feasibility, trims scope, proposes a minimum version and a definition of done.
- **Lead** - makes the final decision, protects the playable build, priorities and project rules.

When starting any new feature, balance iteration, major UI change or any task from `todo/tasks.md` that affects gameplay, the core loop, UX, economy, draw rules, scoring or the playable build, Codex acts as **lead** and starts at least two background agents:

- **Game Design Agent** - checks whether the solution actually plays: clear turn fantasy, risk/reward, readable action result, connection to the core loop, and whether the first 3-minute experience avoids becoming a dry rules check.
- **Developer Simplifier** - keeps implementation from becoming too complex: cuts extra systems, catches premature abstractions, proposes the shortest path to acceptance, and protects the loop `menu -> intro -> battle -> result -> upgrade -> intro -> next battle -> final`.
- **Lead Codex** - owns the task, accepts or rejects agent advice, integrates the final decision, verifies the build and is accountable to the user for the outcome.

Optional focused agents for tasks that need them:

- **Art Lead Agent** - checks visual direction, existing asset contracts, file/id safety, and whether implementation blocks on final art.
- **UIX Agent** - checks responsive layout, interaction clarity, debug signals, mobile tap targets and first-minute readability.

The agent cycle is mandatory for any nontrivial work: a new feature, balance iteration, major UI change, core-loop change, UX/economy/draw/scoring change or must/nice/dream task where the feel of the game changes. The user should not need to remind Codex to involve agents manually: if the task looks like this kind of work, Codex starts agents first, even if the user only says "take the nearest task".

Minimum process:

1. Codex formulates the current task and asks the Game Design Agent and Developer Simplifier for their positions.
2. The agents briefly compare positions: what is disputed, what stays in the MVP, what is postponed.
3. Codex as lead compares their conclusions with its own position, makes the final decision and explains what goes into the work.
4. Only after that does Codex move to edits, implementation or final recommendations.

Exceptions to the full agent cycle: tiny commands, typo/text fixes, mechanical refactors with no gameplay/UI/design impact, simple diagnostics, one-off answers or an explicit user request to skip agent discussion. Do not skip agents just because the task feels "obvious" if it changes rules, balance, draw behavior, scoring, battle UX, progression or the first 3-minute experience. If Codex skips the agent cycle, the reason must be obvious: the task is small, local and does not change game decisions.

Background agents do not edit files by default. They give short feedback to the lead: `plays / does not play`, `too complex / acceptable`, main risk, minimum change. If a task needs an additional agent, first add that agent's role and responsibility to this section, then use it in the work.

Minimum Game Design Agent report format:

```text
GD check:
- Playability: passes / fails.
- Strengthens core loop: yes / no.
- Playable build risk: ...
- Keep in MVP: ...
- Postpone: ...
- Verdict: take it / cut it / stop.
```

Minimum Developer Simplifier report format:

```text
Simplified: ...
MVP: ...
Risk/stop signal: ...
```

If the user explicitly speaks as **designer**, do not change code. Only design documents, art tasks, balance ideas, task briefs and other `.md` materials are allowed.

If the user explicitly speaks as **developer**, change only code and technical files. Do not expand design decisions without a separate request.

If no role is specified, treat the user as lead/producer: discuss the decision, record rules or tasks, but do not change code without an explicit technical request.

The designer communicates with the developer only through briefs in `.md`: tasks, acceptance criteria, priorities and links to design context.

After background agents finish, always close their threads. This keeps the agent limit free and prevents blocking future discussions.

If background agents participated in the work, before the final answer gather their results, compare disagreements, close the threads and give the user final feedback: what each agent did, what was accepted into the final decision, what was rejected or postponed and why.

## Scope Control

- Every new idea must have an `MVP`: a minimum verifiable version for 30-90 minutes of work.
- Good ideas are not deleted: they receive the layer `MVP`, `Jam Stretch` or `Post-jam`.
- Only an `MVP` enters active work if it strengthens the current playable build.
- All tasks are marked with priority `must`, `nice` or `dream`.
- If a task does not improve the first 3-minute player experience, it must prove its value separately.
- Every workday should end with a clickable build.
- Do not leave the main loop in a broken state.
- Until the loop `menu -> intro -> battle -> result -> upgrade -> intro -> next battle -> final` works, do not add new modes, deep meta or large parallel systems.
- The only task list, work order, next work item and completion status live in `todo/tasks.md`.
- Choose the next task only from `todo/tasks.md`: the first non-struck heading from top to bottom.
- `todo/current.md` is only a snapshot of the current version and design context. Do not store the task list, build order, next task, acceptance or task statuses in it.
- If a next-step or task list appears anywhere except `todo/tasks.md`, treat it as stale context and move/remove the duplicate.
- New ideas that appear during work but are outside the current plan are recorded in `todo/thoughts.md`. During planning, periodically move confirmed thoughts into `todo/tasks.md` or delete/close them as obsolete.
- After completing a task, review the relevant documentation (`README.md`, `todo/current.md`, `design/`, `techspec/`, `CLAUDE.md`) and update stale information about where things live, how to run the project, which rules apply and which decisions are now current truth.
- Closed versions and snapshots are recorded in `history/`.

## Task Format

New tasks in `todo/tasks.md` should be short but actionable:

- `Idea` - what we want to do.
- `Why` - why the player needs it.
- `MVP` - the minimum version.
- `Acceptance` - definition of done in the format: the player sees X, presses Y and receives Z.
- `Priority` - `must`, `nice` or `dream`.
- `Layer` - `MVP`, `Jam Stretch` or `Post-jam`.

## Commit Convention

Use Conventional Commits:

- `feat:` - new functionality.
- `fix:` - bug fix.
- `docs:` - documentation changes.
- `refactor:` - refactor with no behavior change.
- `chore:` - build, configs, dependencies.
- `style:` - formatting with no logic change.

## Configuration And Balance

All balance, tuning and setting values live in `.json` files in `configs/`. Never hardcode balance values in source code: ball speed, block health, damage, prices, drop rates, timings, sizes and UI positions must be read from configs.

When changing the **structure** of JSON configs (adding/removing/renaming fields, not values), report it in the response in CAPS. For example: "ADDED FIELD `ballSpeed` TO `game.json`" or "REMOVED FIELD `dropRate` FROM `bonuses.json`".

## Bugs For The Programmer

If a bug is found in game code and should be fixed by the programmer, write it in `todo/bugs.md`. Format: date, short description, exactly what should change and in which file.

Do not fix code yourself without explicit permission if the task was only documentation, analysis or a technical brief.

## Tasks For The Programmer

If a new feature or improvement task is needed (not a bug), write it in `todo/tasks.md`. Format: date, title, what should be done, where to look in code and why it is needed.

**Important:** bugs and tasks are different files. A bug is something broken. A task is something new or planned.

## Closing Bugs And Tasks

When fixing a bug or completing a task, erase the body description and mark the heading as done: wrap it in `~~strikethrough~~` and add the status.

Examples:

```text
### ~~[2026-05-08] Ball gets stuck in a corner~~ FIXED
### ~~[2026-05-08] Results screen~~ DONE
```

Closed tasks should not take up the screen.

## Reading Tasks And Bugs

Before starting any code work, read these files in this order:

- `todo/tasks.md` - the only backlog, task order, next work item and statuses.
- `todo/current.md` - current version and design context without task list or acceptance.
- `todo/bugs.md` - known bugs.
- `todo/thoughts.md` - unsynced ideas and observations that are not tasks yet.

They may contain context that affects what to do and how to do it.

If a good idea appears during work, such as changing JSON configs, first compare it with `todo/tasks.md`. If the task already exists in the plan, update the relevant task in `todo/tasks.md`. If there is no task, record the thought in `todo/thoughts.md` instead of losing it in the final message.

## Architectural Decisions

All significant decisions are logged in `design/decisions.md` with date, context and rationale. Check this file before architectural changes.

## Technical Specifications

Detailed technical documentation lives in `techspec/`. Check it before changing rendering, the atlas, batching systems, level formats and asset loading.
