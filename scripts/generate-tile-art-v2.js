import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DIR = path.join(ROOT, 'assets', 'tiles_v2');
const TILE_SIZE = 256;
const SPRITE_COLUMNS = 6;
const PREVIEW_COLUMNS = 6;
const PREVIEW_CELL = { width: 184, height: 216 };
const PREVIEW_TILE_SIZE = 132;

const activeColors = ['red', 'blue', 'green'];

const palette = {
    red: {
        base: [96, 42, 38, 255],
        light: [255, 105, 82, 255],
        dark: [69, 21, 26, 255],
        ink: [48, 15, 19, 255],
        neon: [255, 69, 58, 255],
        core: [255, 238, 207, 255],
        pattern: 'slash',
    },
    blue: {
        base: [35, 73, 126, 255],
        light: [91, 174, 255, 255],
        dark: [16, 38, 84, 255],
        ink: [11, 25, 55, 255],
        neon: [51, 141, 255, 255],
        core: [211, 237, 255, 255],
        pattern: 'bars',
    },
    green: {
        base: [54, 116, 88, 255],
        light: [126, 219, 159, 255],
        dark: [25, 70, 56, 255],
        ink: [17, 47, 39, 255],
        neon: [83, 232, 161, 255],
        core: [219, 255, 235, 255],
        pattern: 'dots',
    },
    gray: {
        base: [91, 80, 70, 255],
        light: [139, 121, 100, 255],
        dark: [45, 41, 39, 255],
        ink: [26, 25, 25, 255],
        neon: [205, 190, 160, 255],
        core: [244, 224, 180, 255],
        pattern: 'grain',
    },
    universal: {
        base: [72, 62, 53, 255],
        light: [239, 198, 119, 255],
        dark: [35, 31, 31, 255],
        ink: [22, 22, 24, 255],
        neon: [239, 198, 119, 255],
        core: [255, 238, 195, 255],
        pattern: 'grain',
    },
};

const patterns = {
    plus: ['.X.', 'XXX', '.X.'],
    line_h: ['...', 'XXX', '...'],
    line_v: ['.X.', '.X.', '.X.'],
    corner_ur: ['.X.', '.XX', '...'],
    corner_rd: ['...', '.XX', '.X.'],
    corner_dl: ['...', 'XX.', '.X.'],
    corner_lu: ['.X.', 'XX.', '...'],
    tee_u: ['.X.', 'XXX', '...'],
    tee_r: ['.X.', '.XX', '.X.'],
    tee_d: ['...', 'XXX', '.X.'],
    tee_l: ['.X.', 'XX.', '.X.'],
};

const blankPattern = ['...', '...', '...'];

const specialPatterns = [
    {
        color: 'universal',
        pattern: 'universal_line_v',
        filename: 'starter_universal_line_v.png',
        matrix: ['.*.', '.*.', '.*.'],
        variantSeed: 97,
    },
];

const font = {
    '0': ['111', '101', '101', '101', '111'],
    '1': ['010', '110', '010', '010', '111'],
    '2': ['111', '001', '111', '100', '111'],
    '3': ['111', '001', '111', '001', '111'],
    a: ['010', '101', '111', '101', '101'],
    b: ['110', '101', '110', '101', '110'],
    c: ['111', '100', '100', '100', '111'],
    d: ['110', '101', '101', '101', '110'],
    e: ['111', '100', '110', '100', '111'],
    g: ['111', '100', '101', '101', '111'],
    h: ['101', '101', '111', '101', '101'],
    i: ['111', '010', '010', '010', '111'],
    l: ['100', '100', '100', '100', '111'],
    n: ['101', '111', '111', '111', '101'],
    o: ['111', '101', '101', '101', '111'],
    p: ['111', '101', '111', '100', '100'],
    r: ['110', '101', '110', '101', '101'],
    s: ['111', '100', '111', '001', '111'],
    t: ['111', '010', '010', '010', '010'],
    u: ['101', '101', '101', '101', '111'],
    v: ['101', '101', '101', '101', '010'],
    y: ['101', '101', '010', '010', '010'],
    _: ['000', '000', '000', '000', '111'],
    ' ': ['000', '000', '000', '000', '000'],
};

class Bitmap {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.data = Buffer.alloc(width * height * 4);
    }

    setPixel(x, y, color) {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
            return;
        }

        const index = (y * this.width + x) * 4;
        const alpha = color[3] / 255;
        const inverse = 1 - alpha;
        this.data[index] = Math.round(color[0] * alpha + this.data[index] * inverse);
        this.data[index + 1] = Math.round(color[1] * alpha + this.data[index + 1] * inverse);
        this.data[index + 2] = Math.round(color[2] * alpha + this.data[index + 2] * inverse);
        this.data[index + 3] = Math.min(255, Math.round(color[3] + this.data[index + 3] * inverse));
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

    paste(source, x, y) {
        for (let sy = 0; sy < source.height; sy += 1) {
            for (let sx = 0; sx < source.width; sx += 1) {
                const index = (sy * source.width + sx) * 4;
                this.setPixel(x + sx, y + sy, [
                    source.data[index],
                    source.data[index + 1],
                    source.data[index + 2],
                    source.data[index + 3],
                ]);
            }
        }
    }

    pasteScaled(source, x, y, size) {
        for (let py = 0; py < size; py += 1) {
            for (let px = 0; px < size; px += 1) {
                const sx = Math.floor(px * source.width / size);
                const sy = Math.floor(py * source.height / size);
                const index = (sy * source.width + sx) * 4;
                this.setPixel(x + px, y + py, [
                    source.data[index],
                    source.data[index + 1],
                    source.data[index + 2],
                    source.data[index + 3],
                ]);
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

function mix(a, b, t) {
    return [
        Math.round(a[0] * (1 - t) + b[0] * t),
        Math.round(a[1] * (1 - t) + b[1] * t),
        Math.round(a[2] * (1 - t) + b[2] * t),
        Math.round(a[3] * (1 - t) + b[3] * t),
    ];
}

function withAlpha(color, alpha) {
    return [color[0], color[1], color[2], alpha];
}

function drawPattern(bitmap, rect, colorKey, seed) {
    const colors = palette[colorKey];
    const { x, y, width, height } = rect;

    if (colors.pattern === 'slash') {
        for (let offset = -height; offset < width + height; offset += 20) {
            const shade = (offset / 20 + seed) % 2 === 0 ? colors.light : colors.dark;
            for (let localY = 0; localY < height; localY += 1) {
                const localX = offset + localY;
                if (localX >= 0 && localX < width - 2) {
                    bitmap.fillRect(x + localX, y + localY, 2, 2, withAlpha(shade, 54));
                }
            }
        }
        return;
    }

    if (colors.pattern === 'bars') {
        for (let py = y + 13 + (seed % 5); py < y + height - 8; py += 20) {
            bitmap.fillRect(x + 9, py, width - 18, 3, withAlpha(colors.light, 68));
            bitmap.fillRect(x + 13, py + 7, width - 26, 2, withAlpha(colors.dark, 44));
        }
        return;
    }

    if (colors.pattern === 'dots') {
        for (let py = y + 13; py < y + height - 8; py += 18) {
            for (let px = x + 11 + ((py + seed * 7) % 12); px < x + width - 8; px += 24) {
                bitmap.fillRect(px, py, 4, 4, withAlpha(colors.light, 72));
                bitmap.fillRect(px + 2, py + 2, 3, 3, withAlpha(colors.dark, 38));
            }
        }
        return;
    }

    for (let py = y + 9; py < y + height - 6; py += 17) {
        for (let px = x + 8 + ((py + seed) % 9); px < x + width - 6; px += 23) {
            bitmap.fillRect(px, py, 3, 3, withAlpha(colors.light, 40));
            bitmap.fillRect(px + 7, py + 7, 2, 2, withAlpha(colors.dark, 42));
        }
    }
}

function cellColor(matrix, colorKey, row, col) {
    if (matrix[row][col] === '*') {
        return 'universal';
    }

    return matrix[row][col] === 'X' ? colorKey : 'gray';
}

function drawCell(bitmap, col, row, colorKey, seed) {
    const bounds = [0, 85, 171, 256];
    const x = bounds[col];
    const y = bounds[row];
    const width = bounds[col + 1] - bounds[col];
    const height = bounds[row + 1] - bounds[row];
    const colors = palette[colorKey];
    const lightBias = ((col * 2 + row + seed) % 3 - 1) * 0.045;
    const base = lightBias >= 0
        ? mix(colors.base, colors.light, lightBias)
        : mix(colors.base, colors.dark, -lightBias);

    bitmap.fillRect(x, y, width, height, base);
    bitmap.fillRect(x, y, width, 2, withAlpha(colors.light, 26));
    bitmap.fillRect(x, y + height - 2, width, 2, withAlpha(colors.dark, 24));
    drawPattern(bitmap, { x, y, width, height }, colorKey, seed + col * 7 + row * 13);
}

function drawUniversalCell(bitmap, col, row, seed) {
    const bounds = [0, 85, 171, 256];
    const x = bounds[col];
    const y = bounds[row];
    const width = bounds[col + 1] - bounds[col];
    const height = bounds[row + 1] - bounds[row];
    const split = Math.floor(width / 2);
    const rightWidth = width - split;
    const redBase = mix(palette.red.base, palette.red.light, 0.04);
    const blueBase = mix(palette.blue.base, palette.blue.light, 0.04);

    bitmap.fillRect(x, y, split, height, redBase);
    bitmap.fillRect(x + split, y, rightWidth, height, blueBase);
    bitmap.fillRect(x, y, width, 2, [255, 255, 255, 30]);
    bitmap.fillRect(x, y + height - 2, width, 2, [0, 0, 0, 30]);
    drawPattern(bitmap, { x, y, width: split, height }, 'red', seed + col * 7 + row * 13);
    drawPattern(bitmap, { x: x + split, y, width: rightWidth, height }, 'blue', seed + col * 11 + row * 17);
    bitmap.fillRect(x + split - 1, y + 7, 2, height - 14, [245, 222, 145, 164]);
}

function drawCellBoundaries(bitmap, matrix, colorKey) {
    const bounds = [0, 85, 171, 256];

    for (let col = 1; col < 3; col += 1) {
        const x = bounds[col];
        for (let row = 0; row < 3; row += 1) {
            const left = cellColor(matrix, colorKey, row, col - 1);
            const right = cellColor(matrix, colorKey, row, col);
            const y = bounds[row];
            const height = bounds[row + 1] - bounds[row];
            const same = left === right;
            bitmap.fillRect(x - (same ? 1 : 2), y, same ? 2 : 4, height, [24, 32, 42, same ? 42 : 104]);
        }
    }

    for (let row = 1; row < 3; row += 1) {
        const y = bounds[row];
        for (let col = 0; col < 3; col += 1) {
            const top = cellColor(matrix, colorKey, row - 1, col);
            const bottom = cellColor(matrix, colorKey, row, col);
            const x = bounds[col];
            const width = bounds[col + 1] - bounds[col];
            const same = top === bottom;
            bitmap.fillRect(x, y - (same ? 1 : 2), width, same ? 2 : 4, [24, 32, 42, same ? 42 : 104]);
        }
    }
}

function drawActiveRidge(bitmap, matrix, colorKey) {
    const bounds = [0, 85, 171, 256];
    const colors = palette[colorKey];

    for (let row = 0; row < 3; row += 1) {
        for (let col = 0; col < 3; col += 1) {
            if (matrix[row][col] !== 'X' && matrix[row][col] !== '*') {
                continue;
            }

            const x = bounds[col];
            const y = bounds[row];
            const width = bounds[col + 1] - bounds[col];
            const height = bounds[row + 1] - bounds[row];

            if (matrix[row][col] === '*') {
                const split = Math.floor(width / 2);
                bitmap.fillRect(x + 8, y + 8, split - 10, 3, withAlpha(palette.red.light, 58));
                bitmap.fillRect(x + split + 2, y + 8, width - split - 10, 3, withAlpha(palette.blue.light, 58));
                bitmap.fillRect(x + 8, y + height - 11, split - 10, 3, withAlpha(palette.red.dark, 46));
                bitmap.fillRect(x + split + 2, y + height - 11, width - split - 10, 3, withAlpha(palette.blue.dark, 46));
                bitmap.fillRect(x + 8, y + 8, 3, height - 16, withAlpha(palette.red.light, 34));
                bitmap.fillRect(x + width - 11, y + 8, 3, height - 16, withAlpha(palette.blue.dark, 38));
                continue;
            }

            bitmap.fillRect(x + 8, y + 8, width - 16, 3, withAlpha(colors.light, 50));
            bitmap.fillRect(x + 8, y + height - 11, width - 16, 3, withAlpha(colors.dark, 46));
            bitmap.fillRect(x + 8, y + 8, 3, height - 16, withAlpha(colors.light, 30));
            bitmap.fillRect(x + width - 11, y + 8, 3, height - 16, withAlpha(colors.dark, 34));
        }
    }
}

function drawThinLine(bitmap, x1, y1, x2, y2, thickness, color) {
    if (Math.abs(x1 - x2) < 0.001) {
        const y = Math.min(y1, y2);
        bitmap.fillRect(x1 - thickness / 2, y, thickness, Math.abs(y2 - y1), color);
        bitmap.fillCircle(x1, y1, thickness / 2, color);
        bitmap.fillCircle(x2, y2, thickness / 2, color);
        return;
    }

    if (Math.abs(y1 - y2) < 0.001) {
        const x = Math.min(x1, x2);
        bitmap.fillRect(x, y1 - thickness / 2, Math.abs(x2 - x1), thickness, color);
        bitmap.fillCircle(x1, y1, thickness / 2, color);
        bitmap.fillCircle(x2, y2, thickness / 2, color);
    }
}

function drawNeonLine(bitmap, x1, y1, x2, y2, colorKey) {
    const colors = palette[colorKey] ?? palette.universal;
    drawThinLine(bitmap, x1, y1, x2, y2, 42, withAlpha(colors.ink, 118));
    drawThinLine(bitmap, x1, y1, x2, y2, 62, withAlpha(colors.neon, 28));
    drawThinLine(bitmap, x1, y1, x2, y2, 46, withAlpha(colors.neon, 48));
    drawThinLine(bitmap, x1, y1, x2, y2, 32, withAlpha(colors.neon, 92));
    drawThinLine(bitmap, x1, y1, x2, y2, 22, withAlpha(colors.neon, 165));
    drawThinLine(bitmap, x1, y1, x2, y2, 15, withAlpha(colors.neon, 255));
    drawThinLine(bitmap, x1, y1, x2, y2, 8, withAlpha(colors.core, 245));
    drawThinLine(bitmap, x1, y1, x2, y2, 3, withAlpha(colors.core, 255));
}

function drawWardNode(bitmap, cx, cy, colorKey) {
    const colors = palette[colorKey] ?? palette.universal;
    bitmap.fillCircle(cx, cy, 25, withAlpha(colors.neon, 36));
    bitmap.fillCircle(cx, cy, 17, withAlpha(colors.neon, 92));
    bitmap.fillCircle(cx, cy, 10, withAlpha(colors.neon, 210));
    bitmap.fillCircle(cx, cy, 4, withAlpha(colors.core, 250));
    drawThinLine(bitmap, cx - 13, cy, cx + 13, cy, 2, withAlpha(colors.core, 150));
    drawThinLine(bitmap, cx, cy - 13, cx, cy + 13, 2, withAlpha(colors.core, 150));
}

function drawStoneGrid(bitmap, seed) {
    const base = [84, 73, 64, 255];
    const warm = [112, 94, 74, 255];
    const cool = [48, 48, 52, 255];

    for (let y = 0; y < TILE_SIZE; y += 1) {
        const t = y / (TILE_SIZE - 1);
        bitmap.fillRect(0, y, TILE_SIZE, 1, mix(base, cool, t * 0.4));
    }

    for (let i = 0; i < 42; i += 1) {
        const x = (seed * 31 + i * 47) % (TILE_SIZE - 28);
        const y = (seed * 19 + i * 29) % (TILE_SIZE - 28);
        const size = 3 + ((seed + i * 7) % 8);
        bitmap.fillRect(x + 14, y + 14, size, size, withAlpha(i % 3 === 0 ? warm : cool, 25 + (i % 4) * 8));
    }

    for (let line = 28; line < TILE_SIZE - 20; line += 28) {
        bitmap.fillRect(18, line, TILE_SIZE - 36, 1, [33, 31, 31, 92]);
        bitmap.fillRect(line, 18, 1, TILE_SIZE - 36, [33, 31, 31, 88]);
    }

    const bounds = [0, 85, 171, 256];
    for (let index = 1; index < 3; index += 1) {
        const point = bounds[index];
        bitmap.fillRect(18, point - 1, TILE_SIZE - 36, 2, [31, 26, 24, 124]);
        bitmap.fillRect(point - 1, 18, 2, TILE_SIZE - 36, [31, 26, 24, 124]);
        bitmap.fillRect(18, point + 1, TILE_SIZE - 36, 1, [148, 125, 92, 54]);
        bitmap.fillRect(point + 1, 18, 1, TILE_SIZE - 36, [148, 125, 92, 48]);
    }
}

function drawBrassFrame(bitmap, colorKey) {
    const brass = [212, 160, 87, 255];
    const brassDark = [79, 51, 32, 255];
    const shadow = [12, 13, 16, 255];
    const accent = palette[colorKey]?.neon ?? brass;

    bitmap.fillRect(0, 0, TILE_SIZE, 8, shadow);
    bitmap.fillRect(0, TILE_SIZE - 8, TILE_SIZE, 8, shadow);
    bitmap.fillRect(0, 0, 8, TILE_SIZE, shadow);
    bitmap.fillRect(TILE_SIZE - 8, 0, 8, TILE_SIZE, shadow);
    bitmap.fillRect(8, 8, TILE_SIZE - 16, 4, brassDark);
    bitmap.fillRect(8, TILE_SIZE - 12, TILE_SIZE - 16, 4, brassDark);
    bitmap.fillRect(8, 8, 4, TILE_SIZE - 16, brassDark);
    bitmap.fillRect(TILE_SIZE - 12, 8, 4, TILE_SIZE - 16, brassDark);
    bitmap.fillRect(13, 13, TILE_SIZE - 26, 2, withAlpha(brass, 190));
    bitmap.fillRect(13, TILE_SIZE - 15, TILE_SIZE - 26, 2, withAlpha(brass, 116));
    bitmap.fillRect(13, 13, 2, TILE_SIZE - 26, withAlpha(brass, 116));
    bitmap.fillRect(TILE_SIZE - 15, 13, 2, TILE_SIZE - 26, withAlpha(brass, 116));
    bitmap.fillRect(TILE_SIZE / 2 - 5, TILE_SIZE - 12, 10, 10, withAlpha(accent, 180));
}

function isActiveSymbol(symbol) {
    return symbol === 'X' || symbol === '*';
}

function getCellCenter(col, row) {
    const bounds = [0, 85, 171, 256];

    return {
        x: (bounds[col] + bounds[col + 1]) / 2,
        y: (bounds[row] + bounds[row + 1]) / 2,
    };
}

function drawPathForMatrix(bitmap, matrix, colorKey, offsetX = 0) {
    for (let row = 0; row < 3; row += 1) {
        for (let col = 0; col < 3; col += 1) {
            if (!isActiveSymbol(matrix[row][col])) {
                continue;
            }

            const center = getCellCenter(col, row);
            const cx = center.x + offsetX;
            const cy = center.y;

            if (col < 2 && isActiveSymbol(matrix[row][col + 1])) {
                const right = getCellCenter(col + 1, row);
                drawNeonLine(bitmap, cx, cy, right.x + offsetX, right.y, colorKey);
            }

            if (row < 2 && isActiveSymbol(matrix[row + 1][col])) {
                const down = getCellCenter(col, row + 1);
                drawNeonLine(bitmap, cx, cy, down.x + offsetX, down.y, colorKey);
            }

            if (col === 0) {
                drawNeonLine(bitmap, 8 + offsetX, cy, cx, cy, colorKey);
            }
            if (col === 2) {
                drawNeonLine(bitmap, cx, cy, TILE_SIZE - 8 + offsetX, cy, colorKey);
            }
            if (row === 0) {
                drawNeonLine(bitmap, cx, 8, cx, cy, colorKey);
            }
            if (row === 2) {
                drawNeonLine(bitmap, cx, cy, cx, TILE_SIZE - 8, colorKey);
            }

            drawWardNode(bitmap, cx, cy, colorKey);
        }
    }
}

function drawCompassRune(bitmap, colorKey) {
    const colors = palette[colorKey] ?? palette.universal;
    const cx = TILE_SIZE / 2;
    const cy = TILE_SIZE / 2;
    bitmap.fillCircle(cx, cy, 15, withAlpha(colors.neon, 30));
    drawThinLine(bitmap, cx - 18, cy, cx + 18, cy, 2, withAlpha(colors.core, 118));
    drawThinLine(bitmap, cx, cy - 18, cx, cy + 18, 2, withAlpha(colors.core, 118));
    bitmap.fillRect(cx - 4, cy - 4, 8, 8, withAlpha(colors.core, 170));
}

function drawTile(matrix, colorKey, seed = 0) {
    const bitmap = new Bitmap(TILE_SIZE, TILE_SIZE);

    drawStoneGrid(bitmap, seed);

    if (colorKey === 'universal') {
        drawPathForMatrix(bitmap, matrix, 'red', -5);
        drawPathForMatrix(bitmap, matrix, 'blue', 5);
        drawThinLine(bitmap, TILE_SIZE / 2, 20, TILE_SIZE / 2, TILE_SIZE - 20, 2, [235, 195, 116, 168]);
        drawCompassRune(bitmap, 'universal');
    } else if (colorKey !== 'gray') {
        drawPathForMatrix(bitmap, matrix, colorKey);
        drawCompassRune(bitmap, colorKey);
    } else {
        bitmap.fillCircle(TILE_SIZE / 2, TILE_SIZE / 2, 19, [190, 168, 126, 28]);
    }

    drawBrassFrame(bitmap, colorKey);

    return bitmap;
}

function drawText(bitmap, text, x, y, scale = 2, color = [236, 244, 250, 255]) {
    let cursor = x;
    for (const char of text.toLowerCase()) {
        const glyph = font[char] ?? font[' '];
        for (let row = 0; row < glyph.length; row += 1) {
            for (let col = 0; col < glyph[row].length; col += 1) {
                if (glyph[row][col] === '1') {
                    bitmap.fillRect(cursor + col * scale, y + row * scale, scale, scale, color);
                }
            }
        }
        cursor += 4 * scale;
    }
}

function textWidth(text, scale = 2) {
    return text.length * 4 * scale - scale;
}

function drawCenteredText(bitmap, text, centerX, y, scale = 2, color) {
    drawText(bitmap, text, Math.round(centerX - textWidth(text, scale) / 2), y, scale, color);
}

function edgeSignature(matrix, side, colorKey) {
    const expanded = matrix.map((row) => row.replaceAll('X', colorKey[0]).replaceAll('.', 'g'));
    if (side === 'top') {
        return expanded[0];
    }
    if (side === 'right') {
        return `${expanded[0][2]}${expanded[1][2]}${expanded[2][2]}`;
    }
    if (side === 'bottom') {
        return expanded[2];
    }
    return `${expanded[0][0]}${expanded[1][0]}${expanded[2][0]}`;
}

function buildEntries() {
    const entries = [];

    for (const color of activeColors) {
        for (const [name, matrix] of Object.entries(patterns)) {
            entries.push({
                color,
                pattern: name,
                filename: `tile_${color}_${name}.png`,
                matrix,
            });
        }
    }

    for (let i = 1; i <= 3; i += 1) {
        entries.push({
            color: 'gray',
            pattern: `blank_${String(i).padStart(2, '0')}`,
            filename: `tile_gray_blank_${String(i).padStart(2, '0')}.png`,
            matrix: blankPattern,
            variantSeed: i * 23,
        });
    }

    return entries;
}

function buildSpecialEntries() {
    return specialPatterns.map((entry) => ({ ...entry }));
}

function writeBitmap(filename, bitmap) {
    fs.writeFileSync(path.join(OUT_DIR, filename), encodePng(bitmap));
}

function createPreview(entries) {
    const rows = Math.ceil(entries.length / PREVIEW_COLUMNS);
    const bitmap = new Bitmap(PREVIEW_COLUMNS * PREVIEW_CELL.width, rows * PREVIEW_CELL.height);
    bitmap.fillRect(0, 0, bitmap.width, bitmap.height, [9, 14, 21, 255]);

    entries.forEach((entry, index) => {
        const col = index % PREVIEW_COLUMNS;
        const row = Math.floor(index / PREVIEW_COLUMNS);
        const x = col * PREVIEW_CELL.width;
        const y = row * PREVIEW_CELL.height;
        const tileX = x + Math.round((PREVIEW_CELL.width - PREVIEW_TILE_SIZE) / 2);
        const tileY = y + 18;
        bitmap.fillRect(x + 8, y + 8, PREVIEW_CELL.width - 16, PREVIEW_CELL.height - 16, [18, 27, 38, 255]);
        bitmap.pasteScaled(entry.bitmap, tileX, tileY, PREVIEW_TILE_SIZE);
        drawCenteredText(bitmap, entry.color, x + PREVIEW_CELL.width / 2, y + 158, 3, palette[entry.color].light);
        drawCenteredText(bitmap, entry.pattern, x + PREVIEW_CELL.width / 2, y + 182, 2, [214, 225, 235, 255]);
    });

    return bitmap;
}

function createSpriteSheet(entries) {
    const bitmap = new Bitmap(TILE_SIZE * SPRITE_COLUMNS, TILE_SIZE * SPRITE_COLUMNS);
    entries.forEach((entry, index) => {
        const col = index % SPRITE_COLUMNS;
        const row = Math.floor(index / SPRITE_COLUMNS);
        bitmap.paste(entry.bitmap, col * TILE_SIZE, row * TILE_SIZE);
    });
    return bitmap;
}

function createManifest(entries) {
    return {
        source: 'scripts/generate-tile-art-v2.js',
        brief: 'design/tile-art-brief.md',
        tileSetVersion: 'v2_capture_boundary',
        tileSize: TILE_SIZE,
        columnsInSpriteSheet: SPRITE_COLUMNS,
        semantics: {
            red: 'combat boundary; captures enclosed area',
            blue: 'combat boundary; captures enclosed area',
            green: 'combat boundary; captures enclosed area',
            gray: 'neutral land; matches edges but deals no damage',
        },
        tiles: entries.map((entry, index) => ({
            id: entry.filename.replace('.png', ''),
            file: entry.filename,
            spriteIndex: index,
            color: entry.color,
            pattern: entry.pattern,
            matrix: entry.matrix,
            edges: {
                top: edgeSignature(entry.matrix, 'top', entry.color),
                right: edgeSignature(entry.matrix, 'right', entry.color),
                bottom: edgeSignature(entry.matrix, 'bottom', entry.color),
                left: edgeSignature(entry.matrix, 'left', entry.color),
            },
        })),
    };
}

function parsePngHeader(buffer) {
    return {
        width: buffer.readUInt32BE(16),
        height: buffer.readUInt32BE(20),
        colorType: buffer[25],
    };
}

function validate(entries, specialEntries = []) {
    const expectedFiles = new Set([
        ...entries.map((entry) => entry.filename),
        ...specialEntries.map((entry) => entry.filename),
        'tile_sprite_sheet_6x6.png',
        'tile_contact_sheet.png',
        'tile_manifest.json',
    ]);
    const existingFiles = fs.readdirSync(OUT_DIR).filter((file) => !file.startsWith('.'));

    for (const file of expectedFiles) {
        if (!existingFiles.includes(file)) {
            throw new Error(`Missing generated file: ${file}`);
        }
    }

    for (const entry of [...entries, ...specialEntries]) {
        const header = parsePngHeader(fs.readFileSync(path.join(OUT_DIR, entry.filename)));
        if (header.width !== TILE_SIZE || header.height !== TILE_SIZE || header.colorType !== 6) {
            throw new Error(`Bad PNG metadata for ${entry.filename}`);
        }
    }

    const forbidden = ['dot', 'cap_l', 'cap_r', 'cap_u', 'cap_d'];
    for (const entry of entries) {
        if (forbidden.includes(entry.pattern)) {
            throw new Error(`Forbidden v1 pattern leaked into v2: ${entry.pattern}`);
        }
    }

    for (const color of activeColors) {
        const colorEntries = entries.filter((entry) => entry.color === color);
        for (const patternName of Object.keys(patterns)) {
            if (!colorEntries.some((entry) => entry.pattern === patternName)) {
                throw new Error(`Missing ${color} ${patternName}`);
            }
        }
    }

    const grayEntries = entries.filter((entry) => entry.color === 'gray');
    if (grayEntries.length !== 3) {
        throw new Error('Expected exactly three gray blanks');
    }

    return {
        tileFiles: entries.length,
        specialFiles: specialEntries.length,
        previewFiles: 2,
        manifestFiles: 1,
    };
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const entries = buildEntries().map((entry, index) => ({
    ...entry,
    bitmap: drawTile(entry.matrix, entry.color, entry.variantSeed ?? index + 1),
}));
const specialEntries = buildSpecialEntries().map((entry, index) => ({
    ...entry,
    bitmap: drawTile(entry.matrix, entry.color, entry.variantSeed ?? entries.length + index + 1),
}));

for (const entry of entries) {
    writeBitmap(entry.filename, entry.bitmap);
}

for (const entry of specialEntries) {
    writeBitmap(entry.filename, entry.bitmap);
}

writeBitmap('tile_sprite_sheet_6x6.png', createSpriteSheet(entries));
writeBitmap('tile_contact_sheet.png', createPreview(entries));
fs.writeFileSync(
    path.join(OUT_DIR, 'tile_manifest.json'),
    `${JSON.stringify(createManifest(entries), null, 2)}\n`,
);

const result = validate(entries, specialEntries);
console.log(`Generated ${result.tileFiles} v2 tile PNGs, ${result.specialFiles} special tile PNG, ${result.previewFiles} sheets, and ${result.manifestFiles} manifest.`);
