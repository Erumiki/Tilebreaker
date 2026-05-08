import { discardTileIds, drawTileIds } from './run.js';

export const COMBAT_COLORS = ['red', 'blue', 'green'];
export const TILE_COLORS = ['red', 'blue', 'green', 'gray'];

const COLOR_SYMBOLS = {
    red: 'R',
    blue: 'B',
    green: 'G',
    gray: '.',
};

const DIRECTIONS = [
    { name: 'north', opposite: 'south', dx: 0, dy: -1 },
    { name: 'east', opposite: 'west', dx: 1, dy: 0 },
    { name: 'south', opposite: 'north', dx: 0, dy: 1 },
    { name: 'west', opposite: 'east', dx: -1, dy: 0 },
];

function pattern(rows) {
    return rows.map((row) => row.split(''));
}

function colorSymbol(color) {
    return COLOR_SYMBOLS[color] ?? '.';
}

function symbolToColor(symbol) {
    const match = Object.entries(COLOR_SYMBOLS)
        .find(([, value]) => value === symbol);

    return match?.[0] ?? 'gray';
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

function boardKey(x, y) {
    return `${x},${y}`;
}

function originalIndex(size, x, y) {
    return y * size + x;
}

function isInsideBoard(size, x, y) {
    return x >= 0 && y >= 0 && x < size && y < size;
}

function createEmptyBoard(size) {
    return Array.from({ length: size }, () => Array(size).fill(null));
}

function countPlacedTiles(board) {
    return board.reduce((sum, row) => (
        sum + row.filter(Boolean).length
    ), 0);
}

function isCombatTile(tileDef) {
    return COMBAT_COLORS.includes(tileDef?.color);
}

function isBlankEdge(tileDef, directionName) {
    return edge(tileDef, directionName).split('').every((symbol) => symbol === COLOR_SYMBOLS.gray);
}

function edgesMatch(tileDef, neighbor, direction, settings) {
    if (settings.grayWildcardPlacement === true && tileDef.color === 'gray' && neighbor.color === 'gray') {
        return true;
    }

    if (settings.grayWildcardPlacement === true && tileDef.color === 'gray' && isCombatTile(neighbor)) {
        return true;
    }

    if (settings.grayWildcardPlacement === true && neighbor.color === 'gray' && isCombatTile(tileDef)) {
        return isBlankEdge(tileDef, direction.name);
    }

    return edge(tileDef, direction.name) === edge(neighbor, direction.opposite);
}

function canPlaceAdjacentTile(board, tileDef, x, y, settings) {
    let hasNeighbor = false;

    for (const direction of DIRECTIONS) {
        const nextX = x + direction.dx;
        const nextY = y + direction.dy;

        if (!isInsideBoard(settings.boardSize, nextX, nextY)) {
            continue;
        }

        const neighbor = board[nextY][nextX];

        if (!neighbor) {
            continue;
        }

        hasNeighbor = true;

        if (!edgesMatch(tileDef, neighbor, direction, settings)) {
            return false;
        }
    }

    return hasNeighbor;
}

function hasDirectNeighbor(board, x, y, settings) {
    return DIRECTIONS.some((direction) => {
        const nextX = x + direction.dx;
        const nextY = y + direction.dy;

        return isInsideBoard(settings.boardSize, nextX, nextY) && Boolean(board[nextY][nextX]);
    });
}

function hasAnyAdjacentPlacement(board, tileDef, settings) {
    for (let y = 0; y < settings.boardSize; y += 1) {
        for (let x = 0; x < settings.boardSize; x += 1) {
            if (!board[y][x]
                && canPlaceAdjacentTile(board, tileDef, x, y, settings)) {
                return true;
            }
        }
    }

    return false;
}

function getDamagePerArea(settings) {
    if (settings.damageFormula?.type === 'areaMultiplier') {
        return settings.damageFormula.areaMultiplier ?? 1;
    }

    return settings.damagePerArea ?? 1;
}

function getLargeZoneBonus(settings, area) {
    const largeZoneBonus = settings.damageFormula?.largeZoneBonus;

    if (!largeZoneBonus) {
        return 0;
    }

    const minArea = largeZoneBonus.minArea ?? 0;
    const bonusPerArea = largeZoneBonus.bonusPerArea ?? 0;

    return Math.max(0, area - minArea) * bonusPerArea;
}

function getGrayInteriorBonus(settings, grayInteriorCells) {
    const grayBonus = settings.damageFormula?.grayInteriorBonus;

    if (!grayBonus) {
        return 0;
    }

    return grayInteriorCells * (grayBonus.bonusPerCell ?? 0);
}

function getZoneDamageBreakdown(settings, area, grayInteriorCells) {
    const areaDamage = area * getDamagePerArea(settings);
    const areaBonus = getLargeZoneBonus(settings, area);
    const grayBonus = getGrayInteriorBonus(settings, grayInteriorCells);

    return {
        areaDamage,
        areaBonus,
        grayBonus,
        baseDamage: areaDamage + areaBonus + grayBonus,
    };
}

function selectPrimaryAttackColor(attack) {
    let primaryColor = null;
    let primaryValue = -Infinity;
    let tied = false;

    for (const color of COMBAT_COLORS) {
        const value = attack[color] ?? 0;

        if (value > primaryValue) {
            primaryColor = color;
            primaryValue = value;
            tied = false;
            continue;
        }

        if (value === primaryValue) {
            tied = true;
        }
    }

    return tied ? null : primaryColor;
}

function evaluateHand(tileIds, tileMap, attack) {
    const loopPatterns = ['corner_rd', 'corner_dl', 'corner_ur', 'corner_lu'];
    const tiles = tileIds.map((tileId) => tileMap.get(tileId)).filter(Boolean);
    const primaryColor = selectPrimaryAttackColor(attack);
    let score = 0;

    for (const color of COMBAT_COLORS) {
        const colorTiles = tiles.filter((tileDef) => tileDef.color === color);
        const patterns = new Set(colorTiles.map((tileDef) => tileDef.pattern));
        const loopCount = loopPatterns.filter((patternName) => patterns.has(patternName)).length;

        score += loopCount * (color === primaryColor ? 8 : 5);

        if (loopCount === loopPatterns.length) {
            score += color === primaryColor ? 160 : 120;
        }

        score += colorTiles.length * ((attack[color] ?? 0) + 1);
    }

    return score;
}

function createTileMap(tiles) {
    return new Map(tiles.map((tileDef) => [tileDef.id, tileDef]));
}

function removeFirst(items, value) {
    const index = items.indexOf(value);

    if (index >= 0) {
        items.splice(index, 1);
        return true;
    }

    return false;
}

function getLoopTileIds(tiles, color) {
    const loopPatterns = ['corner_rd', 'corner_dl', 'corner_ur', 'corner_lu'];

    return loopPatterns
        .map((patternName) => tiles.find((tileDef) => (
            tileDef.color === color && tileDef.pattern === patternName
        ))?.id)
        .filter(Boolean);
}

function completeLoopFromDraw(run, tileIds, tiles, tileMap, attack) {
    const primaryColor = selectPrimaryAttackColor(attack);
    const colors = primaryColor
        ? [
            primaryColor,
            ...COMBAT_COLORS.filter((color) => color !== primaryColor),
        ]
        : COMBAT_COLORS;

    for (const color of colors) {
        const loopTileIds = getLoopTileIds(tiles, color);
        const handSet = new Set(tileIds);
        const missingIds = loopTileIds.filter((tileId) => !handSet.has(tileId));

        if (missingIds.length === 0) {
            return tileIds;
        }

        if (!missingIds.every((tileId) => run.drawPile.includes(tileId))) {
            continue;
        }

        const replaceableIndexes = tileIds
            .map((tileId, index) => ({ tileId, index }))
            .filter(({ tileId }) => !loopTileIds.includes(tileId))
            .map(({ index }) => index);

        if (replaceableIndexes.length < missingIds.length) {
            continue;
        }

        const replacedTileIds = [];
        const completed = [...tileIds];

        for (let index = 0; index < missingIds.length; index += 1) {
            const missingId = missingIds[index];
            const replaceIndex = replaceableIndexes[index];
            removeFirst(run.drawPile, missingId);
            replacedTileIds.push(completed[replaceIndex]);
            completed[replaceIndex] = missingId;
        }

        discardTileIds(run, replacedTileIds);
        completed.sort((leftId, rightId) => (
            evaluateHand([rightId], tileMap, attack) - evaluateHand([leftId], tileMap, attack)
        ));
        return completed;
    }

    return tileIds;
}

function getShapeGroup(tileDef) {
    const patternName = getTilePattern(tileDef);

    if (tileDef?.color === 'gray') {
        return 'gray';
    }

    if (patternName?.startsWith('corner_')) {
        return 'corner';
    }

    if (patternName === 'plus') {
        return 'plus';
    }

    if (patternName?.startsWith('line_')) {
        return 'line';
    }

    if (patternName?.startsWith('tee_')) {
        return 'tee';
    }

    return patternName ?? 'unknown';
}

function countOpeningGroups(entries, getGroup) {
    const counts = {};

    for (const entry of entries) {
        const group = getGroup(entry);
        counts[group] = (counts[group] ?? 0) + 1;
    }

    return counts;
}

function selectOpeningDrawEntries(drawOrder, tileMap, drawBag) {
    const openingDraws = Math.max(0, Math.floor(drawBag.openingDraws ?? 0));
    const targetCount = Math.min(openingDraws, drawOrder.length);
    const patternCaps = drawBag.patternCaps ?? {};
    const patternMinimums = drawBag.patternMinimums ?? {};
    const colorMinimums = drawBag.combatColorMinimums ?? {};
    const grayMax = Number.isFinite(drawBag.grayMax) ? drawBag.grayMax : Infinity;
    const entries = drawOrder.map((tileId, index) => ({
        tileId,
        index,
        tileDef: tileMap.get(tileId),
    }));
    const selected = [];
    const selectedIndexes = new Set();

    const canSelect = (entry) => {
        if (!entry.tileDef || selectedIndexes.has(entry.index)) {
            return false;
        }

        const group = getShapeGroup(entry.tileDef);
        const groupCount = selected.filter((selectedEntry) => (
            getShapeGroup(selectedEntry.tileDef) === group
        )).length;

        if (group === 'gray' && groupCount >= grayMax) {
            return false;
        }

        if (Number.isFinite(patternCaps[group]) && groupCount >= patternCaps[group]) {
            return false;
        }

        return true;
    };

    const selectFirst = (predicate) => {
        if (selected.length >= targetCount) {
            return false;
        }

        const entry = entries.find((candidate) => predicate(candidate) && canSelect(candidate));

        if (!entry) {
            return false;
        }

        selected.push(entry);
        selectedIndexes.add(entry.index);
        return true;
    };

    for (const [group, minimum] of Object.entries(patternMinimums)) {
        for (let count = 0; count < minimum; count += 1) {
            selectFirst((entry) => getShapeGroup(entry.tileDef) === group);
        }
    }

    for (const [color, minimum] of Object.entries(colorMinimums)) {
        for (let count = selected.filter((entry) => entry.tileDef?.color === color).length;
            count < minimum;
            count += 1) {
            if (!selectFirst((entry) => entry.tileDef?.color === color)) {
                break;
            }
        }
    }

    for (const entry of entries) {
        if (selected.length >= targetCount) {
            break;
        }

        if (canSelect(entry)) {
            selected.push(entry);
            selectedIndexes.add(entry.index);
        }
    }

    for (const entry of entries) {
        if (selected.length >= targetCount) {
            break;
        }

        if (!selectedIndexes.has(entry.index)) {
            selected.push(entry);
            selectedIndexes.add(entry.index);
        }
    }

    return selected.sort((left, right) => left.index - right.index);
}

export function applyOpeningDrawBag(run, tiles, settings = {}) {
    const drawBag = settings.drawBag;

    if (!drawBag?.enabled || run.drawPile.length === 0) {
        return null;
    }

    const battleKey = String(run.currentBattle ?? 1);
    run.openingBagBattles ??= [];

    if (run.openingBagBattles.includes(battleKey)) {
        return null;
    }

    const tileMap = createTileMap(tiles);
    const drawOrder = [...run.drawPile].reverse();
    const selected = selectOpeningDrawEntries(drawOrder, tileMap, drawBag);

    if (selected.length === 0) {
        return null;
    }

    const selectedIndexes = new Set(selected.map((entry) => entry.index));
    const rest = drawOrder
        .map((tileId, index) => ({ tileId, index }))
        .filter((entry) => !selectedIndexes.has(entry.index));
    const openingDrawIds = selected.map((entry) => entry.tileId);
    const nextDrawOrder = [
        ...openingDrawIds,
        ...rest.map((entry) => entry.tileId),
    ];

    run.drawPile = [...nextDrawOrder].reverse();
    run.openingBagBattles.push(battleKey);
    run.lastOpeningBag = {
        battle: run.currentBattle ?? 1,
        openingDraws: openingDrawIds.length,
        colors: countOpeningGroups(selected, (entry) => entry.tileDef?.color ?? 'unknown'),
        shapes: countOpeningGroups(selected, (entry) => getShapeGroup(entry.tileDef)),
    };

    return run.lastOpeningBag;
}

function hasAnyValidPlacement(board, hand, settings) {
    const playableTiles = isQueueDrawMode(settings) ? [hand[0]] : hand;

    return playableTiles.some((tileDef) => {
        if (!tileDef) {
            return false;
        }

        for (let y = 0; y < settings.boardSize; y += 1) {
            for (let x = 0; x < settings.boardSize; x += 1) {
                if (canPlaceTile(board, tileDef, x, y, settings)) {
                    return true;
                }
            }
        }

        return false;
    });
}

function isQueueDrawMode(settings) {
    return settings.drawMode === 'queue';
}

function drawTileDefs(run, tiles, count) {
    const tileMap = createTileMap(tiles);
    return drawTileIds(run, count)
        .map((tileId) => tileMap.get(tileId))
        .filter(Boolean);
}

function drawRoundHand({ run, tiles, battle, settings, round, board = null }) {
    const attack = getRoundAttack(battle, round);
    const tileMap = createTileMap(tiles);
    const shouldGuaranteeLoop = settings.guaranteedLoopHands === true;
    const candidateCount = shouldGuaranteeLoop ? settings.handSelectionDraws ?? 3 : 1;
    const candidates = [];

    for (let index = 0; index < candidateCount; index += 1) {
        const drawnTileIds = drawTileIds(run, settings.handSize);
        const tileIds = shouldGuaranteeLoop
            ? completeLoopFromDraw(
                run,
                drawnTileIds,
                tiles,
                tileMap,
                attack,
            )
            : drawnTileIds;

        if (tileIds.length === 0) {
            break;
        }

        candidates.push({
            tileIds,
            score: evaluateHand(tileIds, tileMap, attack)
                + (board && hasAnyValidPlacement(
                    board,
                    tileIds.map((tileId) => tileMap.get(tileId)).filter(Boolean),
                    settings,
                ) ? 10000 : 0),
        });
    }

    if (candidates.length === 0) {
        return [];
    }

    candidates.sort((left, right) => right.score - left.score);
    const [chosen, ...discarded] = candidates;

    for (const candidate of discarded) {
        discardTileIds(run, candidate.tileIds);
    }

    return chosen.tileIds.map((tileId) => tileMap.get(tileId)).filter(Boolean);
}

function drawRoundTiles({ run, tiles, battle, settings, round, board = null }) {
    if (isQueueDrawMode(settings)) {
        if (settings.guaranteedLoopHands === true) {
            return drawRoundHand({
                run,
                tiles,
                battle,
                settings,
                round,
                board,
            });
        }

        return drawTileDefs(run, tiles, settings.handSize ?? 7);
    }

    return drawRoundHand({
        run,
        tiles,
        battle,
        settings,
        round,
        board,
    });
}

function buildMicroGrid(board, boardSize) {
    const size = boardSize * 3;
    const cells = Array.from({ length: size }, () => Array(size).fill(null));

    for (let tileY = 0; tileY < boardSize; tileY += 1) {
        for (let tileX = 0; tileX < boardSize; tileX += 1) {
            const tileDef = board[tileY][tileX];

            if (!tileDef) {
                continue;
            }

            for (let y = 0; y < 3; y += 1) {
                for (let x = 0; x < 3; x += 1) {
                    cells[tileY * 3 + y][tileX * 3 + x] = tileDef.cells[y][x];
                }
            }
        }
    }

    return cells;
}

function floodOutsideForColor(grid, colorSymbolValue) {
    const size = grid.length;
    const expandedSize = size + 2;
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

function findCapturedAreas(board, settings) {
    const grid = buildMicroGrid(board, settings.boardSize);
    const zones = [];

    for (const color of COMBAT_COLORS) {
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

                const region = collectEnclosedRegion(
                    grid,
                    colorSymbolValue,
                    reachable,
                    { x, y },
                    visited,
                );
                const area = region.interiorCells.length + region.boundaryCells.length;
                const grayInteriorCells = region.interiorCells.filter((cell) => {
                    const tileDef = board[Math.floor(cell.y / 3)]?.[Math.floor(cell.x / 3)];

                    return tileDef?.color === 'gray';
                }).length;
                const damage = getZoneDamageBreakdown(settings, area, grayInteriorCells);

                if (region.interiorCells.length === 0 || region.boundaryCells.length === 0) {
                    continue;
                }

                zones.push({
                    color,
                    interiorSize: region.interiorCells.length,
                    boundarySize: region.boundaryCells.length,
                    area,
                    areaDamage: damage.areaDamage,
                    areaBonus: damage.areaBonus,
                    grayInteriorCells,
                    grayBonus: damage.grayBonus,
                    baseDamage: damage.baseDamage,
                    damage: damage.baseDamage,
                    interiorCells: region.interiorCells,
                    boundaryCells: region.boundaryCells,
                });
            }
        }
    }

    return zones;
}

function cloneBoard(board) {
    return board.map((row) => [...row]);
}

function getScoredTileKeys(result) {
    const scoredTileKeys = new Set();

    if (!result) {
        return scoredTileKeys;
    }

    for (const zone of result.score.zones) {
        for (const cell of [...zone.interiorCells, ...zone.boundaryCells]) {
            scoredTileKeys.add(boardKey(
                Math.floor(cell.x / 3),
                Math.floor(cell.y / 3),
            ));
        }
    }

    return scoredTileKeys;
}

function clearScoredTiles(board, result) {
    const nextBoard = cloneBoard(board);
    const scoredTileKeys = getScoredTileKeys(result);

    for (const tileKey of scoredTileKeys) {
        const [x, y] = tileKey.split(',').map(Number);

        if (nextBoard[y]?.[x]) {
            nextBoard[y][x] = null;
        }
    }

    return nextBoard;
}

function prepareNextRoundBoard(state, settings) {
    if (settings.roundBoardCleanup === 'clearAll') {
        return createEmptyBoard(settings.boardSize);
    }

    if (settings.roundBoardCleanup === 'clearScoredTiles') {
        return clearScoredTiles(state.board, state.lastResult);
    }

    return cloneBoard(state.board);
}

function isPlacementPayoffVariant(settings) {
    return settings.gameplayVariant === 'placement_payoff';
}

function getPlacementPayoffRules(settings) {
    return {
        focusPerUsefulPlacement: settings.placementPayoff?.focusPerUsefulPlacement ?? 1,
        maxFocus: settings.placementPayoff?.maxFocus ?? 4,
        bonusPerFocus: settings.placementPayoff?.bonusPerFocus ?? 3,
    };
}

function addPlacementFocus(state, settings, amount) {
    const rules = getPlacementPayoffRules(settings);
    const before = state.placementFocus ?? 0;
    state.placementFocus = Math.min(rules.maxFocus, before + amount);
    state.lastPlacementFocusDelta = state.placementFocus - before;
}

function applyPlacementFocusToScore(state, score, settings) {
    if (!isPlacementPayoffVariant(settings) || score.zones.length === 0) {
        return {
            focusSpent: 0,
            focusBonus: 0,
        };
    }

    const rules = getPlacementPayoffRules(settings);
    const focusSpent = Math.min(state.placementFocus ?? 0, rules.maxFocus);

    if (focusSpent <= 0) {
        return {
            focusSpent: 0,
            focusBonus: 0,
        };
    }

    const focusBonus = focusSpent * rules.bonusPerFocus;
    const targetZone = score.zones.reduce((best, zone) => (
        zone.area > best.area ? zone : best
    ), score.zones[0]);

    targetZone.focusBonus = (targetZone.focusBonus ?? 0) + focusBonus;
    targetZone.damage += focusBonus;
    score.damageByColor[targetZone.color] += focusBonus;
    score.totalDamage += focusBonus;
    state.placementFocus = 0;

    return {
        focusSpent,
        focusBonus,
    };
}

export function createTilesFromManifest(manifest, settings = {}) {
    const deckSize = settings.startingDeckSize ?? manifest.tiles.length;

    return manifest.tiles.slice(0, deckSize).map((entry) => {
        const symbol = colorSymbol(entry.color);
        const rows = entry.matrix.map((row) => row.replaceAll('X', symbol));

        return {
            id: entry.id,
            file: entry.file,
            color: entry.color,
            pattern: entry.pattern,
            cells: pattern(rows),
        };
    });
}

function getTilePattern(tileDef) {
    return tileDef.pattern ?? tileDef.kind;
}

function getRecipeCount(entry) {
    return Math.max(0, Math.floor(entry.count ?? 1));
}

function findRecipeTile(tiles, entry, color = null) {
    if (entry.id) {
        return tiles.find((tileDef) => tileDef.id === entry.id);
    }

    return tiles.find((tileDef) => (
        tileDef.color === color
        && getTilePattern(tileDef) === entry.pattern
    ));
}

export function createStartingDeckIds(tiles, settings = {}) {
    const recipe = settings.startingDeckRecipe;

    if (!Array.isArray(recipe) || recipe.length === 0) {
        return tiles.map((tileDef) => tileDef.id);
    }

    const deckIds = [];

    for (const entry of recipe) {
        const count = getRecipeCount(entry);

        if (count === 0) {
            continue;
        }

        if (entry.id) {
            const tileDef = findRecipeTile(tiles, entry);

            if (!tileDef) {
                throw new Error(`Unknown startingDeckRecipe tile id: ${entry.id}`);
            }

            for (let index = 0; index < count; index += 1) {
                deckIds.push(tileDef.id);
            }
            continue;
        }

        const colors = entry.colors ?? [entry.color];

        if (!entry.pattern || !colors.every(Boolean)) {
            throw new Error('startingDeckRecipe entries need id or pattern + color/colors');
        }

        for (const color of colors) {
            const tileDef = findRecipeTile(tiles, entry, color);

            if (!tileDef) {
                throw new Error(`Unknown startingDeckRecipe tile: ${color}:${entry.pattern}`);
            }

            for (let index = 0; index < count; index += 1) {
                deckIds.push(tileDef.id);
            }
        }
    }

    return deckIds;
}

export function createTileBattleState({ battle, run, settings, tiles }) {
    const round = 1;
    applyOpeningDrawBag(run, tiles, settings);
    const roundTiles = drawRoundTiles({
        run,
        tiles,
        battle,
        settings,
        round,
        board: createEmptyBoard(settings.boardSize),
    });
    const hand = isQueueDrawMode(settings) ? roundTiles.slice(0, 2) : roundTiles;

    return {
        round,
        playerHp: run.playerHp,
        enemyHp: battle.enemyHp,
        board: createEmptyBoard(settings.boardSize),
        hand,
        selectedHandIndex: hand.findIndex(Boolean),
        queueReserve: isQueueDrawMode(settings) ? roundTiles.slice(2) : [],
        playedThisRound: [],
        queuePlayedThisRound: 0,
        phase: 'placing',
        lastResult: null,
        outcome: null,
        placementFocus: 0,
        lastPlacementFocusDelta: 0,
        lastPlacementClosedZones: 0,
    };
}

export function getRoundAttack(battle, round) {
    const attacks = battle.attacks ?? [{ red: 1, blue: 1, green: 1 }];
    return attacks[(round - 1) % attacks.length];
}

export function canPlaceTile(board, tileDef, x, y, settings) {
    if (!tileDef || !isInsideBoard(settings.boardSize, x, y) || board[y][x]) {
        return false;
    }

    if (countPlacedTiles(board) === 0) {
        return true;
    }

    if (canPlaceAdjacentTile(board, tileDef, x, y, settings)) {
        return true;
    }

    if (hasDirectNeighbor(board, x, y, settings)) {
        return false;
    }

    return true;
}

export function placeTile(state, settings, x, y) {
    const tileDef = state.hand[state.selectedHandIndex];

    if (!canPlaceTile(state.board, tileDef, x, y, settings)) {
        return false;
    }

    const placedBefore = countPlacedTiles(state.board);
    const hadDirectNeighbor = hasDirectNeighbor(state.board, x, y, settings);
    state.board[y][x] = tileDef;
    const postPlacementScore = scoreTileBoard(state.board, settings);
    state.lastPlacementClosedZones = postPlacementScore.zones.length;
    state.lastPlacementFocusDelta = 0;

    if (isPlacementPayoffVariant(settings)
        && placedBefore > 0
        && hadDirectNeighbor
        && postPlacementScore.zones.length === 0) {
        addPlacementFocus(
            state,
            settings,
            getPlacementPayoffRules(settings).focusPerUsefulPlacement,
        );
    }

    state.playedThisRound.push(tileDef.id);
    state.queuePlayedThisRound += isQueueDrawMode(settings) ? 1 : 0;
    state.hand[state.selectedHandIndex] = null;
    const nextIndex = state.hand.findIndex(Boolean);
    state.selectedHandIndex = nextIndex >= 0 ? nextIndex : -1;
    return true;
}

export function scoreTileBoard(board, settings, run = null) {
    const zones = findCapturedAreas(board, settings);
    const damageByColor = Object.fromEntries(TILE_COLORS.map((color) => [color, 0]));

    for (const zone of zones) {
        const color = symbolToColor(colorSymbol(zone.color));
        const multiplier = run?.colorMultipliers?.[color] ?? 1;
        zone.damage = zone.baseDamage * multiplier;
        zone.multiplier = multiplier;
        damageByColor[color] += zone.damage;
    }

    return {
        zones,
        damageByColor,
        totalDamage: COMBAT_COLORS.reduce((sum, color) => (
            sum + damageByColor[color]
        ), 0),
    };
}

export function resolveTileRound(state, battle, settings, run = null) {
    const attack = getRoundAttack(battle, state.round);
    const score = scoreTileBoard(state.board, settings, run);
    const placementPayoff = applyPlacementFocusToScore(state, score, settings);
    let enemyDamage = 0;
    let playerDamage = 0;
    const byColor = {};

    for (const color of COMBAT_COLORS) {
        const closedDamage = score.damageByColor[color] || 0;
        const threat = attack[color] || 0;

        if (closedDamage > threat) {
            enemyDamage += closedDamage;
            byColor[color] = {
                threat,
                closedDamage,
                enemyDamage: closedDamage,
                playerDamage: 0,
            };
        } else {
            const missing = Math.max(0, threat - closedDamage);
            playerDamage += missing;
            byColor[color] = {
                threat,
                closedDamage,
                enemyDamage: 0,
                playerDamage: missing,
            };
        }
    }

    state.enemyHp = Math.max(0, state.enemyHp - enemyDamage);
    state.playerHp = Math.max(0, state.playerHp - playerDamage);
    state.phase = 'result';
    state.lastResult = {
        attack,
        score,
        byColor,
        enemyDamage,
        playerDamage,
        placementFocusSpent: placementPayoff.focusSpent,
        placementFocusBonus: placementPayoff.focusBonus,
        placementFocusRemaining: state.placementFocus ?? 0,
        scoredTileKeys: [...getScoredTileKeys({ score })],
    };

    if (state.enemyHp <= 0) {
        state.outcome = 'victory';
    } else if (state.playerHp <= 0) {
        state.outcome = 'defeat';
    }

    return state.lastResult;
}

export function discardRoundHand(run, state) {
    const unplayedTileIds = state.hand
        .filter(Boolean)
        .map((tileDef) => tileDef.id);
    const reserveTileIds = state.queueReserve
        ?.filter(Boolean)
        .map((tileDef) => tileDef.id) ?? [];

    discardTileIds(run, [
        ...state.playedThisRound,
        ...unplayedTileIds,
        ...reserveTileIds,
    ]);
    state.hand = state.hand.map(() => null);
    state.queueReserve = [];
    state.playedThisRound = [];
    state.queuePlayedThisRound = 0;
    state.selectedHandIndex = -1;
}

export function advanceTileQueue(run, state, settings, tiles) {
    if (!isQueueDrawMode(settings) || state.phase !== 'placing') {
        return;
    }

    const roundLimit = settings.handSize ?? 7;

    if (state.queuePlayedThisRound >= roundLimit) {
        state.selectedHandIndex = -1;
        return;
    }

    const nextTile = state.hand[1] ?? null;
    const drawn = [];

    while (drawn.length < (nextTile ? 1 : 2) && state.queueReserve?.length > 0) {
        drawn.push(state.queueReserve.shift());
    }

    if (drawn.length < (nextTile ? 1 : 2)) {
        drawn.push(...drawTileDefs(run, tiles, (nextTile ? 1 : 2) - drawn.length));
    }

    state.hand = [
        nextTile ?? drawn.shift() ?? null,
        drawn.shift() ?? null,
    ];
    state.selectedHandIndex = state.hand[0] ? 0 : -1;
}

export function startNextTileRound(state, { run, battle, settings, tiles }) {
    state.round += 1;
    state.board = prepareNextRoundBoard(state, settings);
    const roundTiles = drawRoundTiles({
        run,
        tiles,
        battle,
        settings,
        round: state.round,
        board: state.board,
    });
    state.hand = isQueueDrawMode(settings) ? roundTiles.slice(0, 2) : roundTiles;
    state.queueReserve = isQueueDrawMode(settings) ? roundTiles.slice(2) : [];

    if (settings.deadEndRecovery === 'freshStart'
        && countPlacedTiles(state.board) > 0
        && !hasAnyValidPlacement(state.board, state.hand, settings)) {
        state.board = createEmptyBoard(settings.boardSize);
    }

    state.selectedHandIndex = state.hand.findIndex(Boolean);
    state.queuePlayedThisRound = 0;
    state.lastPlacementFocusDelta = 0;
    state.lastPlacementClosedZones = 0;
    state.phase = 'placing';
    state.lastResult = null;
    state.outcome = null;
}

export function getBoardPlacementMap(board) {
    const placements = new Map();

    for (let y = 0; y < board.length; y += 1) {
        for (let x = 0; x < board[y].length; x += 1) {
            if (board[y][x]) {
                placements.set(boardKey(x, y), board[y][x]);
            }
        }
    }

    return placements;
}
