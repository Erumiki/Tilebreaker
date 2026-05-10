# UI Layout Audit

Date: 2026-05-10.

Checked the normal MVP route with seed `20260508` in `1440x900` desktop and `390x844` portrait:

- menu;
- battle intro;
- battle initial;
- battle valid-hover;
- battle after closure;
- result;
- shop.

Current audit captures were saved in the ignored local folder `tmp/ui-audit/` during this pass.

## What Was Broken

- Portrait result: the reward line was a single centered text run, so `Награда за монстра...` escaped the result panel on narrow screens.
- Portrait battle intro: the reward preview was positioned below the four stat rows, almost into the bottom border and action button.
- Desktop battle side panel: closure summary, submit-cost text and the battle log used independent hardcoded `y` anchors. On a 438px panel they converged and overpainted each other after a closure.
- Portrait battle HUD: icon-heavy top stats were technically inside the viewport but read too faintly over the banner/background.

## Why It Broke

- Existing viewport checks covered layout rectangles, but not Pixi text bounds.
- `ui.drawText` had no shared `maxWidth`, wrap or fit behavior, so every screen was responsible for not overflowing text manually.
- Decorative borders and corner brackets were duplicated in scenes, so small changes in one screen did not carry to the others.
- Some screen rules mixed element storage and screen-specific flow: the battle side panel had fixed anchors for all bottom content instead of deriving the lower block from the number of visible rows.

## Current Contract

- Shared chrome lives in `src/render/chrome.js`: `insetRect`, `drawBorder`, `drawCornerBrackets` and `drawFramedPanel`.
- Screen-specific placement stays in each scene layout file/function, but text inside panels/buttons/cards should use `maxWidth` and `wordWrap` when it can grow.
- Battle side-panel lower content is now derived from attack-row count instead of magic bottom anchors.
- Portrait intro combines reward info into the gold row instead of adding a fifth cramped line.
- Portrait result wraps reward text inside the panel.
- Portrait battle HUD is drawn as a final high-contrast text bar above the banner.
