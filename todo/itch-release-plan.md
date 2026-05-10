# Itch.io Release Plan

Tilebreaker itch.io release specification for the jam/MVP browser build.

This document is the source of truth for the itch.io upload executor, page-copy executor and marketing-art executor. Keep task ordering/status in `todo/tasks.md`; keep the field values, copy and asset brief here.

Source checks, last reviewed 2026-05-10:

- itch.io HTML5 guide: https://itch.io/docs/creators/html5
- itch.io first project page guide: https://itch.io/docs/creators/getting-started
- itch.io page design guide: https://itch.io/docs/creators/design

## Release Positioning

Release target: public playable jam/MVP prototype after the final build task is complete.

Itch project:

```text
https://mikitava.itch.io/tilebreaker
```

Butler target:

```text
mikitava/tilebreaker:html5
```

Current player-facing language: Russian. Use Russian page copy for the first itch upload unless the game UI is localized before release.

Public promise: a short browser-playable roguelite puzzle battler about sealing monsters in the Astral Archive. Do not promise long-term progression, deep deckbuilding, rotation, multiple modes or a fully balanced card pool.

## 1. Technical Upload Plan

### Prerequisites

The itch executor starts only after these backlog items are accepted:

- `MVP Art Track 3: asset validation, cleanup and final art-lead audit`;
- `MVP Readability And Juice Pass: first-player feedback`;
- `Final Jam Build, screenshots and submission checklist`.

Before upload, verify that README/current docs match the build actually being uploaded.

### Build And Package

Required repo work:

- add or verify a production build command, preferably `./scripts/npm.sh run build`;
- for Vite, ensure the itch build uses relative asset URLs, for example `vite build --base=./` or an equivalent `base: './'` config;
- build to `dist/`;
- package the contents of `dist/`, not the `dist` folder itself, into `release/itch/tilebreaker-itch-html5-jam-mvp.zip`;
- the ZIP root must contain `index.html`;
- include all runtime assets required by the build;
- do not include source files, `node_modules`, test output, drafts or raw art sources in the player ZIP.

Suggested package name:

```text
tilebreaker-itch-html5-jam-mvp.zip
```

Suggested itch upload display label:

```text
Tilebreaker HTML5 jam MVP
```

Butler upload path for hotfixes and repeat uploads:

```sh
./scripts/npm.sh run build
.tools/butler/butler status mikitava/tilebreaker
.tools/butler/butler push --userversion <version-label> dist mikitava/tilebreaker:html5
.tools/butler/butler status mikitava/tilebreaker
```

Use `dist` as the butler source so the existing itch `html5` channel/browser-playable settings stay attached to the channel. Keep the ZIP packaging path for manual itch web-form uploads or archival handoff.

Latest uploaded hotfix version:

```text
runtime-polish-2026-05-10
```

### Upload Requirements To Verify

The itch HTML5 ZIP must pass these checks:

- top-level `index.html` exists;
- all game files are inside the ZIP and referenced by relative paths;
- no built `index.html`, CSS or JS references start with `/assets/` or another absolute project path;
- file/path names match referenced case exactly;
- extracted file count is below 1,000;
- extracted content is below 500 MB;
- no single extracted file is above 200 MB;
- no filename including path is longer than 240 characters;
- filenames are UTF-8 encoded;
- the build runs with network disabled except for the itch page itself; no HTTP external asset calls.

### Local Verification

Run before uploading:

```sh
./scripts/npm.sh run check
./scripts/npm.sh run test:e2e
./scripts/npm.sh run build
./scripts/npm.sh run preview
```

Then verify the production preview:

- desktop normal route: `menu -> battleIntro -> battle -> result -> shop -> battleIntro -> final`;
- portrait phone route at `390x844` or equivalent;
- no missing textures or 403/404 asset requests;
- no console errors during menu, intro, battle, result or shop;
- touch targets and text fit on portrait;
- the loading screen is visible when config/assets are delayed, then hides before the main menu;
- the in-game top-right fullscreen affordance can enter/exit fullscreen locally, or reports a blocked fullscreen state in debug if the browser/embed forbids it;
- final screenshots are captured from this production build, not from dev-only/debug states.

After uploading to itch, use `Save & view page` while the project is still private and verify:

- the game launches from itch;
- fullscreen launch works;
- if the itch fullscreen control is blocked, the in-game top-right fullscreen affordance works on supported desktop browsers or reports the browser/embed block;
- mobile launch works or shows the intended itch mobile behavior;
- the uploaded ZIP is marked as browser-playable;
- the project page can be opened logged out or in an incognito window;
- if the project is submitted to a jam, the jam badge appears on the page after submission.

### Recommended Itch Embed Settings

Use:

- Kind of project: `HTML Game`;
- Launch mode: `Click to launch in fullscreen`;
- Click to Play: enabled;
- Mobile Friendly: enabled after portrait production preview passes;
- Scrollbars: disabled;
- Fullscreen Button: unnecessary for fullscreen launch; if the form requires a choice, keep the default/automatic option.

The build also has its own small top-right fullscreen affordance. This is a code-side fallback for browsers or itch embeds where the page-level fullscreen control does not give the game a usable fullscreen transition. The debug hook is `window.__tilebreakerDebug.getRuntimeDebug().fullscreen`.

Fallback only if fullscreen launch feels wrong on desktop:

- Launch mode: `Embed in page`;
- Viewport: `960 x 640`;
- Fullscreen Button: enabled;
- then re-test that the full board, hand and shop fit without scrollbars.

### Visibility And Submission Flow

Use this flow:

1. Create or edit the game page privately.
2. Fill all fields from Section 2.
3. Upload the ZIP and set the embed options.
4. Upload art from Section 3.
5. Save and view the private page.
6. Test logged in, then logged out/incognito.
7. If this is for a jam, submit the saved project to the jam page.
8. Set Visibility & access to `Public` only after the private page and jam submission are checked.

## 2. Itch Page Fields And Copy

Use the values below as the upload checklist. If the form has a field not listed here, leave it at the default unless it affects visibility, payments, comments, metadata or browser launch.

### Basic Information

Title:

```text
Tilebreaker
```

Project URL / slug:

```text
tilebreaker
```

Short description:

```text
Рогалик-головоломка: выкладывай плитки, замыкай печати и спасай Астральный Архив.
```

Classification:

```text
Games
```

Kind of project:

```text
HTML Game
```

Release status:

```text
Prototype
```

Pricing:

```text
No payments
```

If the form asks for donations, use `No payments` for the first jam upload unless the lead explicitly wants a donation button.

Genre:

```text
Puzzle
```

Tags, maximum 10:

```text
puzzle
strategy
roguelite
deck-building
tile-placement
turn-based
card-game
2d
singleplayer
browser
```

Language / supported language, if present:

```text
Russian
```

Made with / tools, if present:

```text
JavaScript, PixiJS, Vite
```

Input methods / controls metadata, if present:

```text
Mouse, Touchscreen
```

Platforms, if present:

```text
HTML5 browser
```

Content warnings, if present:

```text
Fantasy monsters, mild dark fantasy imagery. No gore.
```

Comments/community:

```text
Enable comments. Do not enable a full community board for the first jam upload.
```

Visibility:

```text
Private during setup. Public only after upload, page preview and jam submission checks pass.
```

### Description

Paste the text below into the itch description. Apply `Header 2` formatting to the section titles in the itch editor.

```text
Tilebreaker

Tilebreaker - короткий браузерный рогалик-головоломка про последнего хранителя Астрального Архива.

Через трещины между звездами в архив прорываются существа из пустоты. У хранителя осталось немного живого света и набор каменных плиток с руническими линиями. Выкладывай красные и синие печати на поле, совпадай краями, замыкай контуры и отсекай монстров от реальности.

Каждая битва - это выбор темпа: закрыть маленькую безопасную печать сейчас или растить большой контур, рискуя потратить сердца на новую руку.

Особенности

- 5 коротких битв в одном забеге.
- Тактическое выкладывание плиток на поле 7x7.
- Красные и синие контуры, которые нужно замыкать в печати.
- Рука из 7 плиток и один запасной слот для будущего плана.
- Кнопка "Сдать руку": новая рука стоит сердца, поэтому ждать идеальную плитку опасно.
- Золото за замкнутые печати и магазин плиток между битвами.
- Браузерная версия без установки, с управлением мышью или тачем.

Управление

- Мышь или тач: выбрать плитку в руке, затем поставить ее на свободную клетку поля.
- Плитку можно поставить рядом с другими плитками, если совпадают края, или начать новый остров на пустом месте.
- Запас: сохрани одну выбранную плитку на потом или поменяй ее с другой.
- Сдать руку: заплати показанную цену в сердцах, сбрось текущую руку и получи новую.
- Магазин: покупай доступные плитки за золото или переходи дальше.

Статус

Это jam/MVP-прототип. Полный забег уже играбелен, но баланс, визуальная чистка и доступность еще могут меняться после релиза.

Ограничения

- Текущая версия рассчитана на мышь или тач; клавиатура и геймпад не поддерживаются.
- Для игры важно различать красные и синие линии; отдельный colorblind mode пока не готов.
- Лучше всего играть в современном Chrome, Firefox или Safari.

Авторы

Дизайн, код и арт-дирекшен: Ivan Fedyanin.
Производственная поддержка: инструменты ИИ.

Контакт

Оставляйте баги и впечатления в комментариях на itch.io.
```

### Download / Launch Instructions

Use this if itch shows a launch or instructions field:

```text
Press Launch game to play in the browser. Fullscreen is recommended. No install required.
```

Russian version if the field is shown on the public page:

```text
Нажмите Launch game, чтобы играть в браузере. Лучше запускать в полноэкранном режиме. Установка не нужна.
```

### Devlog Launch Post

Optional, but useful if time remains.

Title:

```text
Tilebreaker MVP уже можно пройти в браузере
```

Body:

```text
Первый играбельный MVP Tilebreaker уже доступен: короткий рогалик-головоломка про плитки, замкнутые печати и защиту Астрального Архива.

Это jam-прототип, поэтому особенно полезны отзывы о понятности правил, темпе, выкладывании плиток и мобильной раскладке.
```

### Theme Settings

Use a restrained Astral Archive page theme that supports readability:

- Background color: `#071017`;
- Content/background panel color: `#101a22`;
- Text color: `#f3e6c8`;
- Header color: `#ffd27a`;
- Link/button color: `#e45c4f`;
- Secondary accent: `#63b6ff`;
- Layout: keep the default HTML/embed layout unless the screenshots column is explicitly enabled and checked on mobile;
- Custom CSS: do not request or use custom CSS for the first jam release.

## 3. Itch Art Brief

Art direction: Astral Archive defense. The page should read as "seal a monster breach with red and blue ward tiles", not as a generic space shooter and not as a normal card game.

Use actual final build screenshots for screenshots. Do not fake gameplay states, add unimplemented mechanics, add fake rotation controls or draw impossible tile connections.

### Required Deliverables

Store exports under:

```text
release/itch/art/
```

Keep editable source files in the artist's source folder or a clearly named `release/itch/art/source/` folder, but do not include sources in the player ZIP.

Required exports:

1. Cover image
   - Filename: `cover_630x500.png`
   - Size: `630 x 500`
   - Must also read when downscaled to `315 x 250`.
   - Composition: Tilebreaker title/logo, 7x7 ward-board hint, red/blue sealing lines, one monster breach silhouette, warm brass/stone archive mood.
   - Avoid tiny UI text. The cover is for listings, not a rules diagram.

2. Header/banner image
   - Filename: `header_1200x360.png`
   - Size: `1200 x 360`
   - Safe center area: keep the logo/title and main monster-board read inside the central `960 x 280`.
   - Purpose: itch page header image. It may replace the text title on the page.

3. Embed launch background
   - Filename: `embed_background_1280x720.png`
   - Size: `1280 x 720`
   - Purpose: background behind the play/launch button for the HTML5 viewport if the theme editor exposes that option.
   - Composition: quiet battle-board scene with clear center area for the launch button.

4. Page background
   - Filename: `page_background_1920x1080.png`
   - Size: `1920 x 1080`
   - Purpose: subtle page theme background.
   - Keep it dark, low contrast and non-noisy so the description remains readable.

5. Screenshots, 5 PNGs
   - Filenames:
     - `screenshot_01_menu.png`
     - `screenshot_02_intro.png`
     - `screenshot_03_battle_closure.png`
     - `screenshot_04_shop.png`
     - `screenshot_05_victory_or_late_battle.png`
   - Recommended size: capture desktop at `1280 x 720` or `1440 x 900`; crop only if it improves readability.
   - Required coverage: menu/title, monster intro, active battle with a readable board and hand, shop, and victory/late-run pressure.

6. Portrait/mobile proof screenshots, internal QA
   - Filenames:
     - `qa_portrait_battle_390x844.png`
     - `qa_portrait_shop_390x844.png`
   - These are not necessarily uploaded to itch, but the executor must keep them with the release evidence.

### Optional Deliverables

Do only if the required art is done:

- short trailer URL, 15-25 seconds, showing menu, first closure, hand submit, shop and one later monster;
- animated GIF, 6-10 seconds, showing a tile placement closing a contour;
- small transparent logo export, `logo_tilebreaker_transparent.png`, at least `1600 x 500`, for future press/devlog use.

### Screenshot Direction

For screenshot capture:

- use the production build;
- hide debug-only URL parameters unless a stable seed is needed for reproducible composition;
- prefer a battle state where the player can understand "placing tiles closes a seal";
- include one screenshot with the `Сдать руку` button visible and one with the shop visible;
- do not upload screenshots with visible console overlays, dev tools, browser chrome or placeholder/missing art states.

### Cover And Banner Art Notes

The artist should emphasize:

- brass/stone observatory floor;
- red solar wards and blue lunar wards;
- a monster as a breach pressing into the archive;
- a clear title/logo that still reads at small sizes;
- board-game/puzzle readability over cinematic noise.

The artist should avoid:

- fake tile exits that look like playable paths;
- green/gray mechanics as the main visual promise;
- UI text that will become wrong after balance changes;
- heavy blur over the board;
- a pure monster portrait with no tile-placement signal.

### Acceptance

The art set is accepted when:

- the cover reads clearly at `315 x 250`;
- all screenshots are from the final production build;
- the page still reads on mobile;
- no uploaded image promises missing mechanics;
- the itch page can be filled without inventing new text, fields or art requirements during upload.
