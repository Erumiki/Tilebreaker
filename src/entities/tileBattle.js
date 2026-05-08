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

function createRng(seed) {
    let state = seed >>> 0;

    return function next() {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 0x100000000;
    };
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

function getTileByPattern(tiles, color, patternName) {
    return tiles.find((tileDef) => (
        tileDef.color === color && tileDef.pattern === patternName
    ));
}

function getDamagePerArea(settings) {
    if (settings.damageFormula?.type === 'areaMultiplier') {
        return settings.damageFormula.areaMultiplier ?? 1;
    }

    return settings.damagePerArea ?? 1;
}

function selectPrimaryAttackColor(attack) {
    return COMBAT_COLORS.reduce((best, color) => (
        (attack[color] ?? 0) > (attack[best] ?? 0) ? color : best
    ), COMBAT_COLORS[0]);
}

function drawRoundHand({ tiles, battle, settings, round }) {
    const attack = getRoundAttack(battle, round);
    const rng = createRng((settings.seed ?? 20260508) + round * 97 + battle.id.length * 13);
    const primaryColor = selectPrimaryAttackColor(attack);
    const loopPatterns = ['corner_rd', 'corner_dl', 'corner_ur', 'corner_lu'];
    const hand = settings.guaranteedLoopHands === false
        ? []
        : loopPatterns
            .map((patternName) => getTileByPattern(tiles, primaryColor, patternName))
            .filter(Boolean);
    const usedIds = new Set(hand.map((tileDef) => tileDef.id));
    const fillers = shuffle(rng, tiles.filter((tileDef) => !usedIds.has(tileDef.id)));

    for (const tileDef of fillers) {
        if (hand.length >= settings.handSize) {
            break;
        }
        hand.push(tileDef);
    }

    return hand.slice(0, settings.handSize);
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

                if (region.interiorCells.length === 0 || region.boundaryCells.length === 0) {
                    continue;
                }

                zones.push({
                    color,
                    interiorSize: region.interiorCells.length,
                    boundarySize: region.boundaryCells.length,
                    area,
                    damage: area * getDamagePerArea(settings),
                    interiorCells: region.interiorCells,
                    boundaryCells: region.boundaryCells,
                });
            }
        }
    }

    return zones;
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

export function createTileBattleState({ battle, run, settings, tiles }) {
    const round = 1;

    return {
        round,
        playerHp: run.playerHp,
        enemyHp: battle.enemyHp,
        board: createEmptyBoard(settings.boardSize),
        hand: drawRoundHand({ tiles, battle, settings, round }),
        selectedHandIndex: 0,
        phase: 'placing',
        lastResult: null,
        outcome: null,
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

        if (edge(tileDef, direction.name) !== edge(neighbor, direction.opposite)) {
            return false;
        }
    }

    return hasNeighbor;
}

export function placeTile(state, settings, x, y) {
    const tileDef = state.hand[state.selectedHandIndex];

    if (!canPlaceTile(state.board, tileDef, x, y, settings)) {
        return false;
    }

    state.board[y][x] = tileDef;
    state.hand[state.selectedHandIndex] = null;
    const nextIndex = state.hand.findIndex(Boolean);
    state.selectedHandIndex = nextIndex >= 0 ? nextIndex : -1;
    return true;
}

export function scoreTileBoard(board, settings) {
    const zones = findCapturedAreas(board, settings);
    const damageByColor = Object.fromEntries(TILE_COLORS.map((color) => [color, 0]));

    for (const zone of zones) {
        damageByColor[symbolToColor(colorSymbol(zone.color))] += zone.damage;
    }

    return {
        zones,
        damageByColor,
        totalDamage: COMBAT_COLORS.reduce((sum, color) => (
            sum + damageByColor[color]
        ), 0),
    };
}

export function resolveTileRound(state, battle, settings) {
    const attack = getRoundAttack(battle, state.round);
    const score = scoreTileBoard(state.board, settings);
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
    };

    if (state.enemyHp <= 0) {
        state.outcome = 'victory';
    } else if (state.playerHp <= 0) {
        state.outcome = 'defeat';
    }

    return state.lastResult;
}

export function startNextTileRound(state, { battle, settings, tiles }) {
    state.round += 1;
    state.board = createEmptyBoard(settings.boardSize);
    state.hand = drawRoundHand({
        tiles,
        battle,
        settings,
        round: state.round,
    });
    state.selectedHandIndex = state.hand.findIndex(Boolean);
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
