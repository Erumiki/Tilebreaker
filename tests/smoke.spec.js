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

async function expectScene(page, name) {
  await expect.poll(() => page.evaluate(() => (
    window.__tilebreakerDebug?.getSceneName?.()
  ))).toBe(name);
}

test('player can complete the 5-battle prototype loop', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('#game')).toBeVisible();
  await expectScene(page, 'mainmenu');

  await clickCanvas(page, 0.5, 0.63);
  await expectScene(page, 'battle');

  for (let battle = 1; battle <= 5; battle += 1) {
    await clickCanvas(page, 0.36, 0.88);
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
