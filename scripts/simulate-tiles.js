import fs from 'node:fs';

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

const BOARD_SIZE = TILE_SETTINGS.boardSize ?? 6;
const HAND_SIZE = TILE_SETTINGS.handSize ?? 7;
const HAND_RUNS = Number(process.env.HAND_RUNS ?? 40);
const FIGHT_RUNS = Number(process.env.FIGHT_RUNS ?? 40);
const PLACEMENT_ATTEMPTS = Number(process.env.PLACEMENT_ATTEMPTS ?? 40);
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
const OFF_COLOR_LEAP_PLACEMENT = TILE_SETTINGS.offColorLeapPlacement === true;
const OFF_COLOR_LEAP_DISTANCE = TILE_SETTINGS.offColorLeapDistance ?? 2;
const OFF_COLOR_LEAP_ONLY_WHEN_BLOCKED = TILE_SETTINGS.offColorLeapOnlyWhenBlocked !== false;
const THEORETICAL_BATTLES = LEVEL_CONFIG.battles;

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
        cells: pattern(rows),
    };
}

function createStartingDeck() {
    if (fs.existsSync(TILE_MANIFEST_PATH)) {
        const manifest = JSON.parse(fs.readFileSync(TILE_MANIFEST_PATH, 'utf8'));
        return {
            label: manifest.tileSetVersion ?? TILE_MANIFEST_PATH,
            tiles: manifest.tiles.map(tileFromManifest),
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

        if (strictEdges && edge(tileDef, direction.name) !== edge(neighbor, direction.opposite)) {
            return false;
        }
    }

    return hasNeighbor;
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

                if (region.interiorCells.length === 0 || region.boundaryCells.length === 0) {
                    continue;
                }

                zones.push({
                    color: colorSymbolValue,
                    interiorSize: region.interiorCells.length,
                    boundarySize: region.boundaryCells.length,
                    size: area,
                    damage: captureDamage(area),
                    interiorCells: region.interiorCells,
                    boundaryCells: region.boundaryCells,
                });
            }
        }
    }

    return zones;
}

function captureDamage(area) {
    return area * CAPTURE_DAMAGE_PER_AREA;
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

function placementValue(score, placedCount, attack) {
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

function findBestPlacement(rng, hand, attack = null, strictEdges = true, startingPlacements = new Map()) {
    let best = null;

    for (let attempt = 0; attempt < PLACEMENT_ATTEMPTS; attempt += 1) {
        const placements = clonePlacements(startingPlacements);
        const handOrder = shuffle(rng, hand);
        const placedBefore = placements.size;

        for (const tileDef of handOrder) {
            if (placements.size === 0) {
                const center = Math.floor(BOARD_SIZE / 2);
                placements.set(key(center, center), tileDef);
                continue;
            }

            const candidates = findCandidatePlacements(placements, tileDef, strictEdges);

            if (candidates.length === 0) {
                continue;
            }

            const chosen = pick(rng, candidates);
            placements.set(key(chosen.x, chosen.y), tileDef);
        }

        const score = scorePlacement(placements, attack);
        const placedThisRound = placements.size - placedBefore;
        const value = placementValue(score, placedThisRound, attack);

        if (!best || value > best.value) {
            best = {
                placements,
                score,
                placedThisRound,
                retainedBefore: placedBefore,
                value,
            };
        }
    }

    return best;
}

function drawHand(rng, deck, count) {
    return shuffle(rng, deck).slice(0, count);
}

function drawBestCandidateHand(rng, deck, count, strictEdges, attack = null) {
    let bestCandidate = null;

    for (let draw = 0; draw < HAND_SELECTION_DRAWS; draw += 1) {
        const hand = drawHand(rng, deck, count);
        const best = findBestPlacement(rng, hand, attack, strictEdges);
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

function createDrawState(rng, deck) {
    return {
        drawPile: shuffle(rng, deck),
        discardPile: [],
    };
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

function drawBestCandidateHandFromState(rng, state, count, strictEdges, attack, placements = new Map()) {
    const candidates = [];

    for (let draw = 0; draw < HAND_SELECTION_DRAWS; draw += 1) {
        const hand = drawFromState(rng, state, count);

        if (hand.length === 0) {
            break;
        }

        const best = findBestPlacement(rng, hand, attack, strictEdges, placements);
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

function analyzeHands(rng, deck, strictEdges) {
    const reports = [];

    for (let run = 0; run < HAND_RUNS; run += 1) {
        const candidate = drawBestCandidateHand(rng, deck, HAND_SIZE, strictEdges);
        const hand = candidate.hand;
        const best = candidate.best;
        reports.push({
            placed: best.placements.size,
            totalDamage: best.score.totalDamage,
            zones: best.score.zones.length,
            damageByColor: best.score.damageByColor,
            hand,
            best,
        });
    }

    return reports;
}

function simulateFight(rng, deck, battle, strictEdges) {
    const drawState = createDrawState(rng, deck);
    let placements = new Map();
    let enemyHp = battle.enemyHp;
    let playerHp = STARTING_PLAYER_HP;
    let rounds = 0;
    let totalEnemyDamage = 0;
    let totalPlayerDamage = 0;
    let deadEndRounds = 0;
    let recoveredDeadEnds = 0;
    let capturedZones = 0;

    while (rounds < MAX_ROUNDS && enemyHp > 0 && playerHp > 0) {
        const attack = battle.attacks[rounds % battle.attacks.length];
        const candidate = drawBestCandidateHandFromState(
            rng,
            drawState,
            HAND_SIZE,
            strictEdges,
            attack,
            placements,
        );

        if (!candidate) {
            break;
        }

        const hand = candidate.hand;
        let best = candidate.best;

        if (best.placedThisRound === 0 && placements.size > 0) {
            deadEndRounds += 1;

            if (DEAD_END_RECOVERY === 'freshStart') {
                best = findBestPlacement(rng, hand, attack, strictEdges, new Map());
                recoveredDeadEnds += 1;
            }
        }

        const combat = best.score.combat;

        enemyHp -= combat.enemyDamage;
        playerHp -= combat.playerDamage;
        totalEnemyDamage += combat.enemyDamage;
        totalPlayerDamage += combat.playerDamage;
        capturedZones += best.score.zones.length;
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
        retainedTiles: placements.size,
    };
}

function analyzeBattles(rng, deck, strictEdges) {
    return THEORETICAL_BATTLES.map((battle) => {
        const fights = [];

        for (let run = 0; run < FIGHT_RUNS; run += 1) {
            fights.push(simulateFight(rng, deck, battle, strictEdges));
        }

        return {
            battle,
            fights,
            wins: fights.filter((fight) => fight.win).length,
        };
    });
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

function printHandReport(label, reports) {
    console.log(`\n${label}`);
    console.log(`  placed:       ${formatSummary(summarize(reports.map((report) => report.placed)))}`);
    console.log(`  captures:     ${formatSummary(summarize(reports.map((report) => report.zones)))}`);
    console.log(`  total damage: ${formatSummary(summarize(reports.map((report) => report.totalDamage)))}`);

    for (const color of DAMAGE_COLORS) {
        console.log(`  ${color.padEnd(5)} damage: ${formatSummary(summarize(reports.map((report) => report.damageByColor[color])))}`);
    }

    const zeroDamage = reports.filter((report) => report.totalDamage === 0).length;
    const allTilesPlaced = reports.filter((report) => report.placed === HAND_SIZE).length;
    console.log(`  zero damage hands: ${zeroDamage}/${reports.length}`);
    console.log(`  all tiles placed:  ${allTilesPlaced}/${reports.length}`);
}

function printBattleReport(label, reports) {
    console.log(`\n${label}`);

    for (const report of reports) {
        const fights = report.fights;
        const winRate = report.wins / fights.length;
        console.log(
            `  ${report.battle.id} ${report.battle.name.padEnd(15)} `
            + `wins ${report.wins}/${fights.length} (${(winRate * 100).toFixed(0)}%) | `
            + `rounds ${formatSummary(summarize(fights.map((fight) => fight.rounds)))} | `
            + `enemy dmg ${formatSummary(summarize(fights.map((fight) => fight.totalEnemyDamage)))} | `
            + `player dmg ${formatSummary(summarize(fights.map((fight) => fight.totalPlayerDamage)))} | `
            + `dead-end ${fights.reduce((sum, fight) => sum + fight.deadEndRounds, 0)}`
            + `/${fights.reduce((sum, fight) => sum + fight.rounds, 0)} rounds`
        );
    }
}

function run() {
    const seed = Number(process.argv[2] || 20260508);
    const deckDefinition = createStartingDeck();
    const deck = deckDefinition.tiles;

    console.log(`Tilebreaker tile feasibility simulation`);
    console.log(`Seed: ${seed}`);
    console.log(`Tile set: ${deckDefinition.label}`);
    console.log(`Board: ${BOARD_SIZE}x${BOARD_SIZE}, hand: ${HAND_SIZE}, placement attempts per hand: ${PLACEMENT_ATTEMPTS}`);
    console.log(GUARANTEED_LOOP_HANDS
        ? `Hand smoothing: best of ${HAND_SELECTION_DRAWS} candidate draws`
        : 'Hand smoothing: off, honest single draw');
    console.log(`Capture damage: area * ${CAPTURE_DAMAGE_PER_AREA}`);
    console.log(`Round board cleanup: ${ROUND_BOARD_CLEANUP}, dead-end recovery: ${DEAD_END_RECOVERY}`);
    console.log(`Off-color leap: ${OFF_COLOR_LEAP_PLACEMENT}, distance: ${OFF_COLOR_LEAP_DISTANCE}, only blocked: ${OFF_COLOR_LEAP_ONLY_WHEN_BLOCKED}`);
    printDeck(deck);

    const modes = process.argv.includes('--with-loose') ? [true, false] : [true];

    for (const strictEdges of modes) {
        const rng = createRng(seed + (strictEdges ? 0 : 9999));
        const modeLabel = strictEdges
            ? 'STRICT edge matching'
            : 'LOOSE adjacency baseline';
        const handReports = analyzeHands(rng, deck, strictEdges);
        const battleReports = analyzeBattles(rng, deck, strictEdges);

        printHandReport(`\n=== ${modeLabel}: ${HAND_RUNS} ${GUARANTEED_LOOP_HANDS ? 'smoothed' : 'honest'} hands ===`, handReports);
        printBattleReport(`\n=== ${modeLabel}: theoretical battles, ${FIGHT_RUNS} fights each ===`, battleReports);
    }
}

run();
