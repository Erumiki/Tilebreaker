import * as PIXI from 'pixi.js';
import { loadConfig } from './core/config.js';
import { initInput } from './core/input.js';
import { initPixi } from './core/renderer.js';
import {
    applyUpgrade,
    BattleOutcome,
    createRunState,
    getCurrentBattle,
    resolveBattle,
} from './entities/run.js';
import { createUiRenderer } from './render/ui.js';
import { createBattleScene } from './scenes/battle.js';
import { createMainMenuScene } from './scenes/mainmenu.js';
import { createBattleResultScene } from './scenes/result.js';
import { createUpgradeScene } from './scenes/upgrades.js';

const canvas = document.getElementById('game');
const config = await loadConfig();
const app = await initPixi(PIXI, canvas, config);
const input = initInput(canvas);
const ui = createUiRenderer(PIXI, app.stage);
const battles = config.levels.battles;
const upgrades = config.levels.upgrades;
const totalBattles = Math.min(config.game.run.totalBattles, battles.length);
let run = null;
let scene = null;

function showMainMenu() {
    scene = createMainMenuScene({
        config,
        input,
        ui,
        onStart: startRun,
    });
}

function showBattle() {
    scene = createBattleScene({
        config,
        input,
        ui,
        run,
        battle: getCurrentBattle(run, battles),
        onFinish: showResult,
    });
}

function showResult(outcome) {
    const result = resolveBattle(run, outcome);
    scene = createBattleResultScene({
        input,
        ui,
        result,
        onContinue() {
            if (result.isRunVictory || outcome === BattleOutcome.Defeat) {
                showMainMenu();
                return;
            }

            showUpgrades();
        },
    });
}

function showUpgrades() {
    scene = createUpgradeScene({
        input,
        ui,
        run,
        upgrades,
        onChoose(upgrade) {
            applyUpgrade(run, upgrade);
            showBattle();
        },
    });
}

function startRun() {
    run = createRunState({
        totalBattles,
        playerHp: config.game.tileBattle.startingPlayerHp,
    });
    showBattle();
}

showMainMenu();

app.ticker.add((ticker) => {
    const dt = Math.min((ticker.deltaMS ?? 16.67) / 1000, 0.1);
    scene?.update?.(dt);
    scene?.render?.(app);
});

window.__tilebreakerDebug = {
    getSceneName() {
        return scene?.name ?? 'unknown';
    },
    getRun() {
        return run ? { ...run } : null;
    },
    getBattleDebug() {
        return scene?.getDebugState?.() ?? null;
    },
};
