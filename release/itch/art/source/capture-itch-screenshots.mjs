import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceDir = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(sourceDir, '..');
const baseUrl = process.env.TILEBREAKER_SCREENSHOT_URL
  ?? 'http://127.0.0.1:5173/?seed=20260508&guaranteedLoopHands=true&drawMode=hand';
const diagnostics = [];

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function poll(fn, predicate = Boolean, timeoutMs = 15000, intervalMs = 50) {
  const started = Date.now();
  let last;

  while (Date.now() - started < timeoutMs) {
    last = await fn();
    if (predicate(last)) {
      return last;
    }
    await sleep(intervalMs);
  }

  throw new Error(`Timed out while polling. Last value: ${JSON.stringify(last)}`);
}

async function expectScene(page, sceneName) {
  await poll(
    () => page.evaluate(() => window.__tilebreakerDebug?.getSceneName?.()),
    (value) => value === sceneName,
  );
}

async function clickRect(page, rect) {
  await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await sleep(80);
}

async function getMenuDebug(page) {
  return poll(
    () => page.evaluate(() => window.__tilebreakerDebug?.getMainMenuDebug?.()),
    (debug) => Boolean(debug?.layout?.startButton?.width),
  );
}

async function getIntroDebug(page) {
  return poll(
    () => page.evaluate(() => window.__tilebreakerDebug?.getBattleIntroDebug?.()),
    (debug) => Boolean(debug?.layout?.primaryButton?.width),
  );
}

async function getBattleDebug(page) {
  return poll(
    () => page.evaluate(() => window.__tilebreakerDebug?.getBattleDebug?.()),
    (debug) => Boolean(debug?.layout?.board?.width),
  );
}

async function getShopDebug(page) {
  return poll(
    () => page.evaluate(() => window.__tilebreakerDebug?.getShopDebug?.()),
    (debug) => Boolean(debug?.layout?.continueButton?.width),
  );
}

async function getResultDebug(page) {
  return poll(
    () => page.evaluate(() => window.__tilebreakerDebug?.getResultDebug?.()),
    (debug) => Boolean(debug?.layout?.actionButton?.width),
  );
}

function findClosureIndices(hand) {
  for (const color of ['red', 'blue', 'green']) {
    const indices = {
      corner_rd: hand.findIndex((tile) => tile?.color === color && tile?.pattern === 'corner_rd'),
      corner_dl: hand.findIndex((tile) => tile?.color === color && tile?.pattern === 'corner_dl'),
      corner_ur: hand.findIndex((tile) => tile?.color === color && tile?.pattern === 'corner_ur'),
      corner_lu: hand.findIndex((tile) => tile?.color === color && tile?.pattern === 'corner_lu'),
    };

    if (Object.values(indices).every((index) => index >= 0)) {
      return indices;
    }
  }

  return null;
}

function isEmptyClosureBlock(board, x, y) {
  return !board[y][x]
    && !board[y][x + 1]
    && !board[y + 1][x]
    && !board[y + 1][x + 1];
}

function hasOutsideNeighbor(board, x, y) {
  for (let yy = Math.max(0, y - 1); yy <= Math.min(board.length - 1, y + 2); yy += 1) {
    for (let xx = Math.max(0, x - 1); xx <= Math.min(board[yy].length - 1, x + 2); xx += 1) {
      const insideBlock = xx >= x && xx <= x + 1 && yy >= y && yy <= y + 1;

      if (!insideBlock && board[yy][xx]) {
        return true;
      }
    }
  }

  return false;
}

function findIsolatedEmptyClosureOrigin(board) {
  for (let y = 0; y < board.length - 1; y += 1) {
    for (let x = 0; x < board[y].length - 1; x += 1) {
      if (isEmptyClosureBlock(board, x, y) && !hasOutsideNeighbor(board, x, y)) {
        return { x, y };
      }
    }
  }

  return null;
}

async function placeHandIndex(page, handIndex, cellX, cellY) {
  let debug = await getBattleDebug(page);

  if (debug?.layout?.hand?.[handIndex]) {
    await clickRect(page, debug.layout.hand[handIndex]);
  }

  debug = await getBattleDebug(page);
  const { board, cellSize } = debug.layout;
  await page.mouse.click(
    board.x + (cellX + 0.5) * cellSize,
    board.y + (cellY + 0.5) * cellSize,
  );
  await sleep(130);
}

async function playClosureIfAvailable(page) {
  const debug = await getBattleDebug(page);
  const indices = findClosureIndices(debug.hand);
  const origin = findIsolatedEmptyClosureOrigin(debug.board);

  if (!indices || !origin) {
    return false;
  }

  const placements = [
    [indices.corner_rd, origin.x, origin.y],
    [indices.corner_dl, origin.x + 1, origin.y],
    [indices.corner_ur, origin.x, origin.y + 1],
    [indices.corner_lu, origin.x + 1, origin.y + 1],
  ];

  for (const placement of placements) {
    await placeHandIndex(page, ...placement);
    const scene = await page.evaluate(() => window.__tilebreakerDebug.getSceneName());
    if (scene !== 'battle') {
      return true;
    }
  }

  return true;
}

async function placeFirstValidHandTile(page) {
  const debug = await getBattleDebug(page);

  if (debug.phase !== 'placing' || debug.validCells.length === 0) {
    return false;
  }

  const target = debug.validCells[0];
  const { board, cellSize } = debug.layout;
  await page.mouse.click(
    board.x + (target.x + 0.5) * cellSize,
    board.y + (target.y + 0.5) * cellSize,
  );
  await sleep(100);
  return true;
}

async function submitLegacyHand(page) {
  const debug = await getBattleDebug(page);
  if (!debug.submitCost?.canPay) {
    return false;
  }
  await clickRect(page, debug.layout.endRoundButton);
  await sleep(150);
  return true;
}

async function playUntilResult(page) {
  for (let turn = 0; turn < 54; turn += 1) {
    const scene = await page.evaluate(() => window.__tilebreakerDebug.getSceneName());
    if (scene === 'result') {
      return;
    }

    let debug = await getBattleDebug(page);
    if (debug.outcome) {
      await clickRect(page, debug.layout.endRoundButton);
      await expectScene(page, 'result');
      return;
    }

    const closed = await playClosureIfAvailable(page);
    debug = await getBattleDebug(page);

    if (!closed) {
      await placeFirstValidHandTile(page);
      debug = await getBattleDebug(page);
    }

    if (debug.outcome) {
      continue;
    }

    if (debug.submitCost?.canPay) {
      await submitLegacyHand(page);
    }
  }

  throw new Error('Battle did not reach result in screenshot script');
}

async function openRun(page, viewport) {
  await page.setViewportSize(viewport);
  await page.goto(baseUrl);
  await page.waitForLoadState('networkidle');
  await expectScene(page, 'mainmenu');
}

async function screenshot(page, filename) {
  await sleep(220);
  await page.screenshot({ path: resolve(outDir, filename), animations: 'disabled' });
}

function monitorPage(page, label) {
  page.on('console', (message) => {
    if (message.type() === 'error') {
      diagnostics.push(`${label} console error: ${message.text()}`);
    }
  });

  page.on('pageerror', (error) => {
    diagnostics.push(`${label} page error: ${error.message}`);
  });

  page.on('requestfailed', (request) => {
    diagnostics.push(`${label} request failed: ${request.url()} ${request.failure()?.errorText ?? ''}`);
  });

  page.on('response', (response) => {
    if (response.status() >= 400) {
      diagnostics.push(`${label} HTTP ${response.status()}: ${response.url()}`);
    }
  });
}

const browser = await chromium.launch();

const desktop = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
monitorPage(desktop, 'desktop');
await openRun(desktop, { width: 1280, height: 720 });
await screenshot(desktop, 'screenshot_01_menu.png');

let menuDebug = await getMenuDebug(desktop);
await clickRect(desktop, menuDebug.layout.startButton);
await expectScene(desktop, 'battleIntro');
await screenshot(desktop, 'screenshot_02_intro.png');

let introDebug = await getIntroDebug(desktop);
await clickRect(desktop, introDebug.buttonRect);
await expectScene(desktop, 'battle');
await playClosureIfAvailable(desktop);
await screenshot(desktop, 'screenshot_03_battle_closure.png');

await playUntilResult(desktop);
await screenshot(desktop, 'screenshot_05_victory_or_late_battle.png');

const resultDebug = await getResultDebug(desktop);
await clickRect(desktop, resultDebug.layout.actionButton);
await expectScene(desktop, 'shop');
await getShopDebug(desktop);
await screenshot(desktop, 'screenshot_04_shop.png');

const portraitBattle = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
monitorPage(portraitBattle, 'portrait-battle');
await openRun(portraitBattle, { width: 390, height: 844 });
menuDebug = await getMenuDebug(portraitBattle);
await clickRect(portraitBattle, menuDebug.layout.startButton);
introDebug = await getIntroDebug(portraitBattle);
await screenshot(portraitBattle, 'qa_portrait_intro_390x844.png');
await clickRect(portraitBattle, introDebug.buttonRect);
await expectScene(portraitBattle, 'battle');
await screenshot(portraitBattle, 'qa_portrait_battle_390x844.png');

const portraitShop = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
monitorPage(portraitShop, 'portrait-shop');
await openRun(portraitShop, { width: 390, height: 844 });
menuDebug = await getMenuDebug(portraitShop);
await clickRect(portraitShop, menuDebug.layout.startButton);
introDebug = await getIntroDebug(portraitShop);
await clickRect(portraitShop, introDebug.buttonRect);
await expectScene(portraitShop, 'battle');
await playUntilResult(portraitShop);
await screenshot(portraitShop, 'qa_portrait_result_390x844.png');
const portraitResult = await getResultDebug(portraitShop);
await clickRect(portraitShop, portraitResult.layout.actionButton);
await expectScene(portraitShop, 'shop');
await getShopDebug(portraitShop);
await screenshot(portraitShop, 'qa_portrait_shop_390x844.png');

await browser.close();

if (diagnostics.length > 0) {
  throw new Error(`Screenshot capture found production diagnostics:\n${diagnostics.join('\n')}`);
}
