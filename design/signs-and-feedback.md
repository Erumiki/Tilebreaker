# Signs & Feedback

This is the UIX inventory for battle signs, feedback, messages and small animations.

Do not implement from this file directly. First use it to decide what every action and event should communicate, then promote the chosen items into the implementation task.

## Pass Rules

- Every player action and game event should have a trigger, visible feedback, optional animation, message-log text and a debug/test signal.
- Prefer short battle-log messages that say what happened, who paid or received something, and why.
- Feedback should happen at the same moment as the rule effect. If a zone closes immediately, its damage/gold/strike feedback appears immediately too.
- Keep the active Core 1 loop focused on hearts, hand-submit cost, immediate closures, gold and strikes.
- Old monster attack damage should not leak into the active UI once the new hand-submit economy is implemented.

## Initial Event Inventory

| Event | Feedback to define |
| --- | --- |
| Battle start | Show the 7x7 board, center anchors or future universal starter, starting hand, empty/filled hold slot, player hearts, monster hearts and gold. |
| Select hand card | Show selected card state, valid cells and current hold action. |
| Hold selected card | Show the held card, hand gap/refill behavior if any, and message only if needed. |
| Swap held card | Show hand/hold swap animation and preserve clear selected state. |
| Valid placement | Place tile, update valid-cell highlights, check closure immediately. |
| Invalid placement | Explain edge mismatch, occupied cell or unreachable placement without blocking future clicks. |
| Zone closes | Close/score at once, animate the closed zone, deal monster damage, update hearts, log the damage and check strike/gold. |
| Strike gained | Show strike count or chain moment and bonus gold earned. |
| Gold earned | Update gold immediately and log source: closure, strike or future reward. |
| Hand submit | Button says "Сдать руку" and previews heart cost; click pays cost instantly and starts redeal. |
| Redeal | Animate old hand leaving and new hand entering; held card behavior stays explicit. |
| Player pays hearts | Animate player heart loss and log that the cost came from submitting the hand. |
| Monster damage | Animate monster heart loss and log the closed-zone source. |
| Battle win/loss | Make final state distinct from normal hand submit and preserve the reason in the log. |
| Shop/card buy | Future pass: show gold price, card preview, buy confirmation feedback and deck update. |

## Core 1 Rescue Decisions

These decisions apply to active `legacy` / Core 1 Rescue only. They replace the older round-end combat language in the playable layer; archived variants may stay technically URL-playable without inheriting this economy.

### Hand Submit

- Button label: `Сдать руку`.
- The button always shows the exact heart cost before click: `Сдать руку (-N hearts)`.
- Cost is paid immediately on click, before the redeal starts.
- Cost formula for the implementation pass: `1 + floor(unplayedHandCards / 4) + floor(handSubmitsThisBattle / 2)`.
- With current hand size 7, the first submit costs 2 hearts if the player gives up the whole hand, 1 heart after playing down to 3 cards, then every second submit in the same battle adds +1.
- The held card does not count as unplayed hand cost, because hold is the explicit tool for saving one plan.
- `handSubmitsThisBattle` resets at battle start and after battle win/loss, not after closure.
- If the player cannot pay the previewed cost, the button is disabled and the log says why.
- Message-log text: `Hand submitted: -N hearts.`
- Debug/test signal: expose `submitCost`, `unplayedHandCards`, `handSubmitsThisBattle`, `playerHeartsBefore`, `playerHeartsAfter`.

### Immediate Closure

- Zone closure is checked immediately after every valid tile placement.
- If the placed tile closes one or more zones, those zones score immediately before the player can place another tile, hold, or submit the hand.
- Monster hearts update in the same beat as the closure feedback.
- Scored closure tiles use the existing cleanup rule, but the visible moment should be: highlight closed zone -> apply heart damage/gold/strike -> remove or fade scored tiles.
- No separate "end round" scoring remains in active Core 1.
- Message-log text: `Closed red zone: -H monster hearts, +G gold.`
- Debug/test signal: expose `lastClosureImmediate: true`, `closedZones`, `monsterHeartsBefore`, `monsterHeartsAfter`, `goldEarned`.

### Monster Damage

- Active Core 1 removes separate monster attack damage.
- The player loses hearts only from `Сдать руку` in the current MVP implementation pass.
- Enemy attack rows from the old round model should not be presented as incoming damage in active Core 1. If retained for debug, they must be visually separated from player-facing cost.
- Message-log text for old monster damage is removed from active Core 1.

### Strike

- A strike is awarded only when a valid tile placement closes a zone immediately after the previous valid tile placement also closed a zone.
- "Immediately" means the next valid placement by the player. Holding/swapping/selecting does not break the chance because no tile was placed. Invalid clicks do not break it. Any valid non-closing placement breaks it.
- Submitting the hand breaks the strike chance and resets the current strike count.
- Strike count starts at 0. First closure gives normal gold and opens a strike chance. Second closure on the very next valid placement gives `Strike x1`; third consecutive closure gives `Strike x2`, and so on.
- Strike bonus for the implementation pass: `+1 gold * strikeCount` on top of normal closure gold.
- Message-log text: `Strike xS: +B gold.`
- Debug/test signal: expose `strikeCount`, `strikeWindowOpen`, `lastPlacementClosedZone`, `strikeGold`.

### Gold

- Gold is a future between-round card-buying currency, not a battle survival resource.
- Starting gold in a new run: 0.
- Closure reward for the implementation pass: `+1 gold per closed zone`.
- Strike bonus: `+strikeCount gold` when a strike triggers.
- Battle win rewards and card shop prices are a later card/shop pass. Do not add card buying to this implementation pass.
- Message-log text: `Gold +G.`
- Debug/test signal: expose run `gold`, `goldBefore`, `goldAfter`, `goldSource`.

## UIX Checklist For Next Implementation

Priority 1:

- Rename old round-end/new-pick action to `Сдать руку`.
- Show the live submit cost on the button and disable it when lethal/unpayable.
- On submit, animate player heart loss first, then animate hand discard/redeal.
- Replace active Core 1 monster attack damage text with submit-cost language.
- Trigger closure scoring immediately after placement and log the result immediately.
- Show monster heart loss at closure time, not at hand submit time.
- Add battle-log rows for submit cost, closure damage, gold and strike.

Priority 2:

- Add gold display to battle HUD, starting at 0.
- Add small floating `+G gold` on closure and strike.
- Add a short strike burst/count near the closure result when consecutive placements close zones.
- Keep hold behavior visually explicit: held card saved through submit, returned to discard at battle end.
- Expose debug/test fields for submit cost, immediate closure, gold and strike.

Priority 3, later card/shop pass:

- Add between-round card shop or buy offers using gold.
- Show card price, preview, buy confirmation and deck update.
- Tune shop prices only after gold income from closures/strikes is visible in playtest.
