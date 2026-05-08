export const BattleOutcome = {
    Victory: 'victory',
    Defeat: 'defeat',
};

export function createRunState({ totalBattles }) {
    return {
        totalBattles,
        currentBattle: 1,
        completedBattles: 0,
        upgrades: [],
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

export function applyUpgrade(run, upgrade) {
    run.upgrades.push(upgrade);
    run.currentBattle = run.completedBattles + 1;
}
