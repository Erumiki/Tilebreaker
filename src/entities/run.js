export const BattleOutcome = {
    Victory: 'victory',
    Defeat: 'defeat',
};

const COMBAT_COLORS = ['red', 'blue', 'green'];
const LOOP_PATTERNS = ['corner_rd', 'corner_dl', 'corner_ur', 'corner_lu'];

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

function pickAddTile(run, tiles) {
    const color = COMBAT_COLORS[run.completedBattles % COMBAT_COLORS.length];
    const pattern = LOOP_PATTERNS[Math.floor(run.completedBattles / COMBAT_COLORS.length) % LOOP_PATTERNS.length];

    return tiles.find((tileDef) => tileDef.color === color && tileDef.pattern === pattern)
        ?? tiles.find((tileDef) => tileDef.color === color)
        ?? tiles[0];
}

function pickRemoveTile(run, tiles) {
    const allIds = [...run.drawPile, ...run.discardPile];
    const grayId = allIds.find((tileId) => getTileById(tiles, tileId)?.color === 'gray');

    if (grayId) {
        return getTileById(tiles, grayId);
    }

    const weakestColor = COMBAT_COLORS.reduce((weakest, color) => (
        (run.colorMultipliers[color] ?? 1) < (run.colorMultipliers[weakest] ?? 1)
            ? color
            : weakest
    ), COMBAT_COLORS[0]);

    const removableId = allIds.find((tileId) => {
        const tileDef = getTileById(tiles, tileId);
        return tileDef?.color !== weakestColor;
    }) ?? allIds[0];

    return getTileById(tiles, removableId);
}

function pickBoostColor(run) {
    return COMBAT_COLORS[(run.completedBattles - 1 + COMBAT_COLORS.length) % COMBAT_COLORS.length];
}

export function createRunState({
    totalBattles,
    playerHp,
    startingDeck = [],
    seed = 20260508,
}) {
    const run = {
        totalBattles,
        currentBattle: 1,
        completedBattles: 0,
        playerHp,
        upgrades: [],
        deck: [...startingDeck],
        drawPile: [],
        discardPile: [],
        rngState: seed >>> 0,
        reshuffles: 0,
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

export function resolveBattle(run, outcome) {
    if (outcome === BattleOutcome.Victory) {
        run.completedBattles += 1;
    }

    return {
        outcome,
        battleNumber: run.currentBattle,
        completedBattles: run.completedBattles,
        totalBattles: run.totalBattles,
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

export function getRewardChoices(run, tiles) {
    const addTile = pickAddTile(run, tiles);
    const removeTile = pickRemoveTile(run, tiles);
    const boostColor = pickBoostColor(run);

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
