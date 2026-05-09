const CARD_RARITIES = new Set(['common', 'uncommon', 'rare']);
const SHOP_CARD_STATUSES = new Set(['active', 'staged', 'disabled']);
const COMBAT_COLORS = new Set(['red', 'blue', 'green']);

function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function cardEnabled(card) {
    return card.enabled !== false && card.status !== 'disabled' && card.status !== 'staged';
}

function addError(errors, message) {
    errors.push(message);
}

function tileIndex(tiles = []) {
    return new Map(tiles.filter(Boolean).map((tile) => [tile.id, tile]));
}

function artIdSet(artManifest = null) {
    if (!Array.isArray(artManifest?.assets)) {
        return new Set();
    }

    return new Set(artManifest.assets.map((asset) => asset.id));
}

function validateSpecialTile(card, errors) {
    const specialTile = card.specialTile;

    if (!isObject(specialTile)) {
        addError(errors, `${card.id}: enabled special cards need a specialTile definition.`);
        return;
    }

    if (!specialTile.id || typeof specialTile.id !== 'string') {
        addError(errors, `${card.id}: specialTile.id is required.`);
    }

    if (!specialTile.color || typeof specialTile.color !== 'string') {
        addError(errors, `${card.id}: specialTile.color is required.`);
    }

    if (!specialTile.pattern || typeof specialTile.pattern !== 'string') {
        addError(errors, `${card.id}: specialTile.pattern is required.`);
    }

    if (!Array.isArray(specialTile.matrix) || specialTile.matrix.length !== 3) {
        addError(errors, `${card.id}: specialTile.matrix must contain three rows.`);
        return;
    }

    for (const row of specialTile.matrix) {
        if (typeof row !== 'string' || row.length !== 3) {
            addError(errors, `${card.id}: each specialTile.matrix row must be a three-character string.`);
        }
    }
}

function validateRuleTileReferences(card, tileIds, errors) {
    const segments = card.rules?.segments;

    if (!Array.isArray(segments)) {
        return;
    }

    for (const segment of segments) {
        if (!segment.tileId || !tileIds.has(segment.tileId)) {
            addError(errors, `${card.id}: rules.segments references unknown tileId ${segment.tileId ?? '<missing>'}.`);
        }
    }
}

function validateCard(card, context, errors) {
    const { tilesById, tileIds, artIds, activeShopColors } = context;
    const enabled = cardEnabled(card);

    if (!card.id || typeof card.id !== 'string') {
        addError(errors, 'Every card needs a string id.');
        return;
    }

    if (!card.name || typeof card.name !== 'string') {
        addError(errors, `${card.id}: name is required.`);
    }

    if (!card.description || typeof card.description !== 'string') {
        addError(errors, `${card.id}: description is required.`);
    }

    if (!Number.isInteger(card.cost) || card.cost < 0) {
        addError(errors, `${card.id}: cost must be a non-negative integer.`);
    }

    if (!CARD_RARITIES.has(card.rarity)) {
        addError(errors, `${card.id}: rarity must be common, uncommon or rare.`);
    }

    if (!card.family || typeof card.family !== 'string') {
        addError(errors, `${card.id}: family is required.`);
    }

    if (!SHOP_CARD_STATUSES.has(card.status ?? 'active')) {
        addError(errors, `${card.id}: status must be active, staged or disabled.`);
    }

    if (!Number.isFinite(card.offerWeight) || card.offerWeight < 0) {
        addError(errors, `${card.id}: offerWeight must be a non-negative number.`);
    }

    if (!Number.isInteger(card.maxPerShop) || card.maxPerShop < 0) {
        addError(errors, `${card.id}: maxPerShop must be a non-negative integer.`);
    }

    if (!Number.isInteger(card.enabledFromBattle) || card.enabledFromBattle < 1) {
        addError(errors, `${card.id}: enabledFromBattle must be a positive integer.`);
    }

    if (card.color && !COMBAT_COLORS.has(card.color)) {
        addError(errors, `${card.id}: color must be red, blue or green.`);
    }

    if (enabled && card.color && !activeShopColors.has(card.color)) {
        addError(errors, `${card.id}: enabled card color ${card.color} is not in active shop colors.`);
    }

    if (card.tileId) {
        const tile = tilesById.get(card.tileId);

        if (!tile) {
            addError(errors, `${card.id}: unknown tileId ${card.tileId}.`);
        } else {
            if (card.color && tile.color !== card.color) {
                addError(errors, `${card.id}: color does not match ${card.tileId}.`);
            }

            if (card.pattern && tile.pattern !== card.pattern) {
                addError(errors, `${card.id}: pattern does not match ${card.tileId}.`);
            }
        }
    }

    if (card.specialTile) {
        validateSpecialTile(card, errors);
    }

    validateRuleTileReferences(card, tileIds, errors);

    if (enabled && !card.tileId && !card.specialTile) {
        addError(errors, `${card.id}: enabled cards need tileId or specialTile.`);
    }

    if (enabled && !card.assetId) {
        addError(errors, `${card.id}: enabled cards need assetId.`);
    }

    if (enabled && card.assetId) {
        const specialTileId = card.specialTile?.id;
        const assetExists = tileIds.has(card.assetId)
            || artIds.has(card.assetId)
            || card.assetId === specialTileId;

        if (!assetExists) {
            addError(errors, `${card.id}: unknown assetId ${card.assetId}.`);
        }
    }
}

export function validateCardCatalog(catalog, options = {}) {
    const errors = [];

    if (!isObject(catalog)) {
        throw new Error('Card catalog must be an object.');
    }

    if (!catalog.version || typeof catalog.version !== 'string') {
        addError(errors, 'Card catalog version is required.');
    }

    if (!isObject(catalog.shop)) {
        addError(errors, 'Card catalog shop rules are required.');
    }

    if (!Array.isArray(catalog.cards)) {
        addError(errors, 'Card catalog cards array is required.');
    }

    const cards = Array.isArray(catalog.cards) ? catalog.cards : [];
    const ids = new Set();
    const duplicates = new Set();
    const tilesById = tileIndex(options.tiles);
    const tileIds = new Set(tilesById.keys());
    const artIds = artIdSet(options.artManifest);
    const activeShopColors = new Set(catalog.shop?.activeColors ?? []);

    if (!Number.isInteger(catalog.shop?.offerCount) || catalog.shop.offerCount < 1) {
        addError(errors, 'shop.offerCount must be a positive integer.');
    }

    if (activeShopColors.size === 0) {
        addError(errors, 'shop.activeColors must contain at least one color.');
    }

    for (const color of activeShopColors) {
        if (!COMBAT_COLORS.has(color)) {
            addError(errors, `shop.activeColors contains unknown color ${color}.`);
        }
    }

    for (const card of cards) {
        if (!isObject(card)) {
            addError(errors, 'Every card entry must be an object.');
            continue;
        }

        if (card.id) {
            if (ids.has(card.id)) {
                duplicates.add(card.id);
            }
            ids.add(card.id);
        }

        validateCard(card, {
            tilesById,
            tileIds,
            artIds,
            activeShopColors,
        }, errors);
    }

    for (const id of duplicates) {
        addError(errors, `Duplicate card id ${id}.`);
    }

    const enabledCards = cards.filter(cardEnabled);

    if (enabledCards.length === 0) {
        addError(errors, 'Card catalog must contain at least one enabled card.');
    }

    if (errors.length > 0) {
        throw new Error(`Invalid card catalog:\n- ${errors.join('\n- ')}`);
    }

    return {
        cards: [...cards],
        enabledCards,
        stagedCards: cards.filter((card) => card.status === 'staged' || card.enabled === false),
    };
}

export function getEnabledShopCards(catalog, options = {}) {
    const battleNumber = Math.max(1, Math.floor(options.battleNumber ?? 1));
    const activeColors = new Set(options.activeColors ?? catalog.shop?.activeColors ?? []);

    return catalog.cards.filter((card) => {
        if (!cardEnabled(card)) {
            return false;
        }

        if ((card.enabledFromBattle ?? 1) > battleNumber) {
            return false;
        }

        return !card.color || activeColors.has(card.color);
    });
}

export function getCatalogSpecialTiles(catalog, options = {}) {
    const includeStaged = options.includeStaged === true;

    return catalog.cards
        .filter((card) => card.specialTile && (includeStaged || cardEnabled(card)))
        .map((card) => ({
            ...card.specialTile,
            sourceCardId: card.id,
        }));
}
