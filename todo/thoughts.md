# Thoughts

Unsynced ideas, observations and improvements that appeared during work but have not become tasks in `todo/tasks.md` yet.

## Rules

- Before adding a thought, check `todo/tasks.md`.
- If the idea is already in the plan, update the existing task in `todo/tasks.md` instead of duplicating it here.
- If the idea is not in the plan, record it here briefly: date, context, why it may be useful, and where to sync it later.
- During planning, periodically move confirmed thoughts into `todo/tasks.md` or delete them as obsolete.

## Inbox

- [2026-05-09] Legacy playtest: full-hand immediately became more playable. This confirms that the next iteration should strengthen agency in legacy instead of returning to queue. New goal wording: kill the monster with fewer hand picks.

- [2026-05-09] Legacy hearts/pick-pressure: synced into the Core 1 Rescue design pass. The next active wording is `Сдать руку`: preview and immediately pay `1 + floor(unplayedHandCards / 4) + floor(handSubmitsThisBattle / 2)`, remove separate monster attack damage, and keep the player cost explicit.

- [2026-05-09] Day 2 playtest: remove gray blank from all active tests. In the current state, the blank tile does not create an interesting decision, makes the hand harder to read and can mask the real draw problem. Synced in `configs/game.json`: rescue deck without gray blank, `drawBag.grayMax = 0`.

- [2026-05-09] Core 1 Rescue: the most playable mode is `legacy`, but the main pain is waiting for the needed card. Hypothesis order for review: 1) full-hand by default, 2) universal red/blue starting center like Carcassonne, 3) hold one tile, 4) limited rotate, 5) red/blue double-color tiles. The first two points go into the must task; keep the rest as later levers.

- [2026-05-09] Kingdomino-like combat: second favorite if Core 1 Rescue does not come alive. Minimum fantasy: three-color pieces connect by domino logic, connected colors deal colored damage, and the number of piece replacements is limited. Important: do not mix this with capture-fill; keep it as a separate spike.

- [2026-05-09] Fiords-like reference: reproducing Fiords card by card may be worth trying, but it risks restarting the design. Keep it only as a reference/separate post-jam spike, not as the next must.

- [2026-05-09] Possible small review idea: instead of full rotate, give a "rotate token" as a rare battle resource or reward. This may relieve orientation frustration without buffing every corner permanently or bringing back small-square dominance.

- [2026-05-09] Tooling: `scripts/simulate-tiles.js` can print active `GAMEPLAY_VARIANT=one_color_chain`, but does not model Chain accumulation and Chain bonus. For Variant B evaluation, use real playable/debug for now; when comparing variants, update the simulator to count connected region continuity, `chainSpent/chainBonus` and single-lane threat next to the usual capture metrics.

- [2026-05-09] Tooling: `scripts/simulate-tiles.js` prints active `GAMEPLAY_VARIANT=placement_payoff`, but the current theoretical battle model does not apply Focus. For Variant A balance, use real playable/debug for now or update the simulator to count Focus gain along the placement sequence, cap, conversion on closure and print `focus spent/bonus` next to damage.

- [2026-05-09] Playtest: the game still punishes attempts to make land larger than 4 cells. The current recipe/bag/queue and large-zone bonuses do not give the player a clear enough reason to grow a plot instead of quickly closing a small one. Raw directions:
  - keep one land color to remove color self-punishment and leave the decision about shape/route;
  - reward the act of placing or, more carefully, continuous continuation of one plan/plot;
  - add points/beacons/targets on the board that must be connected by land for a bonus;
  - turn the mechanic into a road: if a route has a start and end or connects assigned gates, it gives bonus damage;
  - count extra cells beyond the small contour as charge for the final hit so 5+ cells do not feel like lost tempo;
  - give a bonus for a bridge between two islands, a long chain, perimeter, forks or 2-3 obvious shapes such as line 5+, 3x3 square and ring;
  - use large lands as a base/control zone: adjacent placements, shield, resource or next hit scale from region size.
  Synced into `todo/tasks.md` as Day 4 gameplay variants and into `design/gameplay-variants.md` as the comparison scorecard.

- [2026-05-08] Hidden tile queue hypothesis - synced into `todo/tasks.md` and implemented as active MVP `drawMode: "queue"`. Hand mode remains available for comparison through `?drawMode=hand`.

The tile-battle JSON config idea already exists in `todo/tasks.md`: `[2026-05-08] Day 1: move tile-battle parameters into configs`.
