import assert from 'node:assert/strict';
import test from 'node:test';
import cardCatalog from '../configs/cards.json' with { type: 'json' };
import gameConfig from '../configs/game.json' with { type: 'json' };
import manifest from '../assets/tiles_v2/tile_manifest.json' with { type: 'json' };
import {
    getCatalogSpecialTiles,
    getEnabledShopCards,
    validateCardCatalog,
} from '../src/entities/cards.js';
import {
    GAMEPLAY_VARIANT_ORDER,
    getGameplayVariant,
    normalizeGameplayVariantId,
} from '../src/entities/gameplayVariants.js';
import {
    BattleOutcome,
    buyShopOffer,
    createShopState,
    createRunState,
    drawTileIds,
    finishShop,
    getRewardChoices,
    resolveBattle,
} from '../src/entities/run.js';
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
    getTilePlacementFailure,
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
const catalogSpecialTiles = getCatalogSpecialTiles(cardCatalog);
const stagedCatalogSpecialTiles = getCatalogSpecialTiles(cardCatalog, { includeStaged: true });
const cardValidationTiles = [
    ...manifest.tiles,
    ...gameConfig.tileBattle.specialTiles,
    ...stagedCatalogSpecialTiles,
];

function getTestCardBalanceStatus(card) {
    return card.balanceStatus
        ?? card.rules?.balanceStatus
        ?? cardCatalog.shop.familyBalanceStatus?.[card.family]
        ?? 'unverified';
}

test('card catalog validates buyable tiles, prices, and staged special families', () => {
    const result = validateCardCatalog(cardCatalog, {
        tiles: cardValidationTiles,
    });

    assert.equal(result.enabledCards.some((card) => card.id === 'card_red_line_h'), true);
    assert.equal(result.enabledCards.some((card) => card.id === 'card_blue_plus'), true);
    assert.equal(result.enabledCards.some((card) => card.id === 'card_joker_line_v'), false);
    assert.equal(result.enabledCards.some((card) => card.family === 'double_line'), false);
    assert.equal(result.stagedCards.some((card) => card.id === 'card_joker_line_v'), true);
    assert.equal(result.stagedCards.some((card) => card.family === 'double_line'), true);
    assert.equal(result.stagedCards.some((card) => card.family === 'double_curve'), true);
    assert.equal(result.enabledCards.every((card) => card.cost > 0), true);
    assert.equal(result.enabledCards.every((card) => getTestCardBalanceStatus(card).startsWith('mvp_keep')), true);
});

test('shop card filtering respects battle unlocks and active early colors', () => {
    const battleOneCards = getEnabledShopCards(cardCatalog, {
        battleNumber: 1,
        activeColors: ['red', 'blue'],
    });
    const battleTwoCards = getEnabledShopCards(cardCatalog, {
        battleNumber: 2,
        activeColors: ['red', 'blue'],
    });

    assert.equal(battleOneCards.some((card) => card.family === 'plus'), false);
    assert.equal(battleOneCards.some((card) => card.family === 'joker_line'), false);
    assert.equal(battleTwoCards.some((card) => card.family === 'double_line'), false);
    assert.equal(battleOneCards.some((card) => card.color === 'green'), false);
    assert.equal(battleTwoCards.some((card) => card.id === 'card_red_plus'), true);
    assert.equal(battleTwoCards.some((card) => card.id === 'card_joker_line_v'), false);

    const battleThreeCards = getEnabledShopCards(cardCatalog, {
        battleNumber: 3,
        activeColors: ['red', 'blue'],
    });
    assert.equal(battleThreeCards.some((card) => card.id === 'card_double_line'), false);
});

test('card catalog keeps staged special tile definitions out of the active shop', () => {
    const specialTiles = getCatalogSpecialTiles(cardCatalog);

    assert.deepEqual(specialTiles.map((tileDef) => tileDef.id), []);

    const stagedSpecialTiles = getCatalogSpecialTiles(cardCatalog, { includeStaged: true });

    assert.deepEqual(stagedSpecialTiles.map((tileDef) => tileDef.id), ['joker_line_v', 'double_red_line_h']);
    assert.equal(stagedSpecialTiles[0].matrix.join('/'), '.*./.*./.*.');
    assert.equal(stagedSpecialTiles[0].special, 'universal_boundary');
    assert.equal(stagedSpecialTiles[0].sourceCardId, 'card_joker_line_v');
    assert.equal(stagedSpecialTiles[1].special, 'double_macro_tile');
    assert.deepEqual(stagedSpecialTiles[1].segments.map((segment) => segment.tileId), [
        'tile_red_line_h',
        'tile_red_line_h',
    ]);
});

test('shop generation creates deterministic card offers for the next battle', () => {
    const run = createRunState({
        totalBattles: 5,
        playerHp: 18,
        startingDeck: ['tile_red_line_h', 'tile_blue_line_h'],
        seed: 20260508,
        settings: { activeCombatColors: ['red', 'blue'] },
    });

    run.completedBattles = 1;
    run.gold = 9;

    const shop = createShopState(run, cardCatalog);
    const counts = new Map();

    assert.equal(shop.nextBattle, 2);
    assert.equal(shop.offers.length, cardCatalog.shop.offerCount);
    assert.equal(shop.balanceStatus, 'mvp_balance_synced');
    assert.equal(shop.offers.some((offer) => offer.cardId === 'card_joker_line_v'), false);
    assert.equal(shop.offers.some((offer) => offer.cardId === 'card_double_line'), false);

    for (const offer of shop.offers) {
        counts.set(offer.cardId, (counts.get(offer.cardId) ?? 0) + 1);
        const catalogCard = cardCatalog.cards.find((card) => card.id === offer.cardId);
        assert.equal(offer.type, 'shop_card');
        assert.equal(offer.balanceStatus, getTestCardBalanceStatus(catalogCard));
        assert.equal(offer.enabledFromBattle <= 2, true);
        assert.equal(!offer.color || ['red', 'blue'].includes(offer.color), true);
        assert.equal(offer.cost > 0, true);
        assert.equal(offer.bought, false);
    }

    for (const [cardId, count] of counts) {
        const catalogCard = cardCatalog.cards.find((card) => card.id === cardId);
        assert.equal(count <= catalogCard.maxPerShop, true);
    }
});

test('balance-synced shop keeps staged joker and double cards out of generated offers', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
        const run = createRunState({
            totalBattles: 5,
            playerHp: 18,
            startingDeck: ['tile_red_line_h', 'tile_blue_line_h'],
            seed,
            settings: { activeCombatColors: ['red', 'blue'] },
        });

        run.completedBattles = 1;
        let shop = createShopState(run, cardCatalog);
        assert.equal(shop.offers.some((offer) => offer.cardId === 'card_joker_line_v'), false);
        assert.equal(shop.offers.some((offer) => offer.cardId === 'card_double_line'), false);

        run.completedBattles = 2;
        shop = createShopState(run, cardCatalog);
        assert.equal(shop.offers.some((offer) => offer.cardId === 'card_joker_line_v'), false);
        assert.equal(shop.offers.some((offer) => offer.cardId === 'card_double_line'), false);
    }
});

test('buying shop offers spends gold and sends cards to discard', () => {
    const run = createRunState({
        totalBattles: 5,
        playerHp: 18,
        startingDeck: ['tile_red_line_h', 'tile_blue_line_h'],
        seed: 20260508,
        settings: { activeCombatColors: ['red', 'blue'] },
    });

    run.completedBattles = 1;
    run.gold = 20;

    const shop = createShopState(run, cardCatalog);
    const offer = shop.offers.find((candidate) => candidate.cost <= run.gold);
    const deckBefore = run.deck.length;
    const discardBefore = run.discardPile.length;
    const result = buyShopOffer(run, shop, offer.offerId);

    assert.equal(result.bought, true);
    assert.equal(offer.bought, true);
    assert.equal(run.gold, 20 - offer.cost);
    assert.equal(run.deck.length, deckBefore + 1);
    assert.equal(run.discardPile.length, discardBefore + 1);
    assert.equal(run.deck.at(-1), offer.tileId);
    assert.equal(run.discardPile.at(-1), offer.tileId);
    assert.equal(run.purchasedCards.at(-1).cardId, offer.cardId);
    assert.equal(run.purchasedCards.at(-1).balanceStatus, offer.balanceStatus);

    const secondOffer = shop.offers.find((candidate) => !candidate.bought && candidate.cost <= run.gold);
    const secondResult = buyShopOffer(run, shop, secondOffer.offerId);

    assert.equal(secondResult.bought, true);
    assert.equal(run.deck.length, deckBefore + 2);
    assert.equal(run.discardPile.length, discardBefore + 2);
    assert.equal(run.deck.at(-1), secondOffer.tileId);
    assert.equal(run.discardPile.at(-1), secondOffer.tileId);
    assert.equal(shop.boughtCards.length, 2);

    const repeated = buyShopOffer(run, shop, offer.offerId);
    assert.equal(repeated.bought, false);
    assert.equal(repeated.reason, 'already_bought');

    const finished = finishShop(run, shop);
    assert.equal(finished.nextBattle, 2);
    assert.equal(run.currentBattle, 2);
    assert.equal(run.shopHistory.length, 1);
    assert.equal(run.shopHistory[0].boughtCards.length, 2);
});

test('unaffordable shop offers stay visible and cannot be bought', () => {
    const run = createRunState({
        totalBattles: 5,
        playerHp: 18,
        startingDeck: ['tile_red_line_h', 'tile_blue_line_h'],
        seed: 20260508,
        settings: { activeCombatColors: ['red', 'blue'] },
    });

    run.completedBattles = 1;
    run.gold = 0;

    const shop = createShopState(run, cardCatalog);
    const result = buyShopOffer(run, shop, shop.offers[0].offerId);

    assert.equal(result.bought, false);
    assert.equal(result.reason, 'not_enough_gold');
    assert.equal(shop.offers[0].bought, false);
    assert.equal(run.deck.length, 2);
    assert.equal(run.discardPile.length, 0);
});

function createSingleOfferShop(card) {
    return {
        id: `test_shop_${card.id}`,
        battleNumber: Math.max(1, card.enabledFromBattle ?? 1),
        nextBattle: Math.max(1, card.enabledFromBattle ?? 1),
        offers: [{
            ...card,
            offerId: `${card.id}_test`,
            cardId: card.id,
            type: 'shop_card',
            tileId: card.tileId ?? card.specialTile?.id ?? null,
            bought: false,
            balanceStatus: getTestCardBalanceStatus(card),
        }],
        boughtCards: [],
        goldBefore: 20,
        goldAfter: 20,
        continued: false,
        balanceStatus: cardCatalog.shop.balanceStatus,
    };
}

test('plus and staged special debug offers can be bought and enter discard', () => {
    for (const cardId of ['card_red_plus', 'card_joker_line_v', 'card_double_line']) {
        const card = cardCatalog.cards.find((entry) => entry.id === cardId);
        const run = createRunState({
            totalBattles: 5,
            playerHp: 18,
            startingDeck: ['tile_red_line_h'],
            seed: 20260508,
            settings: { activeCombatColors: ['red', 'blue'] },
        });
        const shop = createSingleOfferShop(card);

        run.gold = 20;

        const result = buyShopOffer(run, shop, shop.offers[0].offerId);

        assert.equal(result.bought, true, cardId);
        assert.equal(run.deck.at(-1), shop.offers[0].tileId);
        assert.equal(run.discardPile.at(-1), shop.offers[0].tileId);
        assert.equal(run.purchasedCards.at(-1).cardId, cardId);
        assert.equal(run.purchasedCards.at(-1).balanceStatus, getTestCardBalanceStatus(card));
    }
});

test('bought double-line card appears through normal discard reshuffle draw', () => {
    const card = cardCatalog.cards.find((entry) => entry.id === 'card_double_line');
    const run = createRunState({
        totalBattles: 5,
        playerHp: 18,
        startingDeck: ['tile_red_line_h'],
        seed: 20260508,
        settings: { activeCombatColors: ['red', 'blue'] },
    });
    const shop = createSingleOfferShop(card);

    run.gold = 20;
    assert.equal(buyShopOffer(run, shop, shop.offers[0].offerId).bought, true);

    run.drawPile = [];

    assert.deepEqual(drawTileIds(run, 1), ['double_red_line_h']);
    assert.equal(run.reshuffles, 1);
});

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

test('monster bounty pays configured reward once on victory', () => {
    const run = createRunState({
        totalBattles: 1,
        playerHp: 18,
        startingDeck: ['tile_red_line_h'],
        seed: 20260508,
        settings: {
            gameplayVariant: 'legacy',
            hearts: { maxPlayerHp: 18 },
        },
    });

    run.gold = 4;

    const firstResult = resolveBattle(run, BattleOutcome.Victory, {
        id: 'battle_test',
        reward: 3,
    });
    const secondResult = resolveBattle(run, BattleOutcome.Victory, {
        id: 'battle_test',
        reward: 3,
    });

    assert.equal(firstResult.bountyGold, 3);
    assert.equal(firstResult.gold, 7);
    assert.equal(secondResult.bountyGold, 0);
    assert.equal(run.gold, 7);
    assert.deepEqual(run.bountiesClaimed, ['battle_test']);
    assert.equal(run.maxPlayerHp, 18);
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

test('placement failure explains no card, occupied cells, edge mismatch, and macro footprint', () => {
    const board = emptyBoard();
    board[2][2] = tile('tile_red_line_h');

    assert.equal(
        getTilePlacementFailure(board, null, 1, 1, settings).code,
        'no_selected_card',
    );
    assert.equal(
        getTilePlacementFailure(board, tile('tile_blue_line_v'), 2, 2, settings).code,
        'occupied_cell',
    );
    assert.equal(
        getTilePlacementFailure(board, tile('tile_blue_line_h'), 3, 2, settings).code,
        'edge_mismatch',
    );

    const macroSettings = {
        ...settings,
        boardSize: 7,
        specialTiles: stagedCatalogSpecialTiles,
    };
    const macroTiles = createTilesFromManifest(manifest, macroSettings);
    const macroTile = macroTiles.find((tileDef) => tileDef.id === 'double_red_line_h');
    const macroBoard = Array.from({ length: 7 }, () => Array(7).fill(null));

    assert.equal(
        getTilePlacementFailure(macroBoard, macroTile, 6, 1, macroSettings).code,
        'outside_macro_footprint',
    );
});

test('legacy starts on a 7x7 board with one universal red-blue center anchor', () => {
    const startSettings = {
        ...settings,
        boardSize: 7,
        handSize: 7,
        drawMode: 'hand',
        gameplayVariant: 'legacy',
        activeCombatColors: ['red', 'blue'],
        specialTiles: [
            {
                id: 'starter_universal_line_v',
                color: 'universal',
                pattern: 'universal_line_v',
                matrix: ['.*.', '.*.', '.*.'],
                special: 'universal_boundary',
                gameplayVariants: ['legacy'],
            },
        ],
        startingBoardTiles: [
            { id: 'starter_universal_line_v', x: 3, y: 3, gameplayVariants: ['legacy'] },
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
    assert.equal(placedTiles.length, 1);
    assert.equal(state.board[3][3].id, 'starter_universal_line_v');
    assert.equal(state.board[3][3].color, 'universal');
    assert.equal(state.board[3][3].pattern, 'universal_line_v');
    assert.equal(canPlaceTile(state.board, startTile('tile_red_line_v'), 3, 3, startSettings), false);
    assert.equal(canPlaceTile(state.board, startTile('tile_red_line_v'), 3, 2, startSettings), true);
    assert.equal(canPlaceTile(state.board, startTile('tile_blue_line_v'), 3, 2, startSettings), true);
    assert.equal(canPlaceTile(state.board, startTile('tile_red_line_h'), 3, 2, startSettings), false);

    const directColorBoard = Array.from({ length: 7 }, () => Array(7).fill(null));
    directColorBoard[3][3] = startTile('tile_red_line_v');
    assert.equal(canPlaceTile(directColorBoard, startTile('tile_blue_line_v'), 3, 2, startSettings), false);
});

test('legacy field resources seed on empty board cells under the tile layer', () => {
    const resourceSettings = {
        ...settings,
        boardSize: 7,
        handSize: 3,
        drawMode: 'hand',
        gameplayVariant: 'legacy',
        activeCombatColors: ['red', 'blue'],
        specialTiles: [
            {
                id: 'starter_universal_line_v',
                color: 'universal',
                pattern: 'universal_line_v',
                matrix: ['.*.', '.*.', '.*.'],
                special: 'universal_boundary',
                gameplayVariants: ['legacy'],
            },
        ],
        startingBoardTiles: [
            { id: 'starter_universal_line_v', x: 3, y: 3, gameplayVariants: ['legacy'] },
        ],
        startingDeckRecipe: [
            { pattern: 'line_h', colors: ['red', 'blue'], count: 1 },
            { pattern: 'line_v', colors: ['red', 'blue'], count: 1 },
        ],
        fieldResources: {
            enabled: true,
            gold: { count: 2, amount: 1 },
            heart: { count: 1, amount: 2 },
        },
    };
    const resourceTiles = createTilesFromManifest(manifest, resourceSettings);
    const run = createRunState({
        totalBattles: 1,
        playerHp: 18,
        startingDeck: createStartingDeckIds(resourceTiles, resourceSettings),
        seed: 20260508,
        settings: resourceSettings,
    });
    const state = createTileBattleState({
        battle: {
            enemyHp: 3,
            attacks: [{ red: 1, blue: 1 }],
        },
        run,
        settings: resourceSettings,
        tiles: resourceTiles,
    });

    assert.equal(state.boardResources.length, 3);
    assert.equal(state.boardResources.filter((resource) => resource.type === 'gold').length, 2);
    assert.equal(state.boardResources.filter((resource) => resource.type === 'heart').length, 1);
    assert.equal(state.boardResources.every((resource) => !resource.consumed), true);
    assert.equal(state.boardResources.some((resource) => resource.x === 3 && resource.y === 3), false);
    assert.equal(state.boardResources.every((resource) => state.board[resource.y][resource.x] === null), true);
});

test('universal boundary assists closure without adding wildcard cells to score area', () => {
    const universalSettings = {
        ...settings,
        boardSize: 7,
        gameplayVariant: 'legacy',
        activeCombatColors: ['red', 'blue'],
        specialTiles: [
            {
                id: 'starter_universal_line_v',
                color: 'universal',
                pattern: 'universal_line_v',
                matrix: ['.*.', '.*.', '.*.'],
                special: 'universal_boundary',
                gameplayVariants: ['legacy'],
            },
        ],
        hearts: {
            zoneDamagePerHeart: 24,
            minimumZoneHearts: 1,
        },
        damageFormula: {
            type: 'areaMultiplier',
            areaMultiplier: 2,
        },
    };
    const universalTiles = createTilesFromManifest(manifest, universalSettings);
    const startTile = (id) => universalTiles.find((tileDef) => tileDef.id === id);
    const board = Array.from({ length: 7 }, () => Array(7).fill(null));
    board[2][3] = startTile('tile_red_corner_rd');
    board[2][4] = startTile('tile_red_corner_dl');
    board[3][3] = startTile('starter_universal_line_v');
    board[3][4] = startTile('tile_red_line_v');
    board[4][3] = startTile('tile_red_corner_ur');
    board[4][4] = startTile('tile_red_corner_lu');

    const universalScore = scoreTileBoard(board, universalSettings);
    const redOnlyBoard = board.map((row) => [...row]);
    redOnlyBoard[3][3] = startTile('tile_red_line_v');
    const redOnlyScore = scoreTileBoard(redOnlyBoard, universalSettings);

    assert.equal(universalScore.zones.length, 1);
    assert.equal(universalScore.zones[0].color, 'red');
    assert.equal(universalScore.zones[0].wildcardBoundarySize, 3);
    assert.equal(redOnlyScore.zones[0].area - universalScore.zones[0].area, 3);
});

test('staged joker line keeps universal boundary placement without direct red-blue merging', () => {
    const jokerSettings = {
        ...settings,
        boardSize: 7,
        gameplayVariant: 'legacy',
        activeCombatColors: ['red', 'blue'],
        specialTiles: stagedCatalogSpecialTiles,
    };
    const jokerTiles = createTilesFromManifest(manifest, jokerSettings);
    const jokerTile = (id) => jokerTiles.find((tileDef) => tileDef.id === id);
    const board = Array.from({ length: 7 }, () => Array(7).fill(null));

    board[3][3] = jokerTile('joker_line_v');

    assert.equal(canPlaceTile(board, jokerTile('tile_red_line_v'), 3, 2, jokerSettings), true);
    assert.equal(canPlaceTile(board, jokerTile('tile_blue_line_v'), 3, 4, jokerSettings), true);

    const redBoard = Array.from({ length: 7 }, () => Array(7).fill(null));
    redBoard[3][3] = jokerTile('tile_red_line_v');
    assert.equal(canPlaceTile(redBoard, jokerTile('tile_blue_line_v'), 3, 2, jokerSettings), false);
});

test('double-line macro card places two ordinary segments and discards one bought card id', () => {
    const macroSettings = {
        ...settings,
        boardSize: 7,
        gameplayVariant: 'legacy',
        specialTiles: stagedCatalogSpecialTiles,
    };
    const macroTiles = createTilesFromManifest(manifest, macroSettings);
    const macroTile = (id) => macroTiles.find((tileDef) => tileDef.id === id);
    const state = {
        round: 1,
        playerHp: 12,
        enemyHp: 3,
        board: Array.from({ length: 7 }, () => Array(7).fill(null)),
        boardResources: [
            { id: 'gold_left', type: 'gold', x: 1, y: 2, amount: 1, consumed: false },
            { id: 'gold_right', type: 'gold', x: 2, y: 2, amount: 1, consumed: false },
        ],
        hand: [macroTile('double_red_line_h')],
        heldTile: null,
        selectedHandIndex: 0,
        queueReserve: [],
        playedThisRound: [],
        queuePlayedThisRound: 0,
        phase: 'placing',
        lastResult: null,
        battleLog: [],
        resourceEvents: [],
        outcome: null,
    };
    const run = {
        gold: 0,
        discardPile: [],
    };

    assert.equal(canPlaceTile(state.board, macroTile('double_red_line_h'), 1, 2, macroSettings), true);
    assert.equal(placeTile(state, macroSettings, 1, 2, run), true);
    assert.equal(state.board[2][1].id, 'tile_red_line_h');
    assert.equal(state.board[2][2].id, 'tile_red_line_h');
    assert.deepEqual(state.playedThisRound, ['double_red_line_h']);
    assert.equal(state.hand[0], null);
    assert.equal(run.gold, 2);
    assert.equal(state.boardResources.every((resource) => resource.consumed), true);

    discardRoundHand(run, state);
    assert.deepEqual(run.discardPile, ['double_red_line_h']);
});

test('double-line macro card obeys outside edge legality and can score as ordinary segments', () => {
    const macroSettings = {
        ...settings,
        boardSize: 7,
        gameplayVariant: 'legacy',
        specialTiles: stagedCatalogSpecialTiles,
        damageFormula: {
            type: 'areaMultiplier',
            areaMultiplier: 2,
        },
        hearts: {
            zoneDamagePerHeart: 24,
            minimumZoneHearts: 1,
        },
    };
    const macroTiles = createTilesFromManifest(manifest, macroSettings);
    const macroTile = (id) => macroTiles.find((tileDef) => tileDef.id === id);
    const blockedBoard = Array.from({ length: 7 }, () => Array(7).fill(null));

    blockedBoard[2][3] = macroTile('tile_blue_line_v');

    assert.equal(canPlaceTile(blockedBoard, macroTile('double_red_line_h'), 1, 2, macroSettings), false);

    const scoringBoard = Array.from({ length: 7 }, () => Array(7).fill(null));
    scoringBoard[2][1] = macroTile('tile_red_corner_rd');
    scoringBoard[2][2] = macroTile('tile_red_line_h');
    scoringBoard[2][3] = macroTile('tile_red_line_h');
    scoringBoard[2][4] = macroTile('tile_red_corner_dl');
    scoringBoard[3][1] = macroTile('tile_red_corner_ur');
    scoringBoard[3][2] = macroTile('tile_red_line_h');
    scoringBoard[3][3] = macroTile('tile_red_line_h');
    scoringBoard[3][4] = macroTile('tile_red_corner_lu');

    const score = scoreTileBoard(scoringBoard, macroSettings);

    assert.equal(score.zones.length, 1);
    assert.equal(score.zones[0].color, 'red');
    assert.equal(score.zones[0].damage >= 1, true);
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
        playerHp: 12,
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
        playerHp: 10,
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

test('field resources are picked up by placing on their cells exactly once', () => {
    const resourceSettings = {
        ...settings,
        gameplayVariant: 'legacy',
        hearts: {
            maxPlayerHp: 12,
        },
    };
    const run = {
        gold: 2,
        playerHp: 10,
        maxPlayerHp: 12,
        colorMultipliers: { red: 1, blue: 1, green: 1 },
    };
    const state = {
        round: 1,
        playerHp: 10,
        enemyHp: 3,
        board: emptyBoard(),
        boardResources: [
            { id: 'gold_a', type: 'gold', x: 1, y: 1, amount: 2, consumed: false },
            { id: 'heart_a', type: 'heart', x: 5, y: 5, amount: 4, consumed: false },
        ],
        hand: [tile('tile_red_line_h'), tile('tile_blue_line_h')],
        heldTile: null,
        selectedHandIndex: 0,
        queueReserve: [],
        playedThisRound: [],
        queuePlayedThisRound: 0,
        phase: 'placing',
        lastResult: null,
        battleLog: [],
        resourceEvents: [],
        outcome: null,
    };

    assert.equal(placeTile(state, resourceSettings, 1, 1, run), true);
    assert.equal(run.gold, 4);
    assert.equal(state.boardResources[0].consumed, true);
    assert.equal(state.boardResources[0].consumedBy, 'placement');
    assert.equal(state.lastPlacementResourceResult.amount, 2);
    assert.equal(state.lastPlacementResourceResult.goldBefore, 2);
    assert.equal(state.lastPlacementResourceResult.goldAfter, 4);
    assert.equal(state.resourceEvents[0].source, 'placement');
    assert.equal(state.battleLog.at(-1), 'Field gold picked up: +2 gold.');

    assert.equal(placeTile(state, resourceSettings, 5, 5, run), true);
    assert.equal(run.gold, 4);
    assert.equal(state.playerHp, 12);
    assert.equal(run.playerHp, 12);
    assert.equal(state.boardResources[1].consumed, true);
    assert.equal(state.boardResources[1].consumedBy, 'placement');
    assert.equal(state.lastPlacementResourceResult.heartAmount, 4);
    assert.equal(state.lastPlacementResourceResult.heartHeal, 2);
    assert.equal(state.resourceEvents.at(-1).source, 'placement');
    assert.equal(state.battleLog.at(-1), 'Heart picked up: +2 hearts.');
});

test('closed fields consume resource gold and heal hearts up to max', () => {
    const resourceSettings = {
        ...settings,
        gameplayVariant: 'legacy',
        roundBoardCleanup: 'clearScoredTiles',
        damageFormula: {
            type: 'areaMultiplier',
            areaMultiplier: 2,
        },
        hearts: {
            maxPlayerHp: 12,
            zoneDamagePerHeart: 24,
            minimumZoneHearts: 1,
        },
        gold: {
            closureGold: 1,
            strikeGoldPerCount: 1,
        },
    };
    const run = {
        gold: 2,
        maxPlayerHp: 12,
        colorMultipliers: { red: 1, blue: 1, green: 1 },
    };
    const state = {
        round: 1,
        playerHp: 10,
        enemyHp: 3,
        board: emptyBoard(),
        boardResources: [
            { id: 'gold_inside', type: 'gold', x: 2, y: 2, amount: 2, consumed: false },
            { id: 'heart_inside', type: 'heart', x: 2, y: 2, amount: 4, consumed: false },
        ],
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
        resourceEvents: [],
        outcome: null,
    };

    state.board[1][1] = tile('tile_red_corner_rd');
    state.board[1][2] = tile('tile_red_tee_d');
    state.board[1][3] = tile('tile_red_corner_dl');
    state.board[2][1] = tile('tile_red_tee_r');
    state.board[2][3] = tile('tile_red_tee_l');
    state.board[3][1] = tile('tile_red_corner_ur');
    state.board[3][2] = tile('tile_red_tee_u');

    assert.equal(placeTile(state, resourceSettings, 3, 3, run), true);
    const result = resolveImmediatePlacement(state, {
        enemyHp: 3,
        attacks: [{ red: 0, blue: 0 }],
    }, resourceSettings, run);

    assert.equal(result.closedZones, 1);
    assert.equal(result.closureGold, 1);
    assert.equal(result.fieldGold, 2);
    assert.equal(result.heartHeal, 2);
    assert.equal(result.goldEarned, 3);
    assert.equal(result.goldBefore, 2);
    assert.equal(result.goldAfter, 5);
    assert.equal(result.playerHeartsBefore, 10);
    assert.equal(result.playerHeartsAfter, 12);
    assert.equal(state.playerHp, 12);
    assert.equal(run.playerHp, 12);
    assert.equal(run.gold, 5);
    assert.equal(state.boardResources.every((resource) => resource.consumed), true);
    assert.deepEqual(
        state.boardResources.map((resource) => resource.consumedBy),
        ['closure', 'closure'],
    );
    assert.equal(state.resourceEvents.at(-1).source, 'closure');
    assert.equal(state.resourceEvents.at(-1).goldAmount, 2);
    assert.equal(state.resourceEvents.at(-1).heartHeal, 2);
    assert.equal(state.battleLog.some((entry) => entry === 'Field gold sealed: +2 gold.'), true);
    assert.equal(state.battleLog.some((entry) => entry === 'Heart sealed: +2 hearts.'), true);
    assert.ok(
        state.battleLog.findIndex((entry) => entry.startsWith('Closed red zone')) <
        state.battleLog.findIndex((entry) => entry === 'Field gold sealed: +2 gold.'),
    );
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
