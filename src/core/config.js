import {
    getCatalogSpecialTiles,
    validateCardCatalog,
} from '../entities/cards.js';

const CONFIG_FILES = {
    game: 'configs/game.json',
    levels: 'configs/levels.json',
    cards: 'configs/cards.json',
};

let configs = null;

export async function loadConfig() {
    const entries = await Promise.all(
        Object.entries(CONFIG_FILES).map(async ([key, path]) => {
            const response = await fetch(path);
            if (!response.ok) {
                throw new Error(`Failed to load config: ${path}`);
            }
            return [key, await response.json()];
        }),
    );

    configs = Object.fromEntries(entries);

    const manifestPath = configs.game.tileBattle?.manifestPath;
    if (manifestPath) {
        const response = await fetch(manifestPath);
        if (!response.ok) {
            throw new Error(`Failed to load tile manifest: ${manifestPath}`);
        }
        configs.tileManifest = await response.json();
    }

    if (configs.cards) {
        validateCardCatalog(configs.cards, {
            tiles: [
                ...(configs.tileManifest?.tiles ?? []),
                ...(configs.game.tileBattle?.specialTiles ?? []),
            ],
            settings: configs.game.tileBattle,
        });
        const existingSpecialTiles = configs.game.tileBattle?.specialTiles ?? [];
        const existingIds = new Set(existingSpecialTiles.map((tile) => tile.id));
        const catalogSpecialTiles = getCatalogSpecialTiles(configs.cards)
            .filter((tile) => !existingIds.has(tile.id));

        configs.game.tileBattle.specialTiles = [
            ...existingSpecialTiles,
            ...catalogSpecialTiles,
        ];
    }

    return configs;
}

export function getConfig(key) {
    if (!configs) {
        throw new Error('Configs are not loaded');
    }
    return configs[key];
}
