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

function drawSoftCircle(bitmap, cx, cy, radius, color, falloff = 1.65) {
    const x0 = Math.floor(cx - radius);
    const y0 = Math.floor(cy - radius);
    const x1 = Math.ceil(cx + radius);
    const y1 = Math.ceil(cy + radius);

    for (let y = y0; y <= y1; y += 1) {
        for (let x = x0; x <= x1; x += 1) {
            const dx = x - cx;
            const dy = y - cy;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > radius) {
                continue;
            }

            const alpha = Math.round(color[3] * Math.pow(1 - distance / radius, falloff));
            if (alpha > 0) {
                bitmap.setPixel(x, y, [color[0], color[1], color[2], alpha]);
            }
        }
    }
}

function drawDiamond(bitmap, cx, cy, radius, color) {
    for (let y = -radius; y <= radius; y += 1) {
        const halfWidth = radius - Math.abs(y);
        bitmap.fillRect(cx - halfWidth, cy + y, halfWidth * 2 + 1, 1, color);
    }
}

function drawSampledLine(bitmap, x1, y1, x2, y2, radius, color, soft = true) {
    const length = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(1, Math.ceil(length / Math.max(1.6, radius * 0.36)));

    for (let step = 0; step <= steps; step += 1) {
        const t = step / steps;
        const x = x1 * (1 - t) + x2 * t;
        const y = y1 * (1 - t) + y2 * t;
        if (soft) {
            drawSoftCircle(bitmap, x, y, radius, color);
        } else {
            bitmap.fillCircle(x, y, radius, color);
        }
    }
}

function drawSampledQuadratic(bitmap, x1, y1, cx, cy, x2, y2, radius, color, soft = true) {
    const length = Math.hypot(cx - x1, cy - y1) + Math.hypot(x2 - cx, y2 - cy);
    const steps = Math.max(12, Math.ceil(length / Math.max(1.6, radius * 0.34)));

    for (let step = 0; step <= steps; step += 1) {
        const t = step / steps;
        const a = (1 - t) * (1 - t);
        const b = 2 * (1 - t) * t;
        const c = t * t;
        const x = a * x1 + b * cx + c * x2;
        const y = a * y1 + b * cy + c * y2;
        if (soft) {
            drawSoftCircle(bitmap, x, y, radius, color);
        } else {
            bitmap.fillCircle(x, y, radius, color);
        }
    }
}

function drawNeonLine(bitmap, x1, y1, x2, y2, colorKey) {
    const colors = palette[colorKey] ?? palette.universal;
    drawSampledLine(bitmap, x1, y1, x2, y2, 28, withAlpha(colors.ink, 132), false);
    drawSampledLine(bitmap, x1, y1, x2, y2, 42, withAlpha(colors.neon, 38));
    drawSampledLine(bitmap, x1, y1, x2, y2, 30, withAlpha(colors.neon, 64));
    drawSampledLine(bitmap, x1, y1, x2, y2, 20, withAlpha(colors.neon, 118));
    drawSampledLine(bitmap, x1, y1, x2, y2, 13, withAlpha(colors.neon, 236), false);
    drawSampledLine(bitmap, x1, y1, x2, y2, 7, withAlpha(colors.core, 255), false);
    drawSampledLine(bitmap, x1, y1, x2, y2, 3, withAlpha(colors.core, 255), false);
}

function drawNeonCurve(bitmap, x1, y1, cx, cy, x2, y2, colorKey) {
    const colors = palette[colorKey] ?? palette.universal;
    drawSampledQuadratic(bitmap, x1, y1, cx, cy, x2, y2, 28, withAlpha(colors.ink, 132), false);
    drawSampledQuadratic(bitmap, x1, y1, cx, cy, x2, y2, 42, withAlpha(colors.neon, 38));
    drawSampledQuadratic(bitmap, x1, y1, cx, cy, x2, y2, 30, withAlpha(colors.neon, 64));
    drawSampledQuadratic(bitmap, x1, y1, cx, cy, x2, y2, 20, withAlpha(colors.neon, 118));
    drawSampledQuadratic(bitmap, x1, y1, cx, cy, x2, y2, 13, withAlpha(colors.neon, 236), false);
    drawSampledQuadratic(bitmap, x1, y1, cx, cy, x2, y2, 7, withAlpha(colors.core, 255), false);
    drawSampledQuadratic(bitmap, x1, y1, cx, cy, x2, y2, 3, withAlpha(colors.core, 255), false);
}

function drawWardSpark(bitmap, cx, cy, colorKey, scale = 1) {
    const colors = palette[colorKey] ?? palette.universal;
    drawSoftCircle(bitmap, cx, cy, 23 * scale, withAlpha(colors.neon, 78));
    drawDiamond(bitmap, Math.round(cx), Math.round(cy), Math.round(7 * scale), withAlpha(colors.core, 224));
    drawDiamond(bitmap, Math.round(cx), Math.round(cy), Math.round(4 * scale), withAlpha(colors.core, 255));
    drawThinLine(bitmap, cx - 17 * scale, cy, cx + 17 * scale, cy, Math.max(1, 2 * scale), withAlpha(colors.core, 160));
    drawThinLine(bitmap, cx, cy - 17 * scale, cx, cy + 17 * scale, Math.max(1, 2 * scale), withAlpha(colors.core, 160));
}

function drawStoneGrid(bitmap, seed) {
    const base = [76, 66, 57, 255];
    const warm = [126, 101, 72, 255];
    const cool = [39, 40, 45, 255];
    const panelWarm = [96, 80, 64, 255];

    for (let y = 0; y < TILE_SIZE; y += 1) {
        const t = y / (TILE_SIZE - 1);
        bitmap.fillRect(0, y, TILE_SIZE, 1, mix(mix(base, panelWarm, 0.18), cool, t * 0.46));
    }

    for (let i = 0; i < 62; i += 1) {
        const x = (seed * 31 + i * 47) % (TILE_SIZE - 28);
        const y = (seed * 19 + i * 29) % (TILE_SIZE - 28);
        const size = 2 + ((seed + i * 7) % 7);
        bitmap.fillRect(x + 14, y + 14, size, size, withAlpha(i % 3 === 0 ? warm : cool, 18 + (i % 5) * 7));
    }

    for (let line = 30; line < TILE_SIZE - 22; line += 28) {
        bitmap.fillRect(20, line, TILE_SIZE - 40, 1, [26, 25, 25, 84]);
        bitmap.fillRect(line, 20, 1, TILE_SIZE - 40, [26, 25, 25, 80]);
        bitmap.fillRect(20, line + 1, TILE_SIZE - 40, 1, [137, 113, 82, 22]);
        bitmap.fillRect(line + 1, 20, 1, TILE_SIZE - 40, [137, 113, 82, 20]);
    }

    const bounds = [0, 85, 171, 256];
    for (let index = 1; index < 3; index += 1) {
        const point = bounds[index];
        bitmap.fillRect(18, point - 2, TILE_SIZE - 36, 3, [25, 21, 20, 132]);
        bitmap.fillRect(point - 2, 18, 3, TILE_SIZE - 36, [25, 21, 20, 132]);
        bitmap.fillRect(18, point + 1, TILE_SIZE - 36, 1, [165, 132, 87, 62]);
        bitmap.fillRect(point + 1, 18, 1, TILE_SIZE - 36, [165, 132, 87, 58]);
    }

    for (let inset = 18; inset < 34; inset += 3) {
        const alpha = 34 - inset;
        bitmap.fillRect(inset, inset, TILE_SIZE - inset * 2, 1, [196, 155, 94, alpha]);
        bitmap.fillRect(inset, TILE_SIZE - inset - 1, TILE_SIZE - inset * 2, 1, [12, 11, 12, alpha + 16]);
        bitmap.fillRect(inset, inset, 1, TILE_SIZE - inset * 2, [196, 155, 94, Math.round(alpha * 0.7)]);
        bitmap.fillRect(TILE_SIZE - inset - 1, inset, 1, TILE_SIZE - inset * 2, [12, 11, 12, alpha + 12]);
    }
}

function drawBrassFrame(bitmap, colorKey) {
    const brass = [212, 160, 87, 255];
    const brassLight = [255, 210, 128, 255];
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
    bitmap.fillRect(13, 13, TILE_SIZE - 26, 2, withAlpha(brassLight, 178));
    bitmap.fillRect(13, TILE_SIZE - 15, TILE_SIZE - 26, 2, withAlpha(brass, 116));
    bitmap.fillRect(13, 13, 2, TILE_SIZE - 26, withAlpha(brass, 124));
    bitmap.fillRect(TILE_SIZE - 15, 13, 2, TILE_SIZE - 26, withAlpha(brass, 108));
    bitmap.fillRect(22, 22, TILE_SIZE - 44, 2, withAlpha(brassDark, 130));
    bitmap.fillRect(22, TILE_SIZE - 24, TILE_SIZE - 44, 2, withAlpha(brassDark, 130));
    bitmap.fillRect(22, 22, 2, TILE_SIZE - 44, withAlpha(brassDark, 130));
    bitmap.fillRect(TILE_SIZE - 24, 22, 2, TILE_SIZE - 44, withAlpha(brassDark, 130));

    for (const corner of [[19, 19], [TILE_SIZE - 20, 19], [19, TILE_SIZE - 20], [TILE_SIZE - 20, TILE_SIZE - 20]]) {
        drawDiamond(bitmap, corner[0], corner[1], 6, withAlpha(brassLight, 135));
        drawDiamond(bitmap, corner[0], corner[1], 3, withAlpha(brassDark, 160));
    }

    drawDiamond(bitmap, TILE_SIZE / 2, TILE_SIZE - 11, 7, withAlpha(accent, 174));
    drawDiamond(bitmap, TILE_SIZE / 2, TILE_SIZE - 11, 3, withAlpha(palette[colorKey]?.core ?? brassLight, 210));
}

const pathPoints = {
    center: { x: TILE_SIZE / 2, y: TILE_SIZE / 2 },
    top: { x: TILE_SIZE / 2, y: 9 },
    right: { x: TILE_SIZE - 9, y: TILE_SIZE / 2 },
    bottom: { x: TILE_SIZE / 2, y: TILE_SIZE - 9 },
    left: { x: 9, y: TILE_SIZE / 2 },
};

function drawWardEndpoints(bitmap, colorKey, exits) {
    for (const exit of exits) {
        const point = pathPoints[exit];
        drawWardSpark(bitmap, point.x, point.y, colorKey, 0.55);
    }
}

function drawPathMotifs(bitmap, colorKey, seed) {
    const colors = palette[colorKey] ?? palette.universal;
    for (let i = 0; i < 5; i += 1) {
        const x = 40 + ((seed * 41 + i * 53) % 176);
        const y = 40 + ((seed * 29 + i * 61) % 176);
        const alpha = 34 + (i % 2) * 26;
        drawDiamond(bitmap, x, y, 2 + (i % 2), withAlpha(colors.core, alpha));
    }
}

function drawRoundedElbow(bitmap, colorKey, from, to) {
    const p = pathPoints;
    const radius = TILE_SIZE * 0.18;
    const cx = p.center.x;
    const cy = p.center.y;

    const bend = {
        top: { x: cx, y: cy - radius },
        right: { x: cx + radius, y: cy },
        bottom: { x: cx, y: cy + radius },
        left: { x: cx - radius, y: cy },
    };

    drawNeonLine(bitmap, p[from].x, p[from].y, bend[from].x, bend[from].y, colorKey);
    drawNeonCurve(bitmap, bend[from].x, bend[from].y, cx, cy, bend[to].x, bend[to].y, colorKey);
    drawNeonLine(bitmap, bend[to].x, bend[to].y, p[to].x, p[to].y, colorKey);
}

function drawRoundedTee(bitmap, colorKey, trunk, armA, armB) {
    const p = pathPoints;

    if ((armA === 'left' && armB === 'right') || (armA === 'right' && armB === 'left')) {
        drawNeonLine(bitmap, p.left.x, p.left.y, p.right.x, p.right.y, colorKey);
    } else {
        drawNeonLine(bitmap, p.top.x, p.top.y, p.bottom.x, p.bottom.y, colorKey);
    }

    drawRoundedElbow(bitmap, colorKey, trunk, armA);
    drawRoundedElbow(bitmap, colorKey, trunk, armB);
}

function drawUniversalGradientColumn(bitmap) {
    const p = pathPoints;
    const red = palette.red;
    const blue = palette.blue;
    const violet = [190, 83, 255, 255];
    const gold = [245, 198, 116, 255];
    const white = [255, 244, 220, 255];
    const cx = p.center.x;
    const y1 = p.top.y;
    const y2 = p.bottom.y;

    const drawBand = (radius, alpha, brighten = 0) => {
        const x0 = Math.floor(cx - radius);
        const x1 = Math.ceil(cx + radius);
        for (let y = Math.floor(y1); y <= Math.ceil(y2); y += 1) {
            for (let x = x0; x <= x1; x += 1) {
                const dx = Math.abs(x - cx) / radius;
                if (dx > 1) {
                    continue;
                }

                const side = (x - (cx - radius)) / (radius * 2);
                const sideColor = side < 0.5
                    ? mix(red.neon, violet, side * 2)
                    : mix(violet, blue.neon, (side - 0.5) * 2);
                const centerGlow = Math.max(0, 1 - Math.abs(side - 0.5) * 4);
                const color = mix(sideColor, brighten > 0.5 ? white : gold, centerGlow * brighten);
                const falloff = Math.pow(1 - dx, 1.35);
                bitmap.setPixel(x, y, withAlpha(color, Math.round(alpha * falloff)));
            }
        }
    };

    drawBand(50, 34, 0.08);
    drawBand(36, 72, 0.1);
    drawBand(25, 136, 0.14);
    drawBand(18, 220, 0.2);
    drawBand(9, 225, 0.42);

    drawThinLine(bitmap, cx, y1 + 14, cx, y2 - 14, 2, withAlpha(gold, 132));
    drawThinLine(bitmap, cx - 15, y1, cx - 15, y2, 5, withAlpha(red.core, 206));
    drawThinLine(bitmap, cx + 15, y1, cx + 15, y2, 5, withAlpha(blue.core, 226));
    drawThinLine(bitmap, cx - 19, y1 + 4, cx - 19, y2 - 4, 2, withAlpha(red.neon, 160));
    drawThinLine(bitmap, cx + 19, y1 + 4, cx + 19, y2 - 4, 2, withAlpha(blue.neon, 180));
    drawWardSpark(bitmap, cx - 14, y1, 'red', 0.5);
    drawWardSpark(bitmap, cx + 14, y1, 'blue', 0.5);
    drawWardSpark(bitmap, cx - 14, y2, 'red', 0.5);
    drawWardSpark(bitmap, cx + 14, y2, 'blue', 0.5);
}

function drawWardPath(bitmap, colorKey, pattern, seed) {
    const p = pathPoints;

    if (pattern === 'line_h') {
        drawNeonLine(bitmap, p.left.x, p.left.y, p.right.x, p.right.y, colorKey);
        drawWardEndpoints(bitmap, colorKey, ['left', 'right']);
    } else if (pattern === 'line_v') {
        drawNeonLine(bitmap, p.top.x, p.top.y, p.bottom.x, p.bottom.y, colorKey);
        drawWardEndpoints(bitmap, colorKey, ['top', 'bottom']);
    } else if (pattern === 'corner_ur') {
        drawRoundedElbow(bitmap, colorKey, 'top', 'right');
        drawWardEndpoints(bitmap, colorKey, ['top', 'right']);
    } else if (pattern === 'corner_rd') {
        drawRoundedElbow(bitmap, colorKey, 'right', 'bottom');
        drawWardEndpoints(bitmap, colorKey, ['right', 'bottom']);
    } else if (pattern === 'corner_dl') {
        drawRoundedElbow(bitmap, colorKey, 'bottom', 'left');
        drawWardEndpoints(bitmap, colorKey, ['bottom', 'left']);
    } else if (pattern === 'corner_lu') {
        drawRoundedElbow(bitmap, colorKey, 'left', 'top');
        drawWardEndpoints(bitmap, colorKey, ['left', 'top']);
    } else if (pattern === 'tee_u') {
        drawRoundedTee(bitmap, colorKey, 'top', 'left', 'right');
        drawWardEndpoints(bitmap, colorKey, ['left', 'right', 'top']);
    } else if (pattern === 'tee_r') {
        drawRoundedTee(bitmap, colorKey, 'right', 'top', 'bottom');
        drawWardEndpoints(bitmap, colorKey, ['top', 'bottom', 'right']);
    } else if (pattern === 'tee_d') {
        drawRoundedTee(bitmap, colorKey, 'bottom', 'left', 'right');
        drawWardEndpoints(bitmap, colorKey, ['left', 'right', 'bottom']);
    } else if (pattern === 'tee_l') {
        drawRoundedTee(bitmap, colorKey, 'left', 'top', 'bottom');
        drawWardEndpoints(bitmap, colorKey, ['top', 'bottom', 'left']);
    } else if (pattern === 'plus') {
        drawNeonLine(bitmap, p.left.x, p.left.y, p.right.x, p.right.y, colorKey);
        drawNeonLine(bitmap, p.top.x, p.top.y, p.bottom.x, p.bottom.y, colorKey);
        drawWardEndpoints(bitmap, colorKey, ['left', 'right', 'top', 'bottom']);
    } else if (pattern === 'universal_line_v') {
        drawUniversalGradientColumn(bitmap);
    }

    drawWardSpark(bitmap, p.center.x, p.center.y, pattern === 'universal_line_v' ? 'universal' : colorKey, pattern === 'line_h' || pattern === 'line_v' ? 0.72 : 0.9);
    drawPathMotifs(bitmap, pattern === 'universal_line_v' ? 'universal' : colorKey, seed);
}

function drawCompassRune(bitmap, colorKey) {
    const colors = palette[colorKey] ?? palette.universal;
    const cx = TILE_SIZE / 2;
    const cy = TILE_SIZE / 2;
    bitmap.fillCircle(cx, cy, 19, withAlpha(colors.neon, 24));
    drawThinLine(bitmap, cx - 22, cy, cx + 22, cy, 2, withAlpha(colors.core, 92));
    drawThinLine(bitmap, cx, cy - 22, cx, cy + 22, 2, withAlpha(colors.core, 92));
    drawDiamond(bitmap, cx, cy, 5, withAlpha(colors.core, 145));
}

function drawGraySeal(bitmap, seed) {
    const cx = TILE_SIZE / 2;
    const cy = TILE_SIZE / 2;
    bitmap.fillCircle(cx, cy, 27, [196, 166, 116, 20]);
    bitmap.fillCircle(cx, cy, 16, [221, 190, 135, 26]);
    drawThinLine(bitmap, cx - 24, cy, cx + 24, cy, 2, [186, 152, 102, 54]);
    drawThinLine(bitmap, cx, cy - 24, cx, cy + 24, 2, [186, 152, 102, 54]);
    for (let i = 0; i < 6; i += 1) {
        const x = 42 + ((seed * 37 + i * 31) % 172);
        const y = 38 + ((seed * 17 + i * 47) % 180);
        bitmap.fillRect(x, y, 3, 3, [170, 139, 92, 34]);
    }
}

function drawTile(matrix, colorKey, seed = 0, pattern = '') {
    const bitmap = new Bitmap(TILE_SIZE, TILE_SIZE);

    drawStoneGrid(bitmap, seed);

    if (colorKey === 'universal') {
        drawWardPath(bitmap, colorKey, pattern, seed);
    } else if (colorKey !== 'gray') {
        drawWardPath(bitmap, colorKey, pattern, seed);
    } else {
        drawGraySeal(bitmap, seed);
    }

    if (colorKey !== 'gray') {
        drawCompassRune(bitmap, colorKey);
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
    bitmap: drawTile(entry.matrix, entry.color, entry.variantSeed ?? index + 1, entry.pattern),
}));
const specialEntries = buildSpecialEntries().map((entry, index) => ({
    ...entry,
    bitmap: drawTile(entry.matrix, entry.color, entry.variantSeed ?? entries.length + index + 1, entry.pattern),
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
