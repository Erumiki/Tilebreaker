import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = path.resolve(import.meta.dirname, '..');
const MANIFEST_PATH = path.join(ROOT, 'assets', 'art_mvp', 'art_manifest.json');
const FILE_PATTERN = /^[a-z0-9_]+\.png$/;
const ID_PATTERN = /^[a-z0-9_]+$/;

const palettes = {
    screen_background: [[24, 35, 54, 255], [42, 88, 111, 255], [236, 186, 83, 255]],
    level_backdrop: [[31, 43, 61, 255], [73, 82, 107, 255], [107, 190, 162, 255]],
    ui_chrome: [[18, 27, 39, 225], [72, 91, 116, 235], [158, 218, 255, 255]],
    button: [[34, 54, 77, 230], [82, 132, 172, 245], [238, 213, 134, 255]],
    board_cell: [[43, 52, 54, 190], [95, 115, 113, 210], [223, 207, 157, 240]],
    tile_state: [[54, 61, 71, 70], [255, 255, 255, 90], [242, 196, 91, 150]],
    slot: [[25, 32, 45, 205], [76, 95, 124, 225], [238, 213, 134, 255]],
    card_frame: [[34, 30, 43, 225], [102, 86, 132, 235], [239, 204, 123, 255]],
    monster_portrait: [[45, 29, 39, 0], [126, 61, 83, 235], [237, 143, 91, 255]],
    monster_icon: [[45, 29, 39, 0], [126, 61, 83, 235], [237, 143, 91, 255]],
    icon: [[255, 255, 255, 0], [238, 213, 134, 245], [255, 104, 104, 255]],
    overlay: [[255, 255, 255, 0], [121, 190, 255, 95], [255, 255, 255, 190]],
    effect: [[255, 255, 255, 0], [255, 205, 96, 120], [255, 255, 255, 220]],
    shop_card: [[37, 31, 44, 230], [91, 71, 112, 235], [241, 205, 129, 255]],
};

class Bitmap {
    constructor(width, height, transparent = true) {
        this.width = width;
        this.height = height;
        this.data = Buffer.alloc(width * height * 4);

        if (!transparent) {
            this.fillRect(0, 0, width, height, [0, 0, 0, 255]);
        }
    }

    setPixel(x, y, color) {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
            return;
        }

        const index = (y * this.width + x) * 4;
        const alpha = (color[3] ?? 255) / 255;
        const inverse = 1 - alpha;
        this.data[index] = Math.round(color[0] * alpha + this.data[index] * inverse);
        this.data[index + 1] = Math.round(color[1] * alpha + this.data[index + 1] * inverse);
        this.data[index + 2] = Math.round(color[2] * alpha + this.data[index + 2] * inverse);
        this.data[index + 3] = Math.min(255, Math.round((color[3] ?? 255) + this.data[index + 3] * inverse));
    }

    fillRect(x, y, width, height, color) {
        const x0 = Math.max(0, Math.floor(x));
        const y0 = Math.max(0, Math.floor(y));
        const x1 = Math.min(this.width, Math.ceil(x + width));
        const y1 = Math.min(this.height, Math.ceil(y + height));

        for (let py = y0; py < y1; py += 1) {
            for (let px = x0; px < x1; px += 1) {
                this.setPixel(px, py, color);
            }
        }
    }

    fillCircle(cx, cy, radius, color) {
        const r2 = radius * radius;
        const x0 = Math.floor(cx - radius);
        const y0 = Math.floor(cy - radius);
        const x1 = Math.ceil(cx + radius);
        const y1 = Math.ceil(cy + radius);

        for (let y = y0; y <= y1; y += 1) {
            for (let x = x0; x <= x1; x += 1) {
                const dx = x - cx;
                const dy = y - cy;
                if (dx * dx + dy * dy <= r2) {
                    this.setPixel(x, y, color);
                }
            }
        }
    }
}

function crc32(buffer) {
    let crc = 0xffffffff;

    for (const byte of buffer) {
        crc ^= byte;
        for (let i = 0; i < 8; i += 1) {
            crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
        }
    }

    return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
    const typeBuffer = Buffer.from(type);
    const length = Buffer.alloc(4);
    const checksum = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
    return Buffer.concat([length, typeBuffer, data, checksum]);
}

function encodePng(bitmap) {
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(bitmap.width, 0);
    ihdr.writeUInt32BE(bitmap.height, 4);
    ihdr[8] = 8;
    ihdr[9] = 6;

    const scanlines = Buffer.alloc((bitmap.width * 4 + 1) * bitmap.height);
    for (let y = 0; y < bitmap.height; y += 1) {
        const target = y * (bitmap.width * 4 + 1);
        scanlines[target] = 0;
        bitmap.data.copy(scanlines, target + 1, y * bitmap.width * 4, (y + 1) * bitmap.width * 4);
    }

    return Buffer.concat([
        signature,
        chunk('IHDR', ihdr),
        chunk('IDAT', zlib.deflateSync(scanlines, { level: 9 })),
        chunk('IEND', Buffer.alloc(0)),
    ]);
}

function hashString(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function mix(a, b, t) {
    return [
        Math.round(a[0] * (1 - t) + b[0] * t),
        Math.round(a[1] * (1 - t) + b[1] * t),
        Math.round(a[2] * (1 - t) + b[2] * t),
        Math.round((a[3] ?? 255) * (1 - t) + (b[3] ?? 255) * t),
    ];
}

function withAlpha(color, alpha) {
    return [color[0], color[1], color[2], alpha];
}

function drawFrame(bitmap, color, thickness) {
    bitmap.fillRect(0, 0, bitmap.width, thickness, color);
    bitmap.fillRect(0, bitmap.height - thickness, bitmap.width, thickness, color);
    bitmap.fillRect(0, 0, thickness, bitmap.height, color);
    bitmap.fillRect(bitmap.width - thickness, 0, thickness, bitmap.height, color);
}

function drawCategoryPattern(bitmap, asset, palette) {
    const [base, mid, accent] = palette;
    const seed = hashString(asset.id);
    const stripeCount = 3 + (seed % 5);
    const stripeWidth = Math.max(4, Math.floor(bitmap.width / (stripeCount * 5)));

    for (let i = 0; i < stripeCount; i += 1) {
        const x = Math.floor((i + 1) * bitmap.width / (stripeCount + 1));
        const alpha = 35 + ((seed >> (i * 3)) & 63);
        bitmap.fillRect(x, 0, stripeWidth, bitmap.height, withAlpha(accent, alpha));
    }

    for (let y = 0; y < bitmap.height; y += Math.max(16, Math.floor(bitmap.height / 8))) {
        bitmap.fillRect(0, y, bitmap.width, 1, withAlpha(mid, 45));
    }

    const blockSize = Math.max(10, Math.floor(Math.min(bitmap.width, bitmap.height) / 9));
    for (let i = 0; i < 10; i += 1) {
        if (((seed >> i) & 1) === 0) {
            continue;
        }
        const x = Math.floor(((i * 37 + seed) % Math.max(1, bitmap.width - blockSize)));
        const y = Math.floor(((i * 53 + seed) % Math.max(1, bitmap.height - blockSize)));
        bitmap.fillRect(x, y, blockSize, blockSize, withAlpha(mix(base, accent, 0.55), 55));
    }
}

function drawIconSymbol(bitmap, asset, palette) {
    const [, mid, accent] = palette;
    const cx = bitmap.width / 2;
    const cy = bitmap.height / 2;
    const size = Math.min(bitmap.width, bitmap.height);
    const state = asset.state;

    if (state.includes('heart')) {
        bitmap.fillCircle(cx - size * 0.15, cy - size * 0.11, size * 0.19, withAlpha(accent, 245));
        bitmap.fillCircle(cx + size * 0.15, cy - size * 0.11, size * 0.19, withAlpha(accent, 245));
        bitmap.fillRect(cx - size * 0.27, cy - size * 0.04, size * 0.54, size * 0.24, withAlpha(accent, 245));
        bitmap.fillRect(cx - size * 0.16, cy + size * 0.18, size * 0.32, size * 0.18, withAlpha(accent, 245));
        return;
    }

    if (state === 'gold') {
        bitmap.fillCircle(cx, cy, size * 0.33, withAlpha([241, 190, 69, 255], 250));
        bitmap.fillCircle(cx, cy, size * 0.2, withAlpha([255, 231, 137, 255], 200));
        return;
    }

    if (state === 'deck' || state === 'discard') {
        const w = size * 0.42;
        const h = size * 0.56;
        bitmap.fillRect(cx - w / 2 - 6, cy - h / 2 - 6, w, h, withAlpha(mid, 180));
        bitmap.fillRect(cx - w / 2, cy - h / 2, w, h, withAlpha(accent, 230));
        return;
    }

    if (state === 'strike') {
        bitmap.fillRect(cx - size * 0.08, cy - size * 0.36, size * 0.16, size * 0.72, withAlpha(accent, 240));
        bitmap.fillRect(cx - size * 0.34, cy - size * 0.08, size * 0.68, size * 0.16, withAlpha(accent, 240));
        return;
    }

    bitmap.fillCircle(cx, cy, size * 0.3, withAlpha(accent, 225));
}

function drawPlaceholder(asset) {
    const [width, height] = asset.size;
    const palette = palettes[asset.category] ?? palettes.ui_chrome;
    const [base, mid, accent] = palette;
    const bitmap = new Bitmap(width, height, asset.alpha !== false);

    if (asset.alpha === false) {
        for (let y = 0; y < height; y += 1) {
            const t = y / Math.max(1, height - 1);
            bitmap.fillRect(0, y, width, 1, mix(base, mid, t));
        }
    } else {
        const inset = Math.max(4, Math.floor(Math.min(width, height) * 0.06));
        bitmap.fillRect(inset, inset, width - inset * 2, height - inset * 2, base);
        bitmap.fillRect(inset * 2, inset * 2, width - inset * 4, height - inset * 4, withAlpha(mid, 135));
    }

    drawCategoryPattern(bitmap, asset, palette);

    if (asset.category === 'icon') {
        drawIconSymbol(bitmap, asset, palette);
    }

    if (asset.category === 'monster_portrait' || asset.category === 'monster_icon') {
        const size = Math.min(width, height);
        bitmap.fillCircle(width / 2, height / 2, size * 0.34, withAlpha(mid, 235));
        bitmap.fillCircle(width * 0.39, height * 0.43, size * 0.04, withAlpha(accent, 250));
        bitmap.fillCircle(width * 0.61, height * 0.43, size * 0.04, withAlpha(accent, 250));
        bitmap.fillRect(width * 0.36, height * 0.6, width * 0.28, height * 0.04, withAlpha(accent, 230));
    }

    if (asset.category === 'overlay' || asset.category === 'effect') {
        bitmap.fillCircle(width / 2, height / 2, Math.min(width, height) * 0.34, withAlpha(accent, 90));
        bitmap.fillCircle(width / 2, height / 2, Math.min(width, height) * 0.18, withAlpha(accent, 135));
    }

    drawFrame(bitmap, withAlpha(accent, asset.alpha === false ? 210 : 180), Math.max(2, Math.floor(Math.min(width, height) / 40)));

    return bitmap;
}

function validateManifest(manifest) {
    const ids = new Set();
    const files = new Set();

    if (!Array.isArray(manifest.assets)) {
        throw new Error('art_manifest.json must contain an assets array.');
    }

    for (const asset of manifest.assets) {
        if (!ID_PATTERN.test(asset.id)) {
            throw new Error(`Invalid asset id: ${asset.id}`);
        }

        if (!FILE_PATTERN.test(asset.file)) {
            throw new Error(`Invalid asset file: ${asset.file}`);
        }

        if (ids.has(asset.id)) {
            throw new Error(`Duplicate asset id: ${asset.id}`);
        }

        if (files.has(asset.file)) {
            throw new Error(`Duplicate asset file: ${asset.file}`);
        }

        if (!Array.isArray(asset.size) || asset.size.length !== 2) {
            throw new Error(`Invalid size for ${asset.id}`);
        }

        const [width, height] = asset.size;
        if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
            throw new Error(`Invalid dimensions for ${asset.id}: ${asset.size}`);
        }

        const states = manifest.states?.[asset.category];
        if (states && !states.includes(asset.state)) {
            throw new Error(`State ${asset.state} is not declared for ${asset.category}`);
        }

        ids.add(asset.id);
        files.add(asset.file);
    }
}

function main() {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    validateManifest(manifest);

    const outputDir = path.join(ROOT, manifest.root);
    fs.mkdirSync(outputDir, { recursive: true });

    for (const asset of manifest.assets) {
        const bitmap = drawPlaceholder(asset);
        fs.writeFileSync(path.join(outputDir, asset.file), encodePng(bitmap));
    }

    console.log(`Generated ${manifest.assets.length} MVP art placeholders in ${manifest.root}`);
}

main();
