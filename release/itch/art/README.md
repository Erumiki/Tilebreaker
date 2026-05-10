# Tilebreaker Itch Art Handoff

Generated for the itch.io release brief in `todo/itch-release-plan.md`.

## Upload Exports

- `cover_630x500.png`
- `header_1200x360.png`
- `embed_background_1280x720.png`
- `page_background_1920x1080.png`
- `screenshot_01_menu.png`
- `screenshot_02_intro.png`
- `screenshot_03_battle_closure.png`
- `screenshot_04_shop.png`
- `screenshot_05_victory_or_late_battle.png`

## Internal QA

- `qa_portrait_intro_390x844.png`
- `qa_portrait_battle_390x844.png`
- `qa_portrait_battle_390x664_hotfix.png`
- `qa_loading_screen_390x664_runtime_polish.png`
- `qa_portrait_result_390x844.png`
- `qa_portrait_shop_390x844.png`

## Sources

Generated bases are kept in `source/*_base_generated.png`. Final marketing exports are rendered by:

```sh
./scripts/node.sh release/itch/art/source/render-itch-art.mjs
```

Screenshots are captured from the local production preview at `http://127.0.0.1:4173/?seed=20260508&guaranteedLoopHands=true&drawMode=hand` after running `./scripts/npm.sh run build` and `./scripts/npm.sh run preview`:

```sh
TILEBREAKER_SCREENSHOT_URL='http://127.0.0.1:4173/?seed=20260508&guaranteedLoopHands=true&drawMode=hand' ./scripts/node.sh release/itch/art/source/capture-itch-screenshots.mjs
```

## Prompt Set

Built-in image generation mode was used for the four marketing bases. The final title text was added locally in `source/compositor.html` so the logo stays readable and exact.

Shared direction: Astral Archive Defense, brass/stone observatory, red solar wards, blue lunar wards, monster breach pressure, no fake UI controls, no impossible tile exits.
