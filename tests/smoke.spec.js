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

async function getMainMenuDebug(page) {
  await expect.poll(() => page.evaluate(() => {
    const debug = window.__tilebreakerDebug?.getMainMenuDebug?.();
    return Boolean(debug?.layout?.startButton);
  })).toBe(true);

  return page.evaluate(() => window.__tilebreakerDebug.getMainMenuDebug());
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

async function placeCurrentQueueTile(page) {
  let debug = await getBattleDebug(page);

  if (debug.drawMode !== 'queue' || debug.phase !== 'placing' || !debug.hand[0] || debug.validCells.length === 0) {
    return false;
  }

  const placedBefore = debug.placedCount;
  const target = debug.validCells[0];
  const { board, cellSize } = debug.layout;
  await page.mouse.click(
    board.x + (target.x + 0.5) * cellSize,
    board.y + (target.y + 0.5) * cellSize,
  );
  await page.waitForTimeout(50);

  debug = await getBattleDebug(page);
  expect(debug.placedCount).toBe(placedBefore + 1);
  return true;
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

  const enemyDamage = debug.lastResult.enemyDamage;
  await clickRect(page, debug.layout.endRoundButton);
  await expect.poll(() => page.evaluate(() => {
    const scene = window.__tilebreakerDebug.getSceneName();
    const battle = window.__tilebreakerDebug.getBattleDebug?.();
    return scene === 'result' || battle?.phase === 'placing';
  })).toBe(true);

  return enemyDamage;
}

async function playUntilBattleResult(page) {
  let sawDamage = false;

  for (let round = 0; round < 36; round += 1) {
    const debug = await getBattleDebug(page);
    let expectedDamage = false;

    if (debug.drawMode === 'queue') {
      for (let step = 0; step < 7; step += 1) {
        const placed = await placeCurrentQueueTile(page);

        if (!placed) {
          break;
        }
      }
    } else {
      expectedDamage = await playClosureIfAvailable(page);
    }

    const enemyDamage = await finishRound(page, expectedDamage);
    sawDamage = sawDamage || enemyDamage > 0;

    const scene = await page.evaluate(() => window.__tilebreakerDebug.getSceneName());
    if (scene === 'result') {
      expect(sawDamage).toBe(true);
      return;
    }
  }

  throw new Error('Battle did not finish within 36 rounds');
}

test('player can complete the 5-battle prototype loop', async ({ page }) => {
  await page.goto('/?seed=20260508&guaranteedLoopHands=true&drawMode=hand');

  await expect(page.locator('#game')).toBeVisible();
  await expectScene(page, 'mainmenu');

  let menuDebug = await getMainMenuDebug(page);
  expect(menuDebug.selectedVariant).toBe('legacy');
  await clickRect(page, menuDebug.layout.startButton);
  await expectScene(page, 'battle');
  let run = await page.evaluate(() => window.__tilebreakerDebug.getRun());
  let battleDebug = await getBattleDebug(page);
  await expect.poll(() => page.evaluate(() => window.__tilebreakerDebug.getRunSeed())).toBe(20260508);
  expect(run.gameplayVariant).toBe('legacy');
  expect(battleDebug.gameplayVariant).toBe('legacy');
  expect(run.activeCombatColors).toEqual(['red', 'blue']);
  expect(run.deck.length).toBeGreaterThan(battleDebug.hand.filter(Boolean).length);
  expect(new Set(run.deck).size).toBeLessThan(run.deck.length);
  expect(
    run.drawPile.length
    + run.discardPile.length
    + battleDebug.hand.filter(Boolean).length
    + (battleDebug.queueReserve?.filter(Boolean).length ?? 0),
  ).toBe(run.deck.length);

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

test('player can choose the first experiment from the temporary variant picker', async ({ page }) => {
  await page.goto('/?seed=20260508');

  await expect(page.locator('#game')).toBeVisible();
  await expectScene(page, 'mainmenu');

  let menuDebug = await getMainMenuDebug(page);
  const placementButton = menuDebug.layout.variants.find((button) => (
    button.variant.id === 'placement_payoff'
  ));
  await clickRect(page, placementButton.rect);

  menuDebug = await getMainMenuDebug(page);
  expect(menuDebug.selectedVariant).toBe('placement_payoff');

  await clickRect(page, menuDebug.layout.startButton);
  await expectScene(page, 'battle');

  const variant = await page.evaluate(() => window.__tilebreakerDebug.getGameplayVariant());
  expect(variant.id).toBe('placement_payoff');

  const battleDebug = await getBattleDebug(page);
  expect(battleDebug.gameplayVariant).toBe('placement_payoff');
  expect(battleDebug.gameplayVariantLabel).toBe('A');
  expect(battleDebug.drawMode).toBe('queue');
  await expect(placeCurrentQueueTile(page)).resolves.toBe(true);
});

test('one-color chain variant is playable through the first two battles', async ({ page }) => {
  await page.goto('/?seed=20260508&variant=b');

  await expect(page.locator('#game')).toBeVisible();
  await expectScene(page, 'mainmenu');

  const menuDebug = await getMainMenuDebug(page);
  expect(menuDebug.selectedVariant).toBe('one_color_chain');
  await clickRect(page, menuDebug.layout.startButton);
  await expectScene(page, 'battle');

  let run = await page.evaluate(() => window.__tilebreakerDebug.getRun());
  let battleDebug = await getBattleDebug(page);
  expect(run.gameplayVariant).toBe('one_color_chain');
  expect(run.activeCombatColors).toEqual(['red']);
  expect(battleDebug.gameplayVariantLabel).toBe('B');
  expect(battleDebug.chainMeter).toEqual(expect.any(Number));

  for (let battle = 1; battle <= 2; battle += 1) {
    await playUntilBattleResult(page);
    await expectScene(page, 'result');

    run = await page.evaluate(() => window.__tilebreakerDebug.getRun());
    expect(run.completedBattles).toBe(battle);

    await clickCanvas(page, 0.5, 0.73);

    if (battle < 2) {
      await expectScene(page, 'upgrades');
      const upgradeDebug = await page.evaluate(() => window.__tilebreakerDebug.getUpgradeDebug());
      await clickRect(page, upgradeDebug.layout.choices[2]);
      await expectScene(page, 'battle');

      battleDebug = await getBattleDebug(page);
      expect(battleDebug.gameplayVariant).toBe('one_color_chain');
    }
  }
});

test('connect-targets variant is playable through the first two battles', async ({ page }) => {
  await page.goto('/?seed=20260508&variant=c');

  await expect(page.locator('#game')).toBeVisible();
  await expectScene(page, 'mainmenu');

  const menuDebug = await getMainMenuDebug(page);
  expect(menuDebug.selectedVariant).toBe('connect_targets');
  await clickRect(page, menuDebug.layout.startButton);
  await expectScene(page, 'battle');

  let run = await page.evaluate(() => window.__tilebreakerDebug.getRun());
  let battleDebug = await getBattleDebug(page);
  expect(run.gameplayVariant).toBe('connect_targets');
  expect(run.activeCombatColors).toEqual(['red']);
  expect(battleDebug.gameplayVariantLabel).toBe('C');
  expect(battleDebug.connectTargets).toEqual(expect.objectContaining({
    a: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
    b: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
    distance: expect.any(Number),
  }));

  for (let battle = 1; battle <= 2; battle += 1) {
    await playUntilBattleResult(page);
    await expectScene(page, 'result');

    run = await page.evaluate(() => window.__tilebreakerDebug.getRun());
    expect(run.completedBattles).toBe(battle);

    await clickCanvas(page, 0.5, 0.73);

    if (battle < 2) {
      await expectScene(page, 'upgrades');
      const upgradeDebug = await page.evaluate(() => window.__tilebreakerDebug.getUpgradeDebug());
      await clickRect(page, upgradeDebug.layout.choices[2]);
      await expectScene(page, 'battle');

      battleDebug = await getBattleDebug(page);
      expect(battleDebug.gameplayVariant).toBe('connect_targets');
      expect(battleDebug.connectTargets).not.toBeNull();
    }
  }
});
