# Card Pool GD Pass

Status 2026-05-09: universal starter implemented; buyable shop cards have validated data in `configs/cards.json`; the between-battle shop now sells catalog offers for gold and sends bought cards to the persistent deck and discard.

This pass records the current card vocabulary used by the implemented gold card shop. The goal is to give Core 1 Rescue more planning control without turning the closure puzzle into an always-wildcard deck.

## Goals

- Keep one readable red-blue universal starter in place of the temporary two-card center bridge.
- Make gold matter between battles through card buys, not only passive scoring.
- Add controlled rescue tools for blocked hands.
- Keep the first 3-minute experience focused on closing territory, hand submit pressure and gold/strike rewards.
- Avoid reintroducing green, gray blank or free rotation until the red-blue rescue loop has been tested.

## Guardrails

- The implemented shop consumes `configs/cards.json`; buys change the persistent deck and discard pile during the run.
- The universal starter is implemented as the opening-control baseline; buyable cards now need balance validation as live shop content.
- Buyable cards go to discard first while also increasing the persistent deck. They should not appear directly in hand unless a later shop rule explicitly says so.
- Prices assume current visible gold income: `+1 gold` per closure and `+strikeCount gold` on strike. Common buys should usually be affordable after one won battle; rare buys should require saving or strong gold play.
- Early shops should offer red-blue cards only. Green stays out of the active economy until a separate task reintroduces it.
- Wildcards should solve "I am one connector short", not make every contour close itself.

## Special Semantics

The current tile rules have ordinary combat symbols (`R`, `B`, `G`) and gray empty land (`.`). Universal and split cards need explicit rule semantics rather than being treated as normal manifest entries.

### Universal Boundary

Working symbol: `*`.

Rule intent:

- `*` is a boundary adapter that can match any active combat color on an edge.
- For capture checks, `*` blocks flood-fill for the color being evaluated, so it can participate in a red or blue contour.
- `*` is not itself red or blue for scoring. It does not add extra damage area and does not multiply color bonuses.
- `*` does not make red and blue match each other directly. Red still cannot touch blue unless the edge connection is through a printed universal cell.
- If one placement would let both colors claim the same wildcard-assisted closure, score only the color of the placed tile that completed the closure in the first MVP. This keeps simultaneous dual-color closure out of the first implementation.

### Split-Color Boundary

A split-color card contains printed red cells and printed blue cells in the same 3x3 tile.

Rule intent:

- Each printed cell belongs to its own color.
- Red and blue cells on the same card do not convert into one color and do not match each other on adjacent edges.
- A split card is a compact way to support two nearby plans, not a color merger.
- Split cards should be tested as bought control cards, not as the starter, because they are harder to explain than a universal adapter.

## Universal Starter Candidate

Accepted candidate: `starter_universal_line_v`.

Role:

- Board-only starter for active `legacy`.
- Replaces the former two ordinary center anchors.
- Communicates "start either red or blue from here" with one visible rule.

Proposed 3x3 rule matrix:

```text
.*.
.*.
.*.
```

Edges:

```text
north: .*.
east:  ...
south: .*.
west:  ...
```

Placement behavior:

- A red or blue vertical continuation can attach above or below it.
- Horizontal sides remain empty, so it does not become a universal plus.
- It should be placed at the board center, not drawn from the deck.
- It should not consume a run card and should return when fresh-start recovery rebuilds the starter board.

Visual brief:

- One vertical boundary stroke with red and blue readable together.
- The image should look like a special center marker, not like gray blank fill.
- Avoid four-way crossroads in the first asset; the starter should invite a plan, not provide every exit.

Decision:

- First implementation: board-only special starter. Implemented in `configs/game.json` as `specialTiles[]` plus one `startingBoardTiles` entry at `(3,3)`.
- Later possibility: a rare buyable universal line can reuse the same rule, but only after the starter proves readable.

Implementation notes:

- `*` matches only active combat-color symbols on touching edge cells.
- Red and blue still do not match each other unless the actual touching cells include `*`.
- For capture checks, `*` blocks flood-fill for the evaluated color.
- `*` boundary cells are excluded from capture area/damage so the starter gives access, not free score.
- If a wildcard-assisted closure would score the same enclosed space for both colors, active `legacy` keeps the placed tile's color for the immediate score.
- The first readable visual is code-rendered and exported as `assets/tiles_v2/starter_universal_line_v.png`: each `*` micro-cell is split red/blue.

## Buyable Card Candidates

Costs are first-pass targets. They are deliberately coarse because gold income and card value still need manual playtest with the live shop.

| Card family | Rarity | Rough cost | Intended role | MVP limit |
| --- | --- | ---: | --- | --- |
| Colored line, red/blue | Common | 2 | Safe extension and bridge-building without boosting small-square closures too hard. | 1-2 per shop. |
| Colored tee, red/blue | Common | 3 | Branching tool for growing a larger contour across multiple turns. | Prefer over extra corners in early shops. |
| Colored corner, red/blue | Common | 4 | Concrete closer when a plan is almost ready. | Cap at 1 per shop in early tests. |
| Joker line `*` | Uncommon | 5 | Rescue a blocked straight continuation in either active color. | No more than 1 offered per shop. |
| Red-blue split corner | Uncommon | 5 | Let one bought card support two adjacent color plans without merging colors. | Test after joker line, not in first shop build. |
| Joker corner `*` | Rare | 6 | Emergency closer for a nearly finished contour. | Max 1 per run until minimal-loop risk is known. |
| Joker tee `*` | Rare | 7 | Powerful branch/rescue card for late battles. | Postpone from first shop pool unless the deck remains too dry. |
| Gold-seal colored card | Uncommon | 4 | Ordinary colored tile that gives `+1 gold` if it participates in a closure. | Payoff experiment only after base buying is readable. |

Services worth testing after card buys are stable:

- Remove a card for 3-4 gold.
- Shop reroll for 2 gold.
- One-use rotate voucher for 4 gold.

Postpone for now:

- Second hold slot.
- Free rotation on every bought card.
- Universal plus.
- Green shop cards.
- Gray blank shop cards.
- Direct damage cards that bypass territory closure.

## Shop Shape

Current shop shape:

- Appears after a won battle.
- Shows 5 catalog-driven card offers.
- Offer mix is generated from `configs/cards.json` using rarity weights, offer weights, active colors, unlock battle and `maxPerShop`.
- Player may buy zero or more affordable cards.
- Bought cards enter discard.
- The old free `1 of 3` victory rewards are no longer the normal path.

Price read:

- 2 gold: "small plan improvement now".
- 3-4 gold: "meaningful card buy after a normal victory".
- 5 gold: "save or win with strike to buy control".
- 6-7 gold: "rare rescue power, not every run".

## Validation Protocol

### Step 1: Universal Starter Only

Compare current two-anchor baseline with `starter_universal_line_v`.

Status 2026-05-09: implemented and passed technical smoke. The remaining validation is manual feel: first 3-5 turns should be clearer than the old two-anchor bridge without making a repeated starter loop the default plan.

Automated checks:

- `legacy` starts with exactly one center starter tile.
- Red and blue vertical lines can legally continue from the starter.
- Fresh-start recovery restores the single starter.
- A wildcard-assisted closure scores only through the placed/completing color.
- No red-blue direct edge match is allowed without `*`.

Simulation:

- Run the usual seed `20260508`.
- Run at least 40 first-battle samples.
- Record battle 1 and battle 2 win rate, average submits, gold earned, minimal capture share, average captured area, captures in the first 3 hands and dead-end/fresh-start rate.

Manual test:

- Play 5 shop-enabled first battles with the starter.
- The player should identify where red and blue can begin without reading a rule note.
- Stop signal: if the starter mostly creates the same minimal vertical loop every time, it needs a weaker shape or different placement.

Success bar:

- First 3-5 turns feel more directed than the two-anchor version.
- Battle 1 win rate does not drop by more than 10 percentage points from the current baseline.
- Minimal capture share does not increase meaningfully.
- Average captured area does not shrink.

### Step 2: Minimal Shop Pool

Initial shop pool now represented in `configs/cards.json`:

- Colored line.
- Colored tee.
- Colored corner.
- Joker line.
- Controlled plus/cross cards from battle 2 onward.

Automated checks:

- Buying spends gold and sends the card to the persistent deck and discard.
- Unaffordable cards cannot be bought.
- Deck, draw pile and discard counts stay consistent.
- Bought cards can appear after reshuffle, not immediately for free.

Simulation and manual checks:

- Compare no-shop vs shop on the same seeds.
- Record gold before shop, cards bought, card use rate, win rate and submit count.
- Track whether purchases reduce dead hands without pushing minimal capture share up.
- Stop signal: if the best purchase is always a corner, raise corner price or reduce corner offer frequency.

### Step 3: Control Expansion

Add candidates one family at a time:

1. Red-blue split corner.
2. Joker corner.
3. Gold-seal card.
4. Joker tee or rotate voucher.

Each candidate needs one clear answer: does it create a better plan, or only make the solution automatic?

## Current Lead Decision

The active battle deck starts with ordinary red/blue rescue cards and the board-only `starter_universal_line_v`. The live shop consumes `configs/cards.json`: ordinary red/blue lines, tees and corners are active from battle 1; red/blue plus and `joker_line_v` unlock from battle 2; stronger joker corner/tee and double line/curve candidates stay staged until their placement/scoring UX is implemented. All bought card families remain `balanceStatus: "unverified"` until the separate balance pass records keep, tuning or disable decisions.
