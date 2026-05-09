# Core Gameplay

Tilebreaker is a fast roguelite tile-placement battler: a mix of Balatro-style risky gambling and Carcassonne-style spatial building.

The main prototype goal: in the first 3 minutes, check whether placing tiles under enemy color pressure is fun and whether it is clear why a zone closed and dealt damage.

## Design Pillar

Each round, the player receives a hand of tiles and builds a temporary map on a fixed board. The enemy declares attacks in three colors with numbers. The player tries to close colored zones so their strength beats the matching enemy color attacks.

The main turn decision:

```text
Close a small safe zone now
or risk growing a large zone for a huge multiplier.
```

## Main Fun

The player should feel:

- the thrill of risking a large zone;
- the pleasure of assembling a map;
- a clear color problem from the enemy;
- an explosive multiplier when a large zone closes;
- the desire to play one more short battle.

## Run Rhythm

Main loop:

```text
Menu -> Battle -> Result -> Upgrade -> Next battle -> Final
```

After 5 victories, the player receives the final run victory. On defeat, the run ends.

## Battle

In each battle round, the enemy declares attacks in three colors, for example:

```text
Red 5
Blue 3
Green 7
```

The player receives a new tile hand, places tiles on the board, then closed colored boundaries capture the land inside them. Captured area counts as colored damage.

For each color separately:

- if the closed sum of the color is greater than that enemy color attack, the full closed sum of that color hits the enemy;
- if the closed sum of the color is lower than that enemy color attack, the player takes the missing damage;
- excess in one color does not currently compensate for a shortage in another color.

Example:

```text
Enemy: red 5, blue 3, green 7
Player closed: red 8, blue 1, green 9

To enemy: 8 red + 9 green
To player: 2 damage for the blue shortage
```

Battle victory: kill the enemy with damage. Defeat: player HP runs out.

## Board

For the MVP, the board is fixed. Starting hypothesis: 6x6.

The board refreshes automatically every battle round: on a new round, the player places a new temporary map from scratch. The map does not persist between rounds.

## Tiles

Land colors:

- red;
- blue;
- green;
- gray.

Gray is the fourth neutral color. It participates in connections and balance, but does not deal damage by itself.

MVP placement rule: adjacent edges must match by color.

Active MVP tile set: `assets/tiles_v2/tile_manifest.json`.

For each combat color in the starting v2 set:

- `line_h`, `line_v`;
- `corner_ur`, `corner_rd`, `corner_dl`, `corner_lu`;
- `tee_u`, `tee_r`, `tee_d`, `tee_l`;
- `plus`.

`dot` and base `cap` tiles are not part of the MVP deck. They may return later only as a special/low-power layer with a separate rule.

Rotation is an open hypothesis:

- first try without manual rotation;
- if it does not play well, add auto-rotation on placement;
- if it still does not play well, allow manual rotation.

## Land Capture

For the MVP, colored micro-cells are read as land boundaries, not as the only scoring area themselves.

Capture is counted like this:

1. For each combat color separately, build the micro-grid for the full board.
2. Micro-cells of that color count as walls/boundaries.
3. If that boundary fully cuts an area off from outside air, the area inside is captured by that color.
4. For visuals, the inner area is temporarily filled with the boundary color.
5. Color score is counted by area: boundary cells + captured interior cells.

Example: if a blue line fully closes around a gray or empty inner area, that entire area becomes blue for scoring this round.

Unclosed boundaries at round end simply do not score in the MVP. The player is already punished by receiving no damage from that area.

MVP clarification rules:

- use 4-neighborhood; diagonal touching does not close a hole;
- empty space connected to the outside area counts as outside air;
- empty space inside a fully closed boundary counts as captured land and scores;
- capture is counted separately for red, blue and green;
- all placed micro-cells inside a closed boundary count as captured interior for that color, including gray and cells of other combat colors;
- gray does not deal damage by itself, but can be captured by a colored boundary;
- already captured areas are not repainted permanently between rounds because the board is temporary every round.

## Damage And Multiplier

The MVP should test the large multiplier: a large zone creates more risk and more reward.

Starting prototype formula:

```text
Captured area = colored boundary cells + interior cells
Final capture strength = captured area * 2
```

If the formula is too sharp, balance is adjusted in config.

## Deck

The player has a deck, hand and discard.

Each round, the player receives a new hand. After play, tiles go to discard. When the deck is empty, discard is shuffled into a new deck.

For the MVP, the player may play all tiles from the hand without energy or action limits.

## Enemies

For the MVP, enemies differ by HP and color attack numbers. Special enemy rules are postponed to future versions.

Each round, the enemy may provide a new color ratio.

## Between Battles

For a quick prototype, the meta layer is minimal:

- after a win, the player chooses one of three rewards;
- rewards can initially be simple deck changes;
- artifacts and rule breaking are a layer after the base battle is validated.

## Not Doing Yet

- Complex story.
- Deep permanent meta-progression.
- Many special enemies.
- Large artifact set.
- Long tutorials.
- Features that do not strengthen the first 3-minute experience.

## Rule

All numeric gameplay parameters must live in `configs/`, not in code.
