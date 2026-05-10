import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = path.resolve(import.meta.dirname, '..');
const ART_MANIFEST_PATH = path.join(ROOT, 'assets', 'art_mvp', 'art_manifest.json');
const GAME_CONFIG_PATH = path.join(ROOT, 'configs', 'game.json');
const LEVELS_CONFIG_PATH = path.join(ROOT, 'configs', 'levels.json');
const CARDS_CONFIG_PATH = path.join(ROOT, 'configs', 'cards.json');
const ID_PATTERN = /^[a-z0-9_]+$/;
const FILE_PATTERN = /^[a-z0-9_]+\.png$/;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const REQUIRED_ART_IDS = [
    'screen_background_menu',
    'screen_background_battle_intro',
    'screen_background_battle',
    'screen_background_shop',
    'screen_background_result',
    'panel_dark',
    'panel_light',
    'button_primary_default',
    'button_primary_hover',
    'button_primary_pressed',
    'button_primary_disabled',
    'button_secondary_default',
    'button_secondary_hover',
    'button_secondary_disabled',
    'board_cell_empty',
    'board_cell_hover',
    'board_cell_valid',
    'board_cell_invalid',
    'board_cell_scored',
    'slot_hand_empty',
    'slot_hand_hover',
    'slot_hand_selected',
    'slot_hold_empty',
    'slot_hold_filled',
    'icon_heart_full',
    'icon_heart_empty',
    'icon_heart_lost',
    'icon_gold',
    'icon_strike',
    'icon_deck',
    'icon_discard',
    'icon_hold',
    'icon_submit',
    'icon_lock',
    'overlay_valid_cell',
    'overlay_invalid_cell',
    'overlay_target_a',
    'overlay_target_b',
    'overlay_gate_start',
    'overlay_gate_end',
    'overlay_zone_filled_red',
    'overlay_zone_filled_blue',
    'overlay_zone_filled_green',
    'overlay_zone_filled_land',
    'effect_capture_flash',
    'effect_gold_pickup',
    'effect_heart_heal',
    'effect_strike_burst',
    'effect_submit_damage',
    'shop_card_offer',
    'shop_card_affordable',
    'shop_card_unaffordable',
    'shop_card_bought',
];

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function crc32(buffer) {
    let crc = 0xffffffff;

    for (const byte of buffer) {
        crc ^= byte;
        for (let index = 0; index < 8; index += 1) {
            crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
        }
    }

    return (crc ^ 0xffffffff) >>> 0;
}

function hasAlphaChannel(colorType) {
    return colorType === 4 || colorType === 6;
}

function channelsForColorType(colorType) {
    if (colorType === 0) {
        return 1;
    }
    if (colorType === 2) {
        return 3;
    }
    if (colorType === 4) {
        return 2;
    }
    if (colorType === 6) {
        return 4;
    }

    return null;
}

function paethPredictor(left, up, upLeft) {
    const p = left + up - upLeft;
    const pa = Math.abs(p - left);
    const pb = Math.abs(p - up);
    const pc = Math.abs(p - upLeft);

    if (pa <= pb && pa <= pc) {
        return left;
    }
    if (pb <= pc) {
        return up;
    }

    return upLeft;
}

function unfilterScanlines({ width, height, bitDepth, colorType, data }) {
    const channels = channelsForColorType(colorType);
    if (bitDepth !== 8 || channels === null) {
        return null;
    }

    const bytesPerPixel = channels;
    const rowLength = width * channels;
    const expectedLength = (rowLength + 1) * height;
    if (data.length < expectedLength) {
        throw new Error(`Inflated PNG data is too short: expected ${expectedLength}, got ${data.length}`);
    }

    const rows = [];
    let offset = 0;
    let previous = Buffer.alloc(rowLength);

    for (let y = 0; y < height; y += 1) {
        const filter = data[offset];
        offset += 1;
        const raw = data.subarray(offset, offset + rowLength);
        offset += rowLength;
        const row = Buffer.alloc(rowLength);

        for (let index = 0; index < rowLength; index += 1) {
            const left = index >= bytesPerPixel ? row[index - bytesPerPixel] : 0;
            const up = previous[index] ?? 0;
            const upLeft = index >= bytesPerPixel ? previous[index - bytesPerPixel] : 0;
            let predictor = 0;

            if (filter === 1) {
                predictor = left;
            } else if (filter === 2) {
                predictor = up;
            } else if (filter === 3) {
                predictor = Math.floor((left + up) / 2);
            } else if (filter === 4) {
                predictor = paethPredictor(left, up, upLeft);
            } else if (filter !== 0) {
                throw new Error(`Unsupported PNG filter ${filter}`);
            }

            row[index] = (raw[index] + predictor) & 0xff;
        }

        rows.push(row);
        previous = row;
    }

    return {
        channels,
        pixels: Buffer.concat(rows),
    };
}

function getAlphaStats(png) {
    if (!hasAlphaChannel(png.colorType)) {
        return {
            hasAlphaChannel: false,
            transparentPixels: 0,
        };
    }

    const decoded = unfilterScanlines(png);
    if (!decoded) {
        return {
            hasAlphaChannel: true,
            transparentPixels: null,
        };
    }

    const alphaOffset = decoded.channels - 1;
    let transparentPixels = 0;

    for (let index = alphaOffset; index < decoded.pixels.length; index += decoded.channels) {
        if (decoded.pixels[index] < 255) {
            transparentPixels += 1;
        }
    }

    return {
        hasAlphaChannel: true,
        transparentPixels,
    };
}

function parsePng(filePath) {
    const buffer = fs.readFileSync(filePath);
    if (buffer.length < PNG_SIGNATURE.length || !buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
        throw new Error('Invalid PNG signature');
    }

    let offset = PNG_SIGNATURE.length;
    let ihdr = null;
    let idat = Buffer.alloc(0);
    let sawIend = false;

    while (offset < buffer.length) {
        if (offset + 12 > buffer.length) {
            throw new Error('Truncated PNG chunk header');
        }

        const length = buffer.readUInt32BE(offset);
        const typeOffset = offset + 4;
        const dataOffset = offset + 8;
        const crcOffset = dataOffset + length;
        const nextOffset = crcOffset + 4;

        if (nextOffset > buffer.length) {
            throw new Error(`Truncated PNG chunk ${buffer.subarray(typeOffset, typeOffset + 4).toString('ascii')}`);
        }

        const type = buffer.subarray(typeOffset, typeOffset + 4).toString('ascii');
        const data = buffer.subarray(dataOffset, crcOffset);
        const expectedCrc = buffer.readUInt32BE(crcOffset);
        const actualCrc = crc32(Buffer.concat([Buffer.from(type), data]));
        if (expectedCrc !== actualCrc) {
            throw new Error(`PNG CRC mismatch in ${type}`);
        }

        if (type === 'IHDR') {
            if (ihdr) {
                throw new Error('Duplicate IHDR chunk');
            }
            if (data.length !== 13) {
                throw new Error('Invalid IHDR size');
            }

            ihdr = {
                width: data.readUInt32BE(0),
                height: data.readUInt32BE(4),
                bitDepth: data[8],
                colorType: data[9],
                compression: data[10],
                filter: data[11],
                interlace: data[12],
            };
        } else if (type === 'IDAT') {
            idat = Buffer.concat([idat, data]);
        } else if (type === 'IEND') {
            sawIend = true;
            break;
        }

        offset = nextOffset;
    }

    if (!ihdr) {
        throw new Error('Missing IHDR chunk');
    }
    if (!sawIend) {
        throw new Error('Missing IEND chunk');
    }
    if (ihdr.compression !== 0 || ihdr.filter !== 0) {
        throw new Error('Unsupported PNG compression or filter method');
    }
    if (ihdr.interlace !== 0) {
        throw new Error('Interlaced PNGs are not supported by the validator');
    }
    if (idat.length === 0) {
        throw new Error('Missing IDAT data');
    }

    const data = zlib.inflateSync(idat);

    return {
        ...ihdr,
        data,
    };
}

function reportError(errors, label, message) {
    errors.push(`${label}: ${message}`);
}

function validateArtManifest(errors) {
    const manifest = readJson(ART_MANIFEST_PATH);
    const assets = Array.isArray(manifest.assets) ? manifest.assets : [];
    const root = path.join(ROOT, manifest.root ?? 'assets/art_mvp');
    const ids = new Set();
    const files = new Set();

    if (!Array.isArray(manifest.assets)) {
        reportError(errors, 'art_manifest.json', 'must contain an assets array');
        return {
            manifest,
            ids,
            root,
        };
    }

    for (const asset of assets) {
        const label = `art:${asset.id ?? '<missing id>'}`;

        if (!ID_PATTERN.test(asset.id ?? '')) {
            reportError(errors, label, `invalid id "${asset.id}"`);
        }
        if (!FILE_PATTERN.test(asset.file ?? '')) {
            reportError(errors, label, `invalid file "${asset.file}"`);
        }
        if (ids.has(asset.id)) {
            reportError(errors, label, 'duplicate asset id');
        }
        if (files.has(asset.file)) {
            reportError(errors, label, `duplicate asset file ${asset.file}`);
        }

        ids.add(asset.id);
        files.add(asset.file);

        const states = manifest.states?.[asset.category];
        if (states && !states.includes(asset.state)) {
            reportError(errors, label, `state "${asset.state}" is not declared for category "${asset.category}"`);
        }

        const [expectedWidth, expectedHeight] = asset.size ?? [];
        if (!Number.isInteger(expectedWidth) || !Number.isInteger(expectedHeight) || expectedWidth <= 0 || expectedHeight <= 0) {
            reportError(errors, label, `invalid size ${JSON.stringify(asset.size)}`);
        }

        const filePath = path.join(root, asset.file ?? '');
        if (!fs.existsSync(filePath)) {
            reportError(errors, label, `missing file ${path.relative(ROOT, filePath)}`);
            continue;
        }

        try {
            const png = parsePng(filePath);
            if (Number.isInteger(expectedWidth) && png.width !== expectedWidth) {
                reportError(errors, label, `width ${png.width} does not match manifest width ${expectedWidth}`);
            }
            if (Number.isInteger(expectedHeight) && png.height !== expectedHeight) {
                reportError(errors, label, `height ${png.height} does not match manifest height ${expectedHeight}`);
            }

            if (asset.alpha === false) {
                const alpha = getAlphaStats(png);
                if (alpha.transparentPixels === null) {
                    reportError(errors, label, 'opaque asset uses an unsupported alpha format for validation');
                } else if (alpha.transparentPixels > 0) {
                    reportError(errors, label, `opaque asset has ${alpha.transparentPixels} transparent pixels`);
                }
            }
        } catch (error) {
            reportError(errors, label, `invalid PNG ${asset.file}: ${error.message}`);
        }
    }

    const manifestFiles = new Set(assets.map((asset) => asset.file));
    for (const dirent of fs.readdirSync(root, { withFileTypes: true })) {
        if (!dirent.isFile() || !dirent.name.endsWith('.png')) {
            continue;
        }
        if (!manifestFiles.has(dirent.name)) {
            reportError(errors, 'art_manifest.json', `unlisted PNG in art root: ${dirent.name}`);
        }
    }

    const requiredArtIds = new Set(REQUIRED_ART_IDS);
    const levels = readJson(LEVELS_CONFIG_PATH);
    const battleIds = (levels.battles ?? []).map((battle) => battle.id);
    for (const battleId of battleIds) {
        requiredArtIds.add(`level_backdrop_${battleId}`);
        requiredArtIds.add(`monster_portrait_${battleId}`);
        requiredArtIds.add(`monster_icon_${battleId}`);
    }

    for (const assetId of requiredArtIds) {
        if (!ids.has(assetId)) {
            reportError(errors, 'normal-path art', `required asset id is missing from manifest: ${assetId}`);
        }
    }

    return {
        manifest,
        ids,
        root,
    };
}

function getRelativeAssetPath(file, basePath) {
    if (!file || /^(https?:)?\/\//.test(file) || file.startsWith('data:')) {
        return null;
    }

    return file.includes('/')
        ? path.join(ROOT, file.replace(/^\/+/, ''))
        : path.join(basePath, file);
}

function validateTilePng(errors, label, filePath, expectedSize) {
    if (!filePath) {
        return;
    }
    if (!fs.existsSync(filePath)) {
        reportError(errors, label, `missing file ${path.relative(ROOT, filePath)}`);
        return;
    }

    try {
        const png = parsePng(filePath);
        if (expectedSize && (png.width !== expectedSize || png.height !== expectedSize)) {
            reportError(errors, label, `PNG size ${png.width}x${png.height} does not match expected ${expectedSize}x${expectedSize}`);
        }
    } catch (error) {
        reportError(errors, label, `invalid PNG ${path.relative(ROOT, filePath)}: ${error.message}`);
    }
}

function validateTileAssets(errors) {
    const game = readJson(GAME_CONFIG_PATH);
    const cards = readJson(CARDS_CONFIG_PATH);
    const manifestPath = path.join(ROOT, game.tileBattle?.manifestPath ?? 'assets/tiles_v2/tile_manifest.json');
    const manifest = readJson(manifestPath);
    const basePath = path.dirname(manifestPath);
    const tileSize = manifest.tileSize;
    const ids = new Set();
    const files = new Set();
    const tiles = Array.isArray(manifest.tiles) ? manifest.tiles : [];

    if (!Number.isInteger(tileSize) || tileSize <= 0) {
        reportError(errors, 'tile_manifest.json', `invalid tileSize ${manifest.tileSize}`);
    }

    for (const tile of tiles) {
        const label = `tile:${tile.id ?? '<missing id>'}`;

        if (!ID_PATTERN.test(tile.id ?? '')) {
            reportError(errors, label, `invalid id "${tile.id}"`);
        }
        if (!FILE_PATTERN.test(tile.file ?? '')) {
            reportError(errors, label, `invalid file "${tile.file}"`);
        }
        if (ids.has(tile.id)) {
            reportError(errors, label, 'duplicate tile id');
        }
        if (files.has(tile.file)) {
            reportError(errors, label, `duplicate tile file ${tile.file}`);
        }

        ids.add(tile.id);
        files.add(tile.file);
        validateTilePng(errors, label, getRelativeAssetPath(tile.file, basePath), tileSize);
    }

    for (const specialTile of game.tileBattle?.specialTiles ?? []) {
        const label = `special tile:${specialTile.id ?? '<missing id>'}`;
        if (!ID_PATTERN.test(specialTile.id ?? '')) {
            reportError(errors, label, `invalid id "${specialTile.id}"`);
        }
        if (!FILE_PATTERN.test(specialTile.file ?? '')) {
            reportError(errors, label, `invalid file "${specialTile.file}"`);
        }
        if (ids.has(specialTile.id)) {
            reportError(errors, label, 'duplicates a tile manifest id');
        }
        ids.add(specialTile.id);
        validateTilePng(errors, label, getRelativeAssetPath(specialTile.file, basePath), tileSize);
    }

    for (const card of cards.cards ?? []) {
        const label = `card:${card.id ?? '<missing id>'}`;
        if (card.enabled !== false && card.rules?.kind === 'ordinary_tile' && !ids.has(card.tileId)) {
            reportError(errors, label, `enabled card references unknown tileId ${card.tileId}`);
        }
        if (card.specialTile?.file) {
            validateTilePng(errors, `${label} specialTile`, getRelativeAssetPath(card.specialTile.file, basePath), tileSize);
        }
    }
}

function main() {
    const errors = [];

    validateArtManifest(errors);
    validateTileAssets(errors);

    if (errors.length > 0) {
        console.error('Asset validation failed:');
        for (const error of errors) {
            console.error(`- ${error}`);
        }
        process.exit(1);
    }

    console.log('Validated MVP art manifest, normal-path art ids and active tile PNGs.');
}

main();
