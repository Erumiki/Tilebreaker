import assert from 'node:assert/strict';
import test from 'node:test';
import manifest from '../assets/tiles_v2/tile_manifest.json' with { type: 'json' };
import {
    canPlaceTile,
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
