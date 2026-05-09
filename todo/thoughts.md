# Thoughts

Unsynced ideas, observations and improvements that appeared during work but have not become tasks in `todo/tasks.md` yet.

## Rules

- Before adding a thought, check `todo/tasks.md`.
- If the idea is already in the plan, update the existing task in `todo/tasks.md` instead of duplicating it here.
- If the idea is not in the plan, record it here briefly: date, context, why it may be useful, and where to sync it later.
- During planning, periodically move confirmed thoughts into `todo/tasks.md` or delete them as obsolete.

## Inbox

- [2026-05-09] Tooling if variants return: `scripts/simulate-tiles.js` can print active `GAMEPLAY_VARIANT=one_color_chain`, but does not model Chain accumulation and Chain bonus. For Variant B evaluation, use real playable/debug for now; when comparing variants again, update the simulator to count connected region continuity, `chainSpent/chainBonus` and single-lane threat next to the usual capture metrics.

- [2026-05-09] Tooling if variants return: `scripts/simulate-tiles.js` prints active `GAMEPLAY_VARIANT=placement_payoff`, but the current theoretical battle model does not apply Focus. For Variant A balance, use real playable/debug for now or update the simulator to count Focus gain along the placement sequence, cap, conversion on closure and print `focus spent/bonus` next to damage.
