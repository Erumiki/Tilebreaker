export const GAMEPLAY_VARIANTS = [
    {
        id: 'legacy',
        shortLabel: 'LEG',
        title: 'Legacy',
    },
    {
        id: 'placement_payoff',
        shortLabel: 'A',
        title: 'Placement payoff',
    },
    {
        id: 'one_color_chain',
        shortLabel: 'B',
        title: 'One-color chain',
    },
    {
        id: 'connect_targets',
        shortLabel: 'C',
        title: 'Connect targets',
    },
    {
        id: 'road_mode',
        shortLabel: 'D',
        title: 'Road mode',
    },
];

export const GAMEPLAY_VARIANT_ORDER = GAMEPLAY_VARIANTS.map((variant) => variant.id);

const VARIANT_ALIASES = new Map([
    ['0', 'legacy'],
    ['base', 'legacy'],
    ['baseline', 'legacy'],
    ['control', 'legacy'],
    ['legacy', 'legacy'],
    ['leg', 'legacy'],
    ['a', 'placement_payoff'],
    ['variant_a', 'placement_payoff'],
    ['placement', 'placement_payoff'],
    ['placement_payoff', 'placement_payoff'],
    ['b', 'one_color_chain'],
    ['variant_b', 'one_color_chain'],
    ['chain', 'one_color_chain'],
    ['one_color', 'one_color_chain'],
    ['one_color_chain', 'one_color_chain'],
    ['c', 'connect_targets'],
    ['variant_c', 'connect_targets'],
    ['targets', 'connect_targets'],
    ['connect_targets', 'connect_targets'],
    ['d', 'road_mode'],
    ['variant_d', 'road_mode'],
    ['road', 'road_mode'],
    ['road_mode', 'road_mode'],
]);

function normalizeKey(value) {
    return String(value ?? 'legacy')
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, '_');
}

export function normalizeGameplayVariantId(value) {
    return VARIANT_ALIASES.get(normalizeKey(value)) ?? 'legacy';
}

export function getGameplayVariant(settings = {}) {
    const id = normalizeGameplayVariantId(settings.gameplayVariant);
    return GAMEPLAY_VARIANTS.find((variant) => variant.id === id) ?? GAMEPLAY_VARIANTS[0];
}

export function formatGameplayVariantLabel(settings = {}) {
    const variant = getGameplayVariant(settings);
    return `${variant.shortLabel}:${variant.id}`;
}
