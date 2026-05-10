import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, '..');
const distDir = resolve(rootDir, 'dist');

const runtimeCopies = [
    ['configs', 'configs'],
    ['assets/art_mvp', 'assets/art_mvp'],
    ['assets/tiles_v2', 'assets/tiles_v2'],
];

await mkdir(distDir, { recursive: true });

await Promise.all(runtimeCopies.map(async ([source, target]) => {
    const sourcePath = resolve(rootDir, source);
    const targetPath = resolve(distDir, target);

    await rm(targetPath, { recursive: true, force: true });
    await mkdir(resolve(targetPath, '..'), { recursive: true });
    await cp(sourcePath, targetPath, { recursive: true });
}));

console.log('Copied runtime configs and assets into dist/.');
