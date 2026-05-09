# Core Gameplay

Tilebreaker is a fast roguelite tile-placement battler about a defender of a star archive. The player places red and blue boundary tiles as magical wards, closes contours to seal invading monsters, and survives by deciding when a new hand is worth paying hearts.

This file describes the active Core 1 Rescue direction. Historical experiments and postponed variants live in `design/gameplay-variants.md`, `design/tile-feasibility.md` and `design/decisions.md`.

## Current Core

Active config:

- `gameplayVariant: "legacy"`;
- `drawMode: "hand"`;
- `holdEnabled: true`;
- active combat colors: `red`, `blue`;
- board: `7x7` macro tiles;
- tile topology: each tile is a `3x3` micro-cell matrix.

The player should feel:

- a clear first move from the universal center starter;
- the pleasure of growing a ward contour across the board;
- tension between closing a small safe seal and investing in a larger one;
- a readable tempo question: "Can I squeeze one more useful move out of this hand, or should I pay hearts to submit it?"

## Run Rhythm

Current implemented loop:

```text
menu -> battle intro -> battle -> result -> shop -> next battle intro -> final
```

After a non-final victory, the old simple reward choice is replaced by the card shop. The player can buy zero or more cards before continuing to the next monster intro.

After 5 victories, the player receives the final run victory. On defeat, the run ends.

## Battle Loop

Each battle starts with:

- player hearts from `configs/game.json`;
- monster hearts from `configs/levels.json`;
- persistent run deck, draw pile, discard pile and gold;
- one board-only universal red-blue starter at the board center;
- a full hand of 7 cards and one hold slot.

The player places hand cards onto empty board cells. A valid placement either:

- touches direct neighbors with matching 3-cell edge signatures; or
- starts a new island in an empty cell with no direct neighbors.

When a placement closes one or more zones, active `legacy` scores those closures immediately before the next player action. Monster hearts, gold, strike feedback and the battle log update in that same beat.

## Hand Submit

The old round-end combat flow is replaced in active `legacy` by `Сдать руку`.

Submitting the hand:

1. previews the exact heart cost on the button;
2. pays that cost immediately;
3. increments the per-battle submit count;
4. discards played and unplayed hand cards;
5. preserves the held card;
6. redeals the hand.

Current formula:

```text
submitCost = 1 + floor(unplayedHandCards / 4) + floor(handSubmitsThisBattle / 2)
```

The held card is excluded from `unplayedHandCards`. If a new hand is needed, the player cannot pay, and the monster is still alive, the battle ends in defeat instead of giving a free redeal.

## Board And Tiles

The active tile catalog is `assets/tiles_v2/tile_manifest.json`.

The full manifest contains:

- red, blue and green combat boundary tiles;
- gray blank technical/future tiles;
- lines, corners, tees and plus patterns for combat colors.

The active Core 1 starting deck uses only red and blue:

- `line_h x2`;
- `line_v x2`;
- each `tee` x1;
- each `corner` x1;
- no `plus`;
- no gray blank.

Green and gray remain in data for future work, archived variants and tooling, but they are not part of the active starting deck, early reward color cycle or visible legacy combat rows.

## Universal Starter

Legacy battles start with one board-only `starter_universal_line_v` at `(3,3)`.

Rule matrix:

```text
.*.
.*.
.*.
```

The `*` boundary:

- matches active combat colors for edge legality;
- blocks flood-fill for the evaluated color;
- does not count as red or blue scoring area;
- does not let red and blue match directly;
- returns when fresh-start recovery rebuilds the starter board.

## Capture And Damage

For each evaluated combat color, the game builds the board micro-grid and treats that color's boundary cells as walls. Empty or filled interior that cannot flood-fill to outside air becomes captured land for that color.

Clarification rules:

- 4-neighborhood only; diagonal touching does not close a hole;
- empty area connected to outside air is not captured;
- empty area inside a fully closed boundary is captured;
- placed cells inside a closed boundary count as interior for the evaluated color;
- visual captured fill does not change tile topology.

Active `legacy` converts closure damage to hearts. Early monsters have 3 hearts, the tuned final battle has `enemyHp: 4`, a minimal 2x2 closure deals 1 heart, and larger zones can deal more through `tileBattle.hearts.zoneDamagePerHeart`.

The underlying configured formula remains:

```text
baseDamage = area * damageFormula.areaMultiplier
largeZoneBonus = max(0, area - largeZoneBonus.minArea) * largeZoneBonus.bonusPerArea
grayInteriorBonus = gray interior cells * grayInteriorBonus.bonusPerCell
```

## Resources

Gold is battle income and shop currency:

- a run starts at 0 gold;
- each closed zone gives `+1 gold`;
- consecutive closing placements award strike bonus gold equal to the current strike count.
- active `legacy` seeds configurable board-underlay field resources: direct placement on gold collects it immediately, and closure consumes remaining gold/hearts in scored cells;
- field hearts heal only through closure and are capped by `hearts.maxPlayerHp`;
- monster victory pays `battle.reward` from `configs/levels.json` once as kill bounty.

The shop generates 5 offers from `configs/cards.json`, respecting card rarity, offer weight, active colors, unlock battle and max-per-shop caps. Bought cards spend gold immediately and go to discard while also increasing the persistent deck.

## Variants

The code keeps archived/test variants behind one switch:

- `legacy`;
- `placement_payoff`;
- `one_color_chain`;
- `connect_targets`;
- `road_mode`.

`legacy` is the active rescue candidate. Variants A-D remain URL/debug-addressable for comparison, but they are not the current MVP direction. Details and manual scorecard live in `design/gameplay-variants.md`.

## Between Battles

Current implemented progression is the card shop:

- card offers are generated from the validated catalog;
- the player may buy any number they can afford, or skip;
- ordinary cards add their tile id to the deck and discard pile;
- final MVP active cards are restrained red/blue line, tee and corner buys, plus red/blue plus/cross as low-pressure control;
- `joker_line_v`, `double_red_line_h` and stronger joker/double candidates are staged after the balance gate;
- bought cards carry the final `balanceStatus` from `configs/cards.json` into shop debug/history.

## Art Fantasy

The active setting is Astral Archive defense:

- red and blue boundaries are solar/lunar wards;
- closed contours are completed seals;
- monsters lose hearts because part of their intrusion is cut off;
- `Сдать руку` is an archive overload paid with living light;
- gold is star dust or archive tokens.

Detailed art direction lives in `design/art-direction.md`. Accepted style references live in `assets/art_refs/`.

## Not Doing Yet

- Deep permanent meta-progression.
- Shop reroll, removal service and other shop services.
- Balanced/approved final card pool.
- Complete low-level art replacement through the MVP art manifest.
- Manual rotation as a default rule.
- Reintroducing green, gray blank or plus into the active starting deck without a separate decision.

## Rule

All numeric gameplay parameters must live in `configs/`, not in code.
