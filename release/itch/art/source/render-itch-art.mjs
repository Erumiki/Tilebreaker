import { chromium } from '@playwright/test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const sourceDir = dirname(fileURLToPath(import.meta.url));
const htmlUrl = pathToFileURL(resolve(sourceDir, 'compositor.html')).href;
const outDir = resolve(sourceDir, '..');

const exports = [
  ['cover', 'cover_630x500.png', 630, 500],
  ['header', 'header_1200x360.png', 1200, 360],
  ['embed', 'embed_background_1280x720.png', 1280, 720],
  ['page', 'page_background_1920x1080.png', 1920, 1080],
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });

for (const [asset, filename, width, height] of exports) {
  await page.setViewportSize({ width, height });
  await page.goto(`${htmlUrl}?asset=${asset}`);
  await page.waitForLoadState('networkidle');
  await page.evaluate(async () => {
    const images = Array.from(document.images);
    await Promise.all(images.map((image) => (
      image.complete
        ? Promise.resolve()
        : new Promise((resolveImage, rejectImage) => {
          image.addEventListener('load', resolveImage, { once: true });
          image.addEventListener('error', rejectImage, { once: true });
        })
    )));
    await document.fonts.ready;
  });
  await page.screenshot({
    path: resolve(outDir, filename),
    clip: { x: 0, y: 0, width, height },
  });
}

await browser.close();
