import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = path.resolve(import.meta.dirname, '..');
const MANIFEST_PATH = path.join(ROOT, 'assets', 'art_mvp', 'art_manifest.json');
const FILE_PATTERN = /^[a-z0-9_]+\.png$/;
const ID_PATTERN = /^[a-z0-9_]+$/;

const palettes = {
    screen_background: [[5, 8, 16, 255], [18, 26, 42, 255], [214, 157, 82, 255]],
    level_backdrop: [[7, 10, 20, 255], [39, 26, 69, 255], [159, 67, 223, 255]],
    ui_chrome: [[10, 14, 21, 230], [33, 30, 32, 238], [207, 151, 85, 255]],
    button: [[73, 26, 20, 238], [126, 44, 31, 248], [242, 200, 127, 255]],
    board_cell: [[58, 50, 43, 210], [103, 88, 70, 225], [221, 168, 94, 245]],
    tile_state: [[255, 255, 255, 0], [255, 218, 144, 80], [255, 87, 65, 180]],
    slot: [[12, 15, 20, 220], [44, 38, 35, 235], [224, 166, 94, 255]],
    card_frame: [[19, 17, 23, 232], [78, 52, 77, 238], [231, 180, 104, 255]],
    monster_portrait: [[255, 255, 255, 0], [38, 18, 63, 235], [201, 72, 255, 255]],
    monster_icon: [[255, 255, 255, 0], [38, 18, 63, 235], [201, 72, 255, 255]],
    icon: [[255, 255, 255, 0], [232, 187, 112, 245], [255, 103, 90, 255]],
    overlay: [[255, 255, 255, 0], [88, 160, 255, 95], [255, 241, 204, 190]],
    effect: [[255, 255, 255, 0], [255, 205, 96, 120], [255, 255, 255, 220]],
    shop_card: [[14, 14, 20, 235], [83, 50, 54, 240], [235, 181, 102, 255]],
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

    fillEllipse(cx, cy, radiusX, radiusY, color) {
        const x0 = Math.floor(cx - radiusX);
        const y0 = Math.floor(cy - radiusY);
        const x1 = Math.ceil(cx + radiusX);
        const y1 = Math.ceil(cy + radiusY);

        for (let y = y0; y <= y1; y += 1) {
            for (let x = x0; x <= x1; x += 1) {
                const dx = (x - cx) / Math.max(1, radiusX);
                const dy = (y - cy) / Math.max(1, radiusY);

                if (dx * dx + dy * dy <= 1) {
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

function drawLine(bitmap, x1, y1, x2, y2, thickness, color) {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1))));
    const radius = Math.max(0.5, thickness / 2);

    for (let index = 0; index <= steps; index += 1) {
        const t = index / steps;
        bitmap.fillCircle(
            x1 + (x2 - x1) * t,
            y1 + (y2 - y1) * t,
            radius,
            color,
        );
    }
}

function drawGlowLine(bitmap, x1, y1, x2, y2, color) {
    drawLine(bitmap, x1, y1, x2, y2, 18, withAlpha(color, 34));
    drawLine(bitmap, x1, y1, x2, y2, 10, withAlpha(color, 88));
    drawLine(bitmap, x1, y1, x2, y2, 4, withAlpha(color, 220));
    drawLine(bitmap, x1, y1, x2, y2, 1.5, [255, 244, 220, 220]);
}

function drawOrnateFrame(bitmap, inset, color = [218, 166, 94, 255], alpha = 205) {
    const dark = [25, 16, 13, alpha];
    const bright = withAlpha(color, alpha);
    const x = inset;
    const y = inset;
    const width = bitmap.width - inset * 2;
    const height = bitmap.height - inset * 2;

    bitmap.fillRect(x, y, width, 4, dark);
    bitmap.fillRect(x, y + height - 4, width, 4, dark);
    bitmap.fillRect(x, y, 4, height, dark);
    bitmap.fillRect(x + width - 4, y, 4, height, dark);
    bitmap.fillRect(x + 5, y + 5, width - 10, 2, bright);
    bitmap.fillRect(x + 5, y + height - 7, width - 10, 2, withAlpha(color, alpha * 0.65));
    bitmap.fillRect(x + 5, y + 5, 2, height - 10, withAlpha(color, alpha * 0.65));
    bitmap.fillRect(x + width - 7, y + 5, 2, height - 10, withAlpha(color, alpha * 0.65));

    const corner = Math.max(8, Math.min(width, height) * 0.08);
    drawLine(bitmap, x, y + corner, x + corner, y, 3, bright);
    drawLine(bitmap, x + width - corner, y, x + width, y + corner, 3, bright);
    drawLine(bitmap, x, y + height - corner, x + corner, y + height, 3, bright);
    drawLine(bitmap, x + width - corner, y + height, x + width, y + height - corner, 3, bright);
}

function drawStar(bitmap, cx, cy, size, color, alpha = 230) {
    const c = withAlpha(color, alpha);
    drawLine(bitmap, cx - size, cy, cx + size, cy, Math.max(1, size * 0.12), c);
    drawLine(bitmap, cx, cy - size, cx, cy + size, Math.max(1, size * 0.12), c);
    drawLine(bitmap, cx - size * 0.55, cy - size * 0.55, cx + size * 0.55, cy + size * 0.55, Math.max(1, size * 0.07), withAlpha(color, alpha * 0.65));
    drawLine(bitmap, cx + size * 0.55, cy - size * 0.55, cx - size * 0.55, cy + size * 0.55, Math.max(1, size * 0.07), withAlpha(color, alpha * 0.65));
    bitmap.fillCircle(cx, cy, Math.max(2, size * 0.16), withAlpha([255, 248, 220, 255], alpha));
}

function drawCompass(bitmap, cx, cy, size, color = [218, 166, 94, 255], alpha = 180) {
    bitmap.fillCircle(cx, cy, size * 0.72, withAlpha(color, alpha * 0.12));
    drawLine(bitmap, cx - size, cy, cx + size, cy, Math.max(1, size * 0.05), withAlpha(color, alpha));
    drawLine(bitmap, cx, cy - size, cx, cy + size, Math.max(1, size * 0.05), withAlpha(color, alpha));
    drawLine(bitmap, cx - size * 0.7, cy - size * 0.7, cx + size * 0.7, cy + size * 0.7, Math.max(1, size * 0.035), withAlpha(color, alpha * 0.65));
    drawLine(bitmap, cx + size * 0.7, cy - size * 0.7, cx - size * 0.7, cy + size * 0.7, Math.max(1, size * 0.035), withAlpha(color, alpha * 0.65));
    bitmap.fillCircle(cx, cy, Math.max(2, size * 0.12), withAlpha([255, 235, 185, 255], alpha));
}

function noise01(seed, index) {
    let value = (seed ^ Math.imul(index + 1, 0x45d9f3b)) >>> 0;
    value = Math.imul(value ^ (value >>> 16), 0x45d9f3b) >>> 0;
    value = Math.imul(value ^ (value >>> 16), 0x45d9f3b) >>> 0;
    return ((value ^ (value >>> 16)) >>> 0) / 0xffffffff;
}

function drawVignette(bitmap, strength = 165) {
    const cx = bitmap.width * 0.5;
    const cy = bitmap.height * 0.52;
    const maxDistance = Math.sqrt(cx * cx + cy * cy);

    for (let y = 0; y < bitmap.height; y += 2) {
        for (let x = 0; x < bitmap.width; x += 2) {
            const dx = x - cx;
            const dy = y - cy;
            const t = Math.min(1, Math.sqrt(dx * dx + dy * dy) / maxDistance);
            const alpha = Math.max(0, (t - 0.32) / 0.68) * strength;
            bitmap.fillRect(x, y, 2, 2, [0, 0, 0, alpha]);
        }
    }
}

function drawStoneTexture(bitmap, rect, seed, options = {}) {
    const base = options.base ?? [43, 36, 31, 255];
    const warm = options.warm ?? [93, 74, 55, 255];
    const cool = options.cool ?? [21, 25, 31, 255];
    const grain = options.grain ?? 34;
    const tileSize = options.tileSize ?? 64;

    for (let y = Math.floor(rect.y); y < rect.y + rect.height; y += 1) {
        const localY = (y - rect.y) / Math.max(1, rect.height);
        const rowColor = mix(base, cool, localY * 0.34);
        bitmap.fillRect(rect.x, y, rect.width, 1, rowColor);
    }

    for (let y = rect.y; y <= rect.y + rect.height; y += tileSize) {
        bitmap.fillRect(rect.x, y, rect.width, 1.5, [12, 10, 9, 84]);
        bitmap.fillRect(rect.x, y + 2, rect.width, 1, [142, 111, 74, 25]);
    }
    for (let x = rect.x; x <= rect.x + rect.width; x += tileSize) {
        bitmap.fillRect(x, rect.y, 1.5, rect.height, [12, 10, 9, 78]);
        bitmap.fillRect(x + 2, rect.y, 1, rect.height, [142, 111, 74, 23]);
    }

    const specks = Math.floor((rect.width * rect.height) / 260);
    for (let i = 0; i < specks; i += 1) {
        const x = rect.x + noise01(seed, i * 4) * rect.width;
        const y = rect.y + noise01(seed, i * 4 + 1) * rect.height;
        const size = 1 + Math.floor(noise01(seed, i * 4 + 2) * 3);
        const alpha = 10 + noise01(seed, i * 4 + 3) * grain;
        bitmap.fillRect(x, y, size, size, withAlpha(noise01(seed, i) > 0.55 ? warm : cool, alpha));
    }
}

function drawArchiveFloor(bitmap, seed, variant = 'battle') {
    const base = variant === 'menu' ? [9, 14, 23, 255] : [10, 12, 18, 255];
    const lower = variant === 'shop' ? [30, 22, 24, 255] : [24, 22, 25, 255];

    for (let y = 0; y < bitmap.height; y += 1) {
        const t = y / Math.max(1, bitmap.height - 1);
        bitmap.fillRect(0, y, bitmap.width, 1, mix(base, lower, t));
    }

    drawStoneTexture(bitmap, {
        x: 0,
        y: 0,
        width: bitmap.width,
        height: bitmap.height,
    }, seed, {
        base: [20, 22, 27, 255],
        warm: [86, 67, 49, 255],
        cool: [7, 11, 18, 255],
        grain: 22,
        tileSize: Math.max(72, Math.floor(bitmap.height / 6)),
    });

    const cx = variant === 'menu' ? bitmap.width * 0.5 : bitmap.width * 0.42;
    const cy = bitmap.height * 0.6;
    const ringColor = [178, 132, 78, 255];
    for (let radius = bitmap.height * 0.16; radius < bitmap.height * 0.98; radius += bitmap.height * 0.12) {
        let previous = null;
        for (let angle = -0.85; angle < Math.PI * 1.88; angle += 0.075) {
            const squash = 0.58 + radius / bitmap.height * 0.12;
            const point = {
                x: cx + Math.cos(angle) * radius,
                y: cy + Math.sin(angle) * radius * squash,
            };
            if (previous && noise01(seed, Math.floor(radius * 13 + angle * 1000)) > 0.18) {
                drawLine(bitmap, previous.x, previous.y, point.x, point.y, 1.15, withAlpha(ringColor, 42));
            }
            previous = point;
        }
    }

    for (let angle = -0.45; angle < Math.PI * 2; angle += Math.PI / 12) {
        drawLine(
            bitmap,
            cx,
            cy,
            cx + Math.cos(angle) * bitmap.height * 0.84,
            cy + Math.sin(angle) * bitmap.height * 0.52,
            0.9,
            [178, 132, 78, 24],
        );
    }

    if (variant === 'menu' || variant === 'result') {
        drawCompass(bitmap, bitmap.width * 0.5, bitmap.height * 0.38, Math.min(bitmap.width, bitmap.height) * 0.17, [224, 170, 96, 255], 150);
    }
}

function drawVoidBreach(bitmap, seed, battleIndex, options = {}) {
    const cx = options.x ?? bitmap.width * 0.78;
    const cy = options.y ?? bitmap.height * 0.42;
    const size = options.size ?? Math.min(bitmap.width, bitmap.height) * 0.22;
    const violet = [120, 36, 177, 255];
    const magenta = [221, 76, 255, 255];
    const blue = [80, 169, 255, 255];

    for (let i = 0; i < 34 + battleIndex * 6; i += 1) {
        const angle = noise01(seed, i * 4) * Math.PI * 2;
        const distance = size * (0.18 + noise01(seed, i * 4 + 1) * 1.55);
        const rx = size * (0.12 + noise01(seed, i * 4 + 2) * 0.5);
        const ry = size * (0.08 + noise01(seed, i * 4 + 3) * 0.35);
        const color = i % 3 === 0 ? magenta : i % 3 === 1 ? violet : blue;
        bitmap.fillEllipse(
            cx + Math.cos(angle) * distance,
            cy + Math.sin(angle) * distance * 0.72,
            rx,
            ry,
            withAlpha(color, 16 + battleIndex * 5 + (i % 5) * 7),
        );
    }

    bitmap.fillEllipse(cx, cy, size * 0.96, size * 0.72, [16, 8, 30, 205]);
    bitmap.fillEllipse(cx + size * 0.08, cy - size * 0.04, size * 0.56, size * 0.44, [6, 5, 15, 230]);

    for (let i = 0; i < 8 + battleIndex; i += 1) {
        const angle = -Math.PI * 0.92 + i * (Math.PI * 1.35 / (7 + battleIndex));
        const start = size * (0.22 + noise01(seed, 200 + i) * 0.16);
        const end = size * (0.88 + noise01(seed, 300 + i) * 0.45);
        const bend = angle - 0.34 + noise01(seed, 400 + i) * 0.22;
        drawLine(
            bitmap,
            cx + Math.cos(angle) * start,
            cy + Math.sin(angle) * start * 0.8,
            cx + Math.cos(bend) * end,
            cy + Math.sin(bend) * end * 0.86,
            Math.max(5, size * 0.052),
            [5, 5, 13, 188],
        );
        drawLine(
            bitmap,
            cx + Math.cos(angle) * start,
            cy + Math.sin(angle) * start * 0.8,
            cx + Math.cos(bend) * end,
            cy + Math.sin(bend) * end * 0.86,
            Math.max(2, size * 0.018),
            [114, 45, 154, 130],
        );
    }

    drawGlowLine(bitmap, cx - size * 0.58, cy - size * 0.08, cx + size * 0.38, cy - size * 0.45, magenta);
    drawGlowLine(bitmap, cx - size * 0.36, cy + size * 0.44, cx + size * 0.52, cy + size * 0.12, blue);
    bitmap.fillEllipse(cx + size * 0.08, cy - size * 0.08, size * 0.045, size * 0.16, [255, 235, 255, 220]);
}

function drawStarField(bitmap, seed, density = 90, alpha = 85) {
    for (let i = 0; i < density; i += 1) {
        const x = noise01(seed, i * 3) * bitmap.width;
        const y = noise01(seed, i * 3 + 1) * bitmap.height;
        const size = noise01(seed, i * 3 + 2) > 0.9 ? 1.8 : 0.9;
        bitmap.fillCircle(x, y, size, [190, 184, 255, alpha + noise01(seed, i + 900) * 80]);
    }
}

function drawAstralBackground(bitmap, asset) {
    const battleIndex = Number((asset.id.match(/_(\d+)$/) ?? [0, 1])[1]) || 1;
    const seed = hashString(asset.id);

    drawArchiveFloor(bitmap, seed, asset.state);
    drawStarField(bitmap, seed, asset.category === 'level_backdrop' ? 130 : 75, 58);

    if (asset.category === 'level_backdrop' || asset.state === 'battle_intro') {
        const windowY = bitmap.height * 0.14;
        const windowHeight = bitmap.height * 0.68;
        bitmap.fillRect(bitmap.width * 0.06, windowY, bitmap.width * 0.88, windowHeight, [5, 6, 12, 118]);
        drawOrnateFrame(bitmap, Math.max(10, Math.floor(Math.min(bitmap.width, bitmap.height) * 0.028)), [191, 130, 73, 255], 110);
        for (let i = 0; i < 5; i += 1) {
            const arcX = bitmap.width * (0.16 + i * 0.09);
            drawLine(bitmap, arcX, windowY + windowHeight, arcX + bitmap.width * 0.24, windowY, 1, [181, 130, 79, 46]);
        }
        for (let i = 0; i < battleIndex + 3; i += 1) {
            const rockX = bitmap.width * (0.12 + noise01(seed, 600 + i) * 0.78);
            const rockY = windowY + noise01(seed, 640 + i) * windowHeight * 0.72;
            bitmap.fillEllipse(rockX, rockY, 12 + i * 5, 8 + i * 3, [15, 14, 18, 218]);
            bitmap.fillEllipse(rockX - 4, rockY - 3, 5 + i * 2, 3 + i, [67, 58, 62, 94]);
        }
        drawVoidBreach(bitmap, seed, battleIndex, {
            x: bitmap.width * 0.74,
            y: bitmap.height * 0.42,
            size: Math.min(bitmap.width, bitmap.height) * (0.2 + battleIndex * 0.012),
        });
    } else if (asset.state === 'battle') {
        drawVoidBreach(bitmap, seed, battleIndex, {
            x: bitmap.width * 0.91,
            y: bitmap.height * 0.44,
            size: Math.min(bitmap.width, bitmap.height) * 0.26,
        });
        bitmap.fillEllipse(bitmap.width * 0.5, bitmap.height * 0.58, bitmap.height * 0.55, bitmap.height * 0.3, [0, 0, 0, 64]);
    } else if (asset.state === 'menu' || asset.state === 'result') {
        bitmap.fillEllipse(bitmap.width * 0.5, bitmap.height * 0.45, bitmap.height * 0.28, bitmap.height * 0.2, [215, 155, 80, 24]);
    }

    drawVignette(bitmap, asset.category === 'level_backdrop' ? 120 : 150);

    drawOrnateFrame(bitmap, Math.max(8, Math.floor(Math.min(bitmap.width, bitmap.height) * 0.018)), [218, 166, 94, 255], 170);
}

function drawPanelSurface(bitmap, asset) {
    const [base, mid, accent] = palettes[asset.category] ?? palettes.ui_chrome;
    const inset = Math.max(5, Math.floor(Math.min(bitmap.width, bitmap.height) * 0.04));
    bitmap.fillRect(0, 0, bitmap.width, bitmap.height, [0, 0, 0, 0]);
    bitmap.fillRect(inset, inset, bitmap.width - inset * 2, bitmap.height - inset * 2, base);
    for (let y = inset; y < bitmap.height - inset; y += 1) {
        const t = (y - inset) / Math.max(1, bitmap.height - inset * 2);
        bitmap.fillRect(inset, y, bitmap.width - inset * 2, 1, mix(base, mid, t * 0.35));
    }
    if (asset.category === 'ui_chrome') {
        drawCompass(bitmap, bitmap.width * 0.5, bitmap.height * 0.5, Math.min(bitmap.width, bitmap.height) * 0.22, accent, 54);
    } else {
        drawCategoryPattern(bitmap, asset, [base, mid, withAlpha(accent, 180)]);
    }
    drawOrnateFrame(bitmap, inset, accent, 210);
}

function drawShopCardSurface(bitmap, asset) {
    const state = asset.state;
    const isBought = state === 'bought';
    const isUnaffordable = state === 'unaffordable';
    const isAffordable = state === 'affordable' || state === 'offer';
    const accent = isBought
        ? [117, 213, 145, 255]
        : isUnaffordable ? [151, 137, 151, 255] : [235, 181, 102, 255];
    const base = isBought
        ? [13, 24, 21, 238]
        : isUnaffordable ? [17, 15, 22, 226] : [13, 16, 23, 238];
    const mid = isBought
        ? [22, 54, 39, 242]
        : isUnaffordable ? [41, 33, 44, 232] : [37, 27, 38, 242];
    const inset = Math.max(8, Math.floor(Math.min(bitmap.width, bitmap.height) * 0.035));
    const inner = {
        x: inset,
        y: inset,
        width: bitmap.width - inset * 2,
        height: bitmap.height - inset * 2,
    };
    const previewSize = Math.floor(Math.min(bitmap.width * 0.5, bitmap.height * 0.3));
    const preview = {
        x: Math.floor(bitmap.width / 2 - previewSize / 2),
        y: Math.floor(bitmap.height * 0.22),
        width: previewSize,
        height: previewSize,
    };
    const seed = hashString(asset.id);

    bitmap.fillRect(0, 0, bitmap.width, bitmap.height, [0, 0, 0, 0]);
    bitmap.fillRect(inner.x, inner.y, inner.width, inner.height, base);
    for (let y = inner.y; y < inner.y + inner.height; y += 1) {
        const t = (y - inner.y) / Math.max(1, inner.height);
        bitmap.fillRect(inner.x, y, inner.width, 1, mix(base, mid, t * 0.42));
    }

    bitmap.fillEllipse(bitmap.width * 0.5, bitmap.height * 0.36, bitmap.width * 0.34, bitmap.height * 0.18, withAlpha(accent, isUnaffordable ? 12 : 20));
    drawCompass(bitmap, bitmap.width * 0.5, bitmap.height * 0.36, Math.min(bitmap.width, bitmap.height) * 0.17, accent, isUnaffordable ? 30 : 46);

    const specks = 36;
    for (let index = 0; index < specks; index += 1) {
        const x = inner.x + noise01(seed, index * 3) * inner.width;
        const y = inner.y + noise01(seed, index * 3 + 1) * inner.height;
        const size = 1 + noise01(seed, index * 3 + 2) * 1.8;
        bitmap.fillRect(x, y, size, size, withAlpha(accent, isUnaffordable ? 12 : 20));
    }

    bitmap.fillRect(preview.x - 10, preview.y - 10, preview.width + 20, preview.height + 20, [4, 7, 11, isUnaffordable ? 92 : 130]);
    bitmap.fillRect(preview.x - 5, preview.y - 5, preview.width + 10, preview.height + 10, [16, 18, 23, isUnaffordable ? 108 : 154]);
    drawFrame({
        width: preview.width + 18,
        height: preview.height + 18,
        fillRect(x, y, width, height, color) {
            bitmap.fillRect(preview.x - 9 + x, preview.y - 9 + y, width, height, color);
        },
    }, withAlpha(accent, isUnaffordable ? 72 : 112), 2);
    drawStar(bitmap, bitmap.width * 0.5, preview.y + preview.height + 34, Math.min(bitmap.width, bitmap.height) * 0.035, accent, isUnaffordable ? 58 : 94);

    const footerY = Math.floor(bitmap.height * 0.73);
    if (isBought) {
        bitmap.fillRect(inner.x + 10, footerY, inner.width - 20, 34, [74, 151, 97, 106]);
        bitmap.fillRect(inner.x + 10, footerY + 31, inner.width - 20, 3, [171, 238, 177, 92]);
    } else if (isAffordable) {
        bitmap.fillRect(inner.x + 10, footerY, inner.width - 20, 34, [91, 64, 30, 76]);
        bitmap.fillRect(inner.x + 10, footerY + 31, inner.width - 20, 3, [241, 196, 111, 82]);
    } else if (isUnaffordable) {
        bitmap.fillRect(inner.x + 10, footerY, inner.width - 20, 34, [42, 35, 43, 92]);
    }

    drawFrame(bitmap, [24, 14, 12, 210], 4);
    drawFrame(bitmap, withAlpha(accent, isUnaffordable ? 118 : 184), 2);
    drawCellCornerBrackets(bitmap, accent, isUnaffordable ? 132 : 220, {
        inset: inset,
        length: 28,
        thickness: 3,
    });
}

function drawCellCornerBrackets(bitmap, color, alpha, options = {}) {
    const inset = options.inset ?? Math.max(10, Math.floor(Math.min(bitmap.width, bitmap.height) * 0.12));
    const length = options.length ?? Math.max(16, Math.floor(Math.min(bitmap.width, bitmap.height) * 0.2));
    const thickness = options.thickness ?? Math.max(2, Math.floor(Math.min(bitmap.width, bitmap.height) * 0.025));
    const c = withAlpha(color, alpha);
    const left = inset;
    const right = bitmap.width - inset;
    const top = inset;
    const bottom = bitmap.height - inset;

    bitmap.fillRect(left, top, length, thickness, c);
    bitmap.fillRect(left, top, thickness, length, c);
    bitmap.fillRect(right - length, top, length, thickness, c);
    bitmap.fillRect(right - thickness, top, thickness, length, c);
    bitmap.fillRect(left, bottom - thickness, length, thickness, c);
    bitmap.fillRect(left, bottom - length, thickness, length, c);
    bitmap.fillRect(right - length, bottom - thickness, length, thickness, c);
    bitmap.fillRect(right - thickness, bottom - length, thickness, length, c);
}

function drawBoardEtching(bitmap, seed, color, alpha) {
    const size = Math.min(bitmap.width, bitmap.height);
    const inner = size * 0.18;
    const cx = bitmap.width / 2;
    const cy = bitmap.height / 2;

    drawCompass(bitmap, cx, cy, size * 0.18, color, alpha);
    for (let index = 0; index < 6; index += 1) {
        const x = bitmap.width * (0.18 + noise01(seed, index * 3) * 0.64);
        const y = bitmap.height * (0.18 + noise01(seed, index * 3 + 1) * 0.64);
        const dotSize = Math.max(1.2, size * (0.008 + noise01(seed, index * 3 + 2) * 0.008));
        bitmap.fillCircle(x, y, dotSize, withAlpha(color, alpha * 0.45));
    }

    bitmap.fillRect(inner, cy - 0.75, bitmap.width - inner * 2, 1.5, withAlpha(color, alpha * 0.18));
    bitmap.fillRect(cx - 0.75, inner, 1.5, bitmap.height - inner * 2, withAlpha(color, alpha * 0.16));
}

function drawBoardSurface(bitmap, asset) {
    const [, , accent] = palettes.board_cell;
    const seed = hashString(asset.id);
    const state = asset.state;
    const size = Math.min(bitmap.width, bitmap.height);
    const stoneRect = {
        x: 10,
        y: 10,
        width: bitmap.width - 20,
        height: bitmap.height - 20,
    };
    const brass = [221, 168, 94, 255];
    const pale = [255, 231, 171, 255];
    const red = [255, 84, 92, 255];
    bitmap.fillRect(0, 0, bitmap.width, bitmap.height, [0, 0, 0, 0]);

    bitmap.fillRect(5, 5, bitmap.width - 10, bitmap.height - 10, [15, 12, 11, 214]);
    bitmap.fillRect(8, 8, bitmap.width - 16, bitmap.height - 16, [77, 63, 49, 236]);
    drawStoneTexture(bitmap, stoneRect, seed, {
        base: state === 'scored' ? [88, 73, 52, 235] : [72, 63, 54, 236],
        warm: [148, 118, 78, 255],
        cool: [31, 31, 34, 255],
        grain: state === 'hover' ? 24 : 30,
        tileSize: Math.max(18, Math.floor(bitmap.width / 4)),
    });

    bitmap.fillRect(11, 11, bitmap.width - 22, 3, [194, 143, 82, 82]);
    bitmap.fillRect(11, bitmap.height - 14, bitmap.width - 22, 3, [8, 7, 7, 98]);
    bitmap.fillRect(11, 11, 3, bitmap.height - 22, [184, 135, 82, 54]);
    bitmap.fillRect(bitmap.width - 14, 11, 3, bitmap.height - 22, [8, 7, 7, 92]);

    for (let line = 22; line < bitmap.width - 16; line += 21) {
        bitmap.fillRect(line, 13, 1, bitmap.height - 26, [22, 18, 16, 58]);
        bitmap.fillRect(line + 1, 13, 1, bitmap.height - 26, [159, 129, 88, 18]);
    }
    for (let line = 22; line < bitmap.height - 16; line += 21) {
        bitmap.fillRect(13, line, bitmap.width - 26, 1, [22, 18, 16, 58]);
        bitmap.fillRect(13, line + 1, bitmap.width - 26, 1, [159, 129, 88, 18]);
    }

    drawBoardEtching(bitmap, seed, brass, state === 'empty' ? 34 : 44);

    if (state === 'valid') {
        bitmap.fillRect(13, 13, bitmap.width - 26, bitmap.height - 26, [211, 151, 78, 28]);
        drawCellCornerBrackets(bitmap, pale, 118, {
            inset: size * 0.11,
            length: size * 0.16,
            thickness: size * 0.022,
        });
        bitmap.fillCircle(bitmap.width / 2, bitmap.height / 2, size * 0.17, [232, 176, 92, 24]);
    }

    if (state === 'invalid') {
        bitmap.fillRect(12, 12, bitmap.width - 24, bitmap.height - 24, [138, 26, 32, 74]);
        drawCellCornerBrackets(bitmap, red, 172, {
            inset: size * 0.1,
            length: size * 0.2,
            thickness: size * 0.032,
        });
        drawLine(bitmap, size * 0.28, size * 0.28, bitmap.width - size * 0.28, bitmap.height - size * 0.28, size * 0.03, withAlpha(red, 135));
        drawLine(bitmap, bitmap.width - size * 0.28, size * 0.28, size * 0.28, bitmap.height - size * 0.28, size * 0.03, withAlpha(red, 135));
    }

    if (state === 'hover') {
        bitmap.fillRect(10, 10, bitmap.width - 20, bitmap.height - 20, [214, 166, 92, 38]);
        drawCellCornerBrackets(bitmap, pale, 145, {
            inset: size * 0.09,
            length: size * 0.22,
            thickness: size * 0.025,
        });
    }

    if (state === 'scored') {
        bitmap.fillRect(10, 10, bitmap.width - 20, bitmap.height - 20, [255, 204, 108, 62]);
        bitmap.fillCircle(bitmap.width / 2, bitmap.height / 2, size * 0.31, [255, 202, 99, 38]);
        drawCompass(bitmap, bitmap.width / 2, bitmap.height / 2, size * 0.28, pale, 150);
        drawStar(bitmap, bitmap.width / 2, bitmap.height / 2, size * 0.12, pale, 172);
    }

    drawOrnateFrame(bitmap, 4, state === 'invalid' ? red : accent, state === 'empty' ? 162 : 205);
    bitmap.fillCircle(bitmap.width / 2, bitmap.height / 2, size * 0.018, [227, 181, 105, 76]);
}

function drawButtonSurface(bitmap, asset) {
    const [base, mid, accent] = palettes.button;
    const disabled = asset.state === 'disabled';
    const hover = asset.state === 'hover';
    const pressed = asset.state === 'pressed';
    const localBase = disabled ? [35, 35, 38, 210] : pressed ? [61, 22, 18, 240] : base;
    const localMid = disabled ? [74, 70, 72, 220] : hover ? [159, 64, 44, 250] : mid;

    bitmap.fillRect(0, 0, bitmap.width, bitmap.height, [0, 0, 0, 0]);
    bitmap.fillRect(8, 8, bitmap.width - 16, bitmap.height - 16, localBase);
    for (let y = 8; y < bitmap.height - 8; y += 1) {
        const t = (y - 8) / Math.max(1, bitmap.height - 16);
        bitmap.fillRect(8, y, bitmap.width - 16, 1, mix(localMid, localBase, t));
    }
    drawOrnateFrame(bitmap, 4, disabled ? [112, 101, 91, 255] : accent, disabled ? 128 : 230);
    drawCompass(bitmap, 54, bitmap.height / 2, Math.min(bitmap.height, 82) * 0.34, disabled ? [128, 118, 105, 255] : accent, disabled ? 90 : 150);
}

function drawSlotSurface(bitmap, asset) {
    const [base, mid, accent] = palettes.slot;
    const selected = asset.state === 'selected';
    const filled = asset.state === 'filled';
    const hover = asset.state === 'hover';
    bitmap.fillRect(0, 0, bitmap.width, bitmap.height, [0, 0, 0, 0]);
    bitmap.fillRect(6, 6, bitmap.width - 12, bitmap.height - 12, base);
    bitmap.fillRect(12, 12, bitmap.width - 24, bitmap.height - 24, mid);
    drawCompass(bitmap, bitmap.width / 2, bitmap.height / 2, Math.min(bitmap.width, bitmap.height) * 0.22, accent, filled ? 105 : 55);
    if (selected || hover) {
        drawGlowLine(bitmap, 12, 12, bitmap.width - 12, 12, selected ? [255, 226, 150, 255] : [89, 178, 255, 255]);
    }
    drawOrnateFrame(bitmap, 4, selected ? [255, 226, 150, 255] : accent, filled ? 230 : 175);
}

function drawMonsterStars(bitmap, seed, count, alpha = 90) {
    for (let i = 0; i < count; i += 1) {
        const x = noise01(seed, i * 5) * bitmap.width;
        const y = noise01(seed, i * 5 + 1) * bitmap.height;
        const size = noise01(seed, i * 5 + 2) > 0.88 ? 2 : 1;
        bitmap.fillCircle(x, y, size, [235, 207, 255, alpha]);
    }
}

function drawMonsterEye(bitmap, cx, cy, radius, color = [255, 238, 225, 255]) {
    bitmap.fillCircle(cx, cy, radius * 1.9, [0, 0, 0, 130]);
    bitmap.fillCircle(cx, cy, radius, color);
    bitmap.fillCircle(cx, cy, radius * 0.42, [10, 8, 20, 245]);
}

function drawJaggedCorona(bitmap, cx, cy, innerRadius, outerRadius, count, color, alpha = 185) {
    for (let i = 0; i < count; i += 1) {
        const angle = (Math.PI * 2 * i) / count;
        const next = angle + Math.PI / count * 0.62;
        const start = innerRadius * (0.92 + (i % 2) * 0.08);
        const end = outerRadius * (0.86 + (i % 3) * 0.07);
        drawLine(
            bitmap,
            cx + Math.cos(angle) * start,
            cy + Math.sin(angle) * start,
            cx + Math.cos(next) * end,
            cy + Math.sin(next) * end,
            Math.max(2, innerRadius * 0.035),
            withAlpha(color, alpha),
        );
    }
}

function drawShadowLeech(bitmap, seed, scale) {
    const size = Math.min(bitmap.width, bitmap.height);
    const cx = bitmap.width * 0.51;
    const cy = bitmap.height * 0.52;
    const dark = [17, 9, 30, 238];
    const purple = [80, 33, 128, 220];
    const blue = [53, 168, 255, 210];
    const red = [255, 84, 95, 210];

    for (let i = 0; i < 18; i += 1) {
        const t = i / 17;
        const angle = -Math.PI * 1.25 + t * Math.PI * 1.82;
        const radius = size * (0.34 - t * 0.13);
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius * 0.92;
        const segment = size * (0.1 + Math.sin(t * Math.PI) * 0.095) * scale;
        bitmap.fillCircle(x, y, segment * 1.35, [92, 38, 146, 48]);
        bitmap.fillCircle(x, y, segment, i % 2 === 0 ? dark : purple);
        if (i % 4 === 0) {
            bitmap.fillCircle(x - segment * 0.25, y - segment * 0.25, segment * 0.16, [235, 207, 255, 135]);
        }
    }
    drawMonsterEye(bitmap, cx + size * 0.22, cy - size * 0.24, size * 0.038 * scale, [255, 236, 223, 255]);
    drawGlowLine(bitmap, cx - size * 0.28, cy + size * 0.2, cx - size * 0.06, cy + size * 0.34, blue);
    drawGlowLine(bitmap, cx + size * 0.05, cy - size * 0.34, cx + size * 0.25, cy - size * 0.25, red);
    drawMonsterStars(bitmap, seed, 18, 110);
}

function drawCometMaw(bitmap, seed, scale) {
    const size = Math.min(bitmap.width, bitmap.height);
    const cx = bitmap.width * 0.54;
    const cy = bitmap.height * 0.52;
    const violet = [93, 34, 146, 230];
    const magenta = [219, 78, 255, 230];
    const blue = [77, 171, 255, 210];

    for (let i = 0; i < 7; i += 1) {
        const offset = (i - 3) * size * 0.048;
        drawGlowLine(
            bitmap,
            cx - size * (0.5 + i * 0.018),
            cy + offset,
            cx - size * 0.06,
            cy + offset * 0.3,
            i % 2 === 0 ? blue : magenta,
        );
    }
    bitmap.fillEllipse(cx, cy, size * 0.28 * scale, size * 0.18 * scale, violet);
    bitmap.fillEllipse(cx + size * 0.13, cy, size * 0.18 * scale, size * 0.13 * scale, [13, 8, 27, 242]);
    drawLine(bitmap, cx + size * 0.02, cy - size * 0.02, cx + size * 0.29, cy - size * 0.14, size * 0.04, [6, 5, 15, 230]);
    drawLine(bitmap, cx + size * 0.02, cy + size * 0.02, cx + size * 0.29, cy + size * 0.14, size * 0.04, [6, 5, 15, 230]);
    for (let i = 0; i < 3; i += 1) {
        drawMonsterEye(bitmap, cx - size * (0.03 + i * 0.08), cy - size * (0.06 - i * 0.04), size * 0.028 * scale, i === 1 ? [135, 206, 255, 255] : [255, 236, 223, 255]);
    }
    drawMonsterStars(bitmap, seed, 22, 100);
}

function drawRiftHound(bitmap, seed, scale) {
    const size = Math.min(bitmap.width, bitmap.height);
    const cx = bitmap.width * 0.48;
    const cy = bitmap.height * 0.54;
    const dark = [12, 9, 24, 238];
    const violet = [74, 29, 121, 228];
    const blue = [73, 164, 255, 220];

    bitmap.fillEllipse(cx, cy, size * 0.3 * scale, size * 0.16 * scale, violet);
    bitmap.fillEllipse(cx + size * 0.25, cy - size * 0.04, size * 0.16 * scale, size * 0.1 * scale, dark);
    drawLine(bitmap, cx + size * 0.32, cy - size * 0.04, cx + size * 0.48, cy - size * 0.1, size * 0.08, dark);
    for (let i = 0; i < 4; i += 1) {
        const legX = cx - size * 0.18 + i * size * 0.12;
        drawLine(bitmap, legX, cy + size * 0.08, legX - size * 0.05, cy + size * 0.34, size * 0.045, dark);
        drawLine(bitmap, legX - size * 0.05, cy + size * 0.34, legX + size * 0.02, cy + size * 0.39, size * 0.025, [166, 83, 223, 170]);
    }
    for (let i = 0; i < 5; i += 1) {
        const x = cx + size * (0.13 + i * 0.08);
        drawGlowLine(bitmap, x, cy - size * 0.18, x + size * 0.06, cy - size * 0.33, blue);
    }
    drawMonsterEye(bitmap, cx + size * 0.33, cy - size * 0.08, size * 0.028 * scale, [255, 96, 120, 255]);
    drawMonsterStars(bitmap, seed, 18, 95);
}

function drawConstellationGiant(bitmap, seed, scale) {
    const size = Math.min(bitmap.width, bitmap.height);
    const cx = bitmap.width * 0.5;
    const cy = bitmap.height * 0.51;
    const gold = [225, 169, 94, 210];
    const violet = [96, 42, 155, 220];
    const dark = [12, 9, 24, 230];

    bitmap.fillCircle(cx, cy - size * 0.28, size * 0.09 * scale, dark);
    bitmap.fillEllipse(cx, cy - size * 0.04, size * 0.17 * scale, size * 0.24 * scale, violet);
    const nodes = [
        [cx, cy - size * 0.28],
        [cx - size * 0.24, cy - size * 0.06],
        [cx + size * 0.25, cy - size * 0.08],
        [cx - size * 0.14, cy + size * 0.25],
        [cx + size * 0.14, cy + size * 0.27],
        [cx, cy - size * 0.02],
    ];
    for (const [from, to] of [[0, 5], [5, 1], [5, 2], [5, 3], [5, 4], [1, 3], [2, 4]]) {
        drawLine(bitmap, nodes[from][0], nodes[from][1], nodes[to][0], nodes[to][1], size * 0.026, gold);
    }
    for (const [x, y] of nodes) {
        bitmap.fillCircle(x, y, size * 0.035, [255, 230, 166, 220]);
        bitmap.fillCircle(x, y, size * 0.07, [163, 80, 220, 55]);
    }
    for (let i = 0; i < 9; i += 1) {
        bitmap.fillEllipse(
            noise01(seed, i) * bitmap.width,
            noise01(seed, 50 + i) * bitmap.height,
            size * 0.04,
            size * 0.025,
            [47, 40, 48, 150],
        );
    }
    drawMonsterEye(bitmap, cx, cy - size * 0.28, size * 0.025 * scale, [173, 218, 255, 255]);
    drawMonsterStars(bitmap, seed, 34, 105);
}

function drawBlackSunMonarch(bitmap, seed, scale) {
    const size = Math.min(bitmap.width, bitmap.height);
    const cx = bitmap.width * 0.5;
    const cy = bitmap.height * 0.5;
    const magenta = [216, 72, 255, 230];
    const red = [255, 82, 88, 210];
    const blue = [75, 166, 255, 205];

    drawJaggedCorona(bitmap, cx, cy, size * 0.22, size * 0.43, 18, magenta, 185);
    drawJaggedCorona(bitmap, cx, cy, size * 0.18, size * 0.34, 13, red, 95);
    bitmap.fillCircle(cx, cy, size * 0.28 * scale, [6, 5, 14, 248]);
    bitmap.fillCircle(cx, cy, size * 0.36 * scale, [80, 32, 135, 75]);
    drawMonsterEye(bitmap, cx, cy, size * 0.05 * scale, [255, 235, 214, 255]);
    drawGlowLine(bitmap, cx - size * 0.42, cy + size * 0.18, cx - size * 0.22, cy + size * 0.3, red);
    drawGlowLine(bitmap, cx + size * 0.24, cy - size * 0.3, cx + size * 0.45, cy - size * 0.17, blue);
    drawMonsterStars(bitmap, seed, 38, 115);
}

function drawMonster(bitmap, asset) {
    const seed = hashString(asset.id);
    const battleIndex = Number((asset.id.match(/_(\d+)$/) ?? [0, 1])[1]) || 1;
    const scale = asset.category === 'monster_icon' ? 0.92 : 1;

    if (battleIndex === 1) {
        drawShadowLeech(bitmap, seed, scale);
    } else if (battleIndex === 2) {
        drawCometMaw(bitmap, seed, scale);
    } else if (battleIndex === 3) {
        drawRiftHound(bitmap, seed, scale);
    } else if (battleIndex === 4) {
        drawConstellationGiant(bitmap, seed, scale);
    } else {
        drawBlackSunMonarch(bitmap, seed, scale);
    }
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
        const color = state === 'heart_empty' ? [225, 190, 128, 255] : state === 'heart_lost' ? [255, 76, 87, 255] : [255, 222, 172, 255];
        bitmap.fillCircle(cx - size * 0.14, cy - size * 0.11, size * 0.2, withAlpha(color, state === 'heart_empty' ? 92 : 230));
        bitmap.fillCircle(cx + size * 0.14, cy - size * 0.11, size * 0.2, withAlpha(color, state === 'heart_empty' ? 92 : 230));
        bitmap.fillRect(cx - size * 0.31, cy - size * 0.02, size * 0.62, size * 0.22, withAlpha(color, state === 'heart_empty' ? 80 : 225));
        drawLine(bitmap, cx - size * 0.26, cy + size * 0.1, cx, cy + size * 0.38, size * 0.13, withAlpha(color, state === 'heart_empty' ? 88 : 225));
        drawLine(bitmap, cx + size * 0.26, cy + size * 0.1, cx, cy + size * 0.38, size * 0.13, withAlpha(color, state === 'heart_empty' ? 88 : 225));
        drawOrnateFrame(bitmap, Math.max(2, size * 0.05), color, state === 'heart_empty' ? 90 : 150);
        return;
    }

    if (state === 'gold') {
        bitmap.fillCircle(cx, cy, size * 0.33, withAlpha([242, 181, 83, 255], 230));
        drawStar(bitmap, cx, cy, size * 0.28, [255, 237, 174, 255], 230);
        return;
    }

    if (state === 'deck' || state === 'discard') {
        const w = size * 0.42;
        const h = size * 0.56;
        bitmap.fillRect(cx - w / 2 - 6, cy - h / 2 - 6, w, h, withAlpha(mid, 170));
        bitmap.fillRect(cx - w / 2, cy - h / 2, w, h, withAlpha([36, 27, 24, 255], 225));
        drawOrnateFrame(bitmap, Math.max(2, size * 0.07), accent, 180);
        drawCompass(bitmap, cx, cy, size * 0.18, accent, 145);
        return;
    }

    if (state === 'strike') {
        drawStar(bitmap, cx, cy, size * 0.36, [255, 230, 164, 255], 235);
        return;
    }

    if (state === 'hold') {
        drawCompass(bitmap, cx, cy, size * 0.34, accent, 205);
        return;
    }

    if (state === 'submit') {
        drawGlowLine(bitmap, cx - size * 0.22, cy + size * 0.24, cx, cy - size * 0.24, [255, 92, 82, 255]);
        drawGlowLine(bitmap, cx, cy - size * 0.24, cx + size * 0.22, cy + size * 0.24, [255, 214, 145, 255]);
        return;
    }

    if (state === 'lock') {
        bitmap.fillRect(cx - size * 0.23, cy - size * 0.02, size * 0.46, size * 0.34, withAlpha(accent, 210));
        drawLine(bitmap, cx - size * 0.16, cy - size * 0.02, cx - size * 0.16, cy - size * 0.19, size * 0.06, withAlpha(accent, 180));
        drawLine(bitmap, cx + size * 0.16, cy - size * 0.02, cx + size * 0.16, cy - size * 0.19, size * 0.06, withAlpha(accent, 180));
        drawLine(bitmap, cx - size * 0.16, cy - size * 0.19, cx + size * 0.16, cy - size * 0.19, size * 0.06, withAlpha(accent, 180));
        return;
    }

    if (state === 'multiplier') {
        drawStar(bitmap, cx, cy, size * 0.25, [89, 180, 255, 255], 220);
        drawStar(bitmap, cx, cy, size * 0.13, [255, 102, 86, 255], 200);
        return;
    }

    bitmap.fillCircle(cx, cy, size * 0.3, withAlpha(accent, 225));
}

function getZoneFilledColor(state) {
    if (state.endsWith('_red')) {
        return [255, 84, 84, 255];
    }
    if (state.endsWith('_blue')) {
        return [80, 174, 255, 255];
    }
    if (state.endsWith('_green')) {
        return [94, 226, 148, 255];
    }
    if (state.endsWith('_land')) {
        return [232, 184, 92, 255];
    }

    return [255, 218, 144, 255];
}

function drawZoneFilledOverlay(bitmap, asset) {
    const color = getZoneFilledColor(asset.state);
    const ember = [255, 236, 190, 255];
    const width = bitmap.width;
    const height = bitmap.height;
    const cx = width / 2;
    const cy = height / 2;
    const size = Math.min(width, height);
    const seed = hashString(asset.id);
    const inset = size * 0.115;
    const inner = inset + size * 0.07;
    const sealGold = asset.state.endsWith('_land') ? color : [238, 190, 116, 255];
    const dimColor = mix(color, [8, 7, 12, 255], 0.18);

    bitmap.fillRect(inset, inset, width - inset * 2, height - inset * 2, withAlpha(dimColor, 68));
    bitmap.fillRect(inner, inner, width - inner * 2, height - inner * 2, withAlpha(color, 34));

    for (let y = inner; y < height - inner; y += Math.max(1, size * 0.06)) {
        bitmap.fillRect(inner, y, width - inner * 2, Math.max(1, size * 0.005), withAlpha(ember, 16));
    }
    for (let x = inner; x < width - inner; x += Math.max(1, size * 0.06)) {
        bitmap.fillRect(x, inner, Math.max(1, size * 0.005), height - inner * 2, withAlpha(ember, 14));
    }

    bitmap.fillEllipse(cx, cy, width * 0.36, height * 0.3, withAlpha(color, 58));
    bitmap.fillEllipse(cx + width * 0.08, cy - height * 0.05, width * 0.21, height * 0.18, withAlpha(ember, 28));
    bitmap.fillEllipse(cx - width * 0.08, cy + height * 0.08, width * 0.26, height * 0.16, withAlpha(color, 36));

    drawGlowLine(bitmap, inset, inset, width - inset, inset, sealGold);
    drawGlowLine(bitmap, width - inset, inset, width - inset, height - inset, sealGold);
    drawGlowLine(bitmap, width - inset, height - inset, inset, height - inset, sealGold);
    drawGlowLine(bitmap, inset, height - inset, inset, inset, sealGold);

    for (const [x, y] of [
        [inset, inset],
        [width - inset, inset],
        [inset, height - inset],
        [width - inset, height - inset],
    ]) {
        drawStar(bitmap, x, y, size * 0.085, ember, 205);
    }

    for (let index = 0; index < 4; index += 1) {
        const offset = (index - 1.5) * size * 0.15;
        drawLine(
            bitmap,
            inner + offset,
            height - inner,
            width - inner + offset * 0.4,
            inner,
            Math.max(1.5, size * 0.009),
            withAlpha(color, index === 1 ? 96 : 42),
        );
    }

    drawCompass(bitmap, cx, cy, size * 0.18, ember, 128);
    drawStar(bitmap, cx, cy, size * 0.105, color, 170);

    for (let index = 0; index < 18; index += 1) {
        const x = width * (0.16 + noise01(seed, index * 3) * 0.68);
        const y = height * (0.16 + noise01(seed, index * 3 + 1) * 0.68);
        const dotSize = size * (0.007 + noise01(seed, index * 3 + 2) * 0.012);
        const dotColor = index % 4 === 0 ? ember : index % 3 === 0 ? sealGold : color;
        bitmap.fillCircle(x, y, dotSize, withAlpha(dotColor, 66 + index * 2));
    }
}

function drawPlacementOverlay(bitmap, asset) {
    const width = bitmap.width;
    const height = bitmap.height;
    const size = Math.min(width, height);
    const valid = asset.state === 'valid_cell';
    const color = valid ? [255, 221, 145, 255] : [255, 82, 92, 255];
    const inner = size * 0.14;
    const cx = width / 2;
    const cy = height / 2;

    bitmap.fillRect(inner, inner, width - inner * 2, height - inner * 2, withAlpha(color, valid ? 16 : 42));
    drawCellCornerBrackets(bitmap, color, valid ? 150 : 230, {
        inset: size * 0.12,
        length: size * (valid ? 0.2 : 0.24),
        thickness: size * (valid ? 0.025 : 0.04),
    });

    if (valid) {
        drawCompass(bitmap, cx, cy, size * 0.22, color, 92);
        bitmap.fillEllipse(cx, cy, width * 0.26, height * 0.2, withAlpha([255, 235, 180, 255], 28));
        drawStar(bitmap, cx, cy, size * 0.08, color, 118);
        return;
    }

    drawLine(bitmap, width * 0.25, height * 0.25, width * 0.75, height * 0.75, size * 0.075, withAlpha(color, 220));
    drawLine(bitmap, width * 0.75, height * 0.25, width * 0.25, height * 0.75, size * 0.075, withAlpha(color, 220));
    drawLine(bitmap, width * 0.25, height * 0.25, width * 0.75, height * 0.75, size * 0.028, [255, 218, 190, 230]);
    drawLine(bitmap, width * 0.75, height * 0.25, width * 0.25, height * 0.75, size * 0.028, [255, 218, 190, 230]);
}

function drawCaptureFlashEffect(bitmap) {
    const width = bitmap.width;
    const height = bitmap.height;
    const cx = width / 2;
    const cy = height / 2;
    const size = Math.min(width, height);
    const inset = size * 0.13;
    const warm = [255, 126, 86, 255];
    const white = [255, 244, 215, 255];
    const gold = [242, 184, 100, 255];

    bitmap.fillRect(inset, inset, width - inset * 2, height - inset * 2, withAlpha(warm, 22));
    bitmap.fillEllipse(cx, cy, width * 0.42, height * 0.32, withAlpha(warm, 34));
    bitmap.fillEllipse(cx, cy, width * 0.24, height * 0.2, withAlpha(white, 28));

    drawGlowLine(bitmap, inset, inset, width - inset, inset, white);
    drawGlowLine(bitmap, width - inset, inset, width - inset, height - inset, white);
    drawGlowLine(bitmap, width - inset, height - inset, inset, height - inset, white);
    drawGlowLine(bitmap, inset, height - inset, inset, inset, white);

    drawStar(bitmap, inset, inset, size * 0.12, white, 235);
    drawStar(bitmap, width - inset, inset, size * 0.12, white, 235);
    drawStar(bitmap, inset, height - inset, size * 0.12, white, 235);
    drawStar(bitmap, width - inset, height - inset, size * 0.12, white, 235);

    drawCompass(bitmap, cx, cy, size * 0.2, gold, 150);
    drawStar(bitmap, cx, cy, size * 0.15, white, 210);

    for (let index = 0; index < 8; index += 1) {
        const angle = index * Math.PI * 0.25;
        const inner = size * 0.18;
        const outer = size * (0.28 + (index % 2) * 0.07);
        drawLine(
            bitmap,
            cx + Math.cos(angle) * inner,
            cy + Math.sin(angle) * inner,
            cx + Math.cos(angle) * outer,
            cy + Math.sin(angle) * outer,
            Math.max(1.2, size * 0.011),
            withAlpha(white, 120),
        );
    }

    for (let index = 0; index < 12; index += 1) {
        const x = width * (0.2 + noise01(0x51a1, index * 3) * 0.6);
        const y = height * (0.2 + noise01(0x51a1, index * 3 + 1) * 0.6);
        const dotSize = size * (0.008 + noise01(0x51a1, index * 3 + 2) * 0.014);
        bitmap.fillCircle(x, y, dotSize, withAlpha(index % 3 === 0 ? white : warm, 80 + index * 5));
    }
}

function drawPlaceholder(asset) {
    const [width, height] = asset.size;
    const palette = palettes[asset.category] ?? palettes.ui_chrome;
    const [base, mid, accent] = palette;
    const bitmap = new Bitmap(width, height, asset.alpha !== false);

    if (asset.alpha === false || asset.category === 'screen_background' || asset.category === 'level_backdrop') {
        drawAstralBackground(bitmap, asset);
        return bitmap;
    }

    if (asset.category === 'shop_card') {
        drawShopCardSurface(bitmap, asset);
        return bitmap;
    }

    if (asset.category === 'ui_chrome' || asset.category === 'card_frame') {
        drawPanelSurface(bitmap, asset);
        if (asset.state === 'rare') {
            drawStar(bitmap, width * 0.86, height * 0.18, Math.min(width, height) * 0.08, [91, 177, 255, 255], 210);
        }
        if (asset.state === 'bought') {
            bitmap.fillRect(width * 0.08, height * 0.72, width * 0.84, height * 0.08, [116, 224, 157, 110]);
        }
        return bitmap;
    }

    if (asset.category === 'button') {
        drawButtonSurface(bitmap, asset);
        return bitmap;
    }

    if (asset.category === 'board_cell') {
        drawBoardSurface(bitmap, asset);
        return bitmap;
    }

    if (asset.category === 'slot') {
        drawSlotSurface(bitmap, asset);
        return bitmap;
    }

    if (asset.category === 'monster_portrait' || asset.category === 'monster_icon') {
        drawMonster(bitmap, asset);
        return bitmap;
    }

    if (asset.category === 'icon') {
        drawIconSymbol(bitmap, asset, palette);
        return bitmap;
    }

    if (asset.category === 'overlay' || asset.category === 'effect') {
        const red = asset.state.includes('red') || asset.state.includes('invalid') ? [255, 82, 76, 255] : accent;
        const blue = asset.state.includes('blue') || asset.state.includes('valid') || asset.state.includes('hover') ? [75, 161, 255, 255] : accent;
        const chosen = asset.state.includes('red') || asset.state.includes('invalid') ? red : blue;

        if (asset.state === 'capture_flash') {
            drawCaptureFlashEffect(bitmap);
            return bitmap;
        }

        if (asset.state.includes('zone_filled')) {
            drawZoneFilledOverlay(bitmap, asset);
            return bitmap;
        }

        if (asset.state === 'valid_cell' || asset.state === 'invalid_cell') {
            drawPlacementOverlay(bitmap, asset);
            return bitmap;
        }

        if (asset.state.includes('capture')) {
            bitmap.fillRect(width * 0.08, height * 0.08, width * 0.84, height * 0.84, withAlpha(chosen, 40));
            drawGlowLine(bitmap, width * 0.12, height * 0.12, width * 0.88, height * 0.12, chosen);
            drawGlowLine(bitmap, width * 0.88, height * 0.12, width * 0.88, height * 0.88, chosen);
            drawGlowLine(bitmap, width * 0.88, height * 0.88, width * 0.12, height * 0.88, chosen);
            drawGlowLine(bitmap, width * 0.12, height * 0.88, width * 0.12, height * 0.12, chosen);
            drawStar(bitmap, width / 2, height / 2, Math.min(width, height) * 0.12, chosen, 190);
            return bitmap;
        }

        if (asset.state.includes('target') || asset.state.includes('gate')) {
            drawCompass(bitmap, width / 2, height / 2, Math.min(width, height) * 0.32, chosen, 220);
            drawStar(bitmap, width / 2, height / 2, Math.min(width, height) * 0.14, chosen, 230);
            return bitmap;
        }

        bitmap.fillCircle(width / 2, height / 2, Math.min(width, height) * 0.34, withAlpha(chosen, 90));
        bitmap.fillCircle(width / 2, height / 2, Math.min(width, height) * 0.18, withAlpha(chosen, 135));
        drawStar(bitmap, width / 2, height / 2, Math.min(width, height) * 0.2, chosen, 165);
        return bitmap;
    }

    const inset = Math.max(4, Math.floor(Math.min(width, height) * 0.06));
    bitmap.fillRect(inset, inset, width - inset * 2, height - inset * 2, base);
    bitmap.fillRect(inset * 2, inset * 2, width - inset * 4, height - inset * 4, withAlpha(mid, 135));
    drawCategoryPattern(bitmap, asset, palette);
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
    const assetIds = new Set((process.env.ART_ASSET_IDS ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean));

    const outputDir = path.join(ROOT, manifest.root);
    fs.mkdirSync(outputDir, { recursive: true });

    const assets = assetIds.size > 0
        ? manifest.assets.filter((asset) => assetIds.has(asset.id))
        : manifest.assets;

    if (assetIds.size > 0 && assets.length !== assetIds.size) {
        const knownIds = new Set(assets.map((asset) => asset.id));
        const missingIds = [...assetIds].filter((id) => !knownIds.has(id));
        throw new Error(`Unknown ART_ASSET_IDS: ${missingIds.join(', ')}`);
    }

    for (const asset of assets) {
        const bitmap = drawPlaceholder(asset);
        fs.writeFileSync(path.join(outputDir, asset.file), encodePng(bitmap));
    }

    console.log(`Generated ${assets.length} MVP art placeholders in ${manifest.root}`);
}

main();
