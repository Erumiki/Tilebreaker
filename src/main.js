import * as PIXI from 'pixi.js';
import { loadConfig } from './core/config.js';
import { initInput } from './core/input.js';
import { initPixi } from './core/renderer.js';
import {
    applyUpgrade,
    BattleOutcome,
    createRunState,
    getRewardChoices,
    getCurrentBattle,
    resolveBattle,
} from './entities/run.js';
import {
    createStartingDeckIds,
    createTilesFromManifest,
} from './entities/tileBattle.js';
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
const tiles = createTilesFromManifest(config.tileManifest, config.game.tileBattle);
const totalBattles = Math.min(config.game.run.totalBattles, battles.length);
const debugOverrides = getDebugOverrides();
let run = null;
let scene = null;
let lastRunSeed = null;

function parseSeed(value) {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    const seed = Number(value);

    if (!Number.isFinite(seed)) {
        return null;
    }

    return seed >>> 0;
}

function createRandomSeed() {
    if (globalThis.crypto?.getRandomValues) {
        const values = new Uint32Array(1);
        globalThis.crypto.getRandomValues(values);
        return values[0];
    }

    return (Date.now() ^ Math.floor(Math.random() * 0x100000000)) >>> 0;
}

function getDebugOverrides() {
    const params = new URLSearchParams(window.location.search);
    const seed = parseSeed(params.get('seed'));
    const guaranteedLoopHands = params.get('guaranteedLoopHands');
    const drawMode = params.get('drawMode');

    return {
        seed,
        guaranteedLoopHands: guaranteedLoopHands === null
            ? null
            : guaranteedLoopHands === 'true' || guaranteedLoopHands === '1',
        drawMode: ['hand', 'queue'].includes(drawMode) ? drawMode : null,
    };
}

function applyDebugOverrides() {
    if (debugOverrides.guaranteedLoopHands !== null) {
        config.game.tileBattle.guaranteedLoopHands = debugOverrides.guaranteedLoopHands;
    }

    if (debugOverrides.drawMode) {
        config.game.tileBattle.drawMode = debugOverrides.drawMode;
    }
}

function getRunSeed() {
    return debugOverrides.seed ?? createRandomSeed();
}

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
        upgrades: getRewardChoices(run, tiles),
        onChoose(upgrade) {
            applyUpgrade(run, upgrade);
            showBattle();
        },
    });
}

function startRun() {
    lastRunSeed = getRunSeed();
    run = createRunState({
        totalBattles,
        playerHp: config.game.tileBattle.startingPlayerHp,
        startingDeck: createStartingDeckIds(tiles, config.game.tileBattle),
        seed: lastRunSeed,
    });
    showBattle();
}

applyDebugOverrides();
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
    getRunSeed() {
        return lastRunSeed;
    },
    getBattleDebug() {
        return scene?.getDebugState?.() ?? null;
    },
    getUpgradeDebug() {
        return scene?.name === 'upgrades' ? scene.getDebugState?.() ?? null : null;
    },
};
