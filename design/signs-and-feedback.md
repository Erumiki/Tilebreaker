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

## Open Questions

- Exact heart cost curve for each next "Сдать руку".
- Whether the cost depends on unplayed cards, hand-submit count, battle number or another pressure meter.
- Whether a closed zone is removed, marked or animated before removal at the exact closure moment.
- Exact definition of "next step" for strikes: next placed tile, next closure opportunity, or any action before hand submit.
- Strike bonus formula and whether strike count resets on submit, invalid placement or non-closing placement.
- Initial gold amount, gold per closure, strike bonus and future shop prices.
- Message-log size, fade timing and whether old messages collapse or scroll.
- Which events need sound later, even if this pass only defines visual/text feedback.

## Next Output

The UIX pass should turn this inventory into a prioritized checklist with exact strings, timing and tests for the active battle UI.
