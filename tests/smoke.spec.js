import { expect, test } from '@playwright/test';

async function clickCanvas(page, xRatio, yRatio) {
  const canvas = page.locator('#game');
  const box = await canvas.boundingBox();

  if (!box) {
    throw new Error('Game canvas is not visible');
  }

  await page.mouse.click(
    box.x + box.width * xRatio,
    box.y + box.height * yRatio,
  );
}

async function clickRect(page, rect) {
  await page.mouse.click(
    rect.x + rect.width / 2,
    rect.y + rect.height / 2,
  );
}

async function expectScene(page, name) {
  await expect.poll(() => page.evaluate(() => (
    window.__tilebreakerDebug?.getSceneName?.()
  ))).toBe(name);
}

async function getBattleDebug(page) {
  await expect.poll(() => page.evaluate(() => {
    const debug = window.__tilebreakerDebug?.getBattleDebug?.();
    return Boolean(debug?.layout);
  })).toBe(true);

  return page.evaluate(() => window.__tilebreakerDebug.getBattleDebug());
}

async function placePattern(page, pattern, cellX, cellY) {
  let debug = await getBattleDebug(page);
  const placedBefore = debug.placedCount;
  const handIndex = debug.hand.findIndex((tile) => tile?.pattern === pattern);
  expect(handIndex).toBeGreaterThanOrEqual(0);
  await clickRect(page, debug.layout.hand[handIndex]);
  await page.waitForTimeout(50);

  debug = await getBattleDebug(page);
  const { board, cellSize } = debug.layout;
  await page.mouse.click(
    board.x + (cellX + 0.5) * cellSize,
    board.y + (cellY + 0.5) * cellSize,
  );
  await page.waitForTimeout(50);

  debug = await getBattleDebug(page);
  expect(
    debug.placedCount,
    `${pattern} should be placed on ${cellX},${cellY}: ${JSON.stringify(debug.board)}`,
  ).toBe(placedBefore + 1);
}

async function playClosureRound(page) {
  await placePattern(page, 'corner_rd', 2, 2);
  await placePattern(page, 'corner_dl', 3, 2);
  await placePattern(page, 'corner_ur', 2, 3);
  await placePattern(page, 'corner_lu', 3, 3);

  let debug = await getBattleDebug(page);
  const enemyHpBefore = debug.enemyHp;
  expect(debug.placedCount).toBe(4);
  await clickRect(page, debug.layout.endRoundButton);

  await expect.poll(() => page.evaluate(() => (
    window.__tilebreakerDebug.getBattleDebug()?.phase
  ))).toBe('result');

  debug = await getBattleDebug(page);
  expect(debug.lastResult.zones).toBeGreaterThan(0);
  expect(debug.lastResult.enemyDamage).toBeGreaterThan(0);
  expect(debug.enemyHp).toBeLessThan(enemyHpBefore);
  for (const color of ['red', 'blue', 'green']) {
    expect(debug.lastResult.byColor[color]).toEqual(expect.objectContaining({
      threat: expect.any(Number),
      closedDamage: expect.any(Number),
      enemyDamage: expect.any(Number),
      playerDamage: expect.any(Number),
    }));
    expect(debug.lastResult.areaByColor[color]).toEqual(expect.any(Number));
  }
  const capturedArea = ['red', 'blue', 'green'].reduce((sum, color) => (
    sum + debug.lastResult.areaByColor[color]
  ), 0);
  expect(capturedArea).toBeGreaterThan(0);

  await clickRect(page, debug.layout.endRoundButton);
  await expect.poll(() => page.evaluate(() => {
    const scene = window.__tilebreakerDebug.getSceneName();
    const battle = window.__tilebreakerDebug.getBattleDebug?.();
    return scene === 'result' || battle?.phase === 'placing';
  })).toBe(true);
}

test('player can complete the 5-battle prototype loop', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('#game')).toBeVisible();
  await expectScene(page, 'mainmenu');

  await clickCanvas(page, 0.5, 0.63);
  await expectScene(page, 'battle');

  for (let battle = 1; battle <= 5; battle += 1) {
    for (let round = 0; round < 5; round += 1) {
      await playClosureRound(page);

      const scene = await page.evaluate(() => window.__tilebreakerDebug.getSceneName());
      if (scene === 'result') {
        break;
      }
    }

    await expectScene(page, 'result');

    const run = await page.evaluate(() => window.__tilebreakerDebug.getRun());
    expect(run.completedBattles).toBe(battle);

    await clickCanvas(page, 0.5, 0.73);

    if (battle < 5) {
      await expectScene(page, 'upgrades');
      await clickCanvas(page, 0.26, 0.59);
      await expectScene(page, 'battle');
    } else {
      await expectScene(page, 'mainmenu');
    }
  }
});
