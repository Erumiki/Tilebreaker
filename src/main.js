import * as PIXI from 'pixi.js';
import { loadConfig } from './core/config.js';
import { initInput } from './core/input.js';
import { initPixi } from './core/renderer.js';
import {
    getGameplayVariant,
    normalizeGameplayVariantId,
} from './entities/gameplayVariants.js';
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
import { createBattleIntroScene } from './scenes/battleIntro.js';
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
const tileTextures = await loadTileTextures(PIXI, tiles, config.game.tileBattle);
const artTextures = await loadArtTextures(PIXI);
const totalBattles = Math.min(config.game.run.totalBattles, battles.length);
const debugOverrides = getDebugOverrides();
let run = null;
let scene = null;
let lastRunSeed = null;

function getTileAssetUrl(file, tileSettings) {
    if (!file) {
        return null;
    }

    if (/^(https?:)?\/\//.test(file) || file.startsWith('data:')) {
        return file;
    }

    if (file.includes('/')) {
        return file.replace(/^\/+/, '');
    }

    const manifestPath = tileSettings.manifestPath ?? 'assets/tiles_v2/tile_manifest.json';
    const basePath = manifestPath.split('/').slice(0, -1).join('/');

    return basePath ? `${basePath}/${file}` : file;
}

async function loadTileTextures(PIXI, tileDefs, tileSettings) {
    const textureRequests = new Map();

    for (const tileDef of tileDefs) {
        const url = getTileAssetUrl(tileDef.file, tileSettings);

        if (url) {
            textureRequests.set(tileDef.id, url);
        }
    }

    const entries = await Promise.all([...textureRequests].map(async ([tileId, url]) => {
        try {
            return [tileId, await PIXI.Assets.load(url)];
        } catch (error) {
            console.warn(`Failed to load tile texture ${url}`, error);
            return null;
        }
    }));

    return new Map(entries.filter(Boolean));
}

async function loadArtTextures(PIXI) {
    try {
        const response = await fetch('assets/art_mvp/art_manifest.json', {
            cache: 'reload',
        });

        if (!response.ok) {
            throw new Error(`Failed to load art manifest: ${response.status}`);
        }

        const manifest = await response.json();
        const root = manifest.root ?? 'assets/art_mvp';
        const cacheBust = manifest.cacheBust ?? Date.now().toString(36);
        const entries = await Promise.all((manifest.assets ?? []).map(async (asset) => {
            try {
                const url = `${root}/${asset.file}?v=${encodeURIComponent(cacheBust)}`;
                return [asset.id, await PIXI.Assets.load(url)];
            } catch (error) {
                console.warn(`Failed to load art texture ${asset.file}`, error);
                return null;
            }
        }));

        return {
            manifest,
            textures: new Map(entries.filter(Boolean)),
        };
    } catch (error) {
        console.warn('Art manifest unavailable; using drawn fallbacks', error);
        return {
            manifest: null,
            textures: new Map(),
        };
    }
}

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
    const gameplayVariant = params.get('gameplayVariant') ?? params.get('variant');

    return {
        seed,
        guaranteedLoopHands: guaranteedLoopHands === null
            ? null
            : guaranteedLoopHands === 'true' || guaranteedLoopHands === '1',
        drawMode: ['hand', 'queue'].includes(drawMode) ? drawMode : null,
        gameplayVariant: gameplayVariant === null
            ? null
            : normalizeGameplayVariantId(gameplayVariant),
    };
}

function applyDebugOverrides() {
    config.game.tileBattle.gameplayVariant = normalizeGameplayVariantId(
        config.game.tileBattle.gameplayVariant,
    );

    if (debugOverrides.guaranteedLoopHands !== null) {
        config.game.tileBattle.guaranteedLoopHands = debugOverrides.guaranteedLoopHands;
    }

    if (debugOverrides.drawMode) {
        config.game.tileBattle.drawMode = debugOverrides.drawMode;
    }

    if (debugOverrides.gameplayVariant) {
        config.game.tileBattle.gameplayVariant = debugOverrides.gameplayVariant;
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
        artTextures,
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
        tileTextures,
        artTextures,
        onFinish: showResult,
    });
}

function showBattleIntro() {
    scene = createBattleIntroScene({
        input,
        ui,
        run,
        battle: getCurrentBattle(run, battles),
        artTextures,
        onStart: showBattle,
    });
}

function showResult(outcome) {
    const result = resolveBattle(run, outcome, getCurrentBattle(run, battles));
    scene = createBattleResultScene({
        input,
        ui,
        artTextures,
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
        artTextures,
        run,
        upgrades: getRewardChoices(run, tiles, config.game.tileBattle),
        onChoose(upgrade) {
            applyUpgrade(run, upgrade);
            showBattleIntro();
        },
    });
}

function startRun(gameplayVariantId = config.game.tileBattle.gameplayVariant) {
    config.game.tileBattle.gameplayVariant = normalizeGameplayVariantId(gameplayVariantId);
    lastRunSeed = getRunSeed();
    run = createRunState({
        totalBattles,
        playerHp: config.game.tileBattle.startingPlayerHp,
        startingDeck: createStartingDeckIds(tiles, config.game.tileBattle),
        seed: lastRunSeed,
        settings: config.game.tileBattle,
    });
    showBattleIntro();
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
    getGameplayVariant() {
        return getGameplayVariant(config.game.tileBattle);
    },
    getMainMenuDebug() {
        return scene?.name === 'mainmenu' ? scene.getDebugState?.() ?? null : null;
    },
    getBattleDebug() {
        return scene?.getDebugState?.() ?? null;
    },
    getBattleIntroDebug() {
        return scene?.name === 'battleIntro' ? scene.getDebugState?.() ?? null : null;
    },
    getUpgradeDebug() {
        return scene?.name === 'upgrades' ? scene.getDebugState?.() ?? null : null;
    },
};
