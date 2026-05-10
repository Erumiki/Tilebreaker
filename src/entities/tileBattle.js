import { discardTileIds, drawTileIds } from './run.js';
import { getGameplayVariant } from './gameplayVariants.js';

export const COMBAT_COLORS = ['red', 'blue', 'green'];
export const TILE_COLORS = ['red', 'blue', 'green', 'gray', 'universal'];

const COLOR_SYMBOLS = {
    red: 'R',
    blue: 'B',
    green: 'G',
    gray: '.',
    universal: '*',
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

function isCombatSymbol(symbol) {
    return COMBAT_COLORS.some((color) => colorSymbol(color) === symbol);
}

function isUniversalSymbol(symbol) {
    return symbol === COLOR_SYMBOLS.universal;
}

function isOneColorChainVariant(settings = {}) {
    return settings.gameplayVariant === 'one_color_chain';
}

function isConnectTargetsVariant(settings = {}) {
    return settings.gameplayVariant === 'connect_targets';
}

function isRoadModeVariant(settings = {}) {
    return settings.gameplayVariant === 'road_mode';
}

function isLegacyVariant(settings = {}) {
    return getGameplayVariant(settings).id === 'legacy';
}

function isRouteGateVariant(settings = {}) {
    return isConnectTargetsVariant(settings) || isRoadModeVariant(settings);
}

function isOneColorLandVariant(settings = {}) {
    return isOneColorChainVariant(settings)
        || (isConnectTargetsVariant(settings) && settings.connectTargets?.oneColorLand !== false)
        || (isRoadModeVariant(settings) && settings.roadMode?.oneColorLand !== false);
}

function normalizeRuleSymbol(symbol, settings = {}) {
    if (isOneColorLandVariant(settings) && isCombatSymbol(symbol)) {
        return COLOR_SYMBOLS.red;
    }

    return symbol;
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

function ruleEdge(tileDef, direction, settings) {
    return edge(tileDef, direction)
        .split('')
        .map((symbol) => normalizeRuleSymbol(symbol, settings))
        .join('');
}

function getActiveCombatSymbols(settings = {}) {
    const colors = Array.isArray(settings.activeCombatColors)
        ? settings.activeCombatColors.filter((color) => COMBAT_COLORS.includes(color))
        : COMBAT_COLORS;

    return new Set((colors.length > 0 ? colors : COMBAT_COLORS).map(colorSymbol));
}

function symbolMatches(left, right, settings) {
    if (left === right) {
        return true;
    }

    const activeCombatSymbols = getActiveCombatSymbols(settings);

    return (isUniversalSymbol(left) && activeCombatSymbols.has(right))
        || (isUniversalSymbol(right) && activeCombatSymbols.has(left));
}

function ruleEdgesMatch(leftEdge, rightEdge, settings) {
    return leftEdge.split('').every((symbol, index) => (
        symbolMatches(symbol, rightEdge[index], settings)
    ));
}

function isBoundaryForColor(symbol, colorSymbolValue) {
    return symbol === colorSymbolValue || isUniversalSymbol(symbol);
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

function shouldUseStartingBoardTile(entry, settings) {
    if (!Array.isArray(entry.gameplayVariants) || entry.gameplayVariants.length === 0) {
        return true;
    }

    return entry.gameplayVariants.includes(getGameplayVariant(settings).id);
}

function findTileById(tiles, tileId) {
    return tiles.find((tileDef) => tileDef.id === tileId);
}

function isMacroTile(tileDef) {
    return tileDef?.special === 'double_macro_tile'
        && Array.isArray(tileDef.segments);
}

function getSegmentOffset(segment) {
    const [x = 0, y = 0] = Array.isArray(segment.offset) ? segment.offset : [];

    return {
        x: Math.floor(x),
        y: Math.floor(y),
    };
}

function getTilePlacementSegments(tileDef, originX, originY) {
    if (!isMacroTile(tileDef)) {
        return [{
            x: originX,
            y: originY,
            tileDef,
            sourceTileId: tileDef?.id,
        }];
    }

    return tileDef.segments.map((segment) => {
        const offset = getSegmentOffset(segment);

        return {
            x: originX + offset.x,
            y: originY + offset.y,
            tileDef: segment.tileDef,
            sourceTileId: tileDef.id,
        };
    });
}

export function getTilePlacementCells(tileDef, originX, originY) {
    return getTilePlacementSegments(tileDef, originX, originY)
        .map((segment) => ({
            x: segment.x,
            y: segment.y,
            tileDef: segment.tileDef,
            tileId: segment.tileDef?.id ?? null,
            sourceTileId: segment.sourceTileId,
        }));
}

function getValidTilePlacementSegments(board, tileDef, originX, originY, settings) {
    const segments = getTilePlacementSegments(tileDef, originX, originY);
    const segmentByKey = new Map();

    for (const segment of segments) {
        if (!segment.tileDef || !isInsideBoard(settings.boardSize, segment.x, segment.y)) {
            return null;
        }

        const keyValue = boardKey(segment.x, segment.y);

        if (segmentByKey.has(keyValue) || board[segment.y][segment.x]) {
            return null;
        }

        segmentByKey.set(keyValue, segment);
    }

    return {
        segments,
        segmentByKey,
    };
}

function createStartingBoard(settings, tiles) {
    const board = createEmptyBoard(settings.boardSize);
    const entries = Array.isArray(settings.startingBoardTiles)
        ? settings.startingBoardTiles
        : [];

    for (const entry of entries) {
        if (!shouldUseStartingBoardTile(entry, settings)) {
            continue;
        }

        const x = Math.floor(entry.x);
        const y = Math.floor(entry.y);
        const tileDef = findTileById(tiles, entry.id);

        if (!tileDef) {
            throw new Error(`Unknown startingBoardTiles tile id: ${entry.id}`);
        }

        if (!isInsideBoard(settings.boardSize, x, y)) {
            throw new Error(`startingBoardTiles entry is outside the board: ${entry.id} at ${x},${y}`);
        }

        if (!canPlaceTile(board, tileDef, x, y, settings)) {
            throw new Error(`startingBoardTiles entry cannot be placed: ${entry.id} at ${x},${y}`);
        }

        board[y][x] = tileDef;
    }

    return board;
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

    return ruleEdgesMatch(
        ruleEdge(tileDef, direction.name, settings),
        ruleEdge(neighbor, direction.opposite, settings),
        settings,
    );
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

function canPlaceMacroTile(board, tileDef, originX, originY, settings) {
    const placement = getValidTilePlacementSegments(board, tileDef, originX, originY, settings);

    if (!placement) {
        return false;
    }

    for (const segment of placement.segments) {
        for (const direction of DIRECTIONS) {
            const nextX = segment.x + direction.dx;
            const nextY = segment.y + direction.dy;

            if (!isInsideBoard(settings.boardSize, nextX, nextY)) {
                continue;
            }

            const internalNeighbor = placement.segmentByKey.get(boardKey(nextX, nextY));

            if (internalNeighbor) {
                if (!edgesMatch(segment.tileDef, internalNeighbor.tileDef, direction, settings)) {
                    return false;
                }
                continue;
            }

            const neighbor = board[nextY][nextX];

            if (neighbor && !edgesMatch(segment.tileDef, neighbor, direction, settings)) {
                return false;
            }
        }
    }

    return true;
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

function convertRawZoneDamageToHearts(settings, rawDamage) {
    const damagePerHeart = settings.hearts?.zoneDamagePerHeart ?? 0;

    if (getGameplayVariant(settings).id !== 'legacy'
        || damagePerHeart <= 0
        || rawDamage <= 0) {
        return rawDamage;
    }

    const minimumHearts = settings.hearts?.minimumZoneHearts ?? 1;

    return Math.max(minimumHearts, Math.floor(rawDamage / damagePerHeart));
}

function getZoneDamageBreakdown(settings, area, grayInteriorCells) {
    const areaDamage = area * getDamagePerArea(settings);
    const areaBonus = getLargeZoneBonus(settings, area);
    const grayBonus = getGrayInteriorBonus(settings, grayInteriorCells);
    const rawDamage = areaDamage + areaBonus + grayBonus;

    return {
        areaDamage,
        areaBonus,
        grayBonus,
        rawDamage,
        baseDamage: convertRawZoneDamageToHearts(settings, rawDamage),
    };
}

function countUnplayedHandTiles(state) {
    return state.hand
        ?.filter(Boolean)
        .length ?? 0;
}

function getHandSubmitRules(settings) {
    return {
        baseDamage: settings.handSubmit?.baseDamage
            ?? settings.hearts?.newPickBaseDamage
            ?? 0,
        unplayedTilesPerDamage: settings.handSubmit?.unplayedTilesPerDamage
            ?? settings.hearts?.unplayedTilesPerDamage
            ?? 0,
        submitsPerExtraDamage: settings.handSubmit?.submitsPerExtraDamage ?? 2,
    };
}

function getGoldRules(settings) {
    return {
        closureGold: settings.gold?.closureGold ?? 1,
        strikeGoldPerCount: settings.gold?.strikeGoldPerCount ?? 1,
    };
}

function getFieldResourceRules(settings) {
    const resources = settings.fieldResources ?? {};

    return {
        enabled: resources.enabled === true,
        gold: {
            count: Math.max(0, Math.floor(resources.gold?.count ?? 0)),
            amount: Math.max(0, resources.gold?.amount ?? 1),
        },
        heart: {
            count: Math.max(0, Math.floor(resources.heart?.count ?? 0)),
            amount: Math.max(0, resources.heart?.amount ?? 1),
        },
    };
}

function getMaxPlayerHp(settings, run = null) {
    return run?.maxPlayerHp
        ?? settings.hearts?.maxPlayerHp
        ?? settings.startingPlayerHp
        ?? Infinity;
}

function createFieldResourceRandom(run) {
    let state = ((run?.rngState ?? 20260508)
        ^ ((run?.currentBattle ?? 1) * 0x9e3779b9)) >>> 0;

    return () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 0x100000000;
    };
}

function createFieldResources(board, settings, run) {
    const rules = getFieldResourceRules(settings);

    if (!isLegacyVariant(settings) || !rules.enabled) {
        return [];
    }

    const cells = [];

    for (let y = 0; y < settings.boardSize; y += 1) {
        for (let x = 0; x < settings.boardSize; x += 1) {
            if (!board[y][x]) {
                cells.push({ x, y });
            }
        }
    }

    const random = createFieldResourceRandom(run);
    const resources = [];
    const battleNumber = run?.currentBattle ?? 1;
    const takeCell = () => {
        if (cells.length === 0) {
            return null;
        }

        const index = Math.floor(random() * cells.length);
        const [cell] = cells.splice(index, 1);
        return cell;
    };
    const addResources = (type, count, amount) => {
        for (let index = 0; index < count; index += 1) {
            const cell = takeCell();

            if (!cell) {
                return;
            }

            resources.push({
                id: `${battleNumber}_${type}_${index + 1}`,
                type,
                x: cell.x,
                y: cell.y,
                amount,
                consumed: false,
                consumedBy: null,
            });
        }
    };

    addResources('gold', rules.gold.count, rules.gold.amount);
    addResources('heart', rules.heart.count, rules.heart.amount);

    return resources;
}

function addBattleLog(state, message) {
    state.battleLog ??= [];
    state.battleLog.push(message);

    if (state.battleLog.length > 6) {
        state.battleLog.splice(0, state.battleLog.length - 6);
    }
}

function addResourceEvent(state, event) {
    state.resourceEvents ??= [];
    state.resourceEvents.push(event);

    if (state.resourceEvents.length > 12) {
        state.resourceEvents.splice(0, state.resourceEvents.length - 12);
    }
}

function describeResource(resource) {
    return {
        id: resource.id,
        type: resource.type,
        x: resource.x,
        y: resource.y,
        amount: resource.amount,
    };
}

function consumeResources(resources, source) {
    for (const resource of resources) {
        resource.consumed = true;
        resource.consumedBy = source;
    }
}

function getUnconsumedResourcesAt(state, x, y, type = null) {
    return (state.boardResources ?? []).filter((resource) => (
        !resource.consumed
        && resource.x === x
        && resource.y === y
        && (!type || resource.type === type)
    ));
}

function collectPlacementResources(state, run, settings, x, y) {
    const resources = getUnconsumedResourcesAt(state, x, y);
    const goldResources = resources.filter((resource) => resource.type === 'gold');
    const heartResources = resources.filter((resource) => resource.type === 'heart');
    const amount = goldResources.reduce((sum, resource) => sum + (resource.amount ?? 0), 0);
    const heartAmount = heartResources.reduce((sum, resource) => sum + (resource.amount ?? 0), 0);
    const goldBefore = run?.gold ?? 0;
    const playerHeartsBefore = state.playerHp ?? 0;
    const maxPlayerHp = getMaxPlayerHp(settings, run);
    const heartHeal = Math.max(0, Math.min(heartAmount, maxPlayerHp - playerHeartsBefore));
    const result = {
        source: 'placement',
        type: resources.length === 1 ? resources[0].type : 'mixed',
        amount,
        goldAmount: amount,
        heartAmount,
        heartHeal,
        resources: resources.map(describeResource),
        goldBefore,
        goldAfter: goldBefore + amount,
        playerHeartsBefore,
        playerHeartsAfter: playerHeartsBefore + heartHeal,
    };

    state.lastPlacementResourceResult = result;

    if (resources.length === 0) {
        return result;
    }

    consumeResources(resources, 'placement');

    if (run) {
        run.gold = goldBefore + amount;
        result.goldAfter = run.gold;
    }

    if (heartResources.length > 0) {
        state.playerHp = playerHeartsBefore + heartHeal;
        if (run) {
            run.playerHp = state.playerHp;
        }
        result.playerHeartsAfter = state.playerHp;
    }

    addResourceEvent(state, result);

    if (amount > 0) {
        addBattleLog(state, `Field gold picked up: +${amount} gold.`);
    }

    if (heartResources.length > 0) {
        addBattleLog(
            state,
            heartHeal > 0
                ? `Heart picked up: +${heartHeal} hearts.`
                : 'Heart picked up: already at max hearts.',
        );
    }

    return result;
}

function addClosureResourceLogs(state, result) {
    if ((result.goldAmount ?? 0) > 0) {
        addBattleLog(state, `Field gold sealed: +${result.goldAmount} gold.`);
    }

    if ((result.heartAmount ?? 0) > 0) {
        addBattleLog(
            state,
            (result.heartHeal ?? 0) > 0
                ? `Heart sealed: +${result.heartHeal} hearts.`
                : 'Heart sealed: already at max hearts.',
        );
    }
}

function collectClosureResources(state, run, settings, score, options = {}) {
    const scoredTileKeys = getScoredTileKeys({ score });
    const resources = (state.boardResources ?? []).filter((resource) => (
        !resource.consumed
        && scoredTileKeys.has(boardKey(resource.x, resource.y))
    ));
    const goldResources = resources.filter((resource) => resource.type === 'gold');
    const heartResources = resources.filter((resource) => resource.type === 'heart');
    const goldAmount = goldResources.reduce((sum, resource) => sum + (resource.amount ?? 0), 0);
    const heartAmount = heartResources.reduce((sum, resource) => sum + (resource.amount ?? 0), 0);
    const goldBefore = run?.gold ?? 0;
    const playerHeartsBefore = state.playerHp ?? 0;
    const maxPlayerHp = getMaxPlayerHp(settings, run);
    const heartHeal = Math.max(0, Math.min(heartAmount, maxPlayerHp - playerHeartsBefore));
    const result = {
        source: 'closure',
        resources: resources.map(describeResource),
        goldAmount,
        heartAmount,
        heartHeal,
        goldBefore,
        goldAfter: goldBefore + goldAmount,
        playerHeartsBefore,
        playerHeartsAfter: playerHeartsBefore + heartHeal,
    };

    state.lastClosureResourceResult = result;

    if (resources.length === 0) {
        return result;
    }

    consumeResources(resources, 'closure');

    if (run && goldAmount > 0) {
        run.gold = goldBefore + goldAmount;
        result.goldAfter = run.gold;
    }

    if (heartResources.length > 0) {
        state.playerHp = playerHeartsBefore + heartHeal;
        if (run) {
            run.playerHp = state.playerHp;
        }
        result.playerHeartsAfter = state.playerHp;
    }

    addResourceEvent(state, result);

    if (options.log !== false) {
        addClosureResourceLogs(state, result);
    }

    return result;
}

function computeHandSubmitCostPreview(state, settings, options = {}) {
    if (!isLegacyVariant(settings)) {
        return {
            baseDamage: 0,
            unplayedHandCards: countUnplayedHandTiles(state),
            unplayedTiles: countUnplayedHandTiles(state),
            unplayedDamage: 0,
            handSubmitsThisBattle: state.handSubmitsThisBattle ?? 0,
            submitDamage: 0,
            totalDamage: 0,
            handSubmitLocked: false,
            canPay: true,
        };
    }

    const rules = getHandSubmitRules(settings);
    const unplayedHandCards = countUnplayedHandTiles(state);
    const handSubmitsThisBattle = state.handSubmitsThisBattle ?? 0;
    const unplayedDamage = rules.unplayedTilesPerDamage > 0
        ? Math.floor(unplayedHandCards / rules.unplayedTilesPerDamage)
        : 0;
    const submitDamage = rules.submitsPerExtraDamage > 0
        ? Math.floor(handSubmitsThisBattle / rules.submitsPerExtraDamage)
        : 0;
    const totalDamage = Math.max(0, rules.baseDamage + unplayedDamage + submitDamage);
    const handSubmitLocked = options.ignoreLock ? false : state.handSubmitLocked === true;
    const lockedDamage = handSubmitLocked
        ? Math.max(totalDamage, state.lockedSubmitCost ?? totalDamage)
        : totalDamage;

    return {
        baseDamage: rules.baseDamage,
        unplayedHandCards,
        unplayedTiles: unplayedHandCards,
        unplayedDamage,
        handSubmitsThisBattle,
        submitDamage,
        totalDamage: lockedDamage,
        handSubmitLocked,
        canPay: !handSubmitLocked && (state.playerHp ?? 0) > totalDamage,
    };
}

export function getHandSubmitCostPreview(state, settings) {
    return computeHandSubmitCostPreview(state, settings);
}

function updateHandSubmitLock(state, settings) {
    if (!isLegacyVariant(settings)) {
        state.handSubmitLocked = false;
        state.lockedSubmitCost = null;
        return;
    }

    const wasLocked = state.handSubmitLocked === true;
    const preview = computeHandSubmitCostPreview(state, settings, { ignoreLock: true });
    state.handSubmitLocked = preview.canPay === false;
    state.lockedSubmitCost = state.handSubmitLocked ? preview.totalDamage : null;

    if (state.handSubmitLocked && !wasLocked && Array.isArray(state.battleLog)) {
        addBattleLog(
            state,
            `Last chance hand: cannot submit ${preview.totalDamage} hearts.`,
        );
    }
}

export function getNewPickDamagePreview(state, settings) {
    if (getGameplayVariant(settings).id !== 'legacy') {
        return {
            baseDamage: 0,
            unplayedTiles: countUnplayedHandTiles(state),
            unplayedDamage: 0,
            totalDamage: 0,
        };
    }

    const heartRules = settings.hearts ?? {};
    const baseDamage = heartRules.newPickBaseDamage ?? 0;
    const tilesPerDamage = heartRules.unplayedTilesPerDamage ?? 0;
    const unplayedTiles = countUnplayedHandTiles(state);
    const unplayedDamage = tilesPerDamage > 0
        ? Math.floor(unplayedTiles / tilesPerDamage)
        : 0;

    return {
        baseDamage,
        unplayedTiles,
        unplayedDamage,
        totalDamage: Math.max(0, baseDamage + unplayedDamage),
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

function hasAnyValidPlacement(board, hand, settings, heldTile = null) {
    const playableTiles = isQueueDrawMode(settings) ? [hand[0]] : hand;
    const tilesToCheck = isHoldEnabled(settings) && heldTile
        ? [...playableTiles, heldTile]
        : playableTiles;

    return tilesToCheck.some((tileDef) => {
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

function isHoldEnabled(settings) {
    return settings.holdEnabled === true && !isQueueDrawMode(settings);
}

function drawTileDefs(run, tiles, count) {
    const tileMap = createTileMap(tiles);
    return drawTileIds(run, count)
        .map((tileId) => tileMap.get(tileId))
        .filter(Boolean);
}

function drawRoundHand({ run, tiles, battle, settings, round, board = null }) {
    const attack = getRoundAttack(battle, round, settings);
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

function buildMicroGrid(board, settings) {
    const size = settings.boardSize * 3;
    const cells = Array.from({ length: size }, () => Array(size).fill(null));

    for (let tileY = 0; tileY < settings.boardSize; tileY += 1) {
        for (let tileX = 0; tileX < settings.boardSize; tileX += 1) {
            const tileDef = board[tileY][tileX];

            if (!tileDef) {
                continue;
            }

            for (let y = 0; y < 3; y += 1) {
                for (let x = 0; x < 3; x += 1) {
                    cells[tileY * 3 + y][tileX * 3 + x] = normalizeRuleSymbol(tileDef.cells[y][x], settings);
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

            if (isOriginalCell && isBoundaryForColor(grid[gridY][gridX], colorSymbolValue)) {
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

            if (isBoundaryForColor(nextColor, colorSymbolValue)) {
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
    const grid = buildMicroGrid(board, settings);
    const zones = [];
    const scoringColors = isOneColorLandVariant(settings) ? ['red'] : COMBAT_COLORS;

    for (const color of scoringColors) {
        const colorSymbolValue = colorSymbol(color);
        const reachable = floodOutsideForColor(grid, colorSymbolValue);
        const visited = new Uint8Array(grid.length * grid.length);

        for (let y = 0; y < grid.length; y += 1) {
            for (let x = 0; x < grid[y].length; x += 1) {
                const cellColor = grid[y][x];
                const cellIndex = originalIndex(grid.length, x, y);

                if (isBoundaryForColor(cellColor, colorSymbolValue)
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
                const wildcardBoundaryCells = region.boundaryCells.filter((cell) => (
                    grid[cell.y][cell.x] === COLOR_SYMBOLS.universal
                )).length;
                const coloredBoundaryCells = region.boundaryCells.length - wildcardBoundaryCells;
                const area = region.interiorCells.length + coloredBoundaryCells;
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
                    boundarySize: coloredBoundaryCells,
                    wildcardBoundarySize: wildcardBoundaryCells,
                    area,
                    areaDamage: damage.areaDamage,
                    areaBonus: damage.areaBonus,
                    grayInteriorCells,
                    grayBonus: damage.grayBonus,
                    rawDamage: damage.rawDamage,
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

    for (const tileKey of result.score?.roadTileKeys ?? []) {
        scoredTileKeys.add(tileKey);
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

function getOneColorChainRules(settings) {
    return {
        maxChain: settings.oneColorChain?.maxChain ?? 5,
        bonusPerChain: settings.oneColorChain?.bonusPerChain ?? 4,
    };
}

function getConnectTargetRules(settings) {
    return {
        bonusDamage: settings.connectTargets?.bonusDamage ?? 30,
        minDistance: settings.connectTargets?.minDistance ?? 5,
        maxDistance: settings.connectTargets?.maxDistance ?? 7,
    };
}

function getRoadModeRules(settings) {
    return {
        completeBonus: settings.roadMode?.completeBonus ?? 12,
        damagePerTile: settings.roadMode?.damagePerTile ?? 6,
        maxScoredExtraLength: settings.roadMode?.maxScoredExtraLength ?? 6,
        minLength: settings.roadMode?.minLength ?? 4,
        gateMinDistance: settings.roadMode?.gateMinDistance ?? 5,
        gateMaxDistance: settings.roadMode?.gateMaxDistance ?? 7,
    };
}

function getRouteGateRules(settings) {
    if (isRoadModeVariant(settings)) {
        const roadRules = getRoadModeRules(settings);
        return {
            minDistance: roadRules.gateMinDistance,
            maxDistance: roadRules.gateMaxDistance,
        };
    }

    return getConnectTargetRules(settings);
}

function getPlacementPayoffRules(settings) {
    return {
        focusPerUsefulPlacement: settings.placementPayoff?.focusPerUsefulPlacement ?? 1,
        maxFocus: settings.placementPayoff?.maxFocus ?? 4,
        bonusPerFocus: settings.placementPayoff?.bonusPerFocus ?? 3,
    };
}

export function getConnectedCombatTileKeys(board, startX, startY, settings) {
    const startTile = board[startY]?.[startX];

    if (!isCombatTile(startTile)) {
        return [];
    }

    const queue = [{ x: startX, y: startY }];
    const visited = new Set([boardKey(startX, startY)]);
    let cursor = 0;

    while (cursor < queue.length) {
        const cell = queue[cursor];
        cursor += 1;
        const tileDef = board[cell.y][cell.x];

        for (const direction of DIRECTIONS) {
            const nextX = cell.x + direction.dx;
            const nextY = cell.y + direction.dy;

            if (!isInsideBoard(settings.boardSize, nextX, nextY)) {
                continue;
            }

            const neighbor = board[nextY][nextX];
            const key = boardKey(nextX, nextY);

            if (!isCombatTile(neighbor) || visited.has(key)) {
                continue;
            }

            if (!edgesMatch(tileDef, neighbor, direction, settings)) {
                continue;
            }

            visited.add(key);
            queue.push({ x: nextX, y: nextY });
        }
    }

    return [...visited];
}

export function getShortestCombatPathKeys(board, start, end, settings) {
    const startTile = board[start.y]?.[start.x];
    const endTile = board[end.y]?.[end.x];

    if (!isCombatTile(startTile) || !isCombatTile(endTile)) {
        return [];
    }

    const startKey = boardKey(start.x, start.y);
    const endKey = boardKey(end.x, end.y);
    const queue = [{ x: start.x, y: start.y }];
    const visited = new Set([startKey]);
    const parent = new Map();
    let cursor = 0;

    while (cursor < queue.length) {
        const cell = queue[cursor];
        cursor += 1;
        const key = boardKey(cell.x, cell.y);

        if (key === endKey) {
            break;
        }

        const tileDef = board[cell.y][cell.x];

        for (const direction of DIRECTIONS) {
            const nextX = cell.x + direction.dx;
            const nextY = cell.y + direction.dy;

            if (!isInsideBoard(settings.boardSize, nextX, nextY)) {
                continue;
            }

            const neighbor = board[nextY][nextX];
            const nextKey = boardKey(nextX, nextY);

            if (!isCombatTile(neighbor) || visited.has(nextKey)) {
                continue;
            }

            if (!edgesMatch(tileDef, neighbor, direction, settings)) {
                continue;
            }

            visited.add(nextKey);
            parent.set(nextKey, key);
            queue.push({ x: nextX, y: nextY });
        }
    }

    if (!visited.has(endKey)) {
        return [];
    }

    const path = [];
    let currentKey = endKey;

    while (currentKey) {
        path.push(currentKey);

        if (currentKey === startKey) {
            break;
        }

        currentKey = parent.get(currentKey);
    }

    return path.reverse();
}

function updateOneColorChainForPlacement(state, settings, x, y) {
    if (!isOneColorChainVariant(settings)) {
        return;
    }

    const rules = getOneColorChainRules(settings);
    const componentKeys = getConnectedCombatTileKeys(state.board, x, y, settings);
    const activeRegionKeys = new Set(state.chainRegionKeys ?? []);
    const continuesActiveRegion = componentKeys.some((key) => activeRegionKeys.has(key));
    state.lastChainDelta = 0;

    if (componentKeys.length === 0) {
        state.chainMeter = 0;
        state.chainRegionKeys = [];
        return;
    }

    if (continuesActiveRegion) {
        const before = Math.max(1, state.chainMeter ?? 1);
        state.chainMeter = Math.min(rules.maxChain, before + 1);
        state.lastChainDelta = state.chainMeter - before;
    } else {
        state.chainMeter = 1;
    }

    state.chainRegionKeys = componentKeys;
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

function applyOneColorChainToScore(state, score, settings) {
    if (!isOneColorChainVariant(settings) || score.zones.length === 0) {
        return {
            chainSpent: 0,
            chainBonus: 0,
        };
    }

    const rules = getOneColorChainRules(settings);
    const chainSpent = Math.min(state.chainMeter ?? 0, rules.maxChain);
    const chainSteps = Math.max(0, chainSpent - 1);
    const chainBonus = chainSteps * rules.bonusPerChain;

    if (chainBonus > 0) {
        const targetZone = score.zones.reduce((best, zone) => (
            zone.area > best.area ? zone : best
        ), score.zones[0]);

        targetZone.chainBonus = (targetZone.chainBonus ?? 0) + chainBonus;
        targetZone.damage += chainBonus;
        score.damageByColor[targetZone.color] += chainBonus;
        score.totalDamage += chainBonus;
    }

    state.chainMeter = 1;
    state.chainRegionKeys = [];

    return {
        chainSpent,
        chainBonus,
    };
}

function cellDistance(left, right) {
    return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}

function createConnectTargetPair(board, settings, salt = 0) {
    if (!isRouteGateVariant(settings)) {
        return null;
    }

    const rules = getRouteGateRules(settings);
    const cells = [];

    for (let y = 0; y < settings.boardSize; y += 1) {
        for (let x = 0; x < settings.boardSize; x += 1) {
            if (!board[y][x]) {
                cells.push({ x, y });
            }
        }
    }

    const pairs = [];

    for (let left = 0; left < cells.length; left += 1) {
        for (let right = left + 1; right < cells.length; right += 1) {
            const distance = cellDistance(cells[left], cells[right]);

            if (distance >= rules.minDistance && distance <= rules.maxDistance) {
                pairs.push({
                    a: cells[left],
                    b: cells[right],
                    distance,
                    connected: false,
                    scored: false,
                });
            }
        }
    }

    if (pairs.length === 0) {
        return null;
    }

    const index = Math.abs(Math.floor(salt)) % pairs.length;
    return pairs[index];
}

function ensureConnectTargets(state, settings) {
    if (!isRouteGateVariant(settings)) {
        state.connectTargets = null;
        return null;
    }

    if (!state.connectTargets || state.connectTargets.scored) {
        state.connectTargets = createConnectTargetPair(
            state.board,
            settings,
            state.round + countPlacedTiles(state.board) * 17,
        );
    }

    return state.connectTargets;
}

function areConnectTargetsLinked(board, targets, settings) {
    if (!targets) {
        return false;
    }

    const startTile = board[targets.a.y]?.[targets.a.x];
    const endTile = board[targets.b.y]?.[targets.b.x];

    if (!isCombatTile(startTile) || !isCombatTile(endTile)) {
        return false;
    }

    return getConnectedCombatTileKeys(board, targets.a.x, targets.a.y, settings)
        .includes(boardKey(targets.b.x, targets.b.y));
}

function applyConnectTargetsToScore(state, score, settings) {
    if (!isConnectTargetsVariant(settings)) {
        return {
            connected: false,
            bonusDamage: 0,
        };
    }

    const targets = ensureConnectTargets(state, settings);

    if (!targets || targets.scored || !areConnectTargetsLinked(state.board, targets, settings)) {
        return {
            connected: false,
            bonusDamage: 0,
        };
    }

    const rules = getConnectTargetRules(settings);
    targets.connected = true;
    targets.scored = true;
    score.targetBonus = (score.targetBonus ?? 0) + rules.bonusDamage;
    score.damageByColor.red += rules.bonusDamage;
    score.totalDamage += rules.bonusDamage;

    return {
        connected: true,
        bonusDamage: rules.bonusDamage,
    };
}

function applyRoadModeToScore(state, score, settings, run = null) {
    if (!isRoadModeVariant(settings)) {
        return {
            connected: false,
            length: 0,
            shortestLength: 0,
            extraLength: 0,
            scoredExtraLength: 0,
            baseDamage: 0,
            damage: 0,
            tileKeys: [],
            pathKeys: [],
        };
    }

    const gates = ensureConnectTargets(state, settings);

    if (!gates || gates.scored || !areConnectTargetsLinked(state.board, gates, settings)) {
        return {
            connected: false,
            length: 0,
            shortestLength: 0,
            extraLength: 0,
            scoredExtraLength: 0,
            baseDamage: 0,
            damage: 0,
            tileKeys: [],
            pathKeys: [],
        };
    }

    const rules = getRoadModeRules(settings);
    const pathKeys = getShortestCombatPathKeys(state.board, gates.a, gates.b, settings);
    const length = pathKeys.length;
    const shortestLength = gates.distance + 1;
    const routeEdges = Math.max(0, length - 1);
    const extraLength = Math.max(0, routeEdges - gates.distance);
    const scoredExtraLength = Math.min(extraLength, rules.maxScoredExtraLength);

    if (length < rules.minLength) {
        gates.connected = true;
        return {
            connected: true,
            length,
            shortestLength,
            extraLength,
            scoredExtraLength,
            baseDamage: 0,
            damage: 0,
            tileKeys: pathKeys,
            pathKeys,
        };
    }

    const multiplier = run?.colorMultipliers?.red ?? 1;
    const baseDamage = rules.completeBonus + scoredExtraLength * rules.damagePerTile;
    const damage = baseDamage * multiplier;
    gates.connected = true;
    gates.scored = true;
    score.road = {
        connected: true,
        length,
        shortestLength,
        extraLength,
        scoredExtraLength,
        baseDamage,
        multiplier,
        damage,
    };
    score.roadTileKeys = pathKeys;
    score.damageByColor.red += damage;
    score.totalDamage += damage;

    return {
        connected: true,
        length,
        shortestLength,
        extraLength,
        scoredExtraLength,
        baseDamage,
        damage,
        tileKeys: pathKeys,
        pathKeys,
    };
}

function createSpecialTile(entry) {
    const color = entry.color ?? 'universal';
    const symbol = colorSymbol(color);
    const rows = entry.matrix.map((row) => row.replaceAll('X', symbol));

    return {
        id: entry.id,
        file: entry.file ?? null,
        color,
        pattern: entry.pattern ?? entry.id,
        cells: pattern(rows),
        special: entry.special ?? null,
        segments: Array.isArray(entry.segments)
            ? entry.segments.map((segment) => ({
                tileId: segment.tileId,
                offset: Array.isArray(segment.offset) ? [...segment.offset] : [0, 0],
            }))
            : null,
    };
}

export function createTilesFromManifest(manifest, settings = {}) {
    const deckSize = settings.startingDeckSize ?? manifest.tiles.length;
    const oneColorLand = isOneColorLandVariant(settings);
    const manifestTiles = manifest.tiles.slice(0, deckSize).map((entry) => {
        const symbol = oneColorLand && COMBAT_COLORS.includes(entry.color)
            ? colorSymbol('red')
            : colorSymbol(entry.color);
        const rows = entry.matrix.map((row) => row.replaceAll('X', symbol));

        return {
            id: entry.id,
            file: entry.file,
            color: entry.color,
            pattern: entry.pattern,
            cells: pattern(rows),
        };
    });
    const specialTiles = Array.isArray(settings.specialTiles)
        ? settings.specialTiles
            .filter((entry) => shouldUseStartingBoardTile(entry, settings))
            .map(createSpecialTile)
        : [];
    const tileMap = createTileMap([...manifestTiles, ...specialTiles]);
    const resolvedSpecialTiles = specialTiles.map((tileDef) => {
        if (!isMacroTile(tileDef)) {
            return tileDef;
        }

        return {
            ...tileDef,
            segments: tileDef.segments.map((segment) => ({
                ...segment,
                tileDef: tileMap.get(segment.tileId),
            })),
        };
    });

    return [...manifestTiles, ...resolvedSpecialTiles];
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
    const startingBoard = createStartingBoard(settings, tiles);
    applyOpeningDrawBag(run, tiles, settings);
    const roundTiles = drawRoundTiles({
        run,
        tiles,
        battle,
        settings,
        round,
        board: startingBoard,
    });
    const hand = isQueueDrawMode(settings) ? roundTiles.slice(0, 2) : roundTiles;

    const state = {
        round,
        playerHp: run.playerHp,
        enemyHp: battle.enemyHp,
        board: startingBoard,
        boardResources: createFieldResources(startingBoard, settings, run),
        hand,
        heldTile: null,
        selectedHandIndex: hand.findIndex(Boolean),
        queueReserve: isQueueDrawMode(settings) ? roundTiles.slice(2) : [],
        playedThisRound: [],
        queuePlayedThisRound: 0,
        handSubmitsThisBattle: 0,
        strikeCount: 0,
        strikeWindowOpen: false,
        lastPlacementClosedZone: false,
        phase: 'placing',
        lastResult: null,
        lastSubmitResult: null,
        lastPlacementResourceResult: null,
        lastClosureResourceResult: null,
        battleLog: [],
        resourceEvents: [],
        handSubmitLocked: false,
        lockedSubmitCost: null,
        outcome: null,
        placementFocus: 0,
        lastPlacementFocusDelta: 0,
        lastPlacementClosedZones: 0,
        chainMeter: isOneColorChainVariant(settings) ? 0 : null,
        lastChainDelta: 0,
        chainRegionKeys: [],
        connectTargets: createConnectTargetPair(startingBoard, settings, round),
    };

    updateHandSubmitLock(state, settings);

    return state;
}

export function getRoundAttack(battle, round, settings = {}) {
    const attacks = battle.attacks ?? [{ red: 1, blue: 1, green: 1 }];
    const attack = attacks[(round - 1) % attacks.length];

    if (!isOneColorLandVariant(settings)) {
        return attack;
    }

    const colors = Array.isArray(settings.activeCombatColors)
        ? settings.activeCombatColors
        : COMBAT_COLORS;
    const totalThreat = colors.reduce((sum, color) => sum + (attack[color] ?? 0), 0);

    return {
        red: totalThreat,
        blue: 0,
        green: 0,
    };
}

export function canPlaceTile(board, tileDef, x, y, settings) {
    if (!tileDef || !isInsideBoard(settings.boardSize, x, y) || board[y][x]) {
        return false;
    }

    if (isMacroTile(tileDef)) {
        return canPlaceMacroTile(board, tileDef, x, y, settings);
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

function hasMacroEdgeMismatch(board, placement, settings) {
    for (const segment of placement.segments) {
        for (const direction of DIRECTIONS) {
            const nextX = segment.x + direction.dx;
            const nextY = segment.y + direction.dy;

            if (!isInsideBoard(settings.boardSize, nextX, nextY)) {
                continue;
            }

            const internalNeighbor = placement.segmentByKey.get(boardKey(nextX, nextY));

            if (internalNeighbor) {
                if (!edgesMatch(segment.tileDef, internalNeighbor.tileDef, direction, settings)) {
                    return true;
                }
                continue;
            }

            const neighbor = board[nextY][nextX];

            if (neighbor && !edgesMatch(segment.tileDef, neighbor, direction, settings)) {
                return true;
            }
        }
    }

    return false;
}

export function getTilePlacementFailure(board, tileDef, x, y, settings) {
    if (!tileDef) {
        return {
            code: 'no_selected_card',
            message: 'Сначала выбери карту для постановки.',
        };
    }

    if (!isInsideBoard(settings.boardSize, x, y)) {
        return {
            code: 'outside_board',
            message: 'Нельзя поставить: клетка вне доски.',
        };
    }

    const segments = getTilePlacementSegments(tileDef, x, y);
    const segmentByKey = new Map();

    for (const segment of segments) {
        if (!segment.tileDef || !isInsideBoard(settings.boardSize, segment.x, segment.y)) {
            return {
                code: isMacroTile(tileDef) ? 'outside_macro_footprint' : 'outside_board',
                message: isMacroTile(tileDef)
                    ? 'Нельзя поставить: большая карта выходит за поле.'
                    : 'Нельзя поставить: клетка вне доски.',
            };
        }

        const keyValue = boardKey(segment.x, segment.y);

        if (segmentByKey.has(keyValue)) {
            return {
                code: 'outside_macro_footprint',
                message: 'Нельзя поставить: клетки большой карты пересекаются.',
            };
        }

        if (board[segment.y][segment.x]) {
            return {
                code: 'occupied_cell',
                message: 'Нельзя поставить: клетка уже занята.',
            };
        }

        segmentByKey.set(keyValue, segment);
    }

    if (isMacroTile(tileDef)) {
        const placement = {
            segments,
            segmentByKey,
        };

        if (hasMacroEdgeMismatch(board, placement, settings)) {
            return {
                code: 'edge_mismatch',
                message: 'Нельзя поставить: края большой карты не совпадают.',
            };
        }

        return null;
    }

    if (countPlacedTiles(board) === 0 || canPlaceAdjacentTile(board, tileDef, x, y, settings)) {
        return null;
    }

    if (hasDirectNeighbor(board, x, y, settings)) {
        return {
            code: 'edge_mismatch',
            message: 'Нельзя поставить: смежные края должны совпасть.',
        };
    }

    return null;
}

function placeTileDefOnBoard(board, tileDef, x, y) {
    for (const segment of getTilePlacementSegments(tileDef, x, y)) {
        board[segment.y][segment.x] = segment.tileDef;
    }
}

export function createBoardWithTilePlacement(board, tileDef, x, y, settings) {
    if (!canPlaceTile(board, tileDef, x, y, settings)) {
        return null;
    }

    const nextBoard = cloneBoard(board);
    placeTileDefOnBoard(nextBoard, tileDef, x, y);
    return nextBoard;
}

export function placeTile(state, settings, x, y, run = null) {
    const tileDef = state.hand[state.selectedHandIndex];

    if (!canPlaceTile(state.board, tileDef, x, y, settings)) {
        return false;
    }

    const placedBefore = countPlacedTiles(state.board);
    const hadDirectNeighbor = hasDirectNeighbor(state.board, x, y, settings);
    const placementSegments = getTilePlacementSegments(tileDef, x, y);
    placeTileDefOnBoard(state.board, tileDef, x, y);
    state.lastPlacedTileColor = tileDef.color;
    state.lastPlacedTileId = tileDef.id;
    for (const segment of placementSegments) {
        collectPlacementResources(state, run, settings, segment.x, segment.y);
    }
    const postPlacementScore = scoreTileBoard(state.board, settings);
    state.lastPlacementClosedZones = postPlacementScore.zones.length;
    state.lastPlacementFocusDelta = 0;
    state.lastChainDelta = 0;

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

    updateOneColorChainForPlacement(state, settings, x, y);
    ensureConnectTargets(state, settings);
    if (state.connectTargets) {
        state.connectTargets.connected = areConnectTargetsLinked(state.board, state.connectTargets, settings);
    }

    state.playedThisRound.push(tileDef.id);
    state.queuePlayedThisRound += isQueueDrawMode(settings) ? 1 : 0;
    state.hand[state.selectedHandIndex] = null;
    const nextIndex = state.hand.findIndex(Boolean);
    state.selectedHandIndex = nextIndex >= 0 ? nextIndex : -1;
    return true;
}

export function holdSelectedTile(state, settings) {
    if (!isHoldEnabled(settings) || state.phase !== 'placing') {
        return false;
    }

    const selectedIndex = state.selectedHandIndex;
    const selectedTile = state.hand[selectedIndex] ?? null;
    const heldTile = state.heldTile ?? null;

    if (!selectedTile && !heldTile) {
        return false;
    }

    if (!selectedTile && heldTile) {
        const emptyIndex = state.hand.findIndex((tileDef) => !tileDef);

        if (emptyIndex < 0) {
            return false;
        }

        state.hand[emptyIndex] = heldTile;
        state.heldTile = null;
        state.selectedHandIndex = emptyIndex;
        return true;
    }

    state.heldTile = selectedTile;
    state.hand[selectedIndex] = heldTile;

    if (state.hand[selectedIndex]) {
        state.selectedHandIndex = selectedIndex;
        return true;
    }

    const nextIndex = state.hand.findIndex(Boolean);
    state.selectedHandIndex = nextIndex >= 0 ? nextIndex : -1;
    return true;
}

function getZoneInteriorKey(zone) {
    return zone.interiorCells
        .map((cell) => boardKey(cell.x, cell.y))
        .sort()
        .join('|');
}

function filterWildcardSharedZones(zones, placedColor) {
    if (!COMBAT_COLORS.includes(placedColor)) {
        return zones;
    }

    const groups = new Map();

    for (const zone of zones) {
        const key = getZoneInteriorKey(zone);
        groups.set(key, [...groups.get(key) ?? [], zone]);
    }

    return [...groups.values()].flatMap((group) => {
        const colors = new Set(group.map((zone) => zone.color));
        const usesWildcard = group.some((zone) => (zone.wildcardBoundarySize ?? 0) > 0);

        if (!usesWildcard || colors.size <= 1) {
            return group;
        }

        return group.filter((zone) => zone.color === placedColor);
    });
}

export function scoreTileBoard(board, settings, run = null, options = {}) {
    const capturedAreas = isRoadModeVariant(settings) ? [] : findCapturedAreas(board, settings);
    const zones = filterWildcardSharedZones(capturedAreas, options.placedColor);
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
    const attack = getRoundAttack(battle, state.round, settings);
    const score = scoreTileBoard(state.board, settings, run);
    const placementPayoff = applyPlacementFocusToScore(state, score, settings);
    const oneColorChain = applyOneColorChainToScore(state, score, settings);
    const connectTargets = applyConnectTargetsToScore(state, score, settings);
    const roadMode = applyRoadModeToScore(state, score, settings, run);
    const newPickDamage = getNewPickDamagePreview(state, settings);
    let enemyDamage = 0;
    let playerDamage = 0;
    const byColor = {};

    for (const color of COMBAT_COLORS) {
        const closedDamage = score.damageByColor[color] || 0;
        const threat = attack[color] || 0;

        if (closedDamage > 0 && closedDamage >= threat) {
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
        chainSpent: oneColorChain.chainSpent,
        chainBonus: oneColorChain.chainBonus,
        chainRemaining: state.chainMeter ?? 0,
        connectTargets: state.connectTargets ? {
            ...state.connectTargets,
            a: { ...state.connectTargets.a },
            b: { ...state.connectTargets.b },
        } : null,
        connectTargetBonus: connectTargets.bonusDamage,
        connectTargetConnected: connectTargets.connected,
        roadConnected: roadMode.connected,
        roadLength: roadMode.length,
        roadShortestLength: roadMode.shortestLength,
        roadExtraLength: roadMode.extraLength,
        roadScoredExtraLength: roadMode.scoredExtraLength,
        roadBaseDamage: roadMode.baseDamage,
        roadDamage: roadMode.damage,
        roadTileKeys: roadMode.tileKeys,
        scoredTileKeys: [...getScoredTileKeys({ score })],
        newPickDamage,
        newPickDamageApplied: false,
    };

    if (state.enemyHp <= 0) {
        state.outcome = 'victory';
    } else if (state.playerHp <= 0) {
        state.outcome = 'defeat';
    }

    return state.lastResult;
}

function createDamageOnlyColorResults(score, attack) {
    const byColor = {};

    for (const color of COMBAT_COLORS) {
        const closedDamage = score.damageByColor[color] || 0;

        byColor[color] = {
            threat: attack[color] || 0,
            closedDamage,
            enemyDamage: closedDamage,
            playerDamage: 0,
        };
    }

    return byColor;
}

function summarizeClosedColors(score) {
    const summaries = Object.fromEntries(COMBAT_COLORS.map((color) => [color, {
        color,
        damage: 0,
        zones: 0,
    }]));

    for (const zone of score.zones) {
        const summary = summaries[zone.color];

        if (!summary) {
            continue;
        }

        summary.damage += zone.damage;
        summary.zones += 1;
    }

    return Object.values(summaries).filter((entry) => entry.damage > 0);
}

export function resolveImmediatePlacement(state, battle, settings, run = null) {
    if (!isLegacyVariant(settings) || state.phase !== 'placing' || state.outcome) {
        return null;
    }

    const attack = getRoundAttack(battle, state.round, settings);
    const score = scoreTileBoard(state.board, settings, run, {
        placedColor: state.lastPlacedTileColor,
    });
    state.lastPlacementClosedZones = score.zones.length;

    if (score.zones.length === 0) {
        state.strikeCount = 0;
        state.strikeWindowOpen = false;
        state.lastPlacementClosedZone = false;

        if (state.lastResult?.lastClosureImmediate) {
            state.lastResult = null;
        }
        state.lastClosureResourceResult = null;

        return null;
    }

    const goldRules = getGoldRules(settings);
    const monsterHeartsBefore = state.enemyHp;
    const goldBefore = run?.gold ?? 0;
    const enemyDamage = score.totalDamage;
    const wasStrikeWindowOpen = state.strikeWindowOpen === true;

    state.strikeCount = wasStrikeWindowOpen
        ? (state.strikeCount ?? 0) + 1
        : 0;
    state.strikeWindowOpen = true;
    state.lastPlacementClosedZone = true;

    const closureGold = score.zones.length * goldRules.closureGold;
    const strikeGold = wasStrikeWindowOpen
        ? state.strikeCount * goldRules.strikeGoldPerCount
        : 0;
    const baseGoldEarned = closureGold + strikeGold;

    if (run) {
        run.gold = (run.gold ?? 0) + baseGoldEarned;
    }

    const closureResources = collectClosureResources(state, run, settings, score, {
        log: false,
    });
    const fieldGold = closureResources.goldAmount;
    const heartHeal = closureResources.heartHeal;
    const goldEarned = baseGoldEarned + fieldGold;

    state.enemyHp = Math.max(0, state.enemyHp - enemyDamage);

    state.lastResult = {
        attack,
        score,
        byColor: createDamageOnlyColorResults(score, attack),
        enemyDamage,
        playerDamage: 0,
        placementFocusSpent: 0,
        placementFocusBonus: 0,
        placementFocusRemaining: state.placementFocus ?? 0,
        chainSpent: 0,
        chainBonus: 0,
        chainRemaining: state.chainMeter ?? 0,
        connectTargets: null,
        connectTargetBonus: 0,
        connectTargetConnected: false,
        roadConnected: false,
        roadLength: 0,
        roadShortestLength: 0,
        roadExtraLength: 0,
        roadScoredExtraLength: 0,
        roadBaseDamage: 0,
        roadDamage: 0,
        roadTileKeys: [],
        scoredTileKeys: [...getScoredTileKeys({ score })],
        newPickDamage: getNewPickDamagePreview(state, settings),
        newPickDamageApplied: false,
        submitCost: getHandSubmitCostPreview(state, settings),
        lastClosureImmediate: true,
        closedZones: score.zones.length,
        monsterHeartsBefore,
        monsterHeartsAfter: state.enemyHp,
        closureGold,
        strikeGold,
        fieldGold,
        heartHeal,
        fieldHeartAmount: closureResources.heartAmount,
        goldEarned,
        goldBefore,
        goldAfter: run?.gold ?? goldBefore,
        playerHeartsBefore: closureResources.playerHeartsBefore,
        playerHeartsAfter: closureResources.playerHeartsAfter,
        closureResources,
        strikeCount: state.strikeCount,
        strikeWindowOpen: state.strikeWindowOpen,
    };

    const closedColors = summarizeClosedColors(score);
    for (const entry of closedColors) {
        const colorClosureGold = entry.zones * goldRules.closureGold;
        addBattleLog(
            state,
            `Closed ${entry.color} zone: -${entry.damage} monster hearts, +${colorClosureGold} gold.`,
        );
    }

    addClosureResourceLogs(state, closureResources);

    if (strikeGold > 0) {
        addBattleLog(state, `Strike x${state.strikeCount}: +${strikeGold} gold.`);
    }

    if (state.enemyHp <= 0) {
        state.outcome = 'victory';
    }

    state.board = prepareNextRoundBoard(state, settings);

    return state.lastResult;
}

export function submitTileHand(state, { run, battle, settings, tiles }) {
    if (!isLegacyVariant(settings) || state.phase !== 'placing' || state.outcome) {
        return {
            submitted: false,
            reason: 'inactive',
            preview: getHandSubmitCostPreview(state, settings),
        };
    }

    const preview = getHandSubmitCostPreview(state, settings);

    if (!preview.canPay) {
        const playerHeartsBefore = state.playerHp;
        state.outcome = state.enemyHp > 0 ? 'defeat' : state.outcome;
        state.lastSubmitResult = {
            submitted: false,
            reason: 'not_enough_hearts',
            ...preview,
            playerHeartsBefore,
            playerHeartsAfter: state.playerHp,
        };
        addBattleLog(state, `No hearts for a new hand: defeat.`);
        return {
            submitted: false,
            reason: 'not_enough_hearts',
            preview,
        };
    }

    const playerHeartsBefore = state.playerHp;
    state.playerHp = Math.max(0, state.playerHp - preview.totalDamage);
    run.playerHp = state.playerHp;
    state.handSubmitsThisBattle = (state.handSubmitsThisBattle ?? 0) + 1;
    state.strikeCount = 0;
    state.strikeWindowOpen = false;
    state.lastPlacementClosedZone = false;

    const result = {
        submitted: true,
        ...preview,
        handSubmitsThisBattle: state.handSubmitsThisBattle,
        playerHeartsBefore,
        playerHeartsAfter: state.playerHp,
    };

    state.lastSubmitResult = result;
    addBattleLog(state, `Hand submitted: -${preview.totalDamage} hearts.`);

    discardRoundHand(run, state);
    startNextTileRound(state, {
        run,
        battle,
        settings,
        tiles,
    });
    state.lastSubmitResult = result;

    return result;
}

export function resolveHandSubmitDefeatIfNeeded(state, settings) {
    if (!isLegacyVariant(settings)
        || state.phase !== 'placing'
        || state.outcome
        || state.enemyHp <= 0
        || countUnplayedHandTiles(state) > 0
        || state.heldTile) {
        return null;
    }

    const preview = getHandSubmitCostPreview(state, settings);

    if (preview.canPay) {
        return null;
    }

    state.outcome = 'defeat';
    state.lastSubmitResult = {
        submitted: false,
        reason: 'not_enough_hearts',
        ...preview,
        playerHeartsBefore: state.playerHp,
        playerHeartsAfter: state.playerHp,
    };
    addBattleLog(state, `No hearts for a new hand: defeat.`);

    return state.lastSubmitResult;
}

export function discardRoundHand(run, state) {
    const unplayedTileIds = state.hand
        .filter(Boolean)
        .map((tileDef) => tileDef.id);
    const reserveTileIds = state.queueReserve
        ?.filter(Boolean)
        .map((tileDef) => tileDef.id) ?? [];
    const heldTileIds = state.outcome && state.heldTile
        ? [state.heldTile.id]
        : [];

    discardTileIds(run, [
        ...state.playedThisRound,
        ...unplayedTileIds,
        ...reserveTileIds,
        ...heldTileIds,
    ]);
    state.hand = state.hand.map(() => null);
    state.queueReserve = [];
    state.playedThisRound = [];
    state.queuePlayedThisRound = 0;
    state.selectedHandIndex = -1;

    if (state.outcome) {
        state.heldTile = null;
    }
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
        && !hasAnyValidPlacement(state.board, state.hand, settings, state.heldTile)) {
        state.board = createStartingBoard(settings, tiles);
    }

    if (isRouteGateVariant(settings)) {
        state.connectTargets = state.connectTargets?.scored
            ? null
            : state.connectTargets;
        ensureConnectTargets(state, settings);
    }

    state.selectedHandIndex = state.hand.findIndex(Boolean);
    state.queuePlayedThisRound = 0;
    state.lastPlacementFocusDelta = 0;
    state.lastPlacementClosedZones = 0;
    state.lastChainDelta = 0;
    state.lastPlacementResourceResult = null;
    state.lastClosureResourceResult = null;
    updateHandSubmitLock(state, settings);
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
