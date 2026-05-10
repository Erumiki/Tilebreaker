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
  await expect.poll(async () => {
    try {
      return await page.evaluate(() => {
        const debug = window.__tilebreakerDebug?.getBattleDebug?.();
        return Boolean(debug?.layout);
      });
    } catch {
      return false;
    }
  }).toBe(true);

  return page.evaluate(() => window.__tilebreakerDebug.getBattleDebug());
}

async function getBattleDebugIfActive(page) {
  return page.evaluate(() => (
    window.__tilebreakerDebug?.getSceneName?.() === 'battle'
      ? window.__tilebreakerDebug.getBattleDebug()
      : null
  ));
}

async function getBattleIntroDebug(page) {
  await expect.poll(async () => {
    try {
      return await page.evaluate(() => {
        const debug = window.__tilebreakerDebug?.getBattleIntroDebug?.();
        return Boolean(debug?.layout?.primaryButton?.width);
      });
    } catch {
      return false;
    }
  }).toBe(true);

  return page.evaluate(() => window.__tilebreakerDebug.getBattleIntroDebug());
}

async function getShopDebug(page) {
  await expect.poll(async () => {
    try {
      return await page.evaluate(() => {
        const debug = window.__tilebreakerDebug?.getShopDebug?.();
        return Boolean(debug?.layout?.continueButton?.width && debug?.offers?.length);
      });
    } catch {
      return false;
    }
  }).toBe(true);

  return page.evaluate(() => window.__tilebreakerDebug.getShopDebug());
}

async function getResultDebug(page) {
  await expect.poll(async () => {
    try {
      return await page.evaluate(() => {
        const debug = window.__tilebreakerDebug?.getResultDebug?.();
        return Boolean(debug?.layout?.actionButton?.width);
      });
    } catch {
      return false;
    }
  }).toBe(true);

  return page.evaluate(() => window.__tilebreakerDebug.getResultDebug());
}

async function getMainMenuDebug(page) {
  await expect.poll(async () => {
    try {
      return await page.evaluate(() => {
        const debug = window.__tilebreakerDebug?.getMainMenuDebug?.();
        return Boolean(debug?.layout?.startButton?.width);
      });
    } catch {
      return false;
    }
  }).toBe(true);

  return page.evaluate(() => window.__tilebreakerDebug.getMainMenuDebug());
}

async function expectNoMissingArt(page) {
  await expect.poll(() => page.evaluate(() => (
    Boolean(window.__tilebreakerDebug?.getArtDebug)
  ))).toBe(true);

  const artDebug = await page.evaluate(() => window.__tilebreakerDebug.getArtDebug());

  expect(artDebug.missingAssetIds).toEqual([]);
  expect(artDebug.loadedCount).toBe(artDebug.manifestAssetCount);
  expect(artDebug.loadedCount).toBeGreaterThan(0);
}

function expectRectInsideViewport(rect, viewport, label) {
  expect(rect.x, `${label}.x`).toBeGreaterThanOrEqual(0);
  expect(rect.y, `${label}.y`).toBeGreaterThanOrEqual(0);
  expect(rect.x + rect.width, `${label}.right`).toBeLessThanOrEqual(viewport.width);
  expect(rect.y + rect.height, `${label}.bottom`).toBeLessThanOrEqual(viewport.height);
}

function expectBattleIntroFits(debug) {
  expect(debug.layout.viewport.overflows).toBe(false);
  expect(debug.layout.minTouchTarget).toBeGreaterThanOrEqual(44);
  expect(debug.monsterPreview).toEqual(expect.objectContaining({
    id: expect.any(String),
    name: expect.any(String),
    enemyHp: expect.any(Number),
  }));
  expect(debug.monsterPreview.assetIds).toEqual(expect.objectContaining({
    background: 'screen_background_battle_intro',
    backdrop: expect.stringMatching(/^level_backdrop_battle_/),
    portrait: expect.stringMatching(/^monster_portrait_battle_/),
    icon: expect.stringMatching(/^monster_icon_battle_/),
  }));
  expect(debug.artImageIds).toEqual(expect.arrayContaining([
    debug.monsterPreview.assetIds.background,
    debug.monsterPreview.assetIds.backdrop,
    debug.monsterPreview.assetIds.portrait,
    debug.monsterPreview.assetIds.icon,
  ]));
  expect(debug.danger).toEqual(expect.objectContaining({
    ante: expect.any(Number),
    label: expect.any(String),
  }));
  expect(debug.rewardPreview).toEqual(expect.any(String));
  expect(debug.player).toEqual(expect.objectContaining({
    hearts: expect.any(Number),
    gold: expect.any(Number),
  }));

  const viewport = debug.layout.viewport.screen;
  [
    ['hud', debug.layout.hud],
    ['portrait', debug.layout.portrait],
    ['icon', debug.layout.icon],
    ['details', debug.layout.details],
    ['primaryButton', debug.layout.primaryButton],
  ].forEach(([label, rect]) => expectRectInsideViewport(rect, viewport, `intro.${label}`));
}

function rectsOverlap(a, b) {
  return !(
    a.x + a.width <= b.x
    || b.x + b.width <= a.x
    || a.y + a.height <= b.y
    || b.y + b.height <= a.y
  );
}

function expectShopFits(debug, expectedMode = null) {
  if (expectedMode) {
    expect(debug.layout.mode).toBe(expectedMode);
  }

  expect(debug.layout.viewport.overflows).toBe(false);
  expect(debug.layout.viewport.overlapsContinue).toBe(false);
  expect(debug.layout.minTouchTarget).toBeGreaterThanOrEqual(44);

  const viewport = debug.layout.viewport.screen;
  debug.layout.offers.forEach((rect, index) => {
    expectRectInsideViewport(rect, viewport, `shop.offer.${index}`);
    expect(rectsOverlap(rect, debug.layout.continueButton), `shop.offer.${index} overlaps continue`).toBe(false);
  });
  expectRectInsideViewport(debug.layout.continueButton, viewport, 'shop.continueButton');
}

function expectResultFits(debug) {
  expect(debug.layout.viewport.overflows).toBe(false);
  expect(debug.layout.viewport.overlaps).toBe(false);

  const viewport = debug.layout.viewport.screen;
  expectRectInsideViewport(debug.layout.panel, viewport, 'result.panel');
  expectRectInsideViewport(debug.layout.actionButton, viewport, 'result.actionButton');
}

async function enterBattleFromIntro(page) {
  await expectScene(page, 'battleIntro');
  const introDebug = await getBattleIntroDebug(page);
  expectBattleIntroFits(introDebug);
  await clickRect(page, introDebug.buttonRect);
  await expectScene(page, 'battle');
  return introDebug;
}

async function continueFromResult(page) {
  await expectScene(page, 'result');
  const resultDebug = await getResultDebug(page);
  expectResultFits(resultDebug);
  await clickRect(page, resultDebug.layout.actionButton);
  return resultDebug;
}

async function buyAffordableShopOffers(page, maxBuys) {
  let bought = 0;

  for (let attempt = 0; attempt < maxBuys; attempt += 1) {
    let debug = await getShopDebug(page);
    const index = debug.offers.findIndex((offer) => offer.affordable && !offer.bought);

    if (index < 0) {
      break;
    }

    const offer = debug.offers[index];
    const goldBefore = debug.shop.goldAfter;
    const deckBefore = debug.deck.deck;
    await clickRect(page, debug.layout.offers[index]);
    await expect.poll(() => page.evaluate((offerId) => {
      const shop = window.__tilebreakerDebug.getShopDebug();
      return shop.offers.find((candidate) => candidate.offerId === offerId)?.bought;
    }, offer.offerId)).toBe(true);

    debug = await getShopDebug(page);
    expect(debug.shop.goldAfter).toBe(goldBefore - offer.cost);
    expect(debug.deck.deck).toBe(deckBefore + 1);
    expect(debug.feedback).toContain('Куплено:');
    expect(debug.uiState.boughtCount).toBeGreaterThanOrEqual(1);
    expect(debug.boughtCards.at(-1)).toEqual(expect.objectContaining({
      cardId: offer.cardId,
      cost: offer.cost,
      balanceStatus: offer.balanceStatus,
    }));
    bought += 1;
  }

  return bought;
}

async function continueFromShop(page, { maxBuys = 0 } = {}) {
  await expectScene(page, 'shop');
  let shopDebug = await getShopDebug(page);

  expect(shopDebug.offers).toHaveLength(5);
  expect(shopDebug.shop.balanceStatus).toBe('mvp_balance_synced');
  expect(shopDebug.layout.viewport.overflows).toBe(false);
  expect(shopDebug.layout.viewport.overlapsContinue).toBe(false);
  expect(shopDebug.offers.every((offer) => offer.type === 'shop_card')).toBe(true);
  expect(shopDebug.offers.every((offer) => offer.balanceStatus.startsWith('mvp_keep'))).toBe(true);
  expect(shopDebug.offers.some((offer) => ['card_joker_line_v', 'card_double_line'].includes(offer.cardId))).toBe(false);
  expect(shopDebug.offers.every((offer) => offer.cardId.startsWith('card_'))).toBe(true);
  expect(shopDebug.offers.some((offer) => ['add_tile', 'remove_tile', 'boost_color'].includes(offer.type))).toBe(false);
  expect(shopDebug.feedback).toEqual(expect.any(String));
  expect(shopDebug.uiState).toEqual(expect.objectContaining({
    canContinue: true,
    boughtCount: expect.any(Number),
    unaffordableCount: expect.any(Number),
  }));

  if (maxBuys > 0) {
    await buyAffordableShopOffers(page, maxBuys);
    shopDebug = await getShopDebug(page);
  }

  await clickRect(page, shopDebug.layout.continueButton);
  await expectScene(page, 'battleIntro');
  return getBattleIntroDebug(page);
}

async function placeHandIndex(page, handIndex, cellX, cellY) {
  let debug = await getBattleDebugIfActive(page);
  if (!debug?.layout) {
    return false;
  }

  const placedBefore = debug.placedCount;
  await clickRect(page, debug.layout.hand[handIndex]);
  await page.waitForTimeout(50);

  debug = await getBattleDebugIfActive(page);
  if (!debug?.layout) {
    return true;
  }

  const { board, cellSize } = debug.layout;
  await page.mouse.click(
    board.x + (cellX + 0.5) * cellSize,
    board.y + (cellY + 0.5) * cellSize,
  );
  await page.waitForTimeout(50);

  const sceneAfter = await page.evaluate(() => window.__tilebreakerDebug.getSceneName());
  if (sceneAfter !== 'battle') {
    return true;
  }

  debug = await getBattleDebug(page);
  if (debug.lastResult?.lastClosureImmediate) {
    expect(debug.lastResult.closedZones).toBeGreaterThan(0);
  } else {
    expect(debug.placedCount).toBe(placedBefore + 1);
  }

  return true;
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
  if (debug.lastResult?.lastClosureImmediate) {
    expect(debug.lastResult.closedZones).toBeGreaterThan(0);
  } else {
    expect(debug.placedCount).toBe(placedBefore + 1);
  }
  return true;
}

async function placeFirstValidHandTile(page) {
  let debug = await getBattleDebug(page);

  if (debug.drawMode === 'queue') {
    return placeCurrentQueueTile(page);
  }

  if (debug.phase !== 'placing' || debug.validCells.length === 0) {
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
  if (debug.lastResult?.lastClosureImmediate) {
    expect(debug.lastResult.closedZones).toBeGreaterThan(0);
  } else {
    expect(debug.placedCount).toBe(placedBefore + 1);
  }
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

  const origin = findIsolatedEmptyClosureOrigin(debug.board);

  if (!origin) {
    return false;
  }

  for (const placement of [
    [indices.corner_rd, origin.x, origin.y],
    [indices.corner_dl, origin.x + 1, origin.y],
    [indices.corner_ur, origin.x, origin.y + 1],
    [indices.corner_lu, origin.x + 1, origin.y + 1],
  ]) {
    const placed = await placeHandIndex(page, ...placement);

    if (!placed) {
      break;
    }

    const scene = await page.evaluate(() => window.__tilebreakerDebug.getSceneName());
    if (scene !== 'battle') {
      break;
    }
  }

  return true;
}

function findIsolatedEmptyClosureOrigin(board) {
  for (let y = 0; y < board.length - 1; y += 1) {
    for (let x = 0; x < board[y].length - 1; x += 1) {
      if (!isEmptyClosureBlock(board, x, y) || hasOutsideNeighbor(board, x, y)) {
        continue;
      }

      return { x, y };
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
  if (!debug.outcome) {
    expect(debug.lastResult.newPickDamage).toEqual(expect.objectContaining({
      totalDamage: expect.any(Number),
      unplayedTiles: expect.any(Number),
    }));
  }
  await clickRect(page, debug.layout.endRoundButton);
  await expect.poll(() => page.evaluate(() => {
    const scene = window.__tilebreakerDebug.getSceneName();
    const battle = window.__tilebreakerDebug.getBattleDebug?.();
    return scene === 'result' || battle?.phase === 'placing';
  })).toBe(true);

  return enemyDamage;
}

async function submitLegacyHand(page) {
  const before = await getBattleDebug(page);

  expect(before.gameplayVariant).toBe('legacy');
  expect(before.phase).toBe('placing');
  expect(before.outcome).toBeFalsy();
  expect(before.submitCost).toEqual(expect.objectContaining({
    totalDamage: expect.any(Number),
    unplayedHandCards: expect.any(Number),
    handSubmitsThisBattle: expect.any(Number),
    canPay: true,
  }));

  await clickRect(page, before.layout.endRoundButton);
  await expect.poll(() => page.evaluate((submitCount) => (
    window.__tilebreakerDebug.getBattleDebug()?.handSubmitsThisBattle
  ), before.handSubmitsThisBattle)).toBe(before.handSubmitsThisBattle + 1);

  const after = await getBattleDebug(page);
  expect(after.phase).toBe('placing');
  expect(after.playerHp).toBe(before.playerHp - before.submitCost.totalDamage);
  expect(after.lastSubmitResult).toEqual(expect.objectContaining({
    submitted: true,
    totalDamage: before.submitCost.totalDamage,
    playerHeartsBefore: before.playerHp,
    playerHeartsAfter: after.playerHp,
  }));
  expect(after.strikeCount).toBe(0);
  expect(after.strikeWindowOpen).toBe(false);
  expect(after.battleLog.some((entry) => entry.startsWith('Hand submitted'))).toBe(true);
  expect(after.feedback).toContain('Рука сдана');
  expect(after.eventBadges.map((badge) => badge.id)).toContain('submit');
}

async function playLegacyUntilBattleResult(page) {
  let sawDamage = false;
  let sawSubmit = false;

  for (let turn = 0; turn < 48; turn += 1) {
    const sceneBeforeTurn = await page.evaluate(() => window.__tilebreakerDebug.getSceneName());
    if (sceneBeforeTurn === 'result') {
      expect(sawDamage).toBe(true);
      return { sawDamage, sawSubmit };
    }

    let debug = await getBattleDebug(page);

    if (debug.outcome) {
      expect(sawDamage).toBe(true);
      await clickRect(page, debug.layout.endRoundButton);
      await expectScene(page, 'result');
      return { sawDamage, sawSubmit };
    }

    const playedClosure = await playClosureIfAvailable(page);

    debug = await getBattleDebug(page);
    if (playedClosure) {
      expect(debug.lastResult).toEqual(expect.objectContaining({
        lastClosureImmediate: true,
        enemyDamage: expect.any(Number),
        playerDamage: 0,
        goldEarned: expect.any(Number),
        fieldGold: expect.any(Number),
        heartHeal: expect.any(Number),
        closureResources: expect.any(Object),
      }));
      expect(debug.lastResult.enemyDamage).toBeGreaterThan(0);
      expect(debug.lastResult.goldEarned).toBeGreaterThan(0);
      expect(debug.gold).toBe(debug.lastResult.goldAfter);
      expect(debug.feedback).toContain('Печать закрыта');
      expect(debug.eventBadges.map((badge) => badge.id)).toEqual(expect.arrayContaining(['monster', 'gold']));
      sawDamage = true;

      if (debug.outcome) {
        continue;
      }
    } else {
      await placeFirstValidHandTile(page);
      const sceneAfterPlacement = await page.evaluate(() => window.__tilebreakerDebug.getSceneName());
      if (sceneAfterPlacement === 'result') {
        expect(sawDamage).toBe(true);
        return { sawDamage, sawSubmit };
      }
      debug = await getBattleDebug(page);

      if (debug.outcome) {
        continue;
      }
    }

    const sceneBeforeSubmit = await page.evaluate(() => window.__tilebreakerDebug.getSceneName());
    if (sceneBeforeSubmit === 'result') {
      expect(sawDamage).toBe(true);
      return { sawDamage, sawSubmit };
    }

    debug = await getBattleDebug(page);
    if (debug.submitCost?.canPay === false) {
      const placed = await placeFirstValidHandTile(page);
      if (!placed) {
        throw new Error('Last-chance hand had no payable submit and no valid placement');
      }
      continue;
    }

    await submitLegacyHand(page);
    sawSubmit = true;
  }

  throw new Error('Legacy battle did not finish within 48 turns');
}

async function playUntilBattleResult(page) {
  let sawDamage = false;

  for (let round = 0; round < 36; round += 1) {
    const debug = await getBattleDebug(page);

    if (debug.gameplayVariant === 'legacy') {
      return playLegacyUntilBattleResult(page);
    }

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
  test.setTimeout(120_000);

  await page.goto('/?seed=20260508&guaranteedLoopHands=true&drawMode=hand');

  await expect(page.locator('#game')).toBeVisible();
  await expectNoMissingArt(page);
  await expectScene(page, 'mainmenu');

  let menuDebug = await getMainMenuDebug(page);
  expect(menuDebug.selectedVariant).toBe('legacy');
  expect(menuDebug.variants).toEqual([]);
  expect(menuDebug.layout.variants).toEqual([]);
  await clickRect(page, menuDebug.layout.startButton);
  let introDebug = await enterBattleFromIntro(page);
  expect(introDebug.battleNumber).toBe(1);
  expect(introDebug.monsterPreview.name).toBe('Теневая пиявка');
  expect(introDebug.monsterPreview.battleName).toBe('Первый раунд');
  let run = await page.evaluate(() => window.__tilebreakerDebug.getRun());
  let battleDebug = await getBattleDebug(page);
  await expect.poll(() => page.evaluate(() => window.__tilebreakerDebug.getRunSeed())).toBe(20260508);
  expect(run.gameplayVariant).toBe('legacy');
  expect(battleDebug.gameplayVariant).toBe('legacy');
  expect(run.gold).toBe(0);
  expect(battleDebug.gold).toBe(0);
  expect(battleDebug.maxPlayerHp).toBe(18);
  expect(battleDebug.activeBoardResources.map((resource) => resource.type).sort()).toEqual([
    'gold',
    'gold',
    'gold',
    'heart',
  ]);
  expect(battleDebug.activeBoardResources.every((resource) => !battleDebug.board[resource.y][resource.x])).toBe(true);
  expect(battleDebug.submitCost).toEqual(expect.objectContaining({
    totalDamage: 2,
    unplayedHandCards: 7,
    handSubmitsThisBattle: 0,
    canPay: true,
  }));
  expect(run.activeCombatColors).toEqual(['red', 'blue']);
  expect(battleDebug.visibleCombatColors).toEqual(['red', 'blue']);
  expect(battleDebug.enemyHp).toBe(3);
  expect(battleDebug.board).toHaveLength(7);
  expect(battleDebug.board.every((row) => row.length === 7)).toBe(true);
  expect(battleDebug.layout.cellSize).toBeCloseTo(battleDebug.layout.board.width / 7);
  expect(battleDebug.placedCount).toBe(1);
  expect(battleDebug.board[3][3]).toEqual(expect.objectContaining({
    id: 'starter_universal_line_v',
    color: 'universal',
    pattern: 'universal_line_v',
  }));
  expect(battleDebug.tileImageIds).toContain('starter_universal_line_v');
  expect(battleDebug.battleArtIds).toEqual(expect.objectContaining({
    background: 'screen_background_battle',
    monsterIcon: 'monster_icon_battle_01',
    heart: 'icon_heart_full',
    gold: 'icon_gold',
    fieldGold: 'icon_gold',
    fieldHeart: 'icon_heart_full',
    hold: 'icon_hold',
    submit: 'icon_submit',
  }));
  expect(battleDebug.battleArtIds.boardCells).toEqual({
    empty: 'board_cell_empty',
    hover: 'board_cell_hover',
    valid: 'board_cell_valid',
    invalid: 'board_cell_invalid',
    scored: 'board_cell_scored',
  });
  expect(battleDebug.battleArtIds.placementHints).toEqual({
    valid: 'overlay_valid_cell',
    invalid: 'overlay_invalid_cell',
    hoverTile: 'overlay_hover_tile',
  });
  expect(battleDebug.artImageIds).toEqual(expect.arrayContaining([
    'board_cell_empty',
    'board_cell_hover',
    'board_cell_valid',
    'board_cell_invalid',
    'board_cell_scored',
    'overlay_valid_cell',
    'overlay_invalid_cell',
    'monster_icon_battle_01',
    'monster_icon_battle_02',
    'monster_icon_battle_03',
    'monster_icon_battle_04',
    'monster_icon_battle_05',
    'icon_heart_full',
    'icon_gold',
    'icon_hold',
    'icon_submit',
  ]));
  expect(run.deck.length).toBeGreaterThan(battleDebug.hand.filter(Boolean).length);
  expect(new Set(run.deck).size).toBeLessThan(run.deck.length);
  expect(
    run.drawPile.length
    + run.discardPile.length
    + battleDebug.hand.filter(Boolean).length
    + (battleDebug.heldTile ? 1 : 0)
    + (battleDebug.queueReserve?.filter(Boolean).length ?? 0),
  ).toBe(run.deck.length);

  await page.mouse.click(
    battleDebug.layout.board.x + (3 + 0.5) * battleDebug.layout.cellSize,
    battleDebug.layout.board.y + (3 + 0.5) * battleDebug.layout.cellSize,
  );
  battleDebug = await getBattleDebug(page);
  expect(battleDebug.lastInvalidPlacement).toEqual(expect.objectContaining({
    code: 'occupied_cell',
    x: 3,
    y: 3,
  }));
  expect(battleDebug.feedback).toContain('клетка уже занята');

  for (let battle = 1; battle <= 5; battle += 1) {
    await playUntilBattleResult(page);

    await expectScene(page, 'result');

    run = await page.evaluate(() => window.__tilebreakerDebug.getRun());
    expect(run.completedBattles).toBe(battle);
    expect(run.bountiesClaimed).toHaveLength(battle);
    expect(run.gold).toBeGreaterThanOrEqual(battle);

    await continueFromResult(page);

    if (battle < 5) {
      const maxBuys = 0;
      const boughtBefore = run.purchasedCards?.length ?? 0;
      const shopIntroDebug = await continueFromShop(page, { maxBuys });
      expect(shopIntroDebug.battleNumber).toBe(battle + 1);
      if (maxBuys > 0) {
        const shoppedRun = await page.evaluate(() => window.__tilebreakerDebug.getRun());
        expect((shoppedRun.purchasedCards?.length ?? 0) - boughtBefore).toBeGreaterThanOrEqual(1);
        expect(shoppedRun.shopHistory).toHaveLength(battle);
      }
      introDebug = await enterBattleFromIntro(page);
      expect(introDebug.battleNumber).toBe(battle + 1);
      const upgradedRun = await page.evaluate(() => window.__tilebreakerDebug.getRun());
      expect(upgradedRun.shopHistory).toHaveLength(battle);
      expect(upgradedRun.upgrades).toHaveLength(0);
    } else {
      await expectScene(page, 'mainmenu');
    }
  }
});

test('shop sells an affordable card and continues to the next monster intro', async ({ page }) => {
  test.setTimeout(60_000);

  await page.goto('/?seed=20260508&guaranteedLoopHands=true&drawMode=hand');

  await expect(page.locator('#game')).toBeVisible();
  await expectScene(page, 'mainmenu');

  const menuDebug = await getMainMenuDebug(page);
  expect(menuDebug.layout.variants).toEqual([]);
  await clickRect(page, menuDebug.layout.startButton);
  await enterBattleFromIntro(page);
  await playUntilBattleResult(page);
  await expectScene(page, 'result');
  await continueFromResult(page);

  const introDebug = await continueFromShop(page, { maxBuys: 1 });
  expect(introDebug.battleNumber).toBe(2);

  const run = await page.evaluate(() => window.__tilebreakerDebug.getRun());
  expect(run.purchasedCards).toHaveLength(1);
  expect(run.shopHistory).toHaveLength(1);
  expect(run.shopHistory[0].boughtCards).toHaveLength(1);
  expect(run.deck).toContain(run.purchasedCards[0].tileId);
  expect(run.discardPile).toContain(run.purchasedCards[0].tileId);
});

test('player can hold and swap one hand card', async ({ page }) => {
  await page.goto('/?seed=20260508&guaranteedLoopHands=true&drawMode=hand');

  await expect(page.locator('#game')).toBeVisible();
  await expectScene(page, 'mainmenu');

  const menuDebug = await getMainMenuDebug(page);
  expect(menuDebug.layout.variants).toEqual([]);
  await clickRect(page, menuDebug.layout.startButton);
  await enterBattleFromIntro(page);

  let run = await page.evaluate(() => window.__tilebreakerDebug.getRun());
  let battleDebug = await getBattleDebug(page);
  const firstTile = battleDebug.hand[0];

  expect(battleDebug.layout.hold).not.toBeNull();
  expect(battleDebug.heldTile).toBeNull();

  await clickRect(page, battleDebug.layout.hold);
  await page.waitForTimeout(50);
  battleDebug = await getBattleDebug(page);

  expect(battleDebug.heldTile).toEqual(firstTile);
  expect(battleDebug.hand[0]).toBeNull();
  expect(battleDebug.selectedHandIndex).toBe(1);
  expect(
    run.drawPile.length
    + run.discardPile.length
    + battleDebug.hand.filter(Boolean).length
    + (battleDebug.heldTile ? 1 : 0),
  ).toBe(run.deck.length);

  const swapIndex = battleDebug.selectedHandIndex;
  const swapTile = battleDebug.hand[swapIndex];
  await clickRect(page, battleDebug.layout.hold);
  await page.waitForTimeout(50);
  battleDebug = await getBattleDebug(page);
  run = await page.evaluate(() => window.__tilebreakerDebug.getRun());

  expect(battleDebug.heldTile).toEqual(swapTile);
  expect(battleDebug.hand[swapIndex]).toEqual(firstTile);
  expect(battleDebug.selectedHandIndex).toBe(swapIndex);
  expect(
    run.drawPile.length
    + run.discardPile.length
    + battleDebug.hand.filter(Boolean).length
    + (battleDebug.heldTile ? 1 : 0),
  ).toBe(run.deck.length);
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 360, height: 740 },
  { width: 430, height: 932 },
]) {
  test(`portrait battle layout fits ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/?seed=20260508&guaranteedLoopHands=true&drawMode=hand');

    await expect(page.locator('#game')).toBeVisible();
    await expectScene(page, 'mainmenu');

    const menuDebug = await getMainMenuDebug(page);
    expect(menuDebug.layout.variants).toEqual([]);
    await clickRect(page, menuDebug.layout.startButton);
    const introDebug = await enterBattleFromIntro(page);
    expect(introDebug.layout.mode).toBe('portrait');

    let battleDebug = await getBattleDebug(page);

    expect(battleDebug.layout.mode).toBe('portrait');
    expect(battleDebug.layout.viewport.overflows).toBe(false);
    expect(battleDebug.layout.minTouchTarget).toBeGreaterThanOrEqual(44);
    expect(battleDebug.layout.hand).toHaveLength(7);
    expect(battleDebug.layout.hold).not.toBeNull();
    expect(battleDebug.uiState.primary).toEqual(expect.any(String));
    expect(battleDebug.uiState.hold).toBe('holdEmpty');

    [
      ['hud', battleDebug.layout.hud],
      ['monsterBanner', battleDebug.layout.monsterBanner],
      ['board', battleDebug.layout.board],
      ['feedback', battleDebug.layout.feedback],
      ['log', battleDebug.layout.log],
      ['hold', battleDebug.layout.hold],
      ['primaryButton', battleDebug.layout.primaryButton],
      ...battleDebug.layout.hand.map((rect, index) => [`hand.${index}`, rect]),
    ].forEach(([label, rect]) => expectRectInsideViewport(rect, viewport, label));

    await clickRect(page, battleDebug.layout.hold);
    await page.waitForTimeout(50);

    battleDebug = await getBattleDebug(page);
    expect(battleDebug.heldTile).not.toBeNull();
    expect(battleDebug.uiState.hold).toBe('holdFilled');

    await clickRect(page, battleDebug.layout.primaryButton);
    await expect.poll(() => page.evaluate(() => (
      window.__tilebreakerDebug.getBattleDebug()?.handSubmitsThisBattle
    ))).toBe(1);

    battleDebug = await getBattleDebug(page);
    expect(battleDebug.layout.mode).toBe('portrait');
    expect(battleDebug.layout.viewport.overflows).toBe(false);
  });
}

test('portrait shop layout keeps offers and continue visible', async ({ page }) => {
  test.setTimeout(60_000);

  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/?seed=20260508&guaranteedLoopHands=true&drawMode=hand');

  await expect(page.locator('#game')).toBeVisible();
  await expectScene(page, 'mainmenu');

  const menuDebug = await getMainMenuDebug(page);
  await clickRect(page, menuDebug.layout.startButton);
  await enterBattleFromIntro(page);
  await playUntilBattleResult(page);
  await expectScene(page, 'result');
  await continueFromResult(page);

  await expectScene(page, 'shop');
  const shopDebug = await getShopDebug(page);
  expectShopFits(shopDebug, 'portrait');
  expect(shopDebug.offers).toHaveLength(5);
  expect(shopDebug.offers.every((offer) => offer.type === 'shop_card')).toBe(true);

  await clickRect(page, shopDebug.layout.continueButton);
  const introDebug = await getBattleIntroDebug(page);
  expect(introDebug.battleNumber).toBe(2);
});

test('normal menu hides variants while debug URLs remain playable', async ({ page }) => {
  await page.goto('/?seed=20260508&variant=c&drawMode=queue');

  await expect(page.locator('#game')).toBeVisible();
  await expectScene(page, 'mainmenu');

  const menuDebug = await getMainMenuDebug(page);
  expect(menuDebug.selectedVariant).toBe('connect_targets');
  expect(menuDebug.variants).toEqual([]);
  expect(menuDebug.layout.variants).toEqual([]);

  await clickRect(page, menuDebug.layout.startButton);
  await enterBattleFromIntro(page);

  const variant = await page.evaluate(() => window.__tilebreakerDebug.getGameplayVariant());
  expect(variant.id).toBe('connect_targets');

  const battleDebug = await getBattleDebug(page);
  expect(battleDebug.gameplayVariant).toBe('connect_targets');
  expect(battleDebug.gameplayVariantLabel).toBe('C');
  expect(battleDebug.drawMode).toBe('queue');
  await expect(placeFirstValidHandTile(page)).resolves.toBe(true);
});

test('one-color chain variant is playable through the first two battles', async ({ page }) => {
  test.setTimeout(60_000);

  await page.goto('/?seed=20260508&variant=b&drawMode=queue');

  await expect(page.locator('#game')).toBeVisible();
  await expectScene(page, 'mainmenu');

  const menuDebug = await getMainMenuDebug(page);
  expect(menuDebug.selectedVariant).toBe('one_color_chain');
  await clickRect(page, menuDebug.layout.startButton);
  await enterBattleFromIntro(page);

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

    await continueFromResult(page);

    if (battle < 2) {
      await continueFromShop(page);
      await enterBattleFromIntro(page);

      battleDebug = await getBattleDebug(page);
      expect(battleDebug.gameplayVariant).toBe('one_color_chain');
    }
  }
});

test('connect-targets variant is playable through the first two battles', async ({ page }) => {
  test.setTimeout(60_000);

  await page.goto('/?seed=20260508&variant=c&drawMode=queue');

  await expect(page.locator('#game')).toBeVisible();
  await expectScene(page, 'mainmenu');

  const menuDebug = await getMainMenuDebug(page);
  expect(menuDebug.selectedVariant).toBe('connect_targets');
  await clickRect(page, menuDebug.layout.startButton);
  await enterBattleFromIntro(page);

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

    await continueFromResult(page);

    if (battle < 2) {
      await continueFromShop(page);
      await enterBattleFromIntro(page);

      battleDebug = await getBattleDebug(page);
      expect(battleDebug.gameplayVariant).toBe('connect_targets');
      expect(battleDebug.connectTargets).not.toBeNull();
    }
  }
});

test('road-mode variant remains URL-playable with visible gates', async ({ page }) => {
  await page.goto('/?seed=20260508&variant=d&drawMode=queue');

  await expect(page.locator('#game')).toBeVisible();
  await expectScene(page, 'mainmenu');

  const menuDebug = await getMainMenuDebug(page);
  expect(menuDebug.selectedVariant).toBe('road_mode');
  await clickRect(page, menuDebug.layout.startButton);
  await enterBattleFromIntro(page);

  let run = await page.evaluate(() => window.__tilebreakerDebug.getRun());
  let battleDebug = await getBattleDebug(page);
  expect(run.gameplayVariant).toBe('road_mode');
  expect(run.activeCombatColors).toEqual(['red']);
  expect(battleDebug.gameplayVariantLabel).toBe('D');
  expect(battleDebug.roadGates).toEqual(expect.objectContaining({
    start: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
    end: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
    distance: expect.any(Number),
  }));

  await expect(placeFirstValidHandTile(page)).resolves.toBe(true);
  battleDebug = await getBattleDebug(page);
  expect(battleDebug.gameplayVariant).toBe('road_mode');
  expect(battleDebug.roadGates).not.toBeNull();
});
