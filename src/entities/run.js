import { getGameplayVariant } from './gameplayVariants.js';
import { getEnabledShopCards } from './cards.js';

export const BattleOutcome = {
    Victory: 'victory',
    Defeat: 'defeat',
};

const COMBAT_COLORS = ['red', 'blue', 'green'];
const LOOP_PATTERNS = ['corner_rd', 'corner_dl', 'corner_ur', 'corner_lu'];

function getActiveCombatColors(settings = {}) {
    if (['one_color_chain', 'connect_targets', 'road_mode'].includes(getGameplayVariant(settings).id)) {
        return ['red'];
    }

    const colors = Array.isArray(settings.activeCombatColors)
        ? settings.activeCombatColors.filter((color) => COMBAT_COLORS.includes(color))
        : [];

    return colors.length > 0 ? colors : COMBAT_COLORS;
}

function nextRandom(run) {
    run.rngState = (run.rngState * 1664525 + 1013904223) >>> 0;
    return run.rngState / 0x100000000;
}

function shuffleWithRun(run, items) {
    const copy = [...items];

    for (let index = copy.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(nextRandom(run) * (index + 1));
        [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }

    return copy;
}

function removeFirst(items, value) {
    const index = items.indexOf(value);

    if (index >= 0) {
        items.splice(index, 1);
        return true;
    }

    return false;
}

function countTiles(run) {
    return run.drawPile.length + run.discardPile.length;
}

function getTileById(tiles, tileId) {
    return tiles.find((tileDef) => tileDef.id === tileId);
}

function getColorLabel(color) {
    return {
        red: 'красный',
        blue: 'синий',
        green: 'зеленый',
        gray: 'серый',
    }[color] ?? 'цветной';
}

function getPatternLabel(pattern) {
    return {
        corner_rd: 'угол вниз-вправо',
        corner_dl: 'угол вниз-влево',
        corner_ur: 'угол вверх-вправо',
        corner_lu: 'угол вверх-влево',
        line_h: 'горизонталь',
        line_v: 'вертикаль',
        tee_u: 'развилка вверх',
        tee_r: 'развилка вправо',
        tee_d: 'развилка вниз',
        tee_l: 'развилка влево',
        plus: 'крест',
        blank: 'пустышка',
    }[pattern] ?? pattern;
}

function pickAddTile(run, tiles, activeColors) {
    const color = activeColors[run.completedBattles % activeColors.length];
    const pattern = LOOP_PATTERNS[Math.floor(run.completedBattles / activeColors.length) % LOOP_PATTERNS.length];

    return tiles.find((tileDef) => tileDef.color === color && tileDef.pattern === pattern)
        ?? tiles.find((tileDef) => tileDef.color === color)
        ?? tiles[0];
}

function pickRemoveTile(run, tiles, activeColors) {
    const allIds = [...run.drawPile, ...run.discardPile];
    const grayId = allIds.find((tileId) => getTileById(tiles, tileId)?.color === 'gray');

    if (grayId) {
        return getTileById(tiles, grayId);
    }

    const weakestColor = activeColors.reduce((weakest, color) => (
        (run.colorMultipliers[color] ?? 1) < (run.colorMultipliers[weakest] ?? 1)
            ? color
            : weakest
    ), activeColors[0]);

    const removableId = allIds.find((tileId) => {
        const tileDef = getTileById(tiles, tileId);
        return tileDef?.color !== weakestColor;
    }) ?? allIds[0];

    return getTileById(tiles, removableId);
}

function pickBoostColor(run, activeColors) {
    return activeColors[(run.completedBattles - 1 + activeColors.length) % activeColors.length];
}

function getShopBattleNumber(run) {
    return Math.max(1, (run.completedBattles ?? 0) + 1);
}

function getCardOfferWeight(card, catalog) {
    const rarityWeight = catalog.shop?.rarityWeights?.[card.rarity] ?? 1;
    return Math.max(0, (card.offerWeight ?? 0) * rarityWeight);
}

function pickWeightedCard(run, candidates, catalog) {
    const totalWeight = candidates.reduce((sum, card) => (
        sum + getCardOfferWeight(card, catalog)
    ), 0);

    if (totalWeight <= 0) {
        return null;
    }

    let roll = nextRandom(run) * totalWeight;

    for (const card of candidates) {
        roll -= getCardOfferWeight(card, catalog);

        if (roll <= 0) {
            return card;
        }
    }

    return candidates.at(-1) ?? null;
}

function getOfferTileId(offer) {
    return offer.tileId ?? offer.specialTile?.id ?? null;
}

function snapshotDeckStats(run) {
    return {
        deck: run.deck.length,
        drawPile: run.drawPile.length,
        discardPile: run.discardPile.length,
    };
}

function createOfferFromCard(card, index) {
    return {
        ...card,
        offerId: `${card.id}_${index + 1}`,
        cardId: card.id,
        type: 'shop_card',
        tileId: card.tileId ?? card.specialTile?.id ?? null,
        bought: false,
        balanceStatus: 'unverified',
    };
}

export function createRunState({
    totalBattles,
    playerHp,
    startingDeck = [],
    seed = 20260508,
    settings = {},
}) {
    const activeCombatColors = getActiveCombatColors(settings);
    const gameplayVariant = getGameplayVariant(settings);
    const run = {
        totalBattles,
        currentBattle: 1,
        completedBattles: 0,
        playerHp,
        maxPlayerHp: settings.hearts?.maxPlayerHp ?? settings.maxPlayerHp ?? playerHp,
        gold: 0,
        bountiesClaimed: [],
        purchasedCards: [],
        shopHistory: [],
        gameplayVariant: gameplayVariant.id,
        upgrades: [],
        deck: [...startingDeck],
        drawPile: [],
        discardPile: [],
        rngState: seed >>> 0,
        reshuffles: 0,
        activeCombatColors,
        colorMultipliers: Object.fromEntries(COMBAT_COLORS.map((color) => [color, 1])),
    };

    run.drawPile = shuffleWithRun(run, run.deck);

    return {
        ...run,
    };
}

export function getCurrentBattle(run, battles) {
    return battles[run.currentBattle - 1] ?? battles[battles.length - 1];
}

export function resolveBattle(run, outcome, battle = null) {
    let bountyGold = 0;
    const battleNumber = run.currentBattle;

    if (outcome === BattleOutcome.Victory) {
        const bountyKey = battle?.id ?? `battle_${battleNumber}`;
        bountyGold = Math.max(0, battle?.reward ?? 0);

        if (bountyGold > 0 && !run.bountiesClaimed?.includes(bountyKey)) {
            run.gold = (run.gold ?? 0) + bountyGold;
            run.bountiesClaimed ??= [];
            run.bountiesClaimed.push(bountyKey);
        } else {
            bountyGold = 0;
        }

        run.completedBattles += 1;
    }

    return {
        outcome,
        battleNumber,
        completedBattles: run.completedBattles,
        totalBattles: run.totalBattles,
        bountyGold,
        gold: run.gold ?? 0,
        isRunVictory: outcome === BattleOutcome.Victory
            && run.completedBattles >= run.totalBattles,
    };
}

export function drawTileIds(run, count) {
    const hand = [];

    while (hand.length < count) {
        if (run.drawPile.length === 0) {
            if (run.discardPile.length === 0) {
                break;
            }

            run.drawPile = shuffleWithRun(run, run.discardPile);
            run.discardPile = [];
            run.reshuffles += 1;
        }

        hand.push(run.drawPile.pop());
    }

    return hand;
}

export function discardTileIds(run, tileIds) {
    run.discardPile.push(...tileIds.filter(Boolean));
}

export function getRunDeckStats(run) {
    return {
        deck: run.deck.length,
        drawPile: run.drawPile.length,
        discardPile: run.discardPile.length,
        totalAvailable: countTiles(run),
        reshuffles: run.reshuffles,
    };
}

export function getRewardChoices(run, tiles, settings = {}) {
    const activeColors = run.activeCombatColors ?? getActiveCombatColors(settings);
    const addTile = pickAddTile(run, tiles, activeColors);
    const removeTile = pickRemoveTile(run, tiles, activeColors);
    const boostColor = pickBoostColor(run, activeColors);

    return [
        {
            id: `add_${addTile.id}`,
            type: 'add_tile',
            tileId: addTile.id,
            name: 'Добавить тайл',
            description: `${getColorLabel(addTile.color)} ${getPatternLabel(addTile.pattern)}\nуйдет в сброс`,
        },
        {
            id: `remove_${removeTile.id}`,
            type: 'remove_tile',
            tileId: removeTile.id,
            name: 'Удалить тайл',
            description: `${getColorLabel(removeTile.color)} ${getPatternLabel(removeTile.pattern)}\nпокинет колоду`,
        },
        {
            id: `boost_${boostColor}`,
            type: 'boost_color',
            color: boostColor,
            amount: 1,
            name: 'Усилить цвет',
            description: `${getColorLabel(boostColor)} множитель\n+1 к захвату`,
        },
    ];
}

export function applyUpgrade(run, upgrade) {
    if (upgrade.type === 'add_tile') {
        run.deck.push(upgrade.tileId);
        run.discardPile.push(upgrade.tileId);
    }

    if (upgrade.type === 'remove_tile') {
        const removedFromDraw = removeFirst(run.drawPile, upgrade.tileId);
        const removedFromDiscard = removedFromDraw ? false : removeFirst(run.discardPile, upgrade.tileId);

        if (removedFromDraw || removedFromDiscard) {
            removeFirst(run.deck, upgrade.tileId);
        }
    }

    if (upgrade.type === 'boost_color') {
        run.colorMultipliers[upgrade.color] = (run.colorMultipliers[upgrade.color] ?? 1)
            + (upgrade.amount ?? 1);
    }

    run.upgrades.push(upgrade);
    run.currentBattle = run.completedBattles + 1;
}

export function createShopState(run, catalog, options = {}) {
    const battleNumber = Math.max(1, Math.floor(options.battleNumber ?? getShopBattleNumber(run)));
    const offerCount = Math.max(1, Math.floor(catalog.shop?.offerCount ?? 5));
    const activeColors = run.activeCombatColors ?? catalog.shop?.activeColors ?? [];
    const allCandidates = getEnabledShopCards(catalog, {
        battleNumber,
        activeColors,
    }).filter((card) => getCardOfferWeight(card, catalog) > 0 && (card.maxPerShop ?? 0) > 0);
    const offerCounts = new Map();
    const offers = [];

    while (offers.length < offerCount) {
        const candidates = allCandidates.filter((card) => (
            (offerCounts.get(card.id) ?? 0) < (card.maxPerShop ?? 1)
        ));
        const card = pickWeightedCard(run, candidates, catalog);

        if (!card) {
            break;
        }

        offerCounts.set(card.id, (offerCounts.get(card.id) ?? 0) + 1);
        offers.push(createOfferFromCard(card, offers.length));
    }

    return {
        id: `shop_after_battle_${run.completedBattles}`,
        battleNumber,
        nextBattle: battleNumber,
        offerCount,
        offers,
        boughtCards: [],
        goldBefore: run.gold ?? 0,
        goldAfter: run.gold ?? 0,
        continued: false,
        balanceStatus: 'unverified',
    };
}

export function buyShopOffer(run, shopState, offerId) {
    const offer = shopState.offers.find((candidate) => candidate.offerId === offerId);

    if (!offer) {
        return {
            bought: false,
            reason: 'unknown_offer',
        };
    }

    if (offer.bought) {
        return {
            bought: false,
            reason: 'already_bought',
            offer,
        };
    }

    if ((run.gold ?? 0) < offer.cost) {
        return {
            bought: false,
            reason: 'not_enough_gold',
            offer,
            goldBefore: run.gold ?? 0,
            goldAfter: run.gold ?? 0,
        };
    }

    const tileId = getOfferTileId(offer);

    if (!tileId) {
        return {
            bought: false,
            reason: 'unsupported_card',
            offer,
        };
    }

    const goldBefore = run.gold ?? 0;
    const deckBefore = snapshotDeckStats(run);

    run.gold = goldBefore - offer.cost;
    run.deck.push(tileId);
    run.discardPile.push(tileId);
    run.purchasedCards ??= [];

    const purchase = {
        offerId: offer.offerId,
        cardId: offer.cardId,
        tileId,
        name: offer.name,
        cost: offer.cost,
        rarity: offer.rarity,
        family: offer.family,
        battleNumber: shopState.battleNumber,
        balanceStatus: 'unverified',
        goldBefore,
        goldAfter: run.gold,
        deckBefore,
        deckAfter: snapshotDeckStats(run),
    };

    offer.bought = true;
    shopState.boughtCards.push(purchase);
    shopState.goldAfter = run.gold;
    run.purchasedCards.push(purchase);

    return {
        bought: true,
        offer,
        purchase,
        goldBefore,
        goldAfter: run.gold,
    };
}

export function finishShop(run, shopState) {
    run.currentBattle = run.completedBattles + 1;
    shopState.continued = true;
    shopState.goldAfter = run.gold ?? 0;
    run.shopHistory ??= [];
    run.shopHistory.push({
        id: shopState.id,
        battleNumber: shopState.battleNumber,
        nextBattle: shopState.nextBattle,
        goldBefore: shopState.goldBefore,
        goldAfter: shopState.goldAfter,
        skipped: shopState.boughtCards.length === 0,
        offers: shopState.offers.map((offer) => ({
            offerId: offer.offerId,
            cardId: offer.cardId,
            cost: offer.cost,
            bought: offer.bought,
            balanceStatus: offer.balanceStatus,
        })),
        boughtCards: [...shopState.boughtCards],
    });

    return {
        nextBattle: run.currentBattle,
        boughtCards: shopState.boughtCards.length,
        gold: run.gold ?? 0,
    };
}
