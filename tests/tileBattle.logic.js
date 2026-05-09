import assert from 'node:assert/strict';
import test from 'node:test';
import manifest from '../assets/tiles_v2/tile_manifest.json' with { type: 'json' };
import {
    GAMEPLAY_VARIANT_ORDER,
    getGameplayVariant,
    normalizeGameplayVariantId,
} from '../src/entities/gameplayVariants.js';
import { createRunState, getRewardChoices } from '../src/entities/run.js';
import {
    advanceTileQueue,
    applyOpeningDrawBag,
    canPlaceTile,
    createStartingDeckIds,
    createTileBattleState,
    createTilesFromManifest,
    discardRoundHand,
    getHandSubmitCostPreview,
    getNewPickDamagePreview,
    holdSelectedTile,
    placeTile,
    resolveHandSubmitDefeatIfNeeded,
    resolveImmediatePlacement,
    resolveTileRound,
    scoreTileBoard,
    submitTileHand,
} from '../src/entities/tileBattle.js';

const settings = {
    boardSize: 6,
    grayWildcardPlacement: true,
};

const tiles = createTilesFromManifest(manifest, settings);

test('gameplay variants keep one comparison order and URL aliases', () => {
    assert.deepEqual(GAMEPLAY_VARIANT_ORDER, [
        'legacy',
        'placement_payoff',
        'one_color_chain',
        'connect_targets',
        'road_mode',
    ]);
    assert.equal(normalizeGameplayVariantId('baseline'), 'legacy');
    assert.equal(normalizeGameplayVariantId('variant-a'), 'placement_payoff');
    assert.equal(normalizeGameplayVariantId('B'), 'one_color_chain');
    assert.equal(normalizeGameplayVariantId('unknown'), 'legacy');
    assert.equal(getGameplayVariant({ gameplayVariant: 'road-mode' }).shortLabel, 'D');
});

test('new runs start with zero gold for the hand-submit economy', () => {
    const run = createRunState({
        totalBattles: 1,
        playerHp: 18,
        startingDeck: ['tile_red_line_h'],
        seed: 20260508,
        settings: { gameplayVariant: 'legacy' },
    });

    assert.equal(run.gold, 0);
});

function emptyBoard() {
    return Array.from({ length: settings.boardSize }, () => Array(settings.boardSize).fill(null));
}

function tile(id) {
    return tiles.find((tileDef) => tileDef.id === id);
}

test('gray blank can fill next to combat edges', () => {
    const board = emptyBoard();
    board[2][2] = tile('tile_red_line_h');

    assert.equal(canPlaceTile(board, tile('tile_gray_blank_01'), 3, 2, settings), true);
    assert.equal(canPlaceTile(board, tile('tile_gray_blank_01'), 2, 1, settings), true);
});

test('combat tile cannot connect an open edge into existing gray fill', () => {
    const board = emptyBoard();
    board[2][2] = tile('tile_gray_blank_01');

    assert.equal(canPlaceTile(board, tile('tile_red_line_h'), 3, 2, settings), false);
    assert.equal(canPlaceTile(board, tile('tile_red_line_v'), 3, 2, settings), true);
});

test('combat tile can start a separated island even when adjacent moves exist', () => {
    const board = emptyBoard();

    board[1][1] = tile('tile_green_tee_l');
    board[2][1] = tile('tile_gray_blank_01');
    board[1][3] = tile('tile_blue_line_h');

    assert.equal(canPlaceTile(board, tile('tile_green_tee_l'), 1, 0, settings), true);
    assert.equal(canPlaceTile(board, tile('tile_green_tee_l'), 3, 3, settings), true);
    assert.equal(canPlaceTile(board, tile('tile_green_tee_l'), 5, 1, settings), true);
});

test('free cells without direct neighbors stay valid after the first tile', () => {
    const board = emptyBoard();
    board[2][2] = tile('tile_red_line_h');

    assert.equal(canPlaceTile(board, tile('tile_blue_line_v'), 5, 5, settings), true);
    assert.equal(canPlaceTile(board, tile('tile_blue_line_v'), 0, 0, settings), true);
});

test('legacy starts on a 7x7 board with two regular colored center anchors', () => {
    const startSettings = {
        ...settings,
        boardSize: 7,
        handSize: 7,
        drawMode: 'hand',
        gameplayVariant: 'legacy',
        startingBoardTiles: [
            { id: 'tile_red_line_v', x: 3, y: 3, gameplayVariants: ['legacy'] },
            { id: 'tile_blue_line_v', x: 4, y: 3, gameplayVariants: ['legacy'] },
        ],
        startingDeckRecipe: [
            { pattern: 'line_h', colors: ['red', 'blue'], count: 2 },
            { pattern: 'line_v', colors: ['red', 'blue'], count: 2 },
            { pattern: 'tee_u', colors: ['red', 'blue'], count: 1 },
            { pattern: 'tee_r', colors: ['red', 'blue'], count: 1 },
        ],
    };
    const startTiles = createTilesFromManifest(manifest, startSettings);
    const startTile = (id) => startTiles.find((tileDef) => tileDef.id === id);
    const deckIds = createStartingDeckIds(startTiles, startSettings);
    const run = createRunState({
        totalBattles: 1,
        playerHp: 18,
        startingDeck: deckIds,
        seed: 20260508,
        settings: startSettings,
    });
    const state = createTileBattleState({
        battle: {
            enemyHp: 3,
            attacks: [{ red: 1, blue: 1 }],
        },
        run,
        settings: startSettings,
        tiles: startTiles,
    });
    const placedTiles = state.board.flat().filter(Boolean);

    assert.equal(state.board.length, 7);
    assert.equal(state.board.every((row) => row.length === 7), true);
    assert.equal(placedTiles.length, 2);
    assert.equal(state.board[3][3].id, 'tile_red_line_v');
    assert.equal(state.board[3][4].id, 'tile_blue_line_v');
    assert.deepEqual(placedTiles.map((tileDef) => tileDef.color).sort(), ['blue', 'red']);
    assert.equal(placedTiles.every((tileDef) => tileDef.pattern === 'line_v'), true);
    assert.equal(canPlaceTile(state.board, startTile('tile_red_line_v'), 3, 3, startSettings), false);
    assert.equal(canPlaceTile(state.board, startTile('tile_red_line_v'), 3, 2, startSettings), true);
    assert.equal(canPlaceTile(state.board, startTile('tile_blue_line_v'), 4, 2, startSettings), true);
});

test('hold slot stores one hand tile, swaps it, and keeps it through a new pick', () => {
    const holdSettings = {
        ...settings,
        holdEnabled: true,
        handSize: 3,
        drawMode: 'hand',
    };
    const run = {
        discardPile: [],
    };
    const state = {
        phase: 'placing',
        hand: [
            tile('tile_red_line_h'),
            tile('tile_blue_line_h'),
            tile('tile_red_line_v'),
        ],
        heldTile: null,
        selectedHandIndex: 0,
        playedThisRound: [],
        queueReserve: [],
        queuePlayedThisRound: 0,
        outcome: null,
    };

    assert.equal(holdSelectedTile(state, holdSettings), true);
    assert.equal(state.heldTile.id, 'tile_red_line_h');
    assert.equal(state.hand[0], null);
    assert.equal(state.selectedHandIndex, 1);

    assert.equal(holdSelectedTile(state, holdSettings), true);
    assert.equal(state.heldTile.id, 'tile_blue_line_h');
    assert.equal(state.hand[1].id, 'tile_red_line_h');
    assert.equal(state.selectedHandIndex, 1);

    discardRoundHand(run, state);

    assert.deepEqual(run.discardPile.sort(), ['tile_red_line_h', 'tile_red_line_v']);
    assert.equal(state.heldTile.id, 'tile_blue_line_h');
    assert.equal(state.hand.every((tileDef) => tileDef === null), true);

    state.phase = 'placing';
    assert.equal(holdSelectedTile(state, holdSettings), true);
    assert.equal(state.heldTile, null);
    assert.equal(state.hand[0].id, 'tile_blue_line_h');
    assert.equal(state.selectedHandIndex, 0);
});

test('held tile returns to discard when the battle ends', () => {
    const run = {
        discardPile: [],
    };
    const state = {
        hand: [],
        heldTile: tile('tile_red_line_h'),
        playedThisRound: [],
        queueReserve: [],
        queuePlayedThisRound: 0,
        selectedHandIndex: -1,
        outcome: 'victory',
    };

    discardRoundHand(run, state);

    assert.deepEqual(run.discardPile, ['tile_red_line_h']);
    assert.equal(state.heldTile, null);
});

test('heart scoring makes a minimal corner loop deal one heart', () => {
    const board = emptyBoard();
    const heartSettings = {
        ...settings,
        damageFormula: {
            type: 'areaMultiplier',
            areaMultiplier: 2,
            largeZoneBonus: {
                minArea: 12,
                bonusPerArea: 2,
            },
        },
        hearts: {
            zoneDamagePerHeart: 24,
            minimumZoneHearts: 1,
        },
    };

    board[2][2] = tile('tile_red_corner_rd');
    board[2][3] = tile('tile_red_corner_dl');
    board[3][2] = tile('tile_red_corner_ur');
    board[3][3] = tile('tile_red_corner_lu');

    const score = scoreTileBoard(board, heartSettings);

    assert.equal(score.zones.length, 1);
    assert.equal(score.zones[0].area, 12);
    assert.equal(score.zones[0].rawDamage, 24);
    assert.equal(score.zones[0].damage, 1);
    assert.equal(score.damageByColor.red, 1);
});

test('new pick damage previews base cost plus unplayed hand penalty', () => {
    const state = {
        hand: [
            tile('tile_red_line_h'),
            null,
            tile('tile_blue_line_v'),
            tile('tile_red_tee_u'),
            null,
            tile('tile_blue_corner_lu'),
        ],
    };
    const preview = getNewPickDamagePreview(state, {
        hearts: {
            newPickBaseDamage: 1,
            unplayedTilesPerDamage: 3,
        },
    });

    assert.deepEqual(preview, {
        baseDamage: 1,
        unplayedTiles: 4,
        unplayedDamage: 1,
        totalDamage: 2,
    });
});

test('hand submit preview includes unplayed cards and repeated-submit pressure', () => {
    const state = {
        playerHp: 9,
        handSubmitsThisBattle: 3,
        hand: [
            tile('tile_red_line_h'),
            null,
            tile('tile_blue_line_v'),
            tile('tile_red_tee_u'),
            tile('tile_blue_corner_lu'),
        ],
    };
    const preview = getHandSubmitCostPreview(state, {
        gameplayVariant: 'legacy',
        handSubmit: {
            baseDamage: 1,
            unplayedTilesPerDamage: 4,
            submitsPerExtraDamage: 2,
        },
    });

    assert.deepEqual(preview, {
        baseDamage: 1,
        unplayedHandCards: 4,
        unplayedTiles: 4,
        unplayedDamage: 1,
        handSubmitsThisBattle: 3,
        submitDamage: 1,
        totalDamage: 3,
        handSubmitLocked: false,
        canPay: true,
    });
});

test('locked last-chance hand keeps submit unaffordable after cards are played', () => {
    const state = {
        playerHp: 2,
        handSubmitLocked: true,
        lockedSubmitCost: 2,
        handSubmitsThisBattle: 0,
        hand: [
            null,
            null,
            tile('tile_blue_corner_lu'),
        ],
    };
    const preview = getHandSubmitCostPreview(state, {
        gameplayVariant: 'legacy',
        handSubmit: {
            baseDamage: 1,
            unplayedTilesPerDamage: 4,
            submitsPerExtraDamage: 2,
        },
    });

    assert.equal(preview.unplayedHandCards, 1);
    assert.equal(preview.totalDamage, 2);
    assert.equal(preview.handSubmitLocked, true);
    assert.equal(preview.canPay, false);
});

test('submitting a legacy hand pays hearts, redeals, resets strike and keeps hold', () => {
    const submitSettings = {
        ...settings,
        gameplayVariant: 'legacy',
        handSize: 4,
        drawMode: 'hand',
        handSubmit: {
            baseDamage: 1,
            unplayedTilesPerDamage: 4,
            submitsPerExtraDamage: 2,
        },
    };
    const run = {
        currentBattle: 1,
        playerHp: 10,
        gold: 0,
        drawPile: [
            'tile_red_line_v',
            'tile_blue_line_v',
            'tile_red_tee_u',
            'tile_blue_tee_u',
        ],
        discardPile: [],
        reshuffles: 0,
        rngState: 20260508,
    };
    const state = {
        round: 1,
        playerHp: 10,
        enemyHp: 3,
        board: emptyBoard(),
        hand: [
            tile('tile_red_line_h'),
            tile('tile_blue_line_h'),
            null,
            tile('tile_red_line_v'),
        ],
        heldTile: tile('tile_blue_corner_lu'),
        selectedHandIndex: 0,
        playedThisRound: ['tile_red_corner_rd'],
        queueReserve: [],
        queuePlayedThisRound: 0,
        handSubmitsThisBattle: 2,
        strikeCount: 2,
        strikeWindowOpen: true,
        phase: 'placing',
        lastResult: null,
        lastSubmitResult: null,
        battleLog: [],
        outcome: null,
    };

    const result = submitTileHand(state, {
        run,
        battle: {
            enemyHp: 3,
            attacks: [{ red: 1, blue: 1 }],
        },
        settings: submitSettings,
        tiles,
    });

    assert.equal(result.submitted, true);
    assert.equal(result.totalDamage, 2);
    assert.equal(result.playerHeartsBefore, 10);
    assert.equal(result.playerHeartsAfter, 8);
    assert.equal(state.playerHp, 8);
    assert.equal(run.playerHp, 8);
    assert.equal(state.handSubmitsThisBattle, 3);
    assert.equal(state.strikeCount, 0);
    assert.equal(state.strikeWindowOpen, false);
    assert.equal(state.round, 2);
    assert.equal(state.heldTile.id, 'tile_blue_corner_lu');
    assert.equal(run.discardPile.includes('tile_blue_corner_lu'), false);
    assert.equal(run.discardPile.includes('tile_red_corner_rd'), true);
    assert.equal(run.discardPile.includes('tile_red_line_h'), true);
    assert.equal(state.hand.filter(Boolean).length, 4);
    assert.equal(state.battleLog.at(-1), 'Hand submitted: -2 hearts.');
});

test('submitting without enough hearts ends the battle instead of redealing', () => {
    const submitSettings = {
        ...settings,
        gameplayVariant: 'legacy',
        handSize: 4,
        drawMode: 'hand',
        handSubmit: {
            baseDamage: 1,
            unplayedTilesPerDamage: 4,
            submitsPerExtraDamage: 2,
        },
    };
    const run = {
        currentBattle: 1,
        playerHp: 2,
        gold: 0,
        drawPile: ['tile_red_line_v', 'tile_blue_line_v'],
        discardPile: [],
        reshuffles: 0,
        rngState: 20260508,
    };
    const state = {
        round: 1,
        playerHp: 2,
        enemyHp: 3,
        board: emptyBoard(),
        hand: [
            tile('tile_red_line_h'),
            tile('tile_blue_line_h'),
            tile('tile_red_line_v'),
            tile('tile_blue_line_v'),
        ],
        heldTile: null,
        selectedHandIndex: 0,
        playedThisRound: [],
        queueReserve: [],
        queuePlayedThisRound: 0,
        handSubmitsThisBattle: 0,
        handSubmitLocked: true,
        lockedSubmitCost: 2,
        strikeCount: 0,
        strikeWindowOpen: false,
        phase: 'placing',
        lastResult: null,
        lastSubmitResult: null,
        battleLog: [],
        outcome: null,
    };

    const result = submitTileHand(state, {
        run,
        battle: {
            enemyHp: 3,
            attacks: [{ red: 1, blue: 1 }],
        },
        settings: submitSettings,
        tiles,
    });

    assert.equal(result.submitted, false);
    assert.equal(result.reason, 'not_enough_hearts');
    assert.equal(state.outcome, 'defeat');
    assert.equal(state.hand.filter(Boolean).length, 4);
    assert.equal(run.drawPile.length, 2);
    assert.equal(state.battleLog.at(-1), 'No hearts for a new hand: defeat.');
});

test('heart combat lets a minimal matching capture damage the monster', () => {
    const heartSettings = {
        ...settings,
        damageFormula: {
            type: 'areaMultiplier',
            areaMultiplier: 2,
        },
        hearts: {
            zoneDamagePerHeart: 24,
            minimumZoneHearts: 1,
        },
    };
    const state = {
        round: 1,
        playerHp: 12,
        enemyHp: 3,
        board: emptyBoard(),
        hand: [],
        selectedHandIndex: -1,
        queueReserve: [],
        playedThisRound: [],
        queuePlayedThisRound: 0,
        phase: 'placing',
        lastResult: null,
        outcome: null,
    };

    state.board[2][2] = tile('tile_red_corner_rd');
    state.board[2][3] = tile('tile_red_corner_dl');
    state.board[3][2] = tile('tile_red_corner_ur');
    state.board[3][3] = tile('tile_red_corner_lu');

    resolveTileRound(state, {
        enemyHp: 3,
        attacks: [{ red: 1, blue: 0 }],
    }, heartSettings);

    assert.equal(state.lastResult.enemyDamage, 1);
    assert.equal(state.lastResult.playerDamage, 0);
    assert.equal(state.enemyHp, 2);
});

test('legacy placement scores closure immediately, pays gold, and skips monster damage', () => {
    const heartSettings = {
        ...settings,
        gameplayVariant: 'legacy',
        roundBoardCleanup: 'clearScoredTiles',
        damageFormula: {
            type: 'areaMultiplier',
            areaMultiplier: 2,
        },
        hearts: {
            zoneDamagePerHeart: 24,
            minimumZoneHearts: 1,
        },
        gold: {
            closureGold: 1,
            strikeGoldPerCount: 1,
        },
    };
    const run = {
        gold: 0,
        colorMultipliers: { red: 1, blue: 1, green: 1 },
    };
    const state = {
        round: 1,
        playerHp: 12,
        enemyHp: 3,
        board: emptyBoard(),
        hand: [tile('tile_red_corner_lu')],
        heldTile: null,
        selectedHandIndex: 0,
        queueReserve: [],
        playedThisRound: [],
        queuePlayedThisRound: 0,
        handSubmitsThisBattle: 0,
        strikeCount: 0,
        strikeWindowOpen: false,
        phase: 'placing',
        lastResult: null,
        battleLog: [],
        outcome: null,
    };

    state.board[2][2] = tile('tile_red_corner_rd');
    state.board[2][3] = tile('tile_red_corner_dl');
    state.board[3][2] = tile('tile_red_corner_ur');

    assert.equal(placeTile(state, heartSettings, 3, 3), true);
    const result = resolveImmediatePlacement(state, {
        enemyHp: 3,
        attacks: [{ red: 99, blue: 99 }],
    }, heartSettings, run);

    assert.equal(result.lastClosureImmediate, true);
    assert.equal(result.enemyDamage, 1);
    assert.equal(result.playerDamage, 0);
    assert.equal(result.closedZones, 1);
    assert.equal(result.goldEarned, 1);
    assert.equal(result.monsterHeartsBefore, 3);
    assert.equal(result.monsterHeartsAfter, 2);
    assert.equal(state.enemyHp, 2);
    assert.equal(state.playerHp, 12);
    assert.equal(run.gold, 1);
    assert.equal(state.phase, 'placing');
    assert.equal(state.strikeWindowOpen, true);
    assert.equal(state.board.flat().filter(Boolean).length, 0);
});

test('empty locked last-chance hand loses if the monster survived', () => {
    const heartSettings = {
        ...settings,
        gameplayVariant: 'legacy',
        handSubmit: {
            baseDamage: 1,
            unplayedTilesPerDamage: 4,
            submitsPerExtraDamage: 2,
        },
    };
    const state = {
        round: 1,
        playerHp: 2,
        enemyHp: 1,
        board: emptyBoard(),
        hand: [null, null, null],
        heldTile: null,
        selectedHandIndex: -1,
        queueReserve: [],
        playedThisRound: ['tile_red_line_h'],
        queuePlayedThisRound: 0,
        handSubmitsThisBattle: 0,
        handSubmitLocked: true,
        lockedSubmitCost: 2,
        strikeCount: 0,
        strikeWindowOpen: false,
        phase: 'placing',
        lastResult: null,
        lastSubmitResult: null,
        battleLog: [],
        outcome: null,
    };

    const result = resolveHandSubmitDefeatIfNeeded(state, heartSettings);

    assert.equal(result.reason, 'not_enough_hearts');
    assert.equal(state.outcome, 'defeat');
    assert.equal(state.lastSubmitResult.totalDamage, 2);
    assert.equal(state.battleLog.at(-1), 'No hearts for a new hand: defeat.');
});

test('legacy consecutive closing placement awards strike gold', () => {
    const heartSettings = {
        ...settings,
        gameplayVariant: 'legacy',
        roundBoardCleanup: 'clearScoredTiles',
        damageFormula: {
            type: 'areaMultiplier',
            areaMultiplier: 2,
        },
        hearts: {
            zoneDamagePerHeart: 24,
            minimumZoneHearts: 1,
        },
        gold: {
            closureGold: 1,
            strikeGoldPerCount: 1,
        },
    };
    const run = {
        gold: 5,
        colorMultipliers: { red: 1, blue: 1, green: 1 },
    };
    const state = {
        round: 1,
        playerHp: 12,
        enemyHp: 3,
        board: emptyBoard(),
        hand: [tile('tile_red_corner_lu')],
        heldTile: null,
        selectedHandIndex: 0,
        queueReserve: [],
        playedThisRound: [],
        queuePlayedThisRound: 0,
        handSubmitsThisBattle: 0,
        strikeCount: 0,
        strikeWindowOpen: true,
        phase: 'placing',
        lastResult: null,
        battleLog: [],
        outcome: null,
    };

    state.board[2][2] = tile('tile_red_corner_rd');
    state.board[2][3] = tile('tile_red_corner_dl');
    state.board[3][2] = tile('tile_red_corner_ur');

    assert.equal(placeTile(state, heartSettings, 3, 3), true);
    const result = resolveImmediatePlacement(state, {
        enemyHp: 3,
        attacks: [{ red: 0, blue: 0 }],
    }, heartSettings, run);

    assert.equal(result.strikeCount, 1);
    assert.equal(result.closureGold, 1);
    assert.equal(result.strikeGold, 1);
    assert.equal(result.goldEarned, 2);
    assert.equal(run.gold, 7);
    assert.equal(state.battleLog.at(-1), 'Strike x1: +1 gold.');
});

test('placement payoff focus charges setup and boosts the next capture', () => {
    const payoffSettings = {
        ...settings,
        gameplayVariant: 'placement_payoff',
        placementPayoff: {
            focusPerUsefulPlacement: 1,
            maxFocus: 4,
            bonusPerFocus: 3,
        },
    };
    const state = {
        round: 1,
        playerHp: 30,
        enemyHp: 60,
        board: emptyBoard(),
        hand: [tile('tile_red_line_h')],
        selectedHandIndex: 0,
        queueReserve: [],
        playedThisRound: [],
        queuePlayedThisRound: 0,
        phase: 'placing',
        lastResult: null,
        outcome: null,
        placementFocus: 0,
    };

    state.board[2][2] = tile('tile_red_line_h');

    assert.equal(placeTile(state, payoffSettings, 3, 2), true);
    assert.equal(state.placementFocus, 1);
    assert.equal(state.lastPlacementFocusDelta, 1);

    state.placementFocus = 2;
    state.hand = [tile('tile_red_corner_lu')];
    state.selectedHandIndex = 0;
    state.board[2][2] = tile('tile_red_corner_rd');
    state.board[2][3] = tile('tile_red_corner_dl');
    state.board[3][2] = tile('tile_red_corner_ur');
    state.board[3][3] = null;

    assert.equal(placeTile(state, payoffSettings, 3, 3), true);

    resolveTileRound(state, {
        enemyHp: 60,
        attacks: [{ red: 0, blue: 0, green: 0 }],
    }, payoffSettings);

    assert.equal(state.lastResult.placementFocusSpent, 2);
    assert.equal(state.lastResult.placementFocusBonus, 6);
    assert.equal(state.lastResult.score.zones.some((zone) => zone.focusBonus === 6), true);
    assert.equal(state.placementFocus, 0);
});

test('one color chain treats combat colors as one land and pays chain bonus', () => {
    const chainSettings = {
        ...settings,
        gameplayVariant: 'one_color_chain',
        activeCombatColors: ['red', 'blue'],
        oneColorChain: {
            maxChain: 5,
            bonusPerChain: 4,
        },
        damageFormula: {
            type: 'areaMultiplier',
            areaMultiplier: 2,
        },
    };
    const chainTiles = createTilesFromManifest(manifest, chainSettings);
    const chainTile = (id) => chainTiles.find((tileDef) => tileDef.id === id);
    const state = {
        round: 1,
        playerHp: 30,
        enemyHp: 80,
        board: emptyBoard(),
        hand: [chainTile('tile_red_line_h')],
        selectedHandIndex: 0,
        queueReserve: [],
        playedThisRound: [],
        queuePlayedThisRound: 0,
        phase: 'placing',
        lastResult: null,
        outcome: null,
        chainMeter: 0,
        chainRegionKeys: [],
    };

    assert.equal(placeTile(state, chainSettings, 1, 1), true);
    assert.equal(state.chainMeter, 1);

    state.hand = [chainTile('tile_blue_line_h')];
    state.selectedHandIndex = 0;

    assert.equal(placeTile(state, chainSettings, 2, 1), true);
    assert.equal(state.chainMeter, 2);
    assert.equal(state.lastChainDelta, 1);

    state.chainMeter = 4;
    state.board = emptyBoard();
    state.board[2][2] = chainTile('tile_blue_corner_rd');
    state.board[2][3] = chainTile('tile_red_corner_dl');
    state.board[3][2] = chainTile('tile_red_corner_ur');
    state.board[3][3] = chainTile('tile_blue_corner_lu');

    resolveTileRound(state, {
        enemyHp: 80,
        attacks: [{ red: 1, blue: 2, green: 5 }],
    }, chainSettings);

    assert.equal(state.lastResult.attack.red, 3);
    assert.equal(state.lastResult.attack.blue, 0);
    assert.equal(state.lastResult.chainSpent, 4);
    assert.equal(state.lastResult.chainBonus, 12);
    assert.equal(state.lastResult.score.zones[0].color, 'red');
    assert.equal(state.lastResult.score.zones[0].chainBonus, 12);
    assert.equal(state.lastResult.byColor.blue.playerDamage, 0);
    assert.equal(state.chainMeter, 1);
});

test('connect targets use one-color land and pay bonus once', () => {
    const targetSettings = {
        ...settings,
        gameplayVariant: 'connect_targets',
        activeCombatColors: ['red', 'blue'],
        connectTargets: {
            bonusDamage: 30,
            minDistance: 2,
            maxDistance: 6,
            oneColorLand: true,
            respawn: 'nextRound',
        },
        damageFormula: {
            type: 'areaMultiplier',
            areaMultiplier: 2,
        },
    };
    const targetTiles = createTilesFromManifest(manifest, targetSettings);
    const targetTile = (id) => targetTiles.find((tileDef) => tileDef.id === id);
    const state = {
        round: 1,
        playerHp: 30,
        enemyHp: 80,
        board: emptyBoard(),
        hand: [],
        selectedHandIndex: -1,
        queueReserve: [],
        playedThisRound: [],
        queuePlayedThisRound: 0,
        phase: 'placing',
        lastResult: null,
        outcome: null,
        placementFocus: 0,
        chainMeter: null,
        chainRegionKeys: [],
        connectTargets: {
            a: { x: 1, y: 1 },
            b: { x: 3, y: 1 },
            distance: 2,
            connected: false,
            scored: false,
        },
    };

    state.board[1][1] = targetTile('tile_red_line_h');
    state.board[1][2] = targetTile('tile_blue_line_h');
    state.board[1][3] = targetTile('tile_red_line_h');

    resolveTileRound(state, {
        enemyHp: 80,
        attacks: [{ red: 0, blue: 5, green: 5 }],
    }, targetSettings);

    assert.equal(state.lastResult.attack.red, 5);
    assert.equal(state.lastResult.attack.blue, 0);
    assert.equal(state.lastResult.connectTargetConnected, true);
    assert.equal(state.lastResult.connectTargetBonus, 30);
    assert.equal(state.lastResult.score.damageByColor.red, 30);
    assert.equal(state.lastResult.enemyDamage, 30);
    assert.equal(state.lastResult.byColor.blue.playerDamage, 0);

    resolveTileRound(state, {
        enemyHp: 80,
        attacks: [{ red: 0, blue: 0, green: 0 }],
    }, targetSettings);

    assert.equal(state.lastResult.connectTargetConnected, false);
    assert.equal(state.lastResult.connectTargetBonus, 0);
});

test('road mode scores connected start/end road by route length without area capture', () => {
    const roadSettings = {
        ...settings,
        gameplayVariant: 'road_mode',
        activeCombatColors: ['red', 'blue'],
        roadMode: {
            completeBonus: 4,
            damagePerTile: 6,
            maxScoredExtraLength: 6,
            minLength: 3,
            gateMinDistance: 2,
            gateMaxDistance: 6,
            oneColorLand: true,
            respawn: 'nextRound',
        },
        damageFormula: {
            type: 'areaMultiplier',
            areaMultiplier: 2,
        },
    };
    const roadTiles = createTilesFromManifest(manifest, roadSettings);
    const roadTile = (id) => roadTiles.find((tileDef) => tileDef.id === id);
    const state = {
        round: 1,
        playerHp: 30,
        enemyHp: 80,
        board: emptyBoard(),
        hand: [],
        selectedHandIndex: -1,
        queueReserve: [],
        playedThisRound: [],
        queuePlayedThisRound: 0,
        phase: 'placing',
        lastResult: null,
        outcome: null,
        placementFocus: 0,
        chainMeter: null,
        chainRegionKeys: [],
        connectTargets: {
            a: { x: 1, y: 1 },
            b: { x: 3, y: 1 },
            distance: 2,
            connected: false,
            scored: false,
        },
    };

    state.board[1][1] = roadTile('tile_red_line_h');
    state.board[1][2] = roadTile('tile_blue_line_h');
    state.board[1][3] = roadTile('tile_red_line_h');

    resolveTileRound(state, {
        enemyHp: 80,
        attacks: [{ red: 0, blue: 5, green: 5 }],
    }, roadSettings);

    assert.equal(state.lastResult.attack.red, 5);
    assert.equal(state.lastResult.attack.blue, 0);
    assert.equal(state.lastResult.score.zones.length, 0);
    assert.equal(state.lastResult.roadConnected, true);
    assert.equal(state.lastResult.roadLength, 3);
    assert.equal(state.lastResult.roadShortestLength, 3);
    assert.equal(state.lastResult.roadExtraLength, 0);
    assert.equal(state.lastResult.roadDamage, 4);
    assert.equal(state.lastResult.score.damageByColor.red, 4);
    assert.equal(state.lastResult.enemyDamage, 0);
    assert.equal(state.lastResult.byColor.blue.playerDamage, 0);
    assert.deepEqual(new Set(state.lastResult.scoredTileKeys), new Set(['1,1', '2,1', '3,1']));

    resolveTileRound(state, {
        enemyHp: 80,
        attacks: [{ red: 0, blue: 0, green: 0 }],
    }, roadSettings);

    assert.equal(state.lastResult.roadConnected, false);
    assert.equal(state.lastResult.roadDamage, 0);
});

test('road mode rewards detours over shortest start/end bridge', () => {
    const roadSettings = {
        ...settings,
        gameplayVariant: 'road_mode',
        activeCombatColors: ['red', 'blue'],
        roadMode: {
            completeBonus: 4,
            damagePerTile: 6,
            maxScoredExtraLength: 6,
            minLength: 3,
            gateMinDistance: 2,
            gateMaxDistance: 8,
            oneColorLand: true,
            respawn: 'nextRound',
        },
    };
    const roadTiles = createTilesFromManifest(manifest, roadSettings);
    const roadTile = (id) => roadTiles.find((tileDef) => tileDef.id === id);
    const state = {
        round: 1,
        playerHp: 30,
        enemyHp: 80,
        board: emptyBoard(),
        hand: [],
        selectedHandIndex: -1,
        queueReserve: [],
        playedThisRound: [],
        queuePlayedThisRound: 0,
        phase: 'placing',
        lastResult: null,
        outcome: null,
        placementFocus: 0,
        chainMeter: null,
        chainRegionKeys: [],
        connectTargets: {
            a: { x: 1, y: 1 },
            b: { x: 3, y: 1 },
            distance: 2,
            connected: false,
            scored: false,
        },
    };

    state.board[1][1] = roadTile('tile_red_plus');
    state.board[2][1] = roadTile('tile_blue_plus');
    state.board[3][1] = roadTile('tile_red_plus');
    state.board[3][2] = roadTile('tile_blue_plus');
    state.board[3][3] = roadTile('tile_red_plus');
    state.board[2][3] = roadTile('tile_blue_plus');
    state.board[1][3] = roadTile('tile_red_plus');

    resolveTileRound(state, {
        enemyHp: 80,
        attacks: [{ red: 0, blue: 0, green: 0 }],
    }, roadSettings);

    assert.equal(state.lastResult.roadConnected, true);
    assert.equal(state.lastResult.roadLength, 7);
    assert.equal(state.lastResult.roadShortestLength, 3);
    assert.equal(state.lastResult.roadExtraLength, 4);
    assert.equal(state.lastResult.roadDamage, 28);
    assert.deepEqual(
        new Set(state.lastResult.scoredTileKeys),
        new Set(['1,1', '1,2', '1,3', '2,3', '3,3', '3,2', '3,1']),
    );
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

test('queue draw mode exposes only current and next tile', () => {
    const deckIds = createStartingDeckIds(tiles, {
        startingDeckRecipe: [
            { pattern: 'line_h', colors: ['red', 'blue', 'green'], count: 1 },
            { pattern: 'line_v', colors: ['red', 'blue', 'green'], count: 1 },
            { pattern: 'tee_u', colors: ['red', 'blue', 'green'], count: 1 },
            { pattern: 'tee_r', colors: ['red', 'blue', 'green'], count: 1 },
        ],
    });
    const run = createRunState({
        totalBattles: 1,
        playerHp: 30,
        startingDeck: deckIds,
        seed: 20260508,
    });
    const queueSettings = {
        ...settings,
        handSize: 7,
        drawMode: 'queue',
    };
    const state = createTileBattleState({
        battle: {
            enemyHp: 30,
            attacks: [{ red: 1, blue: 1, green: 1 }],
        },
        run,
        settings: queueSettings,
        tiles,
    });

    assert.equal(state.hand.length, 2);
    assert.equal(state.queueReserve.length, 5);
    assert.equal(state.selectedHandIndex, 0);

    const previewBefore = state.hand[1]?.id;
    assert.equal(placeTile(state, queueSettings, 2, 2), true);
    advanceTileQueue(run, state, queueSettings, tiles);

    assert.equal(state.queuePlayedThisRound, 1);
    assert.equal(state.selectedHandIndex, 0);
    assert.equal(state.hand[0]?.id, previewBefore);
});

test('active combat colors constrain early reward colors', () => {
    const deckIds = createStartingDeckIds(tiles, {
        activeCombatColors: ['red', 'blue'],
        startingDeckRecipe: [
            { pattern: 'line_h', colors: ['red', 'blue'], count: 2 },
            { pattern: 'line_v', colors: ['red', 'blue'], count: 2 },
            { pattern: 'tee_u', colors: ['red', 'blue'], count: 1 },
            { pattern: 'tee_r', colors: ['red', 'blue'], count: 1 },
            { pattern: 'tee_d', colors: ['red', 'blue'], count: 1 },
            { pattern: 'tee_l', colors: ['red', 'blue'], count: 1 },
            { pattern: 'corner_ur', colors: ['red', 'blue'], count: 1 },
            { pattern: 'corner_rd', colors: ['red', 'blue'], count: 1 },
            { pattern: 'corner_dl', colors: ['red', 'blue'], count: 1 },
            { pattern: 'corner_lu', colors: ['red', 'blue'], count: 1 },
        ],
    });
    const run = createRunState({
        totalBattles: 1,
        playerHp: 30,
        startingDeck: deckIds,
        seed: 20260508,
        settings: { activeCombatColors: ['red', 'blue'] },
    });
    const rewards = getRewardChoices(run, tiles, { activeCombatColors: ['red', 'blue'] });
    const addTile = rewards.find((reward) => reward.type === 'add_tile');
    const boost = rewards.find((reward) => reward.type === 'boost_color');

    assert.equal(['red', 'blue'].includes(tile(addTile.tileId).color), true);
    assert.equal(['red', 'blue'].includes(boost.color), true);
});
