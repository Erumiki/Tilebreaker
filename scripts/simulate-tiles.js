import fs from 'node:fs';
import {
    applyOpeningDrawBag,
    createStartingDeckIds,
} from '../src/entities/tileBattle.js';
import {
    GAMEPLAY_VARIANTS,
    getGameplayVariant,
} from '../src/entities/gameplayVariants.js';

const COLORS = ['red', 'blue', 'green', 'gray'];
const DAMAGE_COLORS = ['red', 'blue', 'green'];
const SYMBOLS = {
    red: 'R',
    blue: 'B',
    green: 'G',
    gray: '.',
};

const GAME_CONFIG = JSON.parse(fs.readFileSync('configs/game.json', 'utf8'));
const LEVEL_CONFIG = JSON.parse(fs.readFileSync('configs/levels.json', 'utf8'));
const TILE_SETTINGS = GAME_CONFIG.tileBattle ?? {};
const GAMEPLAY_VARIANT = getGameplayVariant({
    gameplayVariant: process.env.GAMEPLAY_VARIANT ?? TILE_SETTINGS.gameplayVariant,
});

const BOARD_SIZE = TILE_SETTINGS.boardSize ?? 6;
const HAND_SIZE = TILE_SETTINGS.handSize ?? 7;
const DRAW_MODE = process.env.DRAW_MODE ?? TILE_SETTINGS.drawMode ?? 'hand';
const QUEUE_BEAM_WIDTH = Number(process.env.QUEUE_BEAM_WIDTH ?? 12);
const HAND_RUNS = Number(process.env.HAND_RUNS ?? 40);
const FIGHT_RUNS = Number(process.env.FIGHT_RUNS ?? 40);
const PLACEMENT_ATTEMPTS = Number(process.env.PLACEMENT_ATTEMPTS ?? 40);
const DRAW_BAG = TILE_SETTINGS.drawBag ?? {};
const OPENING_DRAW_COUNT = Number(process.env.OPENING_DRAW_COUNT ?? DRAW_BAG.openingDraws ?? 12);
const HAND_SAMPLE_COUNT = Number(process.env.HAND_SAMPLE_COUNT ?? 12);
const GUARANTEED_LOOP_HANDS = TILE_SETTINGS.guaranteedLoopHands === true;
const HAND_SELECTION_DRAWS = GUARANTEED_LOOP_HANDS
    ? TILE_SETTINGS.handSelectionDraws ?? 3
    : 1;
const MAX_ROUNDS = 8;
const STARTING_PLAYER_HP = TILE_SETTINGS.startingPlayerHp ?? 45;
const TILE_MANIFEST_PATH = TILE_SETTINGS.manifestPath ?? 'assets/tiles_v2/tile_manifest.json';
const CAPTURE_DAMAGE_PER_AREA = TILE_SETTINGS.damageFormula?.areaMultiplier ?? 2;
const ROUND_BOARD_CLEANUP = TILE_SETTINGS.roundBoardCleanup ?? 'clearAll';
const DEAD_END_RECOVERY = TILE_SETTINGS.deadEndRecovery ?? 'none';
const GRAY_WILDCARD_PLACEMENT = TILE_SETTINGS.grayWildcardPlacement === true;
const OFF_COLOR_LEAP_PLACEMENT = TILE_SETTINGS.offColorLeapPlacement === true;
const OFF_COLOR_LEAP_DISTANCE = TILE_SETTINGS.offColorLeapDistance ?? 2;
const OFF_COLOR_LEAP_ONLY_WHEN_BLOCKED = TILE_SETTINGS.offColorLeapOnlyWhenBlocked !== false;
const LARGE_ZONE_BONUS = TILE_SETTINGS.damageFormula?.largeZoneBonus ?? {};
const LARGE_ZONE_MIN_AREA = LARGE_ZONE_BONUS.minArea ?? Infinity;
const LARGE_ZONE_BONUS_PER_AREA = LARGE_ZONE_BONUS.bonusPerArea ?? 0;
const GRAY_INTERIOR_BONUS_PER_CELL = TILE_SETTINGS.damageFormula?.grayInteriorBonus?.bonusPerCell ?? 0;
const THEORETICAL_BATTLES = LEVEL_CONFIG.battles;
const CORNER_PATTERNS = ['corner_rd', 'corner_dl', 'corner_ur', 'corner_lu'];

function createRng(seed) {
    let state = seed >>> 0;

    return function next() {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 0x100000000;
    };
}

function pick(rng, items) {
    return items[Math.floor(rng() * items.length)];
}

function shuffle(rng, items) {
    const copy = [...items];

    for (let index = copy.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(rng() * (index + 1));
        [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }

    return copy;
}

function pattern(rows) {
    return rows.map((row) => row.split(''));
}

function colorSymbol(color) {
    return SYMBOLS[color];
}

function tile(id, color, kind, rows) {
    return {
        id: `${id}_${color}_${kind}`,
        color,
        kind,
        cells: pattern(rows),
    };
}

function createLegacyColorTiles(color) {
    const c = colorSymbol(color);
    const x = SYMBOLS.gray;

    return [
        tile('tile', color, 'dot', [
            `${x}${x}${x}`,
            `${x}${c}${x}`,
            `${x}${x}${x}`,
        ]),
        tile('tile', color, 'line_h', [
            `${x}${x}${x}`,
            `${c}${c}${c}`,
            `${x}${x}${x}`,
        ]),
        tile('tile', color, 'line_v', [
            `${x}${c}${x}`,
            `${x}${c}${x}`,
            `${x}${c}${x}`,
        ]),
        tile('tile', color, 'cap_l', [
            `${x}${x}${x}`,
            `${c}${c}${x}`,
            `${x}${x}${x}`,
        ]),
        tile('tile', color, 'cap_r', [
            `${x}${x}${x}`,
            `${x}${c}${c}`,
            `${x}${x}${x}`,
        ]),
        tile('tile', color, 'cap_u', [
            `${x}${c}${x}`,
            `${x}${c}${x}`,
            `${x}${x}${x}`,
        ]),
        tile('tile', color, 'cap_d', [
            `${x}${x}${x}`,
            `${x}${c}${x}`,
            `${x}${c}${x}`,
        ]),
        tile('tile', color, 'corner_ur', [
            `${x}${c}${x}`,
            `${x}${c}${c}`,
            `${x}${x}${x}`,
        ]),
        tile('tile', color, 'corner_rd', [
            `${x}${x}${x}`,
            `${x}${c}${c}`,
            `${x}${c}${x}`,
        ]),
        tile('tile', color, 'corner_dl', [
            `${x}${x}${x}`,
            `${c}${c}${x}`,
            `${x}${c}${x}`,
        ]),
        tile('tile', color, 'corner_lu', [
            `${x}${c}${x}`,
            `${c}${c}${x}`,
            `${x}${x}${x}`,
        ]),
    ];
}

function tileFromManifest(entry) {
    const symbol = colorSymbol(entry.color);
    const rows = entry.matrix.map((row) => row.replaceAll('X', symbol));

    return {
        id: entry.id,
        color: entry.color,
        kind: entry.pattern,
        pattern: entry.pattern,
        cells: pattern(rows),
    };
}

function createStartingDeck() {
    if (fs.existsSync(TILE_MANIFEST_PATH)) {
        const manifest = JSON.parse(fs.readFileSync(TILE_MANIFEST_PATH, 'utf8'));
        const tiles = manifest.tiles.map(tileFromManifest);
        const tileMap = new Map(tiles.map((tileDef) => [tileDef.id, tileDef]));
        const deckIds = createStartingDeckIds(tiles, TILE_SETTINGS);

        return {
            label: manifest.tileSetVersion ?? TILE_MANIFEST_PATH,
            tiles: deckIds.map((tileId) => {
                const tileDef = tileMap.get(tileId);

                if (!tileDef) {
                    throw new Error(`Unknown starting deck tile id: ${tileId}`);
                }

                return tileDef;
            }),
        };
    }

    const deck = [];
    for (const color of DAMAGE_COLORS) {
        for (const tileDef of createLegacyColorTiles(color)) {
            deck.push(tileDef);
        }
    }

    for (let index = 0; index < 3; index += 1) {
        deck.push(tile(`gray_${index}`, 'gray', 'blank', [
            '...',
            '...',
            '...',
        ]));
    }

    return {
        label: 'legacy_center_exit',
        tiles: deck,
    };
}

function edge(tileDef, direction) {
    if (direction === 'north') {
        return tileDef.cells[0].join('');
    }

    if (direction === 'south') {
        return tileDef.cells[2].join('');
    }

    if (direction === 'west') {
        return `${tileDef.cells[0][0]}${tileDef.cells[1][0]}${tileDef.cells[2][0]}`;
    }

    return `${tileDef.cells[0][2]}${tileDef.cells[1][2]}${tileDef.cells[2][2]}`;
}

const DIRECTIONS = [
    { name: 'north', opposite: 'south', dx: 0, dy: -1 },
    { name: 'east', opposite: 'west', dx: 1, dy: 0 },
    { name: 'south', opposite: 'north', dx: 0, dy: 1 },
    { name: 'west', opposite: 'east', dx: -1, dy: 0 },
];

function key(x, y) {
    return `${x},${y}`;
}

function parseKey(value) {
    return value.split(',').map(Number);
}

function isInsideBoard(x, y) {
    return x >= 0 && y >= 0 && x < BOARD_SIZE && y < BOARD_SIZE;
}

function getTile(placements, x, y) {
    return placements.get(key(x, y));
}

function isCombatTile(tileDef) {
    return DAMAGE_COLORS.includes(tileDef?.color);
}

function canPlaceOffColorLeap(placements, tileDef, x, y) {
    if (!OFF_COLOR_LEAP_PLACEMENT || !isCombatTile(tileDef)) {
        return false;
    }

    for (const direction of DIRECTIONS) {
        const anchorX = x + direction.dx * OFF_COLOR_LEAP_DISTANCE;
        const anchorY = y + direction.dy * OFF_COLOR_LEAP_DISTANCE;
        const gapX = x + direction.dx;
        const gapY = y + direction.dy;

        if (!isInsideBoard(anchorX, anchorY)
            || !isInsideBoard(gapX, gapY)
            || getTile(placements, gapX, gapY)) {
            continue;
        }

        const anchorTile = getTile(placements, anchorX, anchorY);

        if (anchorTile && isCombatTile(anchorTile) && anchorTile.color !== tileDef.color) {
            return true;
        }
    }

    return false;
}

function canPlaceAdjacent(placements, tileDef, x, y, strictEdges) {
    let hasNeighbor = false;

    for (const direction of DIRECTIONS) {
        const neighbor = getTile(placements, x + direction.dx, y + direction.dy);

        if (!neighbor) {
            continue;
        }

        hasNeighbor = true;

        if (strictEdges && !edgesMatch(tileDef, neighbor, direction)) {
            return false;
        }
    }

    return hasNeighbor;
}

function edgesMatch(tileDef, neighbor, direction) {
    if (GRAY_WILDCARD_PLACEMENT && tileDef.color === 'gray' && neighbor.color === 'gray') {
        return true;
    }

    if (GRAY_WILDCARD_PLACEMENT && tileDef.color === 'gray' && isCombatTile(neighbor)) {
        return isBlankEdge(neighbor, direction.opposite);
    }

    if (GRAY_WILDCARD_PLACEMENT && neighbor.color === 'gray' && isCombatTile(tileDef)) {
        return isBlankEdge(tileDef, direction.name);
    }

    return edge(tileDef, direction.name) === edge(neighbor, direction.opposite);
}

function isBlankEdge(tileDef, directionName) {
    return edge(tileDef, directionName).split('').every((symbol) => symbol === SYMBOLS.gray);
}

function hasDirectNeighbor(placements, x, y) {
    return DIRECTIONS.some((direction) => (
        Boolean(getTile(placements, x + direction.dx, y + direction.dy))
    ));
}

function canPlace(placements, tileDef, x, y, strictEdges) {
    if (!isInsideBoard(x, y) || getTile(placements, x, y)) {
        return false;
    }

    if (placements.size === 0) {
        return true;
    }

    if (canPlaceAdjacent(placements, tileDef, x, y, strictEdges)) {
        return true;
    }

    if (hasDirectNeighbor(placements, x, y)) {
        return false;
    }

    return canPlaceOffColorLeap(placements, tileDef, x, y);
}

function findCandidatePlacements(placements, tileDef, strictEdges) {
    if (placements.size === 0) {
        const center = Math.floor(BOARD_SIZE / 2);
        return [{ x: center, y: center }];
    }

    const candidates = new Map();
    const adjacentCandidates = new Map();

    for (const placementKey of placements.keys()) {
        const [placedX, placedY] = parseKey(placementKey);

        for (const direction of DIRECTIONS) {
            const x = placedX + direction.dx;
            const y = placedY + direction.dy;

            if (canPlace(placements, tileDef, x, y, strictEdges)) {
                adjacentCandidates.set(key(x, y), { x, y });
            }
        }
    }

    if (adjacentCandidates.size > 0) {
        return [...adjacentCandidates.values()];
    }

    for (const placementKey of placements.keys()) {
        const [placedX, placedY] = parseKey(placementKey);

        for (const direction of DIRECTIONS) {
            const x = placedX + direction.dx * OFF_COLOR_LEAP_DISTANCE;
            const y = placedY + direction.dy * OFF_COLOR_LEAP_DISTANCE;

            if (canPlace(placements, tileDef, x, y, strictEdges)) {
                candidates.set(key(x, y), { x, y });
            }
        }
    }

    return [...candidates.values()];
}

function buildMicroGrid(placements) {
    const size = BOARD_SIZE * 3;
    const cells = Array.from({ length: size }, () => Array(size).fill(null));

    for (const [placementKey, tileDef] of placements.entries()) {
        const [tileX, tileY] = parseKey(placementKey);

        for (let y = 0; y < 3; y += 1) {
            for (let x = 0; x < 3; x += 1) {
                cells[tileY * 3 + y][tileX * 3 + x] = tileDef.cells[y][x];
            }
        }
    }

    return cells;
}

function originalIndex(size, x, y) {
    return y * size + x;
}

function floodOutsideForColor(grid, colorSymbolValue) {
    const size = grid.length;
    const expandedSize = grid.length + 2;
    const reachable = new Uint8Array(expandedSize * expandedSize);
    const queue = [0];
    let cursor = 0;
    reachable[0] = 1;

    while (cursor < queue.length) {
        const cellIndex = queue[cursor];
        cursor += 1;
        const cellX = cellIndex % expandedSize;
        const cellY = Math.floor(cellIndex / expandedSize);

        for (const direction of DIRECTIONS) {
            const nextX = cellX + direction.dx;
            const nextY = cellY + direction.dy;

            if (nextX < 0 || nextY < 0 || nextX >= expandedSize || nextY >= expandedSize) {
                continue;
            }

            const nextIndex = nextY * expandedSize + nextX;

            if (reachable[nextIndex]) {
                continue;
            }

            const gridX = nextX - 1;
            const gridY = nextY - 1;
            const isOriginalCell = gridX >= 0 && gridY >= 0 && gridX < size && gridY < size;

            if (isOriginalCell && grid[gridY][gridX] === colorSymbolValue) {
                continue;
            }

            reachable[nextIndex] = 1;
            queue.push(nextIndex);
        }
    }

    return reachable;
}

function isReachable(reachable, size, x, y) {
    const expandedSize = size + 2;
    return reachable[(y + 1) * expandedSize + x + 1] === 1;
}

function collectEnclosedRegion(grid, colorSymbolValue, reachable, start, visited) {
    const size = grid.length;
    const queue = [originalIndex(size, start.x, start.y)];
    const boundary = new Uint8Array(size * size);
    const interiorCells = [];
    const boundaryCells = [];
    let cursor = 0;
    visited[queue[0]] = 1;

    while (cursor < queue.length) {
        const cellIndex = queue[cursor];
        cursor += 1;
        const cellX = cellIndex % size;
        const cellY = Math.floor(cellIndex / size);
        interiorCells.push({ x: cellX, y: cellY });

        for (const direction of DIRECTIONS) {
            const nextX = cellX + direction.dx;
            const nextY = cellY + direction.dy;

            if (nextX < 0 || nextY < 0 || nextX >= size || nextY >= size) {
                continue;
            }

            const nextColor = grid[nextY][nextX];
            const nextIndex = originalIndex(size, nextX, nextY);

            if (nextColor === colorSymbolValue) {
                if (!boundary[nextIndex]) {
                    boundary[nextIndex] = 1;
                    boundaryCells.push({ x: nextX, y: nextY });
                }
                continue;
            }

            if (isReachable(reachable, size, nextX, nextY)) {
                continue;
            }

            if (!visited[nextIndex]) {
                visited[nextIndex] = 1;
                queue.push(nextIndex);
            }
        }
    }

    return {
        interiorCells,
        boundaryCells,
    };
}

function findCapturedAreas(placements) {
    const grid = buildMicroGrid(placements);
    const zones = [];

    for (const color of DAMAGE_COLORS) {
        const colorSymbolValue = colorSymbol(color);
        const reachable = floodOutsideForColor(grid, colorSymbolValue);
        const visited = new Uint8Array(grid.length * grid.length);

        for (let y = 0; y < grid.length; y += 1) {
            for (let x = 0; x < grid[y].length; x += 1) {
                const cellColor = grid[y][x];
                const cellIndex = originalIndex(grid.length, x, y);

                if (cellColor === colorSymbolValue
                    || isReachable(reachable, grid.length, x, y)
                    || visited[cellIndex]) {
                    continue;
                }

                const region = collectEnclosedRegion(grid, colorSymbolValue, reachable, { x, y }, visited);
                const area = region.interiorCells.length + region.boundaryCells.length;
                const grayInteriorCells = countGrayInteriorCells(placements, region.interiorCells);
                const damage = captureDamage(area, grayInteriorCells);

                if (region.interiorCells.length === 0 || region.boundaryCells.length === 0) {
                    continue;
                }

                zones.push({
                    color: colorSymbolValue,
                    interiorSize: region.interiorCells.length,
                    boundarySize: region.boundaryCells.length,
                    size: area,
                    areaDamage: damage.areaDamage,
                    areaBonus: damage.areaBonus,
                    grayInteriorCells,
                    grayBonus: damage.grayBonus,
                    damage: damage.total,
                    interiorCells: region.interiorCells,
                    boundaryCells: region.boundaryCells,
                });
            }
        }
    }

    return zones;
}

function countGrayInteriorCells(placements, interiorCells) {
    return interiorCells.filter((cell) => {
        const tileDef = getTile(
            placements,
            Math.floor(cell.x / 3),
            Math.floor(cell.y / 3),
        );

        return tileDef?.color === 'gray';
    }).length;
}

function captureDamage(area, grayInteriorCells = 0) {
    const areaDamage = area * CAPTURE_DAMAGE_PER_AREA;
    const areaBonus = Math.max(0, area - LARGE_ZONE_MIN_AREA) * LARGE_ZONE_BONUS_PER_AREA;
    const grayBonus = grayInteriorCells * GRAY_INTERIOR_BONUS_PER_CELL;

    return {
        areaDamage,
        areaBonus,
        grayBonus,
        total: areaDamage + areaBonus + grayBonus,
    };
}

function scorePlacement(placements, attack = null) {
    const zones = findCapturedAreas(placements);
    const damageByColor = Object.fromEntries(COLORS.map((color) => [color, 0]));

    for (const zone of zones) {
        damageByColor[symbolToColor(zone.color)] += zone.damage;
    }

    const combat = attack ? resolveAttack(damageByColor, attack) : null;

    return {
        zones,
        damageByColor,
        totalDamage: DAMAGE_COLORS.reduce((sum, color) => sum + damageByColor[color], 0),
        combat,
    };
}

function symbolToColor(symbol) {
    for (const [color, colorSymbolValue] of Object.entries(SYMBOLS)) {
        if (colorSymbolValue === symbol) {
            return color;
        }
    }

    throw new Error(`Unknown color symbol: ${symbol}`);
}

function resolveAttack(damageByColor, attack) {
    let enemyDamage = 0;
    let playerDamage = 0;
    const byColor = {};

    for (const color of DAMAGE_COLORS) {
        const closedDamage = damageByColor[color] || 0;
        const threat = attack[color] || 0;

        if (closedDamage > threat) {
            enemyDamage += closedDamage;
            byColor[color] = {
                closedDamage,
                threat,
                enemyDamage: closedDamage,
                playerDamage: 0,
            };
        } else {
            const missing = threat - closedDamage;
            playerDamage += missing;
            byColor[color] = {
                closedDamage,
                threat,
                enemyDamage: 0,
                playerDamage: missing,
            };
        }
    }

    return {
        enemyDamage,
        playerDamage,
        byColor,
    };
}

function getAverageZoneArea(score) {
    if (score.zones.length === 0) {
        return 0;
    }

    return score.zones.reduce((sum, zone) => sum + zone.size, 0) / score.zones.length;
}

function placementValue(score, placedCount, attack, strategy = 'payoff') {
    if (strategy === 'closeASAP') {
        return (
            score.zones.length * 1000
            - getAverageZoneArea(score) * 12
            - placedCount * 3
            + score.totalDamage
        );
    }

    if (!attack) {
        return score.totalDamage * 10 + score.zones.length * 3 + placedCount;
    }

    return (
        score.combat.enemyDamage * 20
        - score.combat.playerDamage * 7
        + score.totalDamage
        + score.zones.length * 3
        + placedCount
    );
}

function clonePlacements(placements) {
    return new Map(placements.entries());
}

function getScoredPlacementKeys(score) {
    const scoredKeys = new Set();

    for (const zone of score.zones) {
        for (const cell of [...zone.interiorCells, ...zone.boundaryCells]) {
            scoredKeys.add(key(
                Math.floor(cell.x / 3),
                Math.floor(cell.y / 3),
            ));
        }
    }

    return scoredKeys;
}

function cleanupPlacementsAfterRound(placements, score) {
    if (ROUND_BOARD_CLEANUP === 'clearAll') {
        return new Map();
    }

    if (ROUND_BOARD_CLEANUP !== 'clearScoredTiles') {
        return clonePlacements(placements);
    }

    const nextPlacements = clonePlacements(placements);

    for (const scoredKey of getScoredPlacementKeys(score)) {
        nextPlacements.delete(scoredKey);
    }

    return nextPlacements;
}

function findBestPlacement(rng, hand, attack = null, strictEdges = true, startingPlacements = new Map(), strategy = 'payoff') {
    let best = null;
    const startingZoneCount = scorePlacement(startingPlacements, attack).zones.length;

    for (let attempt = 0; attempt < PLACEMENT_ATTEMPTS; attempt += 1) {
        const placements = clonePlacements(startingPlacements);
        const handOrder = shuffle(rng, hand);
        const placedBefore = placements.size;
        let firstCaptureAt = null;

        for (const tileDef of handOrder) {
            if (placements.size === 0) {
                const center = Math.floor(BOARD_SIZE / 2);
                placements.set(key(center, center), tileDef);
                if (firstCaptureAt === null && scorePlacement(placements, attack).zones.length > startingZoneCount) {
                    firstCaptureAt = placements.size - placedBefore;
                }
                continue;
            }

            const candidates = findCandidatePlacements(placements, tileDef, strictEdges);

            if (candidates.length === 0) {
                continue;
            }

            const chosen = pick(rng, candidates);
            placements.set(key(chosen.x, chosen.y), tileDef);

            if (firstCaptureAt === null && scorePlacement(placements, attack).zones.length > startingZoneCount) {
                firstCaptureAt = placements.size - placedBefore;
            }
        }

        const score = scorePlacement(placements, attack);
        const placedThisRound = placements.size - placedBefore;
        const value = placementValue(score, placedThisRound, attack, strategy);

        if (!best || value > best.value) {
            best = {
                placements,
                score,
                placedThisRound,
                firstCaptureAt,
                retainedBefore: placedBefore,
                value,
            };
        }
    }

    return best;
}

function findBestQueuePlacement(queueTiles, attack = null, strictEdges = true, startingPlacements = new Map(), strategy = 'payoff') {
    const startingZoneCount = scorePlacement(startingPlacements, attack).zones.length;
    const placedBefore = startingPlacements.size;
    let beam = [{
        placements: clonePlacements(startingPlacements),
        firstCaptureAt: null,
        value: placementValue(scorePlacement(startingPlacements, attack), 0, attack, strategy),
    }];

    for (let index = 0; index < queueTiles.length; index += 1) {
        const tileDef = queueTiles[index];
        const expanded = [];

        for (const node of beam) {
            const candidates = node.placements.size === 0
                ? [{ x: Math.floor(BOARD_SIZE / 2), y: Math.floor(BOARD_SIZE / 2) }]
                : findCandidatePlacements(node.placements, tileDef, strictEdges);

            if (candidates.length === 0) {
                expanded.push({
                    ...node,
                    blocked: true,
                });
                continue;
            }

            for (const candidate of candidates) {
                const placements = clonePlacements(node.placements);
                placements.set(key(candidate.x, candidate.y), tileDef);
                const score = scorePlacement(placements, attack);
                const placedThisRound = placements.size - placedBefore;
                const firstCaptureAt = node.firstCaptureAt === null
                    && score.zones.length > startingZoneCount
                    ? placedThisRound
                    : node.firstCaptureAt;

                expanded.push({
                    placements,
                    firstCaptureAt,
                    blocked: false,
                    value: placementValue(score, placedThisRound, attack, strategy),
                });
            }
        }

        if (expanded.length === 0) {
            break;
        }

        expanded.sort((left, right) => right.value - left.value);
        beam = expanded.slice(0, QUEUE_BEAM_WIDTH);

        if (beam.every((node) => node.blocked)) {
            break;
        }
    }

    beam.sort((left, right) => right.value - left.value);
    const best = beam[0];
    const score = scorePlacement(best.placements, attack);
    const placedThisRound = best.placements.size - placedBefore;

    return {
        placements: best.placements,
        score,
        placedThisRound,
        firstCaptureAt: best.firstCaptureAt,
        retainedBefore: placedBefore,
        value: placementValue(score, placedThisRound, attack, strategy),
    };
}

function drawHand(rng, deck, count) {
    return shuffle(rng, deck).slice(0, count);
}

function drawBestCandidateHand(rng, deck, count, strictEdges, attack = null, strategy = 'payoff') {
    let bestCandidate = null;

    for (let draw = 0; draw < HAND_SELECTION_DRAWS; draw += 1) {
        const hand = drawHand(rng, deck, count);
        const best = findBestPlacement(rng, hand, attack, strictEdges, new Map(), strategy);
        const value = best.value;

        if (!bestCandidate || value > bestCandidate.value) {
            bestCandidate = {
                hand,
                best,
                value,
            };
        }
    }

    return bestCandidate;
}

function createDrawState(rng, deck, useOpeningBag = false) {
    const state = {
        drawPile: shuffle(rng, deck),
        discardPile: [],
    };

    if (useOpeningBag) {
        const tileMap = new Map(deck.map((tileDef) => [tileDef.id, tileDef]));
        const run = {
            currentBattle: 1,
            drawPile: state.drawPile.map((tileDef) => tileDef.id),
            openingBagBattles: [],
        };

        applyOpeningDrawBag(run, deck, TILE_SETTINGS);
        state.drawPile = run.drawPile.map((tileId) => tileMap.get(tileId)).filter(Boolean);
        state.openingBag = run.lastOpeningBag ?? null;
    }

    return state;
}

function drawFromState(rng, state, count) {
    const hand = [];

    while (hand.length < count) {
        if (state.drawPile.length === 0) {
            state.drawPile = shuffle(rng, state.discardPile);
            state.discardPile = [];
        }

        if (state.drawPile.length === 0) {
            break;
        }

        hand.push(state.drawPile.pop());
    }

    return hand;
}

function drawBestCandidateHandFromState(rng, state, count, strictEdges, attack, placements = new Map(), strategy = 'payoff') {
    const candidates = [];

    for (let draw = 0; draw < HAND_SELECTION_DRAWS; draw += 1) {
        const hand = drawFromState(rng, state, count);

        if (hand.length === 0) {
            break;
        }

        const best = findBestPlacement(rng, hand, attack, strictEdges, placements, strategy);
        const value = best.value;
        candidates.push({
            hand,
            best,
            value,
        });
    }

    if (candidates.length === 0) {
        return null;
    }

    candidates.sort((a, b) => b.value - a.value);
    const [chosen, ...discarded] = candidates;

    for (const candidate of discarded) {
        state.discardPile.push(...candidate.hand);
    }

    return chosen;
}

function summarize(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const sum = sorted.reduce((total, value) => total + value, 0);

    return {
        min: sorted[0] ?? 0,
        p25: percentile(sorted, 0.25),
        avg: sum / Math.max(1, sorted.length),
        p75: percentile(sorted, 0.75),
        max: sorted[sorted.length - 1] ?? 0,
    };
}

function percentile(sorted, fraction) {
    if (sorted.length === 0) {
        return 0;
    }

    return sorted[Math.floor((sorted.length - 1) * fraction)];
}

function formatSummary(summary) {
    return `min ${summary.min.toFixed(1)} | p25 ${summary.p25.toFixed(1)} | avg ${summary.avg.toFixed(1)} | p75 ${summary.p75.toFixed(1)} | max ${summary.max.toFixed(1)}`;
}

function analyzeHands(rng, deck, strictEdges, useOpeningBag) {
    const reports = [];

    for (let run = 0; run < HAND_RUNS; run += 1) {
        const drawState = createDrawState(rng, deck, useOpeningBag);
        const candidate = DRAW_MODE === 'queue'
            ? null
            : drawBestCandidateHandFromState(
                rng,
                drawState,
                HAND_SIZE,
                strictEdges,
                null,
                new Map(),
                'payoff',
            );
        const hand = DRAW_MODE === 'queue'
            ? drawFromState(rng, drawState, HAND_SIZE)
            : candidate.hand;
        const best = DRAW_MODE === 'queue'
            ? findBestQueuePlacement(hand, null, strictEdges, new Map(), 'payoff')
            : candidate.best;
        reports.push({
            placed: best.placements.size,
            totalDamage: best.score.totalDamage,
            zones: best.score.zones.length,
            zoneAreas: best.score.zones.map((zone) => zone.size),
            minimalZones: best.score.zones.filter((zone) => zone.size <= LARGE_ZONE_MIN_AREA).length,
            firstCaptureAt: best.firstCaptureAt,
            areaBonus: best.score.zones.reduce((sum, zone) => sum + zone.areaBonus, 0),
            grayBonus: best.score.zones.reduce((sum, zone) => sum + zone.grayBonus, 0),
            grayInteriorCells: best.score.zones.reduce((sum, zone) => sum + zone.grayInteriorCells, 0),
            quickCornerLoop: hasCornerLoop(hand),
            damageByColor: best.score.damageByColor,
            hand,
            best,
        });
    }

    return reports;
}

function analyzeStrategyComparison(rng, deck, strictEdges, useOpeningBag) {
    const reports = [];

    for (let run = 0; run < HAND_RUNS; run += 1) {
        const drawState = createDrawState(rng, deck, useOpeningBag);
        const hand = drawFromState(rng, drawState, HAND_SIZE);
        const closeASAP = DRAW_MODE === 'queue'
            ? findBestQueuePlacement(hand, null, strictEdges, new Map(), 'closeASAP')
            : findBestPlacement(rng, hand, null, strictEdges, new Map(), 'closeASAP');
        const payoff = DRAW_MODE === 'queue'
            ? findBestQueuePlacement(hand, null, strictEdges, new Map(), 'payoff')
            : findBestPlacement(rng, hand, null, strictEdges, new Map(), 'payoff');

        reports.push({
            hand,
            closeASAP,
            payoff,
        });
    }

    return reports;
}

function simulateFight(rng, deck, battle, strictEdges, useOpeningBag) {
    const drawState = createDrawState(rng, deck, useOpeningBag);
    let placements = new Map();
    let enemyHp = battle.enemyHp;
    let playerHp = STARTING_PLAYER_HP;
    let rounds = 0;
    let totalEnemyDamage = 0;
    let totalPlayerDamage = 0;
    let deadEndRounds = 0;
    let recoveredDeadEnds = 0;
    let capturedZones = 0;
    let minimalZones = 0;
    let captureAreaTotal = 0;
    let zeroDamageRounds = 0;
    let currentZeroDamageStreak = 0;
    let maxZeroDamageStreak = 0;
    let capturesWithin3Rounds = 0;

    while (rounds < MAX_ROUNDS && enemyHp > 0 && playerHp > 0) {
        const attack = battle.attacks[rounds % battle.attacks.length];
        const hand = drawFromState(rng, drawState, HAND_SIZE);

        if (hand.length === 0) {
            break;
        }

        let best = DRAW_MODE === 'queue'
            ? findBestQueuePlacement(hand, attack, strictEdges, placements, 'payoff')
            : findBestPlacement(rng, hand, attack, strictEdges, placements, 'payoff');

        if (best.placedThisRound === 0 && placements.size > 0) {
            deadEndRounds += 1;

            if (DEAD_END_RECOVERY === 'freshStart') {
                best = DRAW_MODE === 'queue'
                    ? findBestQueuePlacement(hand, attack, strictEdges, new Map(), 'payoff')
                    : findBestPlacement(rng, hand, attack, strictEdges, new Map(), 'payoff');
                recoveredDeadEnds += 1;
            }
        }

        const combat = best.score.combat;

        enemyHp -= combat.enemyDamage;
        playerHp -= combat.playerDamage;
        totalEnemyDamage += combat.enemyDamage;
        totalPlayerDamage += combat.playerDamage;
        capturedZones += best.score.zones.length;
        minimalZones += best.score.zones.filter((zone) => zone.size <= LARGE_ZONE_MIN_AREA).length;
        captureAreaTotal += best.score.zones.reduce((sum, zone) => sum + zone.size, 0);
        if (best.score.totalDamage === 0) {
            zeroDamageRounds += 1;
            currentZeroDamageStreak += 1;
            maxZeroDamageStreak = Math.max(maxZeroDamageStreak, currentZeroDamageStreak);
        } else {
            currentZeroDamageStreak = 0;
        }
        if (rounds < 3) {
            capturesWithin3Rounds += best.score.zones.length;
        }
        placements = cleanupPlacementsAfterRound(best.placements, best.score);
        drawState.discardPile.push(...hand);
        rounds += 1;
    }

    return {
        win: enemyHp <= 0 && playerHp > 0,
        enemyHp,
        playerHp,
        rounds,
        totalEnemyDamage,
        totalPlayerDamage,
        deadEndRounds,
        recoveredDeadEnds,
        capturedZones,
        minimalZones,
        captureAreaTotal,
        zeroDamageRounds,
        maxZeroDamageStreak,
        capturesWithin3Rounds,
        retainedTiles: placements.size,
    };
}

function analyzeBattles(rng, deck, strictEdges, useOpeningBag) {
    return THEORETICAL_BATTLES.map((battle) => {
        const fights = [];

        for (let run = 0; run < FIGHT_RUNS; run += 1) {
            fights.push(simulateFight(rng, deck, battle, strictEdges, useOpeningBag));
        }

        return {
            battle,
            fights,
            wins: fights.filter((fight) => fight.win).length,
        };
    });
}

function hasCornerLoop(hand) {
    for (const color of DAMAGE_COLORS) {
        const patterns = new Set(
            hand
                .filter((tileDef) => tileDef.color === color)
                .map((tileDef) => tileDef.kind),
        );

        if (CORNER_PATTERNS.every((patternName) => patterns.has(patternName))) {
            return true;
        }
    }

    return false;
}

function createDeckPreset(deck, preset) {
    if (preset === 'current') {
        return deck;
    }

    return deck.filter((tileDef) => {
        const isCorner = CORNER_PATTERNS.includes(tileDef.kind);
        const isPlus = tileDef.kind === 'plus';

        if ((preset === 'fewer corners' || preset === 'fewer both')
            && isCorner
            && tileDef.kind === 'corner_lu') {
            return false;
        }

        if ((preset === 'fewer plus' || preset === 'fewer both') && isPlus) {
            return false;
        }

        return true;
    });
}

function flattenZoneAreas(reports) {
    return reports.flatMap((report) => report.zoneAreas);
}

function printDeck(deck) {
    const byKind = new Map();

    for (const tileDef of deck) {
        const group = `${tileDef.color}:${tileDef.kind}`;
        byKind.set(group, (byKind.get(group) || 0) + 1);
    }

    console.log(`Starting deck: ${deck.length} tiles`);

    for (const [group, count] of [...byKind.entries()].sort()) {
        console.log(`  ${group.padEnd(18)} x${count}`);
    }
}

function shapeGroup(tileDef) {
    if (tileDef.color === 'gray') {
        return 'gray';
    }

    if (CORNER_PATTERNS.includes(tileDef.kind)) {
        return 'corner';
    }

    if (tileDef.kind === 'plus') {
        return 'plus';
    }

    if (tileDef.kind.startsWith('line_')) {
        return 'line';
    }

    if (tileDef.kind.startsWith('tee_')) {
        return 'tee';
    }

    return tileDef.kind;
}

function countBy(items, getGroup) {
    const counts = new Map();

    for (const item of items) {
        const group = getGroup(item);
        counts.set(group, (counts.get(group) || 0) + 1);
    }

    return [...counts.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([group, count]) => `${group}:${count}`)
        .join(', ');
}

function formatPercent(numerator, denominator) {
    if (denominator === 0) {
        return '0%';
    }

    return `${((numerator / denominator) * 100).toFixed(0)}%`;
}

function printOpeningDrawReport(label, rng, deck, useOpeningBag) {
    const drawState = createDrawState(rng, deck, useOpeningBag);
    const draw = drawFromState(rng, drawState, OPENING_DRAW_COUNT);
    const sequence = draw.map((tileDef) => `${tileDef.color}:${tileDef.kind}`).join(' | ');

    console.log(`\n=== ${label}: first ${draw.length} draws ===`);
    console.log(`  opening bag: ${useOpeningBag ? 'on' : 'off'}`);
    console.log(`  sequence: ${sequence}`);
    console.log(`  colors:   ${countBy(draw, (tileDef) => tileDef.color)}`);
    console.log(`  shapes:   ${countBy(draw, shapeGroup)}`);
}

function printHandSamples(reports) {
    const samples = reports.slice(0, HAND_SAMPLE_COUNT);

    console.log(`  first ${samples.length} hand samples:`);

    samples.forEach((report, index) => {
        console.log(
            `    #${String(index + 1).padStart(2, '0')} `
            + `colors [${countBy(report.hand, (tileDef) => tileDef.color)}] `
            + `shapes [${countBy(report.hand, shapeGroup)}]`,
        );
    });
}

function printHandReport(label, reports) {
    const zoneAreas = flattenZoneAreas(reports);
    const totalZones = reports.reduce((sum, report) => sum + report.zones, 0);
    const minimalZones = reports.reduce((sum, report) => sum + report.minimalZones, 0);
    const quickCornerLoops = reports.filter((report) => report.quickCornerLoop).length;
    const firstCaptureValues = reports
        .filter((report) => report.firstCaptureAt !== null)
        .map((report) => report.firstCaptureAt);

    console.log(`\n${label}`);
    console.log(`  placed:       ${formatSummary(summarize(reports.map((report) => report.placed)))}`);
    console.log(`  captures:     ${formatSummary(summarize(reports.map((report) => report.zones)))}`);
    console.log(`  total damage: ${formatSummary(summarize(reports.map((report) => report.totalDamage)))}`);
    console.log(`  zone area:    ${formatSummary(summarize(zoneAreas))}`);
    console.log(`  avg capture area: ${zoneAreas.length === 0 ? '0.0' : (zoneAreas.reduce((sum, area) => sum + area, 0) / zoneAreas.length).toFixed(1)}`);
    console.log(`  min captures: ${minimalZones}/${totalZones} zones <= area ${LARGE_ZONE_MIN_AREA} (${formatPercent(minimalZones, totalZones)})`);
    console.log(`  minimal capture share: ${formatPercent(minimalZones, totalZones)}`);
    console.log(`  placements before capture: ${formatSummary(summarize(firstCaptureValues))}`);
    console.log(`  quick loops:  ${quickCornerLoops}/${reports.length} hands with 4-corner loop`);
    console.log(`  area bonus:   ${formatSummary(summarize(reports.map((report) => report.areaBonus)))}`);
    console.log(`  gray bonus:   ${formatSummary(summarize(reports.map((report) => report.grayBonus)))}`);
    console.log(`  gray cells:   ${formatSummary(summarize(reports.map((report) => report.grayInteriorCells)))}`);

    for (const color of DAMAGE_COLORS) {
        console.log(`  ${color.padEnd(5)} damage: ${formatSummary(summarize(reports.map((report) => report.damageByColor[color])))}`);
    }

    const zeroDamage = reports.filter((report) => report.totalDamage === 0).length;
    const allTilesPlaced = reports.filter((report) => report.placed === HAND_SIZE).length;
    console.log(`  zero damage hands: ${zeroDamage}/${reports.length}`);
    console.log(`  all tiles placed:  ${allTilesPlaced}/${reports.length}`);
    printHandSamples(reports);
}

function printStrategyComparison(label, reports) {
    const closeDamage = reports.map((report) => report.closeASAP.score.totalDamage);
    const payoffDamage = reports.map((report) => report.payoff.score.totalDamage);
    const closeArea = reports.flatMap((report) => report.closeASAP.score.zones.map((zone) => zone.size));
    const payoffArea = reports.flatMap((report) => report.payoff.score.zones.map((zone) => zone.size));
    const betterPayoff = reports.filter((report) => (
        report.payoff.score.totalDamage > report.closeASAP.score.totalDamage
    )).length;

    console.log(`\n${label}`);
    console.log(`  close ASAP damage: ${formatSummary(summarize(closeDamage))}`);
    console.log(`  payoff damage:     ${formatSummary(summarize(payoffDamage))}`);
    console.log(`  close ASAP area:   ${formatSummary(summarize(closeArea))}`);
    console.log(`  payoff area:       ${formatSummary(summarize(payoffArea))}`);
    console.log(`  payoff beats close ASAP: ${betterPayoff}/${reports.length} hands`);
}

function findTile(deck, color, kind) {
    const tileDef = deck.find((tile) => tile.color === color && tile.kind === kind);

    if (!tileDef) {
        throw new Error(`Missing scenario tile: ${color}:${kind}`);
    }

    return tileDef;
}

function createScenarioPlacement(deck, entries) {
    const placements = new Map();

    for (const entry of entries) {
        placements.set(key(entry.x, entry.y), findTile(deck, entry.color, entry.kind));
    }

    return placements;
}

function printPayoffScenarioComparison(deck) {
    const minimal = createScenarioPlacement(deck, [
        { x: 2, y: 2, color: 'red', kind: 'corner_rd' },
        { x: 3, y: 2, color: 'red', kind: 'corner_dl' },
        { x: 2, y: 3, color: 'red', kind: 'corner_ur' },
        { x: 3, y: 3, color: 'red', kind: 'corner_lu' },
    ]);
    const largeWithGray = createScenarioPlacement(deck, [
        { x: 1, y: 1, color: 'red', kind: 'corner_rd' },
        { x: 2, y: 1, color: 'red', kind: 'tee_d' },
        { x: 3, y: 1, color: 'red', kind: 'corner_dl' },
        { x: 1, y: 2, color: 'red', kind: 'tee_r' },
        { x: 2, y: 2, color: 'gray', kind: 'blank_01' },
        { x: 3, y: 2, color: 'red', kind: 'tee_l' },
        { x: 1, y: 3, color: 'red', kind: 'corner_ur' },
        { x: 2, y: 3, color: 'red', kind: 'tee_u' },
        { x: 3, y: 3, color: 'red', kind: 'corner_lu' },
    ]);
    const minimalScore = scorePlacement(minimal);
    const largeScore = scorePlacement(largeWithGray);
    const describe = (score) => {
        const zone = score.zones[0];

        return `area ${zone?.size ?? 0}, area bonus ${zone?.areaBonus ?? 0}, gray bonus ${zone?.grayBonus ?? 0}, damage ${score.totalDamage}`;
    };

    console.log('\n=== Payoff scenarios: close ASAP vs bigger gray fill ===');
    console.log(`  minimal 2x2 loop:       ${describe(minimalScore)}`);
    console.log(`  3x3 loop with gray tile: ${describe(largeScore)}`);
}

function printBattleReport(label, reports) {
    console.log(`\n${label}`);

    for (const report of reports) {
        const fights = report.fights;
        const winRate = report.wins / fights.length;
        const capturedZones = fights.reduce((sum, fight) => sum + fight.capturedZones, 0);
        const minimalZones = fights.reduce((sum, fight) => sum + fight.minimalZones, 0);
        const captureAreaTotal = fights.reduce((sum, fight) => sum + fight.captureAreaTotal, 0);
        const zeroDamageRounds = fights.reduce((sum, fight) => sum + fight.zeroDamageRounds, 0);
        const totalRounds = fights.reduce((sum, fight) => sum + fight.rounds, 0);
        const earlyCaptureFights = fights.filter((fight) => fight.capturesWithin3Rounds > 0).length;
        console.log(
            `  ${report.battle.id} ${report.battle.name.padEnd(15)} `
            + `wins ${report.wins}/${fights.length} (${(winRate * 100).toFixed(0)}%) | `
            + `rounds ${formatSummary(summarize(fights.map((fight) => fight.rounds)))} | `
            + `enemy dmg ${formatSummary(summarize(fights.map((fight) => fight.totalEnemyDamage)))} | `
            + `player dmg ${formatSummary(summarize(fights.map((fight) => fight.totalPlayerDamage)))} | `
            + `captures ${capturedZones}, min ${minimalZones} (${formatPercent(minimalZones, capturedZones)}), avg area ${(captureAreaTotal / Math.max(1, capturedZones)).toFixed(1)} | `
            + `zero ${zeroDamageRounds}/${totalRounds} rounds | `
            + `zero streak ${formatSummary(summarize(fights.map((fight) => fight.maxZeroDamageStreak)))} | `
            + `captures in 3r ${earlyCaptureFights}/${fights.length} | `
            + `dead-end ${fights.reduce((sum, fight) => sum + fight.deadEndRounds, 0)}`
            + `/${totalRounds} rounds`
        );
    }
}

function run() {
    const seed = Number(process.argv[2] || 20260508);
    const deckDefinition = createStartingDeck();
    const deck = deckDefinition.tiles;

    console.log(`Tilebreaker tile feasibility simulation`);
    console.log(`Seed: ${seed}`);
    console.log(`Gameplay variant: ${GAMEPLAY_VARIANT.shortLabel}:${GAMEPLAY_VARIANT.id}`);
    console.log(`Variant order: ${GAMEPLAY_VARIANTS.map((variant) => `${variant.shortLabel}:${variant.id}`).join(' -> ')}`);
    console.log(`Tile set: ${deckDefinition.label}`);
    console.log(`Board: ${BOARD_SIZE}x${BOARD_SIZE}, hand: ${HAND_SIZE}, placement attempts per hand: ${PLACEMENT_ATTEMPTS}`);
    console.log(`Draw mode: ${DRAW_MODE}`);
    if (DRAW_MODE === 'queue') {
        console.log(`Queue AI: beam width ${QUEUE_BEAM_WIDTH}`);
    }
    console.log(GUARANTEED_LOOP_HANDS
        ? `Hand smoothing: best of ${HAND_SELECTION_DRAWS} candidate draws`
        : 'Hand smoothing: off, honest single draw');
    console.log(`Capture damage: area * ${CAPTURE_DAMAGE_PER_AREA}, large zone +${LARGE_ZONE_BONUS_PER_AREA}/area over ${LARGE_ZONE_MIN_AREA}, gray interior +${GRAY_INTERIOR_BONUS_PER_CELL}/cell`);
    console.log(`Round board cleanup: ${ROUND_BOARD_CLEANUP}, dead-end recovery: ${DEAD_END_RECOVERY}`);
    console.log(`Gray wildcard placement: ${GRAY_WILDCARD_PLACEMENT}`);
    console.log(`Off-color leap: ${OFF_COLOR_LEAP_PLACEMENT}, distance: ${OFF_COLOR_LEAP_DISTANCE}, only blocked: ${OFF_COLOR_LEAP_ONLY_WHEN_BLOCKED}`);
    console.log(`Opening draw bag: ${DRAW_BAG.enabled ? 'on' : 'off'}, window: ${OPENING_DRAW_COUNT}`);
    printDeck(deck);
    printPayoffScenarioComparison(deck);

    const modes = process.argv.includes('--with-loose') ? [true, false] : [true];
    const presets = ['current', 'fewer corners', 'fewer plus', 'fewer both'];
    const bagModes = [
        { label: 'current recipe', useOpeningBag: false },
        { label: 'opening bag', useOpeningBag: DRAW_BAG.enabled === true },
    ];

    for (const strictEdges of modes) {
        const modeLabel = strictEdges
            ? 'STRICT edge matching'
            : 'LOOSE adjacency baseline';

        for (const preset of presets) {
            const presetDeck = createDeckPreset(deck, preset);
            const presetSeedOffset = presets.indexOf(preset) * 100000 + (strictEdges ? 0 : 9999);

            for (const bagMode of bagModes) {
                const bagSeedOffset = bagMode.useOpeningBag ? 444444 : 0;
                const handReports = analyzeHands(
                    createRng(seed + presetSeedOffset + bagSeedOffset),
                    presetDeck,
                    strictEdges,
                    bagMode.useOpeningBag,
                );
                const strategyReports = analyzeStrategyComparison(
                    createRng(seed + presetSeedOffset + bagSeedOffset + 33333),
                    presetDeck,
                    strictEdges,
                    bagMode.useOpeningBag,
                );
                const battleReports = analyzeBattles(
                    createRng(seed + presetSeedOffset + bagSeedOffset + 66666),
                    presetDeck,
                    strictEdges,
                    bagMode.useOpeningBag,
                );
                const presetLabel = `${modeLabel} / ${preset} deck / ${bagMode.label} (${presetDeck.length} tiles)`;

                printOpeningDrawReport(
                    presetLabel,
                    createRng(seed + presetSeedOffset + bagSeedOffset + 11111),
                    presetDeck,
                    bagMode.useOpeningBag,
                );
                printHandReport(`\n=== ${presetLabel}: ${HAND_RUNS} ${GUARANTEED_LOOP_HANDS ? 'smoothed' : 'honest'} hands ===`, handReports);
                printStrategyComparison(`=== ${presetLabel}: close ASAP vs payoff ===`, strategyReports);
                printBattleReport(`\n=== ${presetLabel}: theoretical battles, ${FIGHT_RUNS} fights each ===`, battleReports);
            }
        }
    }
}

run();
