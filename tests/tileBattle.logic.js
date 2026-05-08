import assert from 'node:assert/strict';
import test from 'node:test';
import manifest from '../assets/tiles_v2/tile_manifest.json' with { type: 'json' };
import {
    applyOpeningDrawBag,
    canPlaceTile,
    createStartingDeckIds,
    createTilesFromManifest,
} from '../src/entities/tileBattle.js';

const settings = {
    boardSize: 6,
    grayWildcardPlacement: true,
};

const tiles = createTilesFromManifest(manifest, settings);

function emptyBoard() {
    return Array.from({ length: settings.boardSize }, () => Array(settings.boardSize).fill(null));
}

function tile(id) {
    return tiles.find((tileDef) => tileDef.id === id);
}

test('gray blank cannot block an open combat edge', () => {
    const board = emptyBoard();
    board[2][2] = tile('tile_red_line_h');

    assert.equal(canPlaceTile(board, tile('tile_gray_blank_01'), 3, 2, settings), false);
    assert.equal(canPlaceTile(board, tile('tile_gray_blank_01'), 2, 1, settings), true);
});

test('combat tile cannot connect an open edge into existing gray fill', () => {
    const board = emptyBoard();
    board[2][2] = tile('tile_gray_blank_01');

    assert.equal(canPlaceTile(board, tile('tile_red_line_h'), 3, 2, settings), false);
    assert.equal(canPlaceTile(board, tile('tile_red_line_v'), 3, 2, settings), true);
});

test('opening draw bag caps early closers and keeps continuations', () => {
    const deckIds = createStartingDeckIds(tiles, {
        startingDeckRecipe: [
            { pattern: 'line_h', colors: ['red', 'blue', 'green'], count: 1 },
            { pattern: 'line_v', colors: ['red', 'blue', 'green'], count: 1 },
            { pattern: 'tee_u', colors: ['red', 'blue', 'green'], count: 1 },
            { pattern: 'tee_r', colors: ['red', 'blue', 'green'], count: 1 },
            { pattern: 'tee_d', colors: ['red', 'blue', 'green'], count: 1 },
            { pattern: 'tee_l', colors: ['red', 'blue', 'green'], count: 1 },
            { pattern: 'plus', colors: ['red', 'blue', 'green'], count: 1 },
            { pattern: 'corner_ur', colors: ['red', 'blue', 'green'], count: 1 },
            { pattern: 'corner_rd', colors: ['red', 'blue', 'green'], count: 1 },
            { pattern: 'corner_dl', colors: ['red', 'blue', 'green'], count: 1 },
            { pattern: 'corner_lu', colors: ['red', 'blue', 'green'], count: 1 },
            { id: 'tile_gray_blank_01', count: 2 },
            { id: 'tile_gray_blank_02', count: 1 },
            { id: 'tile_gray_blank_03', count: 1 },
        ],
    });
    const run = {
        currentBattle: 1,
        drawPile: [...deckIds],
        openingBagBattles: [],
    };

    applyOpeningDrawBag(run, tiles, {
        drawBag: {
            enabled: true,
            openingDraws: 12,
            patternCaps: { corner: 3, plus: 1 },
            patternMinimums: { line: 3, tee: 4 },
            combatColorMinimums: { red: 2, blue: 2, green: 2 },
            grayMax: 2,
        },
    });

    assert.equal(run.openingBagBattles.length, 1);
    assert.equal(run.lastOpeningBag.shapes.line >= 3, true);
    assert.equal(run.lastOpeningBag.shapes.tee >= 4, true);
    assert.equal(run.lastOpeningBag.shapes.corner <= 3, true);
    assert.equal((run.lastOpeningBag.shapes.plus ?? 0) <= 1, true);
    assert.equal((run.lastOpeningBag.shapes.gray ?? 0) <= 2, true);
    assert.equal(run.lastOpeningBag.colors.red >= 2, true);
    assert.equal(run.lastOpeningBag.colors.blue >= 2, true);
    assert.equal(run.lastOpeningBag.colors.green >= 2, true);
});
