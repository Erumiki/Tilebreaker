import fs from 'node:fs';
import { getCatalogSpecialTiles } from '../src/entities/cards.js';
import {
    BattleOutcome,
    buyShopOffer,
    createRunState,
    createShopState,
    finishShop,
    resolveBattle,
} from '../src/entities/run.js';
import {
    canPlaceTile,
    createBoardWithTilePlacement,
    createStartingDeckIds,
    createTileBattleState,
    createTilesFromManifest,
    discardRoundHand,
    getHandSubmitCostPreview,
    getTilePlacementCells,
    placeTile,
    resolveHandSubmitDefeatIfNeeded,
    resolveImmediatePlacement,
    scoreTileBoard,
    submitTileHand,
} from '../src/entities/tileBattle.js';

const GAME_CONFIG = JSON.parse(fs.readFileSync('configs/game.json', 'utf8'));
const LEVEL_CONFIG = JSON.parse(fs.readFileSync('configs/levels.json', 'utf8'));
const CARD_CATALOG = JSON.parse(fs.readFileSync('configs/cards.json', 'utf8'));
const TILE_MANIFEST = JSON.parse(fs.readFileSync('assets/tiles_v2/tile_manifest.json', 'utf8'));

const BASE_SETTINGS = GAME_CONFIG.tileBattle ?? {};
const SETTINGS = {
    ...BASE_SETTINGS,
    specialTiles: [
        ...(BASE_SETTINGS.specialTiles ?? []),
        ...getCatalogSpecialTiles(CARD_CATALOG),
    ],
};
const TILES = createTilesFromManifest(TILE_MANIFEST, SETTINGS);
const STARTING_DECK = createStartingDeckIds(TILES, SETTINGS);
const BATTLES = LEVEL_CONFIG.battles ?? [];
const BOARD_SIZE = SETTINGS.boardSize ?? 7;
const MINIMAL_AREA = SETTINGS.damageFormula?.largeZoneBonus?.minArea ?? 12;
const MAX_ACTIONS_PER_BATTLE = Number(process.env.CARD_BALANCE_MAX_ACTIONS ?? 180);
const RUNS = Number(process.env.CARD_BALANCE_RUNS ?? 40);
const BASE_SEED = Number(process.env.CARD_BALANCE_SEED ?? 20260508);

const DIRECTIONS = [
    { dx: 0, dy: -1 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
];

const SCENARIOS = [
    {
        id: 'no_shop',
        label: 'No shop baseline',
        type: 'none',
    },
    {
        id: 'line',
        label: 'Forced common line',
        type: 'forced_family',
        families: ['line'],
        maxBuysPerShop: 1,
    },
    {
        id: 'tee',
        label: 'Forced common tee',
        type: 'forced_family',
        families: ['tee'],
        maxBuysPerShop: 1,
    },
    {
        id: 'corner',
        label: 'Forced common corner',
        type: 'forced_family',
        families: ['corner'],
        maxBuysPerShop: 1,
    },
    {
        id: 'common_pool',
        label: 'Forced common pool',
        type: 'forced_family',
        families: ['line', 'tee', 'corner'],
        maxBuysPerShop: 2,
    },
    {
        id: 'plus',
        label: 'Forced plus/cross',
        type: 'forced_family',
        families: ['plus'],
        maxBuysPerShop: 1,
    },
    {
        id: 'joker_line',
        label: 'Forced joker_line_v',
        type: 'forced_family',
        families: ['joker_line'],
        maxBuysPerShop: 1,
    },
    {
        id: 'double_line',
        label: 'Forced double_red_line_h',
        type: 'forced_family',
        families: ['double_line'],
        maxBuysPerShop: 1,
    },
    {
        id: 'live_shop',
        label: 'Live generated shop',
        type: 'live_shop',
        maxBuysPerShop: 2,
    },
];

function formatFixed(value, digits = 1) {
    return Number.isFinite(value) ? value.toFixed(digits) : '0.0';
}

function formatPercent(numerator, denominator) {
    if (denominator <= 0) {
        return '0%';
    }

    return `${((numerator / denominator) * 100).toFixed(0)}%`;
}

function createEmptyBattleMetrics(battle) {
    return {
        battle,
        reached: 0,
        wins: 0,
        submits: 0,
        goldEarned: 0,
        closureZones: 0,
        minimalZones: 0,
        captureArea: 0,
        deadEndSubmits: 0,
        freshStarts: 0,
        playerHpRemaining: 0,
        placements: 0,
        purchasedPlacements: 0,
    };
}

function createScenarioMetrics(scenario) {
    return {
        scenario,
        battles: BATTLES.map(createEmptyBattleMetrics),
        runsWon: 0,
        totalRuns: 0,
        purchases: 0,
        goldSpent: 0,
        unaffordableBuys: 0,
        boughtByFamily: new Map(),
        usedByFamily: new Map(),
    };
}

function incrementMap(map, key, amount = 1) {
    map.set(key, (map.get(key) ?? 0) + amount);
}

function boardTileCount(board) {
    return board.reduce((sum, row) => (
        sum + row.filter(Boolean).length
    ), 0);
}

function isInsideBoard(x, y) {
    return x >= 0 && y >= 0 && x < BOARD_SIZE && y < BOARD_SIZE;
}

function tileHasNeighbor(board, tileDef, x, y) {
    return getTilePlacementCells(tileDef, x, y).some((cell) => (
        DIRECTIONS.some((direction) => {
            const nextX = cell.x + direction.dx;
            const nextY = cell.y + direction.dy;

            return isInsideBoard(nextX, nextY) && Boolean(board[nextY][nextX]);
        })
    ));
}

function matchingNeighborCount(board, tileDef, x, y) {
    const occupied = new Set(
        getTilePlacementCells(tileDef, x, y).map((cell) => `${cell.x},${cell.y}`),
    );
    let neighbors = 0;

    for (const cell of getTilePlacementCells(tileDef, x, y)) {
        for (const direction of DIRECTIONS) {
            const nextX = cell.x + direction.dx;
            const nextY = cell.y + direction.dy;

            if (!isInsideBoard(nextX, nextY) || occupied.has(`${nextX},${nextY}`)) {
                continue;
            }

            if (board[nextY][nextX]) {
                neighbors += 1;
            }
        }
    }

    return neighbors;
}

function resourceAmountAtCells(state, cells, type) {
    const keys = new Set(cells.map((cell) => `${cell.x},${cell.y}`));

    return (state.boardResources ?? [])
        .filter((resource) => (
            !resource.consumed
            && resource.type === type
            && keys.has(`${resource.x},${resource.y}`)
        ))
        .reduce((sum, resource) => sum + (resource.amount ?? 0), 0);
}

function getValidPlacementCandidates(state, run) {
    const adjacent = [];
    const detached = [];

    for (let handIndex = 0; handIndex < state.hand.length; handIndex += 1) {
        const tileDef = state.hand[handIndex];

        if (!tileDef) {
            continue;
        }

        for (let y = 0; y < BOARD_SIZE; y += 1) {
            for (let x = 0; x < BOARD_SIZE; x += 1) {
                if (!canPlaceTile(state.board, tileDef, x, y, SETTINGS)) {
                    continue;
                }

                const board = createBoardWithTilePlacement(state.board, tileDef, x, y, SETTINGS);
                const score = scoreTileBoard(board, SETTINGS, run, {
                    placedColor: tileDef.color,
                });
                const cells = getTilePlacementCells(tileDef, x, y);
                const hasNeighbor = tileHasNeighbor(state.board, tileDef, x, y);
                const neighborCount = matchingNeighborCount(state.board, tileDef, x, y);
                const zoneArea = score.zones.reduce((sum, zone) => sum + zone.area, 0);
                const fieldGold = resourceAmountAtCells(state, cells, 'gold');
                const value = score.totalDamage * 1000
                    + score.zones.length * 120
                    + zoneArea * 8
                    + fieldGold * 40
                    + neighborCount * 12
                    + (hasNeighbor ? 20 : -30)
                    - Math.abs(x - Math.floor(BOARD_SIZE / 2))
                    - Math.abs(y - Math.floor(BOARD_SIZE / 2));
                const candidate = {
                    handIndex,
                    tileDef,
                    x,
                    y,
                    score,
                    hasNeighbor,
                    value,
                };

                if (hasNeighbor || boardTileCount(state.board) === 0) {
                    adjacent.push(candidate);
                } else {
                    detached.push(candidate);
                }
            }
        }
    }

    const candidates = adjacent.length > 0 ? adjacent : detached;
    candidates.sort((left, right) => right.value - left.value);

    return candidates;
}

function tileMatchesPurchasedFamily(tileDef, purchasedFamilies) {
    if (!tileDef || purchasedFamilies.size === 0) {
        return null;
    }

    if (tileDef.id === 'joker_line_v' && purchasedFamilies.has('joker_line')) {
        return 'joker_line';
    }

    if (tileDef.id === 'double_red_line_h' && purchasedFamilies.has('double_line')) {
        return 'double_line';
    }

    if (purchasedFamilies.has(tileDef.pattern)) {
        return tileDef.pattern;
    }

    if (tileDef.pattern?.startsWith('line_') && purchasedFamilies.has('line')) {
        return 'line';
    }

    if (tileDef.pattern?.startsWith('tee_') && purchasedFamilies.has('tee')) {
        return 'tee';
    }

    if (tileDef.pattern?.startsWith('corner_') && purchasedFamilies.has('corner')) {
        return 'corner';
    }

    if (tileDef.pattern === 'plus' && purchasedFamilies.has('plus')) {
        return 'plus';
    }

    return null;
}

function collectClosureMetrics(target, result) {
    if (!result?.score?.zones?.length) {
        return;
    }

    for (const zone of result.score.zones) {
        target.closureZones += 1;
        target.captureArea += zone.area;

        if (zone.area <= MINIMAL_AREA) {
            target.minimalZones += 1;
        }
    }
}

function simulateBattle(run, battle, purchasedFamilies) {
    const state = createTileBattleState({
        battle,
        run,
        settings: SETTINGS,
        tiles: TILES,
    });
    const metrics = {
        win: false,
        submits: 0,
        closureZones: 0,
        minimalZones: 0,
        captureArea: 0,
        deadEndSubmits: 0,
        freshStarts: 0,
        playerHpRemaining: 0,
        placements: 0,
        purchasedPlacements: 0,
        usedByFamily: new Map(),
    };

    for (let action = 0; action < MAX_ACTIONS_PER_BATTLE && !state.outcome; action += 1) {
        const candidates = getValidPlacementCandidates(state, run);

        if (candidates.length === 0) {
            const beforeBoardTiles = boardTileCount(state.board);
            const hasUnplayedCards = state.hand.some(Boolean);
            const preview = getHandSubmitCostPreview(state, SETTINGS);
            const isDeadEndSubmit = hasUnplayedCards && beforeBoardTiles > 1;

            if (isDeadEndSubmit) {
                metrics.deadEndSubmits += 1;
            }

            const submit = submitTileHand(state, {
                run,
                battle,
                settings: SETTINGS,
                tiles: TILES,
            });

            if (submit.submitted) {
                metrics.submits += 1;
            } else if (!preview.canPay) {
                break;
            }

            if (isDeadEndSubmit && boardTileCount(state.board) <= 1) {
                metrics.freshStarts += 1;
            }

            continue;
        }

        const chosen = candidates[0];
        state.selectedHandIndex = chosen.handIndex;
        const placed = placeTile(state, SETTINGS, chosen.x, chosen.y, run);

        if (!placed) {
            break;
        }

        metrics.placements += 1;

        const usedFamily = tileMatchesPurchasedFamily(chosen.tileDef, purchasedFamilies);
        if (usedFamily) {
            metrics.purchasedPlacements += 1;
            incrementMap(metrics.usedByFamily, usedFamily);
        }

        const result = resolveImmediatePlacement(state, battle, SETTINGS, run);
        collectClosureMetrics(metrics, result);
        resolveHandSubmitDefeatIfNeeded(state, SETTINGS);
    }

    metrics.win = state.outcome === 'victory';
    metrics.playerHpRemaining = state.playerHp;
    run.playerHp = state.playerHp;
    discardRoundHand(run, state);

    return metrics;
}

function offerFromCard(card, index = 0) {
    return {
        ...card,
        offerId: `${card.id}_forced_${index + 1}`,
        cardId: card.id,
        type: 'shop_card',
        tileId: card.tileId ?? card.specialTile?.id ?? null,
        bought: false,
        balanceStatus: 'unverified',
    };
}

function createForcedShop(run, card, index = 0) {
    const battleNumber = Math.max(1, (run.completedBattles ?? 0) + 1);

    return {
        id: `forced_shop_after_battle_${run.completedBattles}`,
        battleNumber,
        nextBattle: battleNumber,
        offerCount: 1,
        offers: [offerFromCard(card, index)],
        boughtCards: [],
        goldBefore: run.gold ?? 0,
        goldAfter: run.gold ?? 0,
        continued: false,
        balanceStatus: 'unverified',
    };
}

function enabledCardsForBattle(battleNumber) {
    const activeColors = new Set(CARD_CATALOG.shop?.activeColors ?? []);

    return CARD_CATALOG.cards.filter((card) => (
        card.enabled !== false
        && card.status !== 'disabled'
        && card.status !== 'staged'
        && (card.enabledFromBattle ?? 1) <= battleNumber
        && (!card.color || activeColors.has(card.color))
        && (card.offerWeight ?? 0) > 0
        && (card.maxPerShop ?? 0) > 0
    ));
}

function forcedFamilyCardsForScenario(run, scenario, seed) {
    const battleNumber = Math.max(1, (run.completedBattles ?? 0) + 1);
    const familyList = scenario.families ?? [];
    const families = new Set(familyList);
    const affordableCards = enabledCardsForBattle(battleNumber)
        .filter((card) => families.has(card.family))
        .filter((card) => card.cost <= (run.gold ?? 0))
        .sort((left, right) => (
            left.cost - right.cost
            || left.id.localeCompare(right.id)
        ));

    if (familyList.length <= 1) {
        const offset = affordableCards.length > 0
            ? (seed + battleNumber) % affordableCards.length
            : 0;

        return [
            ...affordableCards.slice(offset),
            ...affordableCards.slice(0, offset),
        ].slice(0, scenario.maxBuysPerShop ?? 1);
    }

    const familyOffset = (seed + battleNumber) % familyList.length;
    const rotatedFamilies = [
        ...familyList.slice(familyOffset),
        ...familyList.slice(0, familyOffset),
    ];
    const picks = [];

    for (const family of rotatedFamilies) {
        const card = affordableCards.find((entry) => entry.family === family);

        if (card) {
            picks.push(card);
        }

        if (picks.length >= (scenario.maxBuysPerShop ?? 1)) {
            break;
        }
    }

    return picks;
}

function buyForcedFamily(run, scenario, seed, metrics, purchasedFamilies) {
    const cards = forcedFamilyCardsForScenario(run, scenario, seed);
    const wantedFamilies = new Set(scenario.families ?? []);

    if (cards.length === 0 && enabledCardsForBattle((run.completedBattles ?? 0) + 1)
        .some((card) => wantedFamilies.has(card.family))) {
        metrics.unaffordableBuys += 1;
    }

    for (const [index, card] of cards.entries()) {
        const shop = createForcedShop(run, card, index);
        const result = buyShopOffer(run, shop, shop.offers[0].offerId);

        if (!result.bought) {
            metrics.unaffordableBuys += 1;
            continue;
        }

        metrics.purchases += 1;
        metrics.goldSpent += result.purchase.cost;
        purchasedFamilies.add(card.family);
        incrementMap(metrics.boughtByFamily, card.family);
    }
}

function liveShopCardValue(card) {
    const familyValue = {
        joker_line: 100,
        plus: 70,
        double_line: 65,
        tee: 52,
        line: 45,
        corner: 42,
    }[card.family] ?? 20;

    return familyValue - card.cost * 2;
}

function buyFromLiveShop(run, scenario, metrics, purchasedFamilies) {
    const shop = createShopState(run, CARD_CATALOG);
    const bought = [];

    while (bought.length < (scenario.maxBuysPerShop ?? 2)) {
        const affordable = shop.offers
            .filter((offer) => !offer.bought && offer.cost <= (run.gold ?? 0))
            .sort((left, right) => liveShopCardValue(right) - liveShopCardValue(left));

        if (affordable.length === 0) {
            break;
        }

        const result = buyShopOffer(run, shop, affordable[0].offerId);

        if (!result.bought) {
            break;
        }

        bought.push(result.purchase);
        metrics.purchases += 1;
        metrics.goldSpent += result.purchase.cost;
        purchasedFamilies.add(result.purchase.family);
        incrementMap(metrics.boughtByFamily, result.purchase.family);
    }

    finishShop(run, shop);
}

function applyShopPolicy(run, scenario, seed, metrics, purchasedFamilies) {
    if (scenario.type === 'none') {
        return;
    }

    if (scenario.type === 'live_shop') {
        buyFromLiveShop(run, scenario, metrics, purchasedFamilies);
        return;
    }

    buyForcedFamily(run, scenario, seed, metrics, purchasedFamilies);
}

function simulateScenarioRun(scenario, seed, metrics) {
    const run = createRunState({
        totalBattles: BATTLES.length,
        playerHp: SETTINGS.startingPlayerHp ?? 18,
        startingDeck: STARTING_DECK,
        seed,
        settings: SETTINGS,
    });
    const purchasedFamilies = new Set();
    let runWon = true;

    for (let battleIndex = 0; battleIndex < BATTLES.length; battleIndex += 1) {
        const battle = BATTLES[battleIndex];
        const battleTotals = metrics.battles[battleIndex];
        const goldBeforeBattle = run.gold ?? 0;

        battleTotals.reached += 1;

        const battleMetrics = simulateBattle(run, battle, purchasedFamilies);
        const outcome = battleMetrics.win ? BattleOutcome.Victory : BattleOutcome.Defeat;
        const result = resolveBattle(run, outcome, battle);
        const goldAfterBattle = run.gold ?? goldBeforeBattle;

        battleTotals.wins += battleMetrics.win ? 1 : 0;
        battleTotals.submits += battleMetrics.submits;
        battleTotals.goldEarned += Math.max(0, goldAfterBattle - goldBeforeBattle);
        battleTotals.closureZones += battleMetrics.closureZones;
        battleTotals.minimalZones += battleMetrics.minimalZones;
        battleTotals.captureArea += battleMetrics.captureArea;
        battleTotals.deadEndSubmits += battleMetrics.deadEndSubmits;
        battleTotals.freshStarts += battleMetrics.freshStarts;
        battleTotals.playerHpRemaining += battleMetrics.playerHpRemaining;
        battleTotals.placements += battleMetrics.placements;
        battleTotals.purchasedPlacements += battleMetrics.purchasedPlacements;

        for (const [family, count] of battleMetrics.usedByFamily) {
            incrementMap(metrics.usedByFamily, family, count);
        }

        if (!battleMetrics.win) {
            runWon = false;
            break;
        }

        if (result.isRunVictory) {
            break;
        }

        applyShopPolicy(run, scenario, seed, metrics, purchasedFamilies);
        run.currentBattle = run.completedBattles + 1;
    }

    metrics.runsWon += runWon ? 1 : 0;
    metrics.totalRuns += 1;
}

function mapSummary(map) {
    if (map.size === 0) {
        return 'none';
    }

    return [...map.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([family, count]) => `${family}:${count}`)
        .join(', ');
}

function printScenarioReport(metrics) {
    const { scenario } = metrics;

    console.log(`\n=== ${scenario.label} (${scenario.id}) ===`);
    console.log(`  full-run wins: ${metrics.runsWon}/${metrics.totalRuns} (${formatPercent(metrics.runsWon, metrics.totalRuns)})`);
    console.log(`  purchases: ${metrics.purchases}, spent ${metrics.goldSpent} gold, unaffordable windows ${metrics.unaffordableBuys}`);
    console.log(`  bought by family: ${mapSummary(metrics.boughtByFamily)}`);
    console.log(`  placed after purchase by family: ${mapSummary(metrics.usedByFamily)}`);

    for (const battle of metrics.battles) {
        if (battle.reached === 0) {
            continue;
        }

        const avgSubmits = battle.submits / battle.reached;
        const avgGold = battle.goldEarned / battle.reached;
        const avgHp = battle.playerHpRemaining / battle.reached;
        const avgClosures = battle.closureZones / battle.reached;
        const avgArea = battle.captureArea / Math.max(1, battle.closureZones);
        const deadEndRate = formatPercent(battle.deadEndSubmits, Math.max(1, battle.submits));
        const useRate = formatPercent(battle.purchasedPlacements, Math.max(1, battle.placements));

        console.log(
            `  ${battle.battle.id}: reached ${battle.reached}, wins ${battle.wins}/${battle.reached} (${formatPercent(battle.wins, battle.reached)}), `
            + `submits avg ${formatFixed(avgSubmits)}, gold avg ${formatFixed(avgGold)}, closures avg ${formatFixed(avgClosures)}, `
            + `minimal ${battle.minimalZones}/${battle.closureZones} (${formatPercent(battle.minimalZones, battle.closureZones)}), `
            + `avg area ${formatFixed(avgArea)}, dead-end submits ${battle.deadEndSubmits}/${battle.submits} (${deadEndRate}), `
            + `fresh starts ${battle.freshStarts}, bought-use placements ${useRate}, hp avg ${formatFixed(avgHp)}`,
        );
    }
}

function createProbeMetrics(probe) {
    return {
        scenario: {
            id: `probe_${probe.family}`,
            label: `${probe.label} forced-draw probe`,
        },
        battles: [createEmptyBattleMetrics(BATTLES[probe.battleIndex])],
        runsWon: 0,
        totalRuns: 0,
        purchases: 0,
        goldSpent: 0,
        unaffordableBuys: 0,
        boughtByFamily: new Map(),
        usedByFamily: new Map(),
    };
}

function pickProbeCard(family, battleNumber, runIndex) {
    const cards = enabledCardsForBattle(battleNumber)
        .filter((card) => card.family === family)
        .sort((left, right) => left.id.localeCompare(right.id));

    if (cards.length === 0) {
        return null;
    }

    return cards[runIndex % cards.length];
}

function simulateForcedDrawProbe(probe, runIndex, seed, metrics) {
    const battle = BATTLES[probe.battleIndex];
    const battleNumber = probe.battleIndex + 1;
    const card = pickProbeCard(probe.family, battleNumber, runIndex);

    if (!battle || !card) {
        return;
    }

    const run = createRunState({
        totalBattles: BATTLES.length,
        playerHp: SETTINGS.startingPlayerHp ?? 18,
        startingDeck: STARTING_DECK,
        seed,
        settings: SETTINGS,
    });
    const tileId = card.tileId ?? card.specialTile?.id ?? null;

    run.currentBattle = battleNumber;
    run.completedBattles = probe.battleIndex;
    run.deck.push(tileId);
    run.drawPile.push(tileId);

    const purchasedFamilies = new Set([card.family]);
    const battleTotals = metrics.battles[0];
    const goldBeforeBattle = run.gold ?? 0;

    metrics.purchases += 1;
    metrics.goldSpent += card.cost;
    incrementMap(metrics.boughtByFamily, card.family);
    battleTotals.reached += 1;

    const battleMetrics = simulateBattle(run, battle, purchasedFamilies);
    const outcome = battleMetrics.win ? BattleOutcome.Victory : BattleOutcome.Defeat;
    resolveBattle(run, outcome, battle);

    battleTotals.wins += battleMetrics.win ? 1 : 0;
    battleTotals.submits += battleMetrics.submits;
    battleTotals.goldEarned += Math.max(0, (run.gold ?? goldBeforeBattle) - goldBeforeBattle);
    battleTotals.closureZones += battleMetrics.closureZones;
    battleTotals.minimalZones += battleMetrics.minimalZones;
    battleTotals.captureArea += battleMetrics.captureArea;
    battleTotals.deadEndSubmits += battleMetrics.deadEndSubmits;
    battleTotals.freshStarts += battleMetrics.freshStarts;
    battleTotals.playerHpRemaining += battleMetrics.playerHpRemaining;
    battleTotals.placements += battleMetrics.placements;
    battleTotals.purchasedPlacements += battleMetrics.purchasedPlacements;

    for (const [family, count] of battleMetrics.usedByFamily) {
        incrementMap(metrics.usedByFamily, family, count);
    }

    metrics.runsWon += battleMetrics.win ? 1 : 0;
    metrics.totalRuns += 1;
}

function printProbeReports() {
    const probes = [
        { family: 'line', label: 'Common line', battleIndex: 1 },
        { family: 'tee', label: 'Common tee', battleIndex: 1 },
        { family: 'corner', label: 'Common corner', battleIndex: 1 },
        { family: 'plus', label: 'Plus/cross', battleIndex: 1 },
        { family: 'joker_line', label: 'Joker line', battleIndex: 1 },
        { family: 'double_line', label: 'Double line', battleIndex: 2 },
    ];

    console.log('\n=== Forced top-deck probes ===');
    console.log('  Probe note: these runs inject one bought card on top of the draw pile for the target battle; use them for card risk/readiness, not shop economy.');

    for (const probe of probes) {
        const metrics = createProbeMetrics(probe);

        for (let index = 0; index < RUNS; index += 1) {
            simulateForcedDrawProbe(probe, index, BASE_SEED + index * 9973 + 555555, metrics);
        }

        printScenarioReport(metrics);
    }
}

function selectedScenarios() {
    const only = process.env.CARD_BALANCE_SCENARIOS
        ?.split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);

    if (!only?.length) {
        return SCENARIOS;
    }

    const wanted = new Set(only);
    return SCENARIOS.filter((scenario) => wanted.has(scenario.id));
}

function run() {
    console.log('Tilebreaker card balance simulation');
    console.log(`Seed base: ${BASE_SEED}, runs: ${RUNS}`);
    console.log(`Board: ${BOARD_SIZE}x${BOARD_SIZE}, hand: ${SETTINGS.handSize}, starting deck: ${STARTING_DECK.length}`);
    console.log(`Metric note: ordinary bought-card use is family-level after first purchase; special-card use is exact by id.`);

    for (const scenario of selectedScenarios()) {
        const metrics = createScenarioMetrics(scenario);

        for (let index = 0; index < RUNS; index += 1) {
            simulateScenarioRun(scenario, BASE_SEED + index * 9973, metrics);
        }

        printScenarioReport(metrics);
    }

    if (process.env.CARD_BALANCE_SKIP_PROBES !== '1') {
        printProbeReports();
    }
}

run();
