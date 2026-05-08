# Current Version

## v0.3 Tile Battle MVP

**Goal:** Replace the battle placeholder with a playable tile-placement combat prototype.

**Active task:** Build the first 3-minute MVP loop: enemy color attacks -> tile placement -> closed-zone scoring -> HP result -> next round.

## Acceptance

- Player opens the Vite dev URL.
- Player sees the main menu.
- Player can move through `menu -> battle -> result -> upgrades -> next battle`.
- During battle, player sees enemy HP, player HP, three color attacks, a fixed field, and a hand of tiles.
- Player places tiles, ends the round, and sees closed-zone scoring.
- If a color beats enemy attack, the full closed sum of that color damages the enemy.
- If a color fails enemy attack, the missing amount damages the player.
- After 5 victories, player sees final run victory.
- UI is rendered through Pixi.js inside canvas, not DOM.
- Numeric balance lives in configs.

## Tasks

- [ ] Define tile-battle config shape.
- [ ] Implement tile deck, hand, discard, and shuffle.
- [ ] Implement fixed field placement.
- [ ] Implement color-edge matching.
- [ ] Implement closed-zone detection.
- [ ] Implement color attack resolution and HP.
- [ ] Implement battle UI and result summary.
- [ ] Connect victory/defeat to existing run flow.
- [ ] Verify playable loop with smoke test.
