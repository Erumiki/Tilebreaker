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

async function placeHandIndex(page, handIndex, cellX, cellY) {
  let debug = await getBattleDebug(page);
  const placedBefore = debug.placedCount;
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
  expect(debug.placedCount).toBe(placedBefore + 1);
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

async function playClosureIfAvailable(page) {
  const debug = await getBattleDebug(page);
  const indices = findClosureIndices(debug.hand);

  if (!indices) {
    return false;
  }

  await placeHandIndex(page, indices.corner_rd, 2, 2);
  await placeHandIndex(page, indices.corner_dl, 3, 2);
  await placeHandIndex(page, indices.corner_ur, 2, 3);
  await placeHandIndex(page, indices.corner_lu, 3, 3);
  return true;
}

async function finishRound(page, expectedDamage = false) {
  let debug = await getBattleDebug(page);
  const enemyHpBefore = debug.enemyHp;
  await clickRect(page, debug.layout.endRoundButton);

  await expect.poll(() => page.evaluate(() => (
    window.__tilebreakerDebug.getBattleDebug()?.phase
  ))).toBe('result');

  debug = await getBattleDebug(page);
  expect(debug.deck.discardPile).toBeGreaterThan(0);
  if (expectedDamage) {
    expect(debug.lastResult.zones).toBeGreaterThan(0);
    expect(debug.lastResult.enemyDamage).toBeGreaterThan(0);
    expect(debug.enemyHp).toBeLessThan(enemyHpBefore);
  }
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
  if (expectedDamage) {
    expect(capturedArea).toBeGreaterThan(0);
  }

  await clickRect(page, debug.layout.endRoundButton);
  await expect.poll(() => page.evaluate(() => {
    const scene = window.__tilebreakerDebug.getSceneName();
    const battle = window.__tilebreakerDebug.getBattleDebug?.();
    return scene === 'result' || battle?.phase === 'placing';
  })).toBe(true);
}

async function playUntilBattleResult(page) {
  let sawDamage = false;

  for (let round = 0; round < 36; round += 1) {
    const playedClosure = await playClosureIfAvailable(page);
    await finishRound(page, playedClosure);
    sawDamage = sawDamage || playedClosure;

    const scene = await page.evaluate(() => window.__tilebreakerDebug.getSceneName());
    if (scene === 'result') {
      expect(sawDamage).toBe(true);
      return;
    }
  }

  throw new Error('Battle did not finish within 36 rounds');
}

test('player can complete the 5-battle prototype loop', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('#game')).toBeVisible();
  await expectScene(page, 'mainmenu');

  await clickCanvas(page, 0.5, 0.63);
  await expectScene(page, 'battle');
  let run = await page.evaluate(() => window.__tilebreakerDebug.getRun());
  let battleDebug = await getBattleDebug(page);
  expect(run.deck).toHaveLength(36);
  expect(run.drawPile.length + run.discardPile.length + battleDebug.hand.filter(Boolean).length).toBe(36);

  for (let battle = 1; battle <= 5; battle += 1) {
    await playUntilBattleResult(page);

    await expectScene(page, 'result');

    run = await page.evaluate(() => window.__tilebreakerDebug.getRun());
    expect(run.completedBattles).toBe(battle);

    await clickCanvas(page, 0.5, 0.73);

    if (battle < 5) {
      await expectScene(page, 'upgrades');
      const upgradeDebug = await page.evaluate(() => window.__tilebreakerDebug.getUpgradeDebug());
      expect(upgradeDebug.upgrades.map((upgrade) => upgrade.type)).toEqual([
        'add_tile',
        'remove_tile',
        'boost_color',
      ]);
      await clickRect(page, upgradeDebug.layout.choices[2]);
      await expectScene(page, 'battle');
      const upgradedRun = await page.evaluate(() => window.__tilebreakerDebug.getRun());
      expect(upgradedRun.upgrades).toHaveLength(battle);
      expect(Object.values(upgradedRun.colorMultipliers).some((value) => value > 1)).toBe(true);
    } else {
      await expectScene(page, 'mainmenu');
    }
  }
});
