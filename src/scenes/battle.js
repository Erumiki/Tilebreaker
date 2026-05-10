import { BattleOutcome, getRunDeckStats } from '../entities/run.js';
import { getGameplayVariant } from '../entities/gameplayVariants.js';
import {
    drawBorder,
    drawCornerBrackets,
    drawFramedPanel,
    insetRect,
} from '../render/chrome.js';
import { drawArtImage as drawManifestImage, drawMissingArtAsset } from '../render/art.js';
import { createBattleLayout } from './battleLayout.js';
import {
    advanceTileQueue,
    canPlaceTile,
    COMBAT_COLORS,
    createBoardWithTilePlacement,
    createTileBattleState,
    createTilesFromManifest,
    discardRoundHand,
    getHandSubmitCostPreview,
    getTilePlacementFailure,
    getRoundAttack,
    getConnectedCombatTileKeys,
    getShortestCombatPathKeys,
    getTilePlacementCells,
    holdSelectedTile,
    placeTile,
    resolveHandSubmitDefeatIfNeeded,
    resolveImmediatePlacement,
    resolveTileRound,
    scoreTileBoard,
    startNextTileRound,
    submitTileHand,
} from '../entities/tileBattle.js';

const COLOR_HEX = {
    red: '#e55353',
    blue: '#4f8cff',
    green: '#55c978',
    gray: '#7d8790',
    land: '#d6b95f',
};

const COLOR_LABELS = {
    red: 'Красный',
    blue: 'Синий',
    green: 'Зеленый',
};

const BATTLE_UI_STATES = {
    battleIntro: 'battleIntro',
    placing: 'placing',
    cardSelected: 'cardSelected',
    holdEmpty: 'holdEmpty',
    holdFilled: 'holdFilled',
    invalidPlacement: 'invalidPlacement',
    closureScored: 'closureScored',
    submitPaid: 'submitPaid',
    submitBlocked: 'submitBlocked',
    lastChanceHand: 'lastChanceHand',
    victory: 'victory',
    defeat: 'defeat',
};

function isQueueDrawMode(settings) {
    return settings.drawMode === 'queue';
}

function isHoldEnabled(settings) {
    return settings.holdEnabled === true && !isQueueDrawMode(settings);
}

function getCaptureAreaByColor(result) {
    const areaByColor = Object.fromEntries(COMBAT_COLORS.map((color) => [color, 0]));

    if (!result) {
        return areaByColor;
    }

    for (const zone of result.score.zones) {
        areaByColor[zone.color] += zone.area;
    }

    return areaByColor;
}

function getCaptureBonusByColor(result) {
    const bonusByColor = Object.fromEntries(COMBAT_COLORS.map((color) => [color, 0]));

    if (!result) {
        return bonusByColor;
    }

    for (const zone of result.score.zones) {
        bonusByColor[zone.color] += (zone.areaBonus ?? 0)
            + (zone.grayBonus ?? 0)
            + (zone.focusBonus ?? 0)
            + (zone.chainBonus ?? 0);
    }

    bonusByColor.red += result.connectTargetBonus ?? 0;
    bonusByColor.red += result.roadDamage ?? 0;

    return bonusByColor;
}

function isPlacementPayoffVariant(settings) {
    return getGameplayVariant(settings).id === 'placement_payoff';
}

function isOneColorChainVariant(settings) {
    return getGameplayVariant(settings).id === 'one_color_chain';
}

function isConnectTargetsVariant(settings) {
    return getGameplayVariant(settings).id === 'connect_targets';
}

function isRoadModeVariant(settings) {
    return getGameplayVariant(settings).id === 'road_mode';
}

function isLegacyVariant(settings) {
    return getGameplayVariant(settings).id === 'legacy';
}

function usesHandSubmitEconomy(settings) {
    return isLegacyVariant(settings);
}

function isOneColorLandVariant(settings) {
    return isOneColorChainVariant(settings)
        || (isConnectTargetsVariant(settings) && settings.connectTargets?.oneColorLand !== false)
        || (isRoadModeVariant(settings) && settings.roadMode?.oneColorLand !== false);
}

function getPlacementFocusMax(settings) {
    return settings.placementPayoff?.maxFocus ?? 4;
}

function getOneColorChainMax(settings) {
    return settings.oneColorChain?.maxChain ?? 5;
}

function getColorHex(color, settings) {
    return isOneColorLandVariant(settings) && color !== 'gray'
        ? COLOR_HEX.land
        : COLOR_HEX[color];
}

function getColorLabel(color, settings) {
    if (isOneColorLandVariant(settings) && color === 'red') {
        return 'Земля';
    }

    return COLOR_LABELS[color];
}

function getVisibleCombatColors(settings) {
    if (isOneColorLandVariant(settings)) {
        return ['red'];
    }

    const colors = Array.isArray(settings.activeCombatColors)
        ? settings.activeCombatColors.filter((color) => COMBAT_COLORS.includes(color))
        : [];

    return colors.length > 0 ? colors : COMBAT_COLORS;
}

function formatHearts(value) {
    const hearts = Math.max(0, Math.ceil(value || 0));

    if (hearts === 0) {
        return 'нет';
    }

    if (hearts <= 12) {
        return '♥'.repeat(hearts);
    }

    return `♥ x${hearts}`;
}

function formatHeartDelta(value) {
    const hearts = Math.max(0, Math.ceil(value || 0));

    return hearts > 0 ? `-${formatHearts(hearts)}` : '0';
}

function formatPositiveHeartDelta(value) {
    const hearts = Math.max(0, Math.ceil(value || 0));

    return hearts > 0 ? `+${formatHearts(hearts)}` : '+0';
}

function pushBattleLog(state, message) {
    state.battleLog ??= [];
    state.battleLog.push(message);

    if (state.battleLog.length > 6) {
        state.battleLog.splice(0, state.battleLog.length - 6);
    }
}

function drawPlacementHint(ui, rect, { valid, hovered, artTextures = null }) {
    const color = valid ? '#d6a05c' : '#ff7b83';
    const fill = valid ? '#d6a05c' : '#ff4f5f';
    const inset = Math.max(3, Math.floor(rect.width * 0.065));
    const overlayId = valid ? 'overlay_valid_cell' : 'overlay_invalid_cell';

    ui.drawRect(insetRect(rect, inset), fill, valid
        ? hovered ? 0.08 : 0.025
        : hovered ? 0.22 : 0.14);
    const drewOverlay = drawArtImage(ui, artTextures, overlayId, insetRect(rect, Math.max(2, inset * 0.5)), {
        alpha: valid
            ? hovered ? 0.38 : 0.22
            : hovered ? 0.98 : 0.68,
        fit: 'stretch',
        required: true,
    });

    if (!drewOverlay) {
        drawCornerBrackets(ui, rect, color, {
            alpha: valid ? hovered ? 0.78 : 0.28 : hovered ? 1 : 0.72,
            thickness: valid
                ? hovered ? Math.max(2, Math.floor(rect.width * 0.04)) : Math.max(1, Math.floor(rect.width * 0.025))
                : hovered ? Math.max(3, Math.floor(rect.width * 0.055)) : Math.max(2, Math.floor(rect.width * 0.04)),
            length: valid
                ? hovered ? Math.max(10, Math.floor(rect.width * 0.24)) : Math.max(7, Math.floor(rect.width * 0.16))
                : hovered ? Math.max(12, Math.floor(rect.width * 0.32)) : Math.max(9, Math.floor(rect.width * 0.22)),
            inset,
        });
    }

    if (!valid) {
        drawBorder(ui, insetRect(rect, Math.max(2, Math.floor(rect.width * 0.045))), color, hovered ? 3 : 2, hovered ? 0.82 : 0.54);
        drawCornerBrackets(ui, rect, color, {
            alpha: hovered ? 0.95 : 0.62,
            thickness: hovered ? Math.max(3, Math.floor(rect.width * 0.055)) : Math.max(2, Math.floor(rect.width * 0.04)),
            length: hovered ? Math.max(12, Math.floor(rect.width * 0.32)) : Math.max(9, Math.floor(rect.width * 0.24)),
            inset,
        });
    }

    if (hovered && !drewOverlay) {
        drawBorder(ui, insetRect(rect, Math.max(2, Math.floor(rect.width * 0.035))), color, 2, valid ? 0.45 : 0.72);

        if (!valid) {
            ui.drawText('X', rect.x + rect.width / 2, rect.y + rect.height * 0.08, {
                align: 'center',
                size: Math.max(32, rect.width * 0.72),
                color: '#ff9aa0',
                weight: 700,
            });
        }
    }
}

function drawPlacementPreview(ui, rect, tileDef, settings, tileTextures) {
    const previewRect = insetRect(rect, Math.max(5, Math.floor(rect.width * 0.075)));

    ui.drawRect(insetRect(rect, Math.max(3, Math.floor(rect.width * 0.055))), '#f5d58a', 0.08);
    drawTile(ui, tileDef, previewRect, {
        oneColorLand: isOneColorLandVariant(settings),
        tileTextures,
        alpha: 0.54,
        background: '#2b251f',
    });
    drawBorder(ui, previewRect, '#f6d88a', Math.max(1, Math.floor(rect.width * 0.025)), 0.48);
}

function drawPlacementPreviewOnBoard(ui, layout, tileDef, x, y, settings, tileTextures) {
    const cells = getTilePlacementCells(tileDef, x, y);

    for (const cell of cells) {
        const rect = {
            x: layout.board.x + cell.x * layout.cellSize,
            y: layout.board.y + cell.y * layout.cellSize,
            width: layout.cellSize,
            height: layout.cellSize,
        };

        drawPlacementPreview(ui, rect, cell.tileDef, settings, tileTextures);
    }
}

function getBattleAssetId(prefix, battle) {
    return `${prefix}_${battle.id}`;
}

function getMonsterName(battle) {
    return battle.monsterName ?? battle.name;
}

function drawArtImage(ui, artTextures, assetId, rect, options = {}) {
    return drawManifestImage(ui, artTextures, assetId, rect, options);
}

function getZoneFilledOverlayAssetId(color, settings) {
    if (isOneColorLandVariant(settings) && color !== 'gray') {
        return 'overlay_zone_filled_land';
    }

    return `overlay_zone_filled_${color}`;
}

function drawZoneFilledCell(ui, rect, color, settings) {
    const inset = Math.max(1, rect.width * 0.08);
    const fill = getColorHex(color, settings);
    const inner = insetRect(rect, inset);
    const gleamThickness = Math.max(1, rect.width * 0.035);

    ui.drawRect(inner, fill, 0.14);
    drawBorder(ui, inner, fill, gleamThickness, 0.18);
    ui.drawRect({
        x: inner.x + inner.width * 0.18,
        y: inner.y + inner.height * 0.48,
        width: inner.width * 0.64,
        height: gleamThickness,
    }, '#fff0c2', 0.08);
    ui.drawRect({
        x: inner.x + inner.width * 0.48,
        y: inner.y + inner.height * 0.18,
        width: gleamThickness,
        height: inner.height * 0.64,
    }, '#fff0c2', 0.065);
}

function getZoneTileBounds(layout, cells) {
    if (cells.length === 0) {
        return null;
    }

    const minX = Math.min(...cells.map((cell) => Math.floor(cell.x / 3)));
    const maxX = Math.max(...cells.map((cell) => Math.floor(cell.x / 3)));
    const minY = Math.min(...cells.map((cell) => Math.floor(cell.y / 3)));
    const maxY = Math.max(...cells.map((cell) => Math.floor(cell.y / 3)));

    return {
        x: layout.board.x + minX * layout.cellSize,
        y: layout.board.y + minY * layout.cellSize,
        width: (maxX - minX + 1) * layout.cellSize,
        height: (maxY - minY + 1) * layout.cellSize,
    };
}

function drawZoneFilledSeal(ui, artTextures, layout, microSize, zone, settings) {
    const zoneCells = [...zone.interiorCells, ...zone.boundaryCells];
    const bounds = getZoneTileBounds(layout, zoneCells);
    if (!bounds) {
        return;
    }

    const assetId = getZoneFilledOverlayAssetId(zone.color, settings);
    const sealRect = {
        x: bounds.x + layout.cellSize * 0.05,
        y: bounds.y + layout.cellSize * 0.05,
        width: bounds.width - layout.cellSize * 0.1,
        height: bounds.height - layout.cellSize * 0.1,
    };

    drawArtImage(ui, artTextures, assetId, sealRect, {
        alpha: 0.42,
        fit: 'stretch',
        required: true,
    });
    drawArtImage(ui, artTextures, 'effect_capture_flash', sealRect, {
        alpha: 0.82,
        fit: 'stretch',
        tint: getColorHex(zone.color, settings),
        required: true,
    });
    drawArtImage(ui, artTextures, 'effect_capture_flash', sealRect, {
        alpha: 0.34,
        fit: 'stretch',
        required: true,
    });
}

function drawIconText(ui, artTextures, assetId, x, y, iconSize, text, options = {}) {
    const iconRect = {
        x,
        y,
        width: iconSize,
        height: iconSize,
    };
    const drawn = drawArtImage(ui, artTextures, assetId, iconRect, {
        alpha: options.iconAlpha ?? 1,
        tint: options.tint,
        required: options.required ?? true,
    });

    if (!drawn && options.fallback) {
        ui.drawText(options.fallback, x + iconSize / 2, y + Math.max(0, (iconSize - 18) / 2), {
            align: 'center',
            size: options.fallbackSize ?? Math.max(14, iconSize - 6),
            color: options.fallbackColor ?? options.color ?? '#ffffff',
        });
    }

    if (text === null || text === undefined || text === '') {
        return;
    }

    ui.drawText(String(text), x + iconSize + (options.gap ?? 5), y + (options.textOffsetY ?? 0), {
        size: options.textSize ?? 15,
        color: options.color ?? '#ffffff',
        weight: options.weight ?? 600,
        maxWidth: options.maxWidth,
    });
}

function drawOrnatePanelFrame(ui, artTextures, rect, options = {}) {
    const drewPanel = drawArtImage(ui, artTextures, 'panel_dark', rect, {
        alpha: options.panelAlpha ?? 0.9,
        fit: 'stretch',
        required: true,
    });

    if (!drewPanel) {
        ui.drawRect(rect, options.background ?? '#06101a', options.fallbackAlpha ?? 0.86);
    }

    const accent = options.accent ?? '#d6a25c';
    drawBorder(ui, rect, '#1c130f', options.outerThickness ?? 3, 0.88);
    drawBorder(ui, insetRect(rect, options.inset ?? 6), accent, options.innerThickness ?? 1, options.innerAlpha ?? 0.58);
    drawCornerBrackets(ui, rect, accent, {
        inset: options.bracketInset ?? 6,
        length: options.bracketLength ?? 28,
        thickness: options.bracketThickness ?? 3,
        alpha: options.bracketAlpha ?? 0.7,
    });
}

function drawDiamondProgress(ui, rect, current, total) {
    const safeTotal = Math.max(1, total || 1);
    const clampedCurrent = Math.max(0, Math.min(safeTotal, current || 0));
    const gap = Math.min(24, rect.width / Math.max(1, safeTotal + 1));
    const startX = rect.x + rect.width / 2 - ((safeTotal - 1) * gap) / 2;
    const y = rect.y;

    for (let index = 0; index < safeTotal; index += 1) {
        ui.drawText('◆', startX + index * gap, y, {
            align: 'center',
            size: 13,
            color: index < clampedCurrent ? '#f3d991' : '#604b32',
            weight: 700,
        });
    }
}

function drawHudPips(ui, artTextures, {
    assetId,
    x,
    y,
    value,
    maxPips = 4,
    size = 18,
    gap = 4,
    color = '#fff2ca',
    fallback = '♥',
    text = null,
}) {
    const pipCount = Math.max(1, Math.min(maxPips, Math.ceil(value || 0)));

    for (let index = 0; index < maxPips; index += 1) {
        const active = index < pipCount;
        const rect = {
            x: x + index * (size + gap),
            y,
            width: size,
            height: size,
        };

        if (!drawArtImage(ui, artTextures, assetId, rect, {
            alpha: active ? 1 : 0.2,
            required: true,
        })) {
            ui.drawText(fallback, rect.x + size / 2, rect.y + 1, {
                align: 'center',
                size,
                color: active ? color : '#51473f',
                weight: 700,
            });
        }
    }

    ui.drawText(text ?? `x${Math.max(0, Math.ceil(value || 0))}`, x + maxPips * (size + gap) + 3, y + 1, {
        size: Math.max(12, size - 2),
        color,
        weight: 700,
        maxWidth: 46,
    });
}

function drawMonsterThreatBar(ui, rect, current, max) {
    const safeMax = Math.max(1, max || current || 1);
    const ratio = Math.max(0, Math.min(1, (current || 0) / safeMax));

    ui.drawRect(rect, '#1d1422', 0.82);
    drawBorder(ui, rect, '#604b32', 1, 0.62);
    ui.drawRect({
        x: rect.x + 2,
        y: rect.y + 2,
        width: Math.max(0, (rect.width - 4) * ratio),
        height: rect.height - 4,
    }, '#8f38d6', 0.86);
    ui.drawRect({
        x: rect.x + 2,
        y: rect.y + 2,
        width: Math.max(0, (rect.width - 4) * ratio),
        height: Math.max(1, (rect.height - 4) * 0.36),
    }, '#d57bff', 0.5);
}

function drawEventBadge(ui, artTextures, rect, assetId, label, options = {}) {
    const iconSize = options.iconSize ?? 18;

    ui.drawRect(rect, options.background ?? '#07121f', options.alpha ?? 0.78);
    drawBorder(ui, rect, options.edgeColor ?? '#d6a25c', 1, options.edgeAlpha ?? 0.55);
    drawIconText(ui, artTextures, assetId, rect.x + 7, rect.y + rect.height / 2 - iconSize / 2, iconSize, label, {
        fallback: options.fallback,
        fallbackColor: options.color,
        textSize: options.textSize ?? 13,
        color: options.color ?? '#f3d991',
        weight: 700,
        gap: 4,
    });
}

function getLatestEventBadges(state) {
    const badges = [];

    if (state.lastResult?.lastClosureImmediate) {
        badges.push({
            id: 'monster',
            assetId: 'icon_heart_lost',
            label: formatHeartDelta(state.lastResult.enemyDamage ?? 0),
            color: '#ffd4d8',
            fallback: '♥',
        });

        if ((state.lastResult.goldEarned ?? 0) > 0) {
            badges.push({
                id: 'gold',
                assetId: 'icon_gold',
                label: `+${state.lastResult.goldEarned}`,
                color: '#f3d991',
                fallback: 'G',
            });
        }

        if ((state.lastResult.heartHeal ?? 0) > 0) {
            badges.push({
                id: 'heart',
                assetId: 'icon_heart_full',
                label: formatPositiveHeartDelta(state.lastResult.heartHeal),
                color: '#c8f7dd',
                fallback: '♥',
            });
        }

        if ((state.lastResult.strikeGold ?? 0) > 0) {
            badges.push({
                id: 'strike',
                assetId: 'icon_strike',
                label: `x${state.lastResult.strikeCount}`,
                color: '#ffe7ad',
                fallback: '*',
            });
        }

        return badges;
    }

    const placement = state.lastPlacementResourceResult;
    if (placement) {
        if ((placement.goldAmount ?? placement.amount ?? 0) > 0) {
            badges.push({
                id: 'fieldGold',
                assetId: 'icon_gold',
                label: `+${placement.goldAmount ?? placement.amount}`,
                color: '#f3d991',
                fallback: 'G',
            });
        }

        if ((placement.heartHeal ?? 0) > 0) {
            badges.push({
                id: 'fieldHeart',
                assetId: 'icon_heart_full',
                label: formatPositiveHeartDelta(placement.heartHeal),
                color: '#c8f7dd',
                fallback: '♥',
            });
        }
    }

    if (state.lastSubmitResult?.submitted) {
        badges.push({
            id: 'submit',
            assetId: 'icon_heart_lost',
            label: formatHeartDelta(state.lastSubmitResult.totalDamage ?? 0),
            color: '#ffd4d8',
            fallback: '♥',
        });
    }

    return badges;
}

function drawBattleEventBadges(ui, artTextures, layout, state) {
    const badges = getLatestEventBadges(state).slice(0, layout.mode === 'portrait' ? 4 : 5);

    if (badges.length === 0) {
        return;
    }

    const gap = 6;
    const badgeHeight = layout.mode === 'portrait' ? 26 : 30;
    const badgeWidth = layout.mode === 'portrait' ? 72 : 82;
    const totalWidth = badges.length * badgeWidth + (badges.length - 1) * gap;
    const startX = Math.max(
        layout.board.x + 6,
        layout.board.x + layout.board.width - totalWidth - 6,
    );
    const y = layout.board.y + 7;

    badges.forEach((badge, index) => {
        drawEventBadge(ui, artTextures, {
            x: startX + index * (badgeWidth + gap),
            y,
            width: badgeWidth,
            height: badgeHeight,
        }, badge.assetId, badge.label, {
            iconSize: layout.mode === 'portrait' ? 17 : 19,
            textSize: layout.mode === 'portrait' ? 12 : 13,
            color: badge.color,
            fallback: badge.fallback,
            edgeColor: badge.id === 'submit' ? '#d78486' : '#d6a25c',
            background: badge.id === 'submit' ? '#21131b' : '#07121f',
        });
    });
}

function drawArtButton(ui, artTextures, rect, label, options = {}) {
    const hovered = options.mouse ? ui.contains(rect, options.mouse) : false;
    const state = options.disabled ? 'disabled' : hovered ? 'hover' : 'default';
    const prefix = options.secondary ? 'button_secondary' : 'button_primary';
    const drawn = drawArtImage(ui, artTextures, `${prefix}_${state}`, rect, {
        alpha: options.alpha ?? 1,
        required: true,
    });

    if (!drawn) {
        ui.drawButton(rect, label, options);
        return;
    }

    const content = getArtButtonContentRects(rect, options);

    if (content.iconWell && content.iconRect) {
        ui.drawRect(content.iconWell, options.iconWellColor ?? (options.disabled ? '#25282e' : '#4a1a1b'), options.iconWellAlpha ?? 0.86);
        drawBorder(ui, content.iconWell, options.iconWellEdgeColor ?? (options.disabled ? '#66666a' : '#d78486'), 1, options.iconWellEdgeAlpha ?? 0.42);
        drawIconText(
            ui,
            artTextures,
            options.iconAssetId,
            content.iconRect.x,
            content.iconRect.y,
            content.iconRect.width,
            '',
            {
                fallback: options.iconFallback,
                fallbackColor: options.iconFallbackColor,
                iconAlpha: options.disabled ? 0.82 : 1,
            },
        );
    }

    ui.drawText(label, content.labelX, content.labelRect.y, {
        align: 'center',
        size: options.textSize ?? 20,
        color: options.textColor ?? '#fff2ca',
        weight: 700,
        maxWidth: content.labelRect.width,
    });
}

function getArtButtonContentRects(rect, options = {}) {
    const textSize = options.textSize ?? 20;
    const labelY = rect.y + rect.height / 2 - textSize / 2 - 2;
    let labelRect = {
        x: rect.x + 17,
        y: labelY,
        width: rect.width - 34,
        height: textSize + 4,
    };
    let iconWell = null;
    let iconRect = null;

    if (options.iconAssetId) {
        const iconSize = options.iconSize ?? Math.min(26, rect.height - 22);
        const iconPadding = options.iconPadding ?? 12;
        const iconWellWidth = Math.max(iconSize + iconPadding * 2, options.iconWellWidth ?? 68);
        iconWell = {
            x: rect.x + 9,
            y: rect.y + 8,
            width: iconWellWidth,
            height: rect.height - 16,
        };
        iconRect = {
            x: iconWell.x + iconWell.width / 2 - iconSize / 2,
            y: rect.y + rect.height / 2 - iconSize / 2,
            width: iconSize,
            height: iconSize,
        };

        const labelLeft = iconWell.x + iconWell.width + 10;
        const labelRight = rect.x + rect.width - 18;
        labelRect = {
            x: labelLeft,
            y: labelY,
            width: Math.max(48, labelRight - labelLeft),
            height: textSize + 4,
        };
    }

    return {
        iconWell,
        iconRect,
        labelRect,
        labelX: labelRect.x + labelRect.width / 2,
    };
}

function getBoardCell(layout, settings, point) {
    if (point.x < layout.board.x
        || point.y < layout.board.y
        || point.x > layout.board.x + layout.board.width
        || point.y > layout.board.y + layout.board.height) {
        return null;
    }

    return {
        x: Math.floor((point.x - layout.board.x) / layout.cellSize),
        y: Math.floor((point.y - layout.board.y) / layout.cellSize),
    };
}

function drawTile(ui, tileDef, rect, options = {}) {
    if (!tileDef) {
        return;
    }

    const texture = options.tileTextures?.get(tileDef.id);
    const gap = Math.max(1, Math.floor(rect.width * 0.035));
    const microSize = (rect.width - gap * 4) / 3;
    ui.drawRect(rect, options.background ?? '#202b34', options.alpha ?? 1);

    if (texture && !options.oneColorLand) {
        ui.drawImage(texture, rect, {
            alpha: options.alpha ?? 1,
        });
        return;
    }

    if (!texture && options.tileTextures && !options.oneColorLand && options.requiredTexture !== false) {
        drawMissingArtAsset(ui, rect, tileDef.id);
        return;
    }

    for (let y = 0; y < 3; y += 1) {
        for (let x = 0; x < 3; x += 1) {
            const symbol = tileDef.cells[y][x];
            const cellRect = {
                x: rect.x + gap + x * (microSize + gap),
                y: rect.y + gap + y * (microSize + gap),
                width: microSize,
                height: microSize,
            };

            if (symbol === '*') {
                ui.drawRect({
                    ...cellRect,
                    width: microSize / 2,
                }, COLOR_HEX.red, 0.95);
                ui.drawRect({
                    ...cellRect,
                    x: cellRect.x + microSize / 2,
                    width: microSize / 2,
                }, COLOR_HEX.blue, 0.95);
                continue;
            }

            const color = options.oneColorLand && symbol !== '.'
                ? COLOR_HEX.land
                : symbol === 'R'
                ? COLOR_HEX.red
                : symbol === 'B'
                    ? COLOR_HEX.blue
                    : symbol === 'G'
                        ? COLOR_HEX.green
                        : COLOR_HEX.gray;
            ui.drawRect(cellRect, color, symbol === '.' ? 0.52 : 0.95);
        }
    }
}

function getBoardResourcesAt(state, x, y) {
    return (state.boardResources ?? []).filter((resource) => (
        !resource.consumed
        && resource.x === x
        && resource.y === y
    ));
}

function drawFieldResources(ui, artTextures, rect, resources, occupied) {
    const visibleResources = resources.slice(0, 2);

    visibleResources.forEach((resource, index) => {
        const size = occupied
            ? Math.max(16, rect.width * 0.32)
            : Math.max(20, rect.width * 0.44);
        const gap = Math.max(2, rect.width * 0.04);
        const x = occupied
            ? rect.x + rect.width - size - gap - index * (size + gap)
            : rect.x + rect.width / 2 - size / 2 + (index - (visibleResources.length - 1) / 2) * (size + gap);
        const y = occupied
            ? rect.y + rect.height - size - gap
            : rect.y + rect.height / 2 - size / 2;
        const iconRect = {
            x,
            y,
            width: size,
            height: size,
        };
        const assetId = resource.type === 'heart' ? 'icon_heart_full' : 'icon_gold';
        const fallback = resource.type === 'heart' ? '+' : 'G';
        const backingColor = resource.type === 'heart' ? '#74314a' : '#6b4d20';

        const backingRect = insetRect(iconRect, -Math.max(2, size * 0.08));
        const effectId = resource.type === 'heart' ? 'effect_heart_heal' : 'effect_gold_pickup';

        if (!drawArtImage(ui, artTextures, effectId, backingRect, {
            alpha: occupied ? 0.56 : 0.48,
            fit: 'stretch',
            required: true,
        })) {
            ui.drawRect(backingRect, backingColor, occupied ? 0.72 : 0.56);
        }

        if (!drawArtImage(ui, artTextures, assetId, iconRect, {
            alpha: occupied ? 0.92 : 1,
            required: true,
        })) {
            ui.drawText(fallback, x + size / 2, y + size * 0.18, {
                align: 'center',
                size: Math.max(13, size * 0.58),
                color: resource.type === 'heart' ? '#ffd4d8' : '#f3d991',
                weight: 700,
            });
        }
    });
}

function drawAttackRow(ui, rect, color, attack, result, settings) {
    const handSubmitEconomy = usesHandSubmitEconomy(settings);
    const compact = rect.width < 270;
    const tight = rect.height < 62;
    const titleY = rect.y + (tight ? 7 : 9);
    const detailY = rect.y + (tight ? 28 : 29);
    const outcomeY = rect.y + (tight ? 44 : 49);
    const promptY = rect.y + (tight ? 32 : 34);

    ui.drawRect(rect, '#132334', 0.96);
    ui.drawRect({ x: rect.x, y: rect.y, width: 6, height: rect.height }, getColorHex(color, settings), 1);
    ui.drawText(getColorLabel(color, settings), rect.x + 18, titleY, {
        size: 16,
        color: '#ecf6ff',
        maxWidth: rect.width * 0.45,
    });
    ui.drawText(handSubmitEconomy ? 'Захват' : `Атака ${formatHearts(attack[color] ?? 0)}`, rect.x + rect.width - (compact ? 92 : 124), titleY, {
        size: 15,
        color: '#afc4d7',
        maxWidth: compact ? 84 : 116,
    });

    if (!result) {
        const prompt = compact
            ? handSubmitEconomy ? 'Замкни границу' : 'Ждет захвата'
            : handSubmitEconomy ? 'Замкни границу, чтобы ударить' : 'Ждет твоего захвата';
        ui.drawText(prompt, rect.x + 18, promptY, {
            size: 14,
            color: '#7f9aad',
            maxWidth: rect.width - 34,
        });
        return;
    }

    const colorResult = result.byColor[color];
    const areaByColor = getCaptureAreaByColor(result);
    const bonusByColor = getCaptureBonusByColor(result);
    const outcomeLabel = handSubmitEconomy
        ? `Бонус ${formatHearts(bonusByColor[color])}  |  Монстру ${formatHeartDelta(colorResult.enemyDamage)}`
        : colorResult.enemyDamage > 0
            ? `Бонус ${formatHearts(bonusByColor[color])}  |  Врагу ${formatHeartDelta(colorResult.enemyDamage)}`
            : `Бонус ${formatHearts(bonusByColor[color])}  |  Игроку ${formatHeartDelta(colorResult.playerDamage)}`;
    const outcomeColor = handSubmitEconomy || colorResult.enemyDamage > 0 ? '#c9ffd9' : '#ffd0d7';

    const multiplier = result.score.zones.find((zone) => zone.color === color)?.multiplier ?? 1;
    ui.drawText(`Площадь ${areaByColor[color]}  |  Удар ${formatHearts(colorResult.closedDamage)}  |  x${multiplier}`, rect.x + 18, detailY, {
        size: 14,
        color: '#d8e7f2',
        maxWidth: rect.width - 34,
    });
    ui.drawText(outcomeLabel, rect.x + 18, outcomeY, {
        size: 14,
        color: outcomeColor,
        maxWidth: rect.width - 34,
    });
}

function drawBattlePanelSurface(ui, artTextures, rect, isUrgent = false) {
    if (!drawArtImage(ui, artTextures, 'panel_dark', rect, {
        alpha: isUrgent ? 0.96 : 0.92,
        fit: 'stretch',
        required: true,
    })) {
        drawFramedPanel(ui, rect, {
            urgent: isUrgent,
            accent: isUrgent ? '#d78486' : '#d6a25c',
        });
        return;
    }

    const accent = isUrgent ? '#d78486' : '#d6a25c';
    drawBorder(ui, rect, '#1c130f', 4, 0.9);
    drawBorder(ui, insetRect(rect, 7), accent, 2, isUrgent ? 0.54 : 0.48);
    drawCornerBrackets(ui, rect, accent, {
        inset: 7,
        length: 28,
        thickness: 4,
        alpha: isUrgent ? 0.72 : 0.62,
    });
}

function drawBoard(ui, layout, settings, state, mouse, tileTextures, artTextures) {
    const selectedTile = state.hand[state.selectedHandIndex];
    const canShowPlacementHints = state.phase === 'placing'
        && !state.outcome
        && Boolean(selectedTile);

    for (let y = 0; y < settings.boardSize; y += 1) {
        for (let x = 0; x < settings.boardSize; x += 1) {
            const rect = {
                x: layout.board.x + x * layout.cellSize,
                y: layout.board.y + y * layout.cellSize,
                width: layout.cellSize,
                height: layout.cellSize,
            };
            const isHovered = ui.contains(rect, mouse);
            const isEmpty = !state.board[y][x];
            const isValid = canShowPlacementHints
                && canPlaceTile(state.board, selectedTile, x, y, settings);
            const isUnavailable = canShowPlacementHints
                && isEmpty
                && !isValid;
            const isInvalidHovered = canShowPlacementHints
                && isHovered
                && !isValid;
            const fill = isValid
                ? isHovered ? '#31566b' : '#203748'
                : '#162432';
            const border = isValid
                ? isHovered ? '#9de7ff' : '#4f93b2'
                : '#24394c';

            const cellAssetId = isHovered
                ? isInvalidHovered ? 'board_cell_invalid' : 'board_cell_hover'
                : isValid ? 'board_cell_valid'
                : isUnavailable ? 'board_cell_invalid'
                : 'board_cell_empty';
            if (!drawArtImage(ui, artTextures, cellAssetId, rect, {
                alpha: isUnavailable && !isHovered ? 0.82 : 1,
                required: true,
            })) {
                ui.drawRect(rect, fill, 1);
                drawBorder(ui, rect, isUnavailable ? '#a84c5c' : border, isHovered && isValid ? 3 : 1, isUnavailable ? 0.95 : isValid ? 1 : 0.7);
            }
            const resources = getBoardResourcesAt(state, x, y);
            if (isEmpty && resources.length > 0) {
                drawFieldResources(ui, artTextures, rect, resources, false);
            }
            drawTile(ui, state.board[y][x], insetRect(rect, 5), {
                oneColorLand: isOneColorLandVariant(settings),
                tileTextures,
            });
            if (!isEmpty && resources.length > 0) {
                drawFieldResources(ui, artTextures, rect, resources, true);
            }

        }
    }

    if (state.lastResult) {
        const microSize = layout.cellSize / 3;
        for (const zone of state.lastResult.score.zones) {
            for (const cell of zone.interiorCells) {
                drawZoneFilledCell(ui, {
                    x: layout.board.x + cell.x * microSize,
                    y: layout.board.y + cell.y * microSize,
                    width: microSize,
                    height: microSize,
                }, zone.color, settings);
            }
            drawZoneFilledSeal(ui, artTextures, layout, microSize, zone, settings);
        }
    }

    for (let y = 0; y < settings.boardSize; y += 1) {
        for (let x = 0; x < settings.boardSize; x += 1) {
            const rect = {
                x: layout.board.x + x * layout.cellSize,
                y: layout.board.y + y * layout.cellSize,
                width: layout.cellSize,
                height: layout.cellSize,
            };
            const isHovered = ui.contains(rect, mouse);
            const isEmpty = !state.board[y][x];
            const isValid = canShowPlacementHints
                && canPlaceTile(state.board, selectedTile, x, y, settings);
            const isUnavailable = canShowPlacementHints
                && isEmpty
                && !isValid;

            if (isEmpty && isValid) {
                drawPlacementHint(ui, rect, {
                    valid: true,
                    hovered: isHovered,
                    artTextures,
                });
            } else if (isUnavailable) {
                drawPlacementHint(ui, rect, {
                    valid: false,
                    hovered: isHovered,
                    artTextures,
                });
            }

            if (isEmpty && isValid && isHovered) {
                drawPlacementPreviewOnBoard(ui, layout, selectedTile, x, y, settings, tileTextures);
            }

            const targets = state.connectTargets;
            const isTargetA = targets?.a.x === x && targets?.a.y === y;
            const isTargetB = targets?.b.x === x && targets?.b.y === y;

            if (isTargetA || isTargetB) {
                const targetColor = targets.connected ? '#c9ffd9' : '#f3d991';
                const label = isRoadModeVariant(settings)
                    ? isTargetA ? 'S' : 'E'
                    : isTargetA ? 'A' : 'B';
                const overlayId = isRoadModeVariant(settings)
                    ? isTargetA ? 'overlay_gate_start' : 'overlay_gate_end'
                    : isTargetA ? 'overlay_target_a' : 'overlay_target_b';
                drawArtImage(ui, artTextures, overlayId, insetRect(rect, 4), {
                    alpha: 0.88,
                    required: true,
                });
                drawBorder(ui, insetRect(rect, 4), targetColor, 2, 0.86);
                ui.drawText(label, rect.x + rect.width / 2, rect.y + rect.height / 2 - 13, {
                    align: 'center',
                    size: 26,
                    color: targetColor,
                });
            }
        }
    }
}

function drawHand(ui, layout, settings, state, mouse, tileTextures, artTextures) {
    const isQueue = isQueueDrawMode(settings);

    layout.hand.forEach((rect, index) => {
        const tileDef = state.hand[index];
        const hovered = ui.contains(rect, mouse);
        const selected = index === state.selectedHandIndex && tileDef;
        const label = isQueue
            ? index === 0 ? 'Текущий' : 'Следующий'
            : null;

        ui.drawRect(rect, hovered && (!isQueue || index === 0) ? '#263d4f' : '#182838', tileDef ? 1 : 0.45);
        drawArtImage(
            ui,
            artTextures,
            selected ? 'slot_hand_selected' : hovered ? 'slot_hand_hover' : 'slot_hand_empty',
            rect,
            {
                alpha: tileDef ? 1 : 0.78,
                required: true,
            },
        );
        drawBorder(ui, rect, selected ? '#f6f0a8' : '#38536a', selected ? 4 : 2, selected ? 1 : 0.8);
        drawTile(ui, tileDef, insetRect(rect, 8), {
            oneColorLand: isOneColorLandVariant(settings),
            tileTextures,
        });

        if (label) {
            const labelX = layout.mode === 'portrait' ? rect.x + rect.width / 2 : rect.x;
            const labelY = layout.mode === 'portrait' ? rect.y + rect.height - 18 : rect.y - 24;

            ui.drawText(label, labelX, labelY, {
                align: layout.mode === 'portrait' ? 'center' : 'left',
                size: layout.mode === 'portrait' ? 12 : index === 0 ? 16 : 14,
                color: index === 0 ? '#f6f0a8' : '#8fb1cb',
            });
        }
    });
}

function drawHold(ui, layout, settings, state, mouse, tileTextures, artTextures) {
    if (!layout.hold) {
        return;
    }

    const rect = layout.hold;
    const hovered = ui.contains(rect, mouse);
    const tileDef = state.heldTile;

    ui.drawRect(rect, hovered ? '#263d4f' : '#182838', tileDef ? 1 : 0.5);
    drawArtImage(
        ui,
        artTextures,
        tileDef ? 'slot_hold_filled' : 'slot_hold_empty',
        rect,
        {
            alpha: hovered ? 1 : 0.82,
            required: true,
        },
    );
    drawBorder(ui, rect, tileDef ? '#f3d991' : '#38536a', tileDef ? 3 : 2, tileDef ? 1 : 0.8);
    drawTile(ui, tileDef, insetRect(rect, 8), {
        oneColorLand: isOneColorLandVariant(settings),
        tileTextures,
    });
    if (!tileDef) {
        const iconSize = Math.max(20, Math.min(30, rect.width * 0.34));
        drawIconText(
            ui,
            artTextures,
            'icon_hold',
            rect.x + rect.width / 2 - iconSize / 2,
            rect.y + rect.height / 2 - iconSize / 2,
            iconSize,
            '',
            {
                fallback: 'H',
                fallbackColor: '#8fb1cb',
                iconAlpha: 0.9,
            },
        );
    }
    if (layout.mode === 'portrait') {
        ui.drawText('Запас', rect.x + rect.width / 2, rect.y + rect.height - 18, {
            align: 'center',
            size: 12,
            color: tileDef ? '#f3d991' : '#8fb1cb',
        });
    } else {
        ui.drawText('Запас', rect.x, rect.y - 24, {
            size: 14,
            color: tileDef ? '#f3d991' : '#8fb1cb',
        });
    }
}

function drawSidePanel(ui, layout, battle, run, settings, state, artTextures) {
    if (!layout.sidePanel) {
        return;
    }

    const panel = layout.sidePanel;
    const attack = getRoundAttack(battle, state.round, settings);
    const deck = getRunDeckStats(run);
    const variant = getGameplayVariant(settings);
    const visibleColors = getVisibleCombatColors(settings);
    const handSubmitEconomy = usesHandSubmitEconomy(settings);
    const submitCostPreview = handSubmitEconomy
        ? getHandSubmitCostPreview(state, settings)
        : null;
    const totalCaptureArea = state.lastResult
        ? state.lastResult.score.zones.reduce((sum, zone) => sum + zone.area, 0)
        : 0;

    drawBattlePanelSurface(
        ui,
        artTextures,
        panel,
        state.outcome === 'defeat' || (submitCostPreview?.canPay === false),
    );
    const compact = panel.width < 330;
    const monsterIconSize = compact ? 48 : 54;
    const monsterIconId = getBattleAssetId('monster_icon', battle);
    const headerTextX = panel.x + 18 + monsterIconSize + 12;
    const sectionTitleY = panel.y + 176;
    const attackRowHeight = visibleColors.length >= 3 ? 52 : 58;
    const attackRowStep = attackRowHeight + 6;
    const attackRowsY = panel.y + 198;
    const attackRowsBottom = attackRowsY
        + Math.max(0, visibleColors.length - 1) * attackRowStep
        + attackRowHeight;
    const lowerBlockY = attackRowsBottom + 14;
    const summaryLineGap = 20;
    const submitBlockY = handSubmitEconomy
        ? Math.min(panel.y + panel.height - 44, state.lastResult ? lowerBlockY + 44 : attackRowsBottom + 18)
        : panel.y + panel.height - 44;
    const logBlockY = submitBlockY + 22;
    const textWidth = panel.width - 36;

    ui.drawRect({
        x: panel.x + 18,
        y: panel.y + 16,
        width: monsterIconSize,
        height: monsterIconSize,
    }, '#132334', 0.72);
    drawArtImage(ui, artTextures, monsterIconId, {
        x: panel.x + 18,
        y: panel.y + 16,
        width: monsterIconSize,
        height: monsterIconSize,
    }, {
        required: true,
    });
    drawBorder(ui, {
        x: panel.x + 18,
        y: panel.y + 16,
        width: monsterIconSize,
        height: monsterIconSize,
    }, '#f3d991', 1, 0.8);
    ui.drawText(getMonsterName(battle), headerTextX, panel.y + 18, {
        size: compact ? 20 : 24,
        color: '#ffffff',
        maxWidth: panel.x + panel.width - headerTextX - 18,
    });
    ui.drawText(`Раунд ${state.round} · ${variant.shortLabel}`, headerTextX, panel.y + 52, {
        size: compact ? 16 : 17,
        color: '#9fb8ca',
        maxWidth: panel.x + panel.width - headerTextX - 18,
    });
    drawIconText(ui, artTextures, 'icon_heart_full', panel.x + 18, panel.y + 88, 21, `Игрок ${state.playerHp}`, {
        fallback: '♥',
        textSize: 18,
        color: '#c8f7dd',
    });
    drawIconText(ui, artTextures, 'icon_heart_lost', panel.x + 18, panel.y + 118, 21, `Монстр ${state.enemyHp}`, {
        fallback: '♥',
        textSize: 18,
        color: '#ffd4d8',
    });
    drawIconText(ui, artTextures, 'icon_gold', panel.x + 18, panel.y + 146, 17, String(run.gold ?? 0), {
        fallback: 'G',
        textSize: 16,
        color: '#f3d991',
    });
    drawIconText(ui, artTextures, 'icon_deck', panel.x + 88, panel.y + 146, 17, String(deck.drawPile), {
        fallback: 'D',
        textSize: 15,
        color: '#8fb1cb',
    });
    drawIconText(ui, artTextures, 'icon_discard', panel.x + 150, panel.y + 146, 17, String(deck.discardPile), {
        fallback: 'X',
        textSize: 15,
        color: '#8fb1cb',
    });
    if ((state.strikeCount ?? 0) > 0) {
        drawIconText(ui, artTextures, 'icon_strike', panel.x + panel.width - 70, panel.y + 146, 17, state.strikeCount, {
            fallback: '*',
            textSize: 15,
            color: '#f3d991',
        });
    }
    if (isQueueDrawMode(settings)) {
        ui.drawText(`Queue ${state.queuePlayedThisRound} / ${settings.handSize}`, panel.x + panel.width - 112, panel.y + 52, {
            size: 15,
            color: '#f6f0a8',
            maxWidth: 96,
        });
    }
    if (isPlacementPayoffVariant(settings)) {
        ui.drawText(`Focus ${state.placementFocus ?? 0}/${getPlacementFocusMax(settings)}`, panel.x + panel.width - 112, panel.y + 166, {
            size: 15,
            color: '#f3d991',
            maxWidth: 96,
        });
    }
    if (isOneColorChainVariant(settings)) {
        ui.drawText(`Chain x${state.chainMeter ?? 0}/${getOneColorChainMax(settings)}`, panel.x + panel.width - 118, panel.y + 166, {
            size: 15,
            color: '#f3d991',
            maxWidth: 104,
        });
    }
    if (isConnectTargetsVariant(settings) && state.connectTargets) {
        const targetStatus = state.connectTargets.connected
            ? `Targets +${settings.connectTargets?.bonusDamage ?? 30}`
            : `Targets ${state.connectTargets.distance}`;
        ui.drawText(targetStatus, panel.x + panel.width - 128, panel.y + 166, {
            size: 15,
            color: state.connectTargets.connected ? '#c9ffd9' : '#f3d991',
            maxWidth: 112,
        });
    }
    if (isRoadModeVariant(settings) && state.connectTargets) {
        const roadStatus = state.connectTargets.connected
            ? `Road +${state.lastResult?.roadDamage ?? 0}`
            : `Road ${state.connectTargets.distance}`;
        ui.drawText(roadStatus, panel.x + panel.width - 128, panel.y + 166, {
            size: 15,
            color: state.connectTargets.connected ? '#c9ffd9' : '#f3d991',
            maxWidth: 112,
        });
    }

    ui.drawText(handSubmitEconomy
        ? state.lastResult ? 'Последний захват' : 'Цель хода'
        : state.lastResult ? 'Итог раунда' : 'Атаки врага', panel.x + 18, sectionTitleY, {
        size: 16,
        color: '#8fb1cb',
        maxWidth: textWidth,
    });

    visibleColors.forEach((color, index) => {
        drawAttackRow(ui, {
            x: panel.x + 16,
            y: attackRowsY + index * attackRowStep,
            width: panel.width - 32,
            height: attackRowHeight,
        }, color, attack, state.lastResult, settings);
    });

    if (state.lastResult) {
        const zones = state.lastResult.score.zones.length;
        const totalBonus = state.lastResult.score.zones.reduce((sum, zone) => (
            sum + (zone.areaBonus ?? 0)
                + (zone.grayBonus ?? 0)
                + (zone.focusBonus ?? 0)
                + (zone.chainBonus ?? 0)
        ), 0) + (state.lastResult.connectTargetBonus ?? 0) + (state.lastResult.roadDamage ?? 0);
        const summary = isRoadModeVariant(settings)
            ? `Дорога ${state.lastResult.roadLength ?? 0}  |  Лишних +${state.lastResult.roadExtraLength ?? 0}  |  Урон +${state.lastResult.roadDamage ?? 0}`
            : handSubmitEconomy
                ? `Зон ${zones}  |  Золото +${state.lastResult.goldEarned ?? 0}  |  Strike x${state.lastResult.strikeCount ?? 0}`
                : `Зон ${zones}  |  Площадь ${totalCaptureArea}  |  Бонус +${totalBonus}`;
        ui.drawText(summary, panel.x + 18, lowerBlockY, {
            size: 15,
            color: '#d8e7f2',
            maxWidth: textWidth,
        });
        ui.drawText(handSubmitEconomy
            ? `Монстру ${formatHeartDelta(state.lastResult.enemyDamage)}  |  Игроку 0`
            : `Монстру ${formatHeartDelta(state.lastResult.enemyDamage)}  |  Игроку ${formatHeartDelta(state.lastResult.playerDamage)}`, panel.x + 18, lowerBlockY + summaryLineGap, {
            size: 15,
            color: state.lastResult.playerDamage > 0 ? '#ffd0d7' : '#c9ffd9',
            maxWidth: textWidth,
        });
        if (!handSubmitEconomy && !state.outcome && (state.lastResult.newPickDamage?.totalDamage ?? 0) > 0) {
            const pickDamage = state.lastResult.newPickDamage;
            ui.drawText(`Новый пик ${formatHeartDelta(pickDamage.totalDamage)}: база ${formatHearts(pickDamage.baseDamage)}, невыставлено ${pickDamage.unplayedTiles}`, panel.x + 18, lowerBlockY + summaryLineGap * 2, {
                size: 15,
                color: pickDamage.totalDamage > 0 ? '#ffd0d7' : '#c9ffd9',
                maxWidth: textWidth,
            });
        }
    }

    if (handSubmitEconomy) {
        const submitCost = submitCostPreview;
        const lockText = submitCost.canPay ? '' : ' · последний шанс';
        ui.drawText(`Сдать руку ${formatHeartDelta(submitCost.totalDamage)}: карт ${submitCost.unplayedHandCards}, сдач ${submitCost.handSubmitsThisBattle}${lockText}`, panel.x + 18, submitBlockY, {
            size: 15,
            color: submitCost.canPay ? '#ffd0d7' : '#ff8b9c',
            maxWidth: textWidth,
        });

        const maxLogRows = Math.max(0, Math.floor((panel.y + panel.height - logBlockY - 14) / 18));
        if (maxLogRows > 0) {
            (state.battleLog ?? []).slice(-maxLogRows).forEach((entry, index) => {
                ui.drawText(entry, panel.x + 18, logBlockY + index * 18, {
                    size: 13,
                    color: '#9fb8ca',
                    maxWidth: textWidth,
                });
            });
        }
    }
}

function getCompactBattleLine(battle, state, settings) {
    const variant = getGameplayVariant(settings);

    return `${getMonsterName(battle)} · Раунд ${state.round} · ${variant.shortLabel}`;
}

function drawPortraitBattleHud(ui, artTextures, hud, run, state) {
    drawOrnatePanelFrame(ui, artTextures, hud, {
        panelAlpha: 0.94,
        inset: 5,
        bracketLength: 26,
        bracketThickness: 3,
        innerAlpha: 0.52,
    });

    ui.drawText(`Б${run.currentBattle}/${run.totalBattles}`, hud.x + 13, hud.y + 11, {
        size: 17,
        color: '#fff2ca',
        weight: 800,
        maxWidth: 58,
    });

    drawHudPips(ui, artTextures, {
        assetId: 'icon_heart_full',
        x: hud.x + hud.width * 0.24,
        y: hud.y + 11,
        value: state.playerHp,
        maxPips: 2,
        size: 18,
        color: '#c8f7dd',
        fallback: '♥',
    });
    drawHudPips(ui, artTextures, {
        assetId: 'icon_heart_lost',
        x: hud.x + hud.width * 0.51,
        y: hud.y + 11,
        value: state.enemyHp,
        maxPips: 2,
        size: 18,
        color: '#ffd4d8',
        fallback: '♥',
    });
    drawIconText(ui, artTextures, 'icon_gold', hud.x + hud.width - 61, hud.y + 11, 18, String(run.gold ?? 0), {
        fallback: 'G',
        textSize: 16,
        color: '#f3d991',
        weight: 800,
    });
}

function drawBattleHeader(ui, layout, run, battle, settings, state, artTextures) {
    if (layout.mode === 'portrait') {
        const hud = layout.hud;
        const banner = layout.monsterBanner;
        const compactBanner = banner.height < 56;

        const backdropId = getBattleAssetId('level_backdrop', battle);
        const portraitId = getBattleAssetId('monster_portrait', battle);
        if (drawArtImage(ui, artTextures, backdropId, banner, {
            alpha: 0.94,
            fit: 'cover',
            required: true,
        })) {
            ui.drawRect(banner, '#03070c', 0.18);
        } else if (!drawArtImage(ui, artTextures, 'panel_dark', banner, {
            alpha: 0.9,
            fit: 'stretch',
            required: true,
        })) {
            ui.drawRect(banner, '#132334', 0.94);
        }

        drawArtImage(ui, artTextures, portraitId, {
            x: banner.x + banner.width * (compactBanner ? 0.58 : 0.46),
            y: banner.y - banner.height * (compactBanner ? 0.03 : 0.25),
            width: banner.width * (compactBanner ? 0.36 : 0.6),
            height: banner.height * (compactBanner ? 1.06 : 1.42),
        }, {
            alpha: compactBanner ? 0.7 : 0.94,
            fit: 'contain',
            required: true,
        });
        ui.drawRect({
            x: banner.x,
            y: banner.y,
            width: banner.width * 0.68,
            height: banner.height,
        }, '#03070c', 0.22);
        drawBorder(ui, banner, '#1c130f', 3, 0.88);
        drawBorder(ui, insetRect(banner, 7), '#d6a25c', 1, 0.58);
        drawCornerBrackets(ui, banner, '#d6a25c', {
            inset: 7,
            length: compactBanner ? 22 : 34,
            thickness: 3,
            alpha: 0.76,
        });

        const titleX = banner.x + 18;
        const titleY = compactBanner
            ? banner.y + Math.max(9, banner.height * 0.24)
            : banner.y + Math.max(14, banner.height * 0.22);
        const iconSize = compactBanner ? 20 : Math.min(36, banner.height * 0.34);
        drawIconText(
            ui,
            artTextures,
            getBattleAssetId('monster_icon', battle),
            titleX,
            titleY - (compactBanner ? 1 : 2),
            iconSize,
            '',
            {
                fallback: 'M',
                fallbackColor: '#f3d991',
            },
        );
        ui.drawText(getMonsterName(battle), titleX + (compactBanner ? 28 : 44), titleY, {
            size: compactBanner ? 16 : 20,
            color: '#fff2ca',
            weight: 800,
            maxWidth: banner.width * (compactBanner ? 0.46 : 0.48),
        });
        if (!compactBanner) {
            ui.drawText(`Раунд ${state.round} · ${getGameplayVariant(settings).shortLabel}`, titleX + 44, titleY + 28, {
                size: 14,
                color: '#d7c59e',
                maxWidth: banner.width * 0.44,
            });
            drawHudPips(ui, artTextures, {
                assetId: 'icon_heart_lost',
                x: titleX,
                y: banner.y + banner.height - 33,
                value: state.enemyHp,
                maxPips: 4,
                size: 19,
                color: '#ffd4d8',
                fallback: '♥',
                text: '',
            });
            drawMonsterThreatBar(ui, {
                x: titleX,
                y: banner.y + banner.height - 12,
                width: Math.min(190, banner.width * 0.54),
                height: 7,
            }, state.enemyHp, battle.enemyHp);

            drawDiamondProgress(ui, {
                x: banner.x + banner.width * 0.34,
                y: banner.y + 10,
                width: banner.width * 0.32,
                height: 18,
            }, run.currentBattle, run.totalBattles);
        }

        drawPortraitBattleHud(ui, artTextures, hud, run, state);
        return;
    }

    const screen = layout.viewport?.screen ?? {
        width: layout.hud.x + layout.hud.width + 16,
        height: layout.hud.y + layout.hud.height + 16,
    };
    const hud = {
        x: 12,
        y: 10,
        width: screen.width - 24,
        height: 72,
    };
    const deck = getRunDeckStats(run);

    drawOrnatePanelFrame(ui, artTextures, hud, {
        panelAlpha: 0.92,
        inset: 7,
        bracketLength: 34,
        bracketThickness: 3,
        innerAlpha: 0.5,
    });
    drawIconText(ui, artTextures, 'icon_multiplier', hud.x + 24, hud.y + 18, 34, '', {
        fallback: '*',
        fallbackColor: '#f3d991',
    });
    drawHudPips(ui, artTextures, {
        assetId: 'icon_heart_full',
        x: hud.x + 78,
        y: hud.y + 20,
        value: state.playerHp,
        maxPips: 5,
        size: 23,
        color: '#c8f7dd',
        fallback: '♥',
    });
    drawIconText(ui, artTextures, 'icon_gold', hud.x + Math.min(360, hud.width * 0.28), hud.y + 22, 22, String(run.gold ?? 0), {
        fallback: 'G',
        textSize: 20,
        color: '#f3d991',
        weight: 800,
    });
    drawIconText(ui, artTextures, 'icon_deck', hud.x + Math.min(470, hud.width * 0.37), hud.y + 22, 22, String(deck.drawPile), {
        fallback: 'D',
        textSize: 18,
        color: '#9fb8ca',
    });
    ui.drawText(`Битва ${run.currentBattle}/${run.totalBattles}`, hud.x + hud.width / 2, hud.y + 17, {
        align: 'center',
        size: 20,
        color: '#fff2ca',
        weight: 800,
        maxWidth: 210,
    });
    drawDiamondProgress(ui, {
        x: hud.x + hud.width / 2 - 120,
        y: hud.y + 44,
        width: 240,
        height: 18,
    }, run.currentBattle, run.totalBattles);
    drawHudPips(ui, artTextures, {
        assetId: 'icon_heart_lost',
        x: hud.x + hud.width - 365,
        y: hud.y + 20,
        value: state.enemyHp,
        maxPips: 5,
        size: 23,
        color: '#ffd4d8',
        fallback: '♥',
    });
    drawIconText(
        ui,
        artTextures,
        getBattleAssetId('monster_icon', battle),
        hud.x + hud.width - 180,
        hud.y + 16,
        36,
        getMonsterName(battle),
        {
            fallback: 'M',
            textSize: 18,
            color: '#fff2ca',
            gap: 9,
            maxWidth: 124,
        },
    );
    ui.drawText(`Раунд ${state.round} · ${getGameplayVariant(settings).shortLabel}`, hud.x + hud.width - 135, hud.y + 47, {
        size: 13,
        color: '#d7c59e',
        maxWidth: 122,
    });

    const subtitle = usesHandSubmitEconomy(settings)
        ? 'Замыкай печати: закрытие бьет монстра, сдача руки стоит сердца'
        : isRoadModeVariant(settings)
            ? 'Проведи дорогу от S к E и перебей атаки'
            : 'Собери замкнутую цветную границу и перебей атаки';
    ui.drawText(subtitle, 28, hud.y + hud.height + 12, {
        size: 15,
        color: '#98b4c8',
        maxWidth: Math.min(720, screen.width - 56),
    });
}

function getFeedbackType(state, settings) {
    if (state.outcome === 'victory') {
        return BATTLE_UI_STATES.victory;
    }

    if (state.outcome === 'defeat') {
        return BATTLE_UI_STATES.defeat;
    }

    if (state.feedback?.startsWith('Нельзя')) {
        return BATTLE_UI_STATES.invalidPlacement;
    }

    if ((state.lastPlacementClosedZones ?? 0) > 0) {
        return BATTLE_UI_STATES.closureScored;
    }

    if (usesHandSubmitEconomy(settings) && state.lastSubmitResult?.submitted) {
        return BATTLE_UI_STATES.submitPaid;
    }

    if (usesHandSubmitEconomy(settings) && !getHandSubmitCostPreview(state, settings).canPay) {
        return state.handSubmitLocked
            ? BATTLE_UI_STATES.lastChanceHand
            : BATTLE_UI_STATES.submitBlocked;
    }

    if (state.hand[state.selectedHandIndex]) {
        return BATTLE_UI_STATES.cardSelected;
    }

    return BATTLE_UI_STATES.placing;
}

function getBattleUiState(state, settings) {
    return {
        primary: getFeedbackType(state, settings),
        placement: state.phase === 'placing' && !state.outcome
            ? BATTLE_UI_STATES.placing
            : state.phase,
        selected: state.hand[state.selectedHandIndex]
            ? BATTLE_UI_STATES.cardSelected
            : null,
        hold: state.heldTile
            ? BATTLE_UI_STATES.holdFilled
            : BATTLE_UI_STATES.holdEmpty,
        canSubmit: !usesHandSubmitEconomy(settings)
            || getHandSubmitCostPreview(state, settings).canPay,
        submitLocked: state.handSubmitLocked ?? false,
    };
}

function drawPortraitFeedback(ui, artTextures, layout, settings, state) {
    if (layout.mode !== 'portrait') {
        if (state.feedback) {
            ui.drawText(state.feedback, layout.board.x, layout.hand[0].y - 34, {
                size: 16,
                color: '#f3d991',
                maxWidth: layout.board.width,
            });
        }
        return;
    }

    const feedback = layout.feedback;
    const log = layout.log;
    const submitCost = usesHandSubmitEconomy(settings)
        ? getHandSubmitCostPreview(state, settings)
        : null;
    const fallback = state.outcome === 'victory'
        ? 'Победа'
        : state.outcome === 'defeat'
            ? 'Поражение'
            : submitCost
                ? submitCost.canPay
                    ? `Сдать руку ${formatHeartDelta(submitCost.totalDamage)} · карт ${submitCost.unplayedHandCards}`
                    : `Последний шанс: сдача руки недоступна (${formatHeartDelta(submitCost.totalDamage)})`
                : 'Ход';
    const isUrgent = state.feedback?.startsWith('Нельзя')
        || submitCost?.canPay === false
        || state.outcome === 'defeat';

    if (!drawArtImage(ui, artTextures, 'panel_dark', feedback, {
        alpha: 0.48,
        fit: 'stretch',
        required: true,
    })) {
        ui.drawRect(feedback, '#101c2a', 0.36);
    }
    drawBorder(ui, feedback, isUrgent ? '#d78486' : '#7d5a34', 1, isUrgent ? 0.82 : 0.55);
    ui.drawText(state.feedback ?? fallback, feedback.x + 10, feedback.y + 8, {
        size: 14,
        color: isUrgent ? '#ffb4c0' : '#f3d991',
        maxWidth: feedback.width - 20,
    });

    if (!drawArtImage(ui, artTextures, 'panel_dark', log, {
        alpha: 0.42,
        fit: 'stretch',
        required: true,
    })) {
        ui.drawRect(log, '#0d1824', 0.42);
    }
    drawBorder(ui, log, '#7d5a34', 1, 0.45);
    const latestLog = (state.battleLog ?? []).slice(-2);
    const lines = latestLog.length > 0
        ? latestLog
        : state.lastResult
            ? [`Монстру ${formatHeartDelta(state.lastResult.enemyDamage)} · золото +${state.lastResult.goldEarned ?? 0}`]
            : ['Событий пока нет'];

    lines.slice(0, 2).forEach((entry, index) => {
        ui.drawText(entry, log.x + 10, log.y + 6 + index * 18, {
            size: 12,
            color: index === 0 ? '#bfd2df' : '#8fb1cb',
            maxWidth: log.width - 20,
        });
    });
}

function getButtonLabel(state, settings) {
    if (state.outcome) {
        return 'К результату битвы';
    }

    if (state.phase === 'placing') {
        if (usesHandSubmitEconomy(settings)) {
            const submitCost = getHandSubmitCostPreview(state, settings);
            return submitCost.canPay
                ? `Сдать руку (${formatHeartDelta(submitCost.totalDamage)})`
                : `Сдать руку (${formatHeartDelta(submitCost.totalDamage)} не хватит)`;
        }

        return 'Закончить раунд';
    }

    if ((state.lastResult?.newPickDamage?.totalDamage ?? 0) > 0) {
        return `Новый пик (${formatHeartDelta(state.lastResult.newPickDamage.totalDamage)})`;
    }

    return 'Новый раунд';
}

function getPrimaryButtonOptions(state, settings, layout, mouse = null) {
    const submitBlocked = usesHandSubmitEconomy(settings)
        && state.phase === 'placing'
        && !state.outcome
        && !getHandSubmitCostPreview(state, settings).canPay;
    const showSubmitIcon = usesHandSubmitEconomy(settings)
        && state.phase === 'placing'
        && !state.outcome;

    return {
        mouse,
        disabled: submitBlocked,
        color: submitBlocked
            ? '#2b323a'
            : state.phase === 'placing' && !state.outcome ? '#243f54' : '#1f4b3c',
        hoverColor: submitBlocked
            ? '#3a434d'
            : state.phase === 'placing' && !state.outcome ? '#66c7f4' : '#69d29d',
        edgeColor: submitBlocked ? '#5b6872' : '#9fdfff',
        textSize: layout.mode === 'portrait' ? 18 : 20,
        iconAssetId: showSubmitIcon ? submitBlocked ? 'icon_lock' : 'icon_submit' : null,
        iconSize: layout.mode === 'portrait' ? 24 : 26,
        iconFallback: submitBlocked ? '!' : '>',
        iconFallbackColor: submitBlocked ? '#ff8b9c' : '#d8e7f2',
        iconWellColor: submitBlocked ? '#25282e' : '#4b1a1a',
        iconWellEdgeColor: submitBlocked ? '#66666a' : '#d78486',
    };
}

function getPrimaryButtonContentDebug(layout, state, settings) {
    const options = getPrimaryButtonOptions(state, settings, layout);
    const content = getArtButtonContentRects(layout.endRoundButton, options);

    return {
        label: getButtonLabel(state, settings),
        disabled: options.disabled,
        iconAssetId: options.iconAssetId,
        iconRect: content.iconRect,
        iconWell: content.iconWell,
        labelRect: content.labelRect,
    };
}

function getClosureArea(result) {
    return result?.score?.zones?.reduce((sum, zone) => sum + (zone.area ?? 0), 0) ?? 0;
}

function getPlacedFeedback(state, settings) {
    if (usesHandSubmitEconomy(settings)) {
        if (state.outcome === 'defeat') {
            return 'Сердец на новую руку не хватает: поражение';
        }

        if ((state.lastPlacementClosedZones ?? 0) > 0) {
            const heal = state.lastResult?.heartHeal ?? 0;
            const fieldGold = state.lastResult?.fieldGold ?? 0;
            const strikeGold = state.lastResult?.strikeGold ?? 0;
            const area = getClosureArea(state.lastResult);
            const extras = [
                fieldGold > 0 ? `поле +${fieldGold}` : null,
                heal > 0 ? `сердца +${heal}` : null,
                strikeGold > 0 ? `strike +${strikeGold}` : null,
            ].filter(Boolean);
            const extraText = extras.length > 0 ? ` · ${extras.join(', ')}` : '';
            return `Печать закрыта: площадь ${area}, монстру ${formatHeartDelta(state.lastResult?.enemyDamage ?? 0)}, золото +${state.lastResult?.goldEarned ?? 0}${extraText}`;
        }

        if ((state.lastPlacementResourceResult?.goldAmount ?? state.lastPlacementResourceResult?.amount ?? 0) > 0
            || (state.lastPlacementResourceResult?.heartHeal ?? 0) > 0) {
            const gold = state.lastPlacementResourceResult?.goldAmount ?? state.lastPlacementResourceResult?.amount ?? 0;
            const heal = state.lastPlacementResourceResult?.heartHeal ?? 0;
            const parts = [
                gold > 0 ? `золото +${gold}` : null,
                heal > 0 ? `сердца +${heal}` : null,
            ].filter(Boolean);
            return `Ресурс поля: ${parts.join(', ')}`;
        }

        return state.selectedHandIndex >= 0
            ? 'Тайл поставлен, закрытие считается сразу'
            : 'Рука пуста, сдавай руку';
    }

    if (isPlacementPayoffVariant(settings)) {
        if ((state.lastPlacementFocusDelta ?? 0) > 0) {
            return `Focus +${state.lastPlacementFocusDelta} (${state.placementFocus}/${getPlacementFocusMax(settings)})`;
        }

        if ((state.lastPlacementClosedZones ?? 0) > 0 && (state.placementFocus ?? 0) > 0) {
            return `Захват готов: Focus ${state.placementFocus} усилит итог раунда`;
        }
    }

    if (isOneColorChainVariant(settings)) {
        if ((state.lastChainDelta ?? 0) > 0) {
            return `Chain x${state.chainMeter} (+${state.lastChainDelta})`;
        }

        if ((state.lastPlacementClosedZones ?? 0) > 0 && (state.chainMeter ?? 0) > 1) {
            return `Захват готов: Chain x${state.chainMeter} усилит удар`;
        }
    }

    if (isConnectTargetsVariant(settings)) {
        if (state.connectTargets?.connected && !state.connectTargets?.scored) {
            return `Цели соединены: +${settings.connectTargets?.bonusDamage ?? 30} к итогу раунда`;
        }

        if (state.connectTargets) {
            return 'Тяни землю между A и B';
        }
    }

    if (isRoadModeVariant(settings)) {
        if (state.connectTargets?.connected && !state.connectTargets?.scored) {
            return 'Дорога соединена: заканчивай раунд для удара';
        }

        if (state.connectTargets) {
            return 'Тяни дорогу от S к E';
        }
    }

    if (isQueueDrawMode(settings)) {
        return state.selectedHandIndex >= 0
            ? 'Текущий тайл поставлен, queue сдвинулся'
            : 'Лимит queue на раунд сыгран, заканчивай раунд';
    }

    return state.selectedHandIndex >= 0
        ? 'Тайл поставлен'
        : 'Рука разыграна, заканчивай раунд';
}

function getHoverKey(ui, layout, settings, mouse) {
    const boardCell = getBoardCell(layout, settings, mouse);
    const handIndex = layout.hand.findIndex((rect) => ui.contains(rect, mouse));
    const holdHover = layout.hold && ui.contains(layout.hold, mouse);
    const buttonHover = ui.contains(layout.endRoundButton, mouse);

    return [
        boardCell ? `${boardCell.x},${boardCell.y}` : '-',
        handIndex,
        holdHover ? 1 : 0,
        buttonHover ? 1 : 0,
    ].join('|');
}

function cellDistance(left, right) {
    return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}

function getRoadPlacementValue(board, x, y, settings, targets) {
    if (!isRoadModeVariant(settings) || !targets) {
        return 0;
    }

    const aTile = board[targets.a.y]?.[targets.a.x];
    const bTile = board[targets.b.y]?.[targets.b.x];

    if (aTile && bTile) {
        const pathKeys = getShortestCombatPathKeys(board, targets.a, targets.b, settings);

        if (pathKeys.length > 0) {
            const base = settings.roadMode?.completeBonus ?? 12;
            const perTile = settings.roadMode?.damagePerTile ?? 6;
            const maxExtra = settings.roadMode?.maxScoredExtraLength ?? 6;
            const routeEdges = Math.max(0, pathKeys.length - 1);
            const extraLength = Math.max(0, routeEdges - targets.distance);
            const scoredExtraLength = Math.min(extraLength, maxExtra);
            const damagePreview = base + scoredExtraLength * perTile;

            return 1700 + damagePreview * 170 + scoredExtraLength * 520;
        }
    }

    if (!aTile && x === targets.a.x && y === targets.a.y) {
        return 5000;
    }

    if (!bTile && x === targets.b.x && y === targets.b.y) {
        return 3600;
    }

    const anchor = aTile ? targets.a : bTile ? targets.b : null;
    const goal = aTile ? targets.b : bTile ? targets.a : targets.a;

    if (!anchor) {
        return Math.max(0, 900 - cellDistance({ x, y }, goal) * 90);
    }

    const componentKeys = getConnectedCombatTileKeys(board, anchor.x, anchor.y, settings);
    const componentCells = componentKeys.map((key) => {
        const [cellX, cellY] = key.split(',').map(Number);
        return { x: cellX, y: cellY };
    });
    const nearestRoadDistance = componentCells.length > 0
        ? Math.min(...componentCells.map((cell) => cellDistance(cell, { x, y })))
        : cellDistance(anchor, { x, y });
    const nearestGoalDistance = componentCells.length > 0
        ? Math.min(...componentCells.map((cell) => cellDistance(cell, goal)))
        : cellDistance(anchor, goal);
    const nextGoalDistance = cellDistance({ x, y }, goal);
    const extension = Math.max(0, nearestGoalDistance - nextGoalDistance);

    return componentKeys.length * 190
        + extension * 340
        - nearestRoadDistance * 120
        - nextGoalDistance * 35;
}

function getPlacementValue(board, tileDef, x, y, settings, run, attack, previewTile = null, targets = null) {
    const nextBoard = createBoardWithTilePlacement(board, tileDef, x, y, settings);

    if (!nextBoard) {
        return -Infinity;
    }

    const score = scoreTileBoard(nextBoard, settings, run);
    const immediateValue = score.totalDamage * 12 + score.zones.length * 40;
    let previewValue = 0;

    if (previewTile) {
        for (let previewY = 0; previewY < settings.boardSize; previewY += 1) {
            for (let previewX = 0; previewX < settings.boardSize; previewX += 1) {
                if (!canPlaceTile(nextBoard, previewTile, previewX, previewY, settings)) {
                    continue;
                }

                const previewBoard = createBoardWithTilePlacement(
                    nextBoard,
                    previewTile,
                    previewX,
                    previewY,
                    settings,
                );

                if (!previewBoard) {
                    continue;
                }

                const previewScore = scoreTileBoard(previewBoard, settings, run);
                previewValue = Math.max(
                    previewValue,
                    previewScore.totalDamage * 12 + previewScore.zones.length * 40,
                );
            }
        }
    }

    const defensiveValue = COMBAT_COLORS.reduce((sum, color) => {
        const closedDamage = score.damageByColor[color] || 0;
        const threat = attack[color] || 0;
        return sum + Math.min(closedDamage, threat);
    }, 0);

    return immediateValue
        + previewValue * 0.35
        + defensiveValue
        + getRoadPlacementValue(nextBoard, x, y, settings, targets);
}

function getValidCells(state, settings, run, battle) {
    if (state.phase !== 'placing' || state.outcome) {
        return [];
    }

    const tileDef = state.hand[state.selectedHandIndex];
    const previewTile = isQueueDrawMode(settings) ? state.hand[1] : null;
    const attack = getRoundAttack(battle, state.round, settings);
    const cells = [];

    for (let y = 0; y < settings.boardSize; y += 1) {
        for (let x = 0; x < settings.boardSize; x += 1) {
            if (!canPlaceTile(state.board, tileDef, x, y, settings)) {
                continue;
            }

            cells.push({
                x,
                y,
                value: getPlacementValue(
                    state.board,
                    tileDef,
                    x,
                    y,
                    settings,
                    run,
                    attack,
                    previewTile,
                    state.connectTargets,
                ),
            });
        }
    }

    return cells.sort((left, right) => right.value - left.value);
}

function createRenderKey({ ui, layout, settings, run, state, mouse, screen }) {
    const boardKey = state.board.map((row) => (
        row.map((tileDef) => tileDef?.id ?? '-').join(',')
    )).join(';');
    const handKey = state.hand.map((tileDef) => tileDef?.id ?? '-').join(',');
    const heldKey = state.heldTile?.id ?? '-';
    const resourcesKey = (state.boardResources ?? []).map((resource) => (
        `${resource.id}:${resource.type}:${resource.x},${resource.y}:${resource.amount}:${resource.consumed ? resource.consumedBy ?? 1 : 0}`
    )).join(',');
    const deck = getRunDeckStats(run);
    const resultKey = state.lastResult
        ? `${state.lastResult.enemyDamage}:${state.lastResult.playerDamage}:${state.lastResult.score.zones.length}:${state.lastResult.placementFocusBonus ?? 0}:${state.lastResult.chainBonus ?? 0}:${state.lastResult.connectTargetBonus ?? 0}:${state.lastResult.roadDamage ?? 0}:${state.lastResult.newPickDamage?.totalDamage ?? 0}:${state.lastResult.newPickDamageApplied ?? false}:${state.lastResult.goldEarned ?? 0}:${state.lastResult.fieldGold ?? 0}:${state.lastResult.heartHeal ?? 0}:${state.lastResult.strikeCount ?? 0}:${state.lastResult.lastClosureImmediate ?? false}`
        : '-';
    const connectTargetKey = state.connectTargets
        ? `${state.connectTargets.a.x},${state.connectTargets.a.y}:${state.connectTargets.b.x},${state.connectTargets.b.y}:${state.connectTargets.connected}:${state.connectTargets.scored}`
        : '-';

    return [
        screen.width,
        screen.height,
        state.phase,
        state.outcome ?? '-',
        state.round,
        state.playerHp,
        state.enemyHp,
        state.selectedHandIndex,
        state.queuePlayedThisRound ?? 0,
        state.queueReserve?.map((tileDef) => tileDef?.id ?? '-').join(',') ?? '-',
        state.placementFocus ?? 0,
        state.lastPlacementFocusDelta ?? 0,
        state.chainMeter ?? 0,
        state.lastChainDelta ?? 0,
        state.handSubmitsThisBattle ?? 0,
        state.handSubmitLocked ?? false,
        state.lockedSubmitCost ?? '-',
        state.strikeCount ?? 0,
        state.strikeWindowOpen ?? false,
        state.lastPlacementClosedZone ?? false,
        state.lastSubmitResult?.totalDamage ?? '-',
        connectTargetKey,
        getGameplayVariant(settings).id,
        boardKey,
        resourcesKey,
        handKey,
        heldKey,
        `${deck.deck}:${deck.drawPile}:${deck.discardPile}:${deck.reshuffles}:${run.gold ?? 0}`,
        COMBAT_COLORS.map((color) => run.colorMultipliers[color]).join(','),
        resultKey,
        (state.battleLog ?? []).join('~'),
        getHoverKey(ui, layout, settings, mouse),
        state.feedback ?? '-',
    ].join('/');
}

export function createBattleScene({
    config,
    input,
    ui,
    run,
    battle,
    tileTextures = new Map(),
    artTextures = null,
    onFinish,
}) {
    const settings = config.game.tileBattle;
    const tiles = createTilesFromManifest(config.tileManifest, settings);
    const state = createTileBattleState({
        battle,
        run,
        settings,
        tiles,
    });

    return {
        name: 'battle',
        layout: null,
        lastRenderKey: null,
        update() {
            const click = input.consumeClick();

            if (!click || !this.layout) {
                return;
            }

            if (state.phase === 'placing'
                && !state.outcome
                && this.layout.hold
                && ui.contains(this.layout.hold, click)) {
                const hadHeldTile = Boolean(state.heldTile);
                const hadSelectedTile = Boolean(state.hand[state.selectedHandIndex]);
                const held = holdSelectedTile(state, settings);
                state.feedback = held
                    ? hadHeldTile && hadSelectedTile
                        ? 'Запас обновлен'
                        : hadHeldTile
                            ? 'Карта вернулась из запаса'
                            : 'Карта ушла в запас'
                    : 'Сначала выбери карту для запаса';
                return;
            }

            const handIndex = this.layout.hand.findIndex((rect) => ui.contains(rect, click));
            if (state.phase === 'placing'
                && !state.outcome
                && handIndex >= 0
                && state.hand[handIndex]
                && (!isQueueDrawMode(settings) || handIndex === 0)) {
                state.selectedHandIndex = handIndex;
                state.feedback = `Выбран ${getColorLabel(state.hand[handIndex].color, settings) ?? 'Серый'} ${state.hand[handIndex].pattern}`;
                return;
            }

            const boardCell = getBoardCell(this.layout, settings, click);
            if (state.phase === 'placing' && !state.outcome && boardCell) {
                const selectedTile = state.hand[state.selectedHandIndex];
                const placementFailure = getTilePlacementFailure(
                    state.board,
                    selectedTile,
                    boardCell.x,
                    boardCell.y,
                    settings,
                );
                const placed = placeTile(state, settings, boardCell.x, boardCell.y, run);
                if (placed) {
                    state.lastInvalidPlacement = null;
                    advanceTileQueue(run, state, settings, tiles);
                    resolveImmediatePlacement(state, battle, settings, run);
                    resolveHandSubmitDefeatIfNeeded(state, settings);
                } else if (placementFailure) {
                    state.lastInvalidPlacement = {
                        ...placementFailure,
                        x: boardCell.x,
                        y: boardCell.y,
                        tileId: selectedTile?.id ?? null,
                    };
                    pushBattleLog(state, placementFailure.message);
                }
                state.feedback = placed
                    ? getPlacedFeedback(state, settings)
                    : placementFailure?.message ?? 'Нельзя поставить сюда.';
                return;
            }

            if (!ui.contains(this.layout.endRoundButton, click)) {
                return;
            }

            if (state.outcome === 'victory') {
                discardRoundHand(run, state);
                run.playerHp = state.playerHp;
                onFinish(BattleOutcome.Victory);
                return;
            }

            if (state.outcome === 'defeat') {
                discardRoundHand(run, state);
                run.playerHp = state.playerHp;
                onFinish(BattleOutcome.Defeat);
                return;
            }

            if (state.phase === 'placing') {
                if (usesHandSubmitEconomy(settings)) {
                    const submit = submitTileHand(state, {
                        run,
                        battle,
                        settings,
                        tiles,
                    });
                    state.feedback = submit.submitted
                        ? state.handSubmitLocked
                            ? `Рука сдана: ${formatHeartDelta(submit.totalDamage)}. Последний шанс: победить этой рукой.`
                            : `Рука сдана: ${formatHeartDelta(submit.totalDamage)}`
                        : 'Не хватает сердец, чтобы сдать руку';
                    return;
                }

                resolveTileRound(state, battle, settings, run);
                discardRoundHand(run, state);
                run.playerHp = state.playerHp;
                state.feedback = null;
                return;
            }

            if ((state.lastResult?.newPickDamage?.totalDamage ?? 0) > 0
                && !state.lastResult.newPickDamageApplied) {
                const pickDamage = state.lastResult.newPickDamage.totalDamage;
                state.playerHp = Math.max(0, state.playerHp - pickDamage);
                run.playerHp = state.playerHp;
                state.lastResult.newPickDamageApplied = true;

                if (state.playerHp <= 0) {
                    onFinish(BattleOutcome.Defeat);
                    return;
                }
            }

            startNextTileRound(state, {
                run,
                battle,
                settings,
                tiles,
            });
            state.feedback = null;
        },
        render(app) {
            const screen = app.screen;
            const mouse = input.getMouse();
            this.layout = createBattleLayout(screen, settings);
            const renderKey = createRenderKey({
                ui,
                layout: this.layout,
                settings,
                run,
                state,
                mouse,
                screen,
            });

            if (renderKey === this.lastRenderKey) {
                return;
            }

            this.lastRenderKey = renderKey;
            ui.begin();

            drawArtImage(ui, artTextures, 'screen_background_battle', {
                x: 0,
                y: 0,
                width: screen.width,
                height: screen.height,
            }, {
                alpha: 0.95,
                fit: 'cover',
                required: true,
            });
            ui.drawRect({
                x: 0,
                y: 0,
                width: screen.width,
                height: screen.height,
            }, '#06101a', 0.22);
            drawBattleHeader(ui, this.layout, run, battle, settings, state, artTextures);
            drawBoard(ui, this.layout, settings, state, mouse, tileTextures, artTextures);
            drawBattleEventBadges(ui, artTextures, this.layout, state);
            drawSidePanel(ui, this.layout, battle, run, settings, state, artTextures);
            drawHold(ui, this.layout, settings, state, mouse, tileTextures, artTextures);
            drawHand(ui, this.layout, settings, state, mouse, tileTextures, artTextures);
            drawPortraitFeedback(ui, artTextures, this.layout, settings, state);
            drawArtButton(
                ui,
                artTextures,
                this.layout.endRoundButton,
                getButtonLabel(state, settings),
                getPrimaryButtonOptions(state, settings, this.layout, mouse),
            );
        },
        getDebugState() {
            return {
                phase: state.phase,
                outcome: state.outcome,
                enemyHp: state.enemyHp,
                playerHp: state.playerHp,
                round: state.round,
                feedback: state.feedback ?? null,
                selectedHandIndex: state.selectedHandIndex,
                placedCount: state.board.reduce((sum, row) => (
                    sum + row.filter(Boolean).length
                ), 0),
                board: state.board.map((row) => row.map((tileDef) => (
                    tileDef ? {
                        id: tileDef.id,
                        color: tileDef.color,
                        pattern: tileDef.pattern,
                    } : null
                ))),
                hand: state.hand.map((tileDef) => tileDef ? {
                    id: tileDef.id,
                    color: tileDef.color,
                    pattern: tileDef.pattern,
                } : null),
                heldTile: state.heldTile ? {
                    id: state.heldTile.id,
                    color: state.heldTile.color,
                    pattern: state.heldTile.pattern,
                } : null,
                gameplayVariant: getGameplayVariant(settings).id,
                gameplayVariantLabel: getGameplayVariant(settings).shortLabel,
                drawMode: settings.drawMode ?? 'hand',
                tileImageIds: [...tileTextures.keys()],
                artImageIds: artTextures?.textures ? [...artTextures.textures.keys()] : [],
                battleArtIds: {
                    background: 'screen_background_battle',
                    monsterIcon: getBattleAssetId('monster_icon', battle),
                    heart: 'icon_heart_full',
                    gold: 'icon_gold',
                    deck: 'icon_deck',
                    discard: 'icon_discard',
                    hold: 'icon_hold',
                    submit: 'icon_submit',
                    lock: 'icon_lock',
                    strike: 'icon_strike',
                    fieldGold: 'icon_gold',
                    fieldHeart: 'icon_heart_full',
                    boardCells: {
                        empty: 'board_cell_empty',
                        hover: 'board_cell_hover',
                        valid: 'board_cell_valid',
                        invalid: 'board_cell_invalid',
                        scored: 'board_cell_scored',
                    },
                    placementHints: {
                        valid: 'overlay_valid_cell',
                        invalid: 'overlay_invalid_cell',
                        hoverTile: 'overlay_hover_tile',
                    },
                },
                gold: run.gold ?? 0,
                maxPlayerHp: run.maxPlayerHp ?? settings.hearts?.maxPlayerHp ?? settings.startingPlayerHp ?? null,
                boardResources: (state.boardResources ?? []).map((resource) => ({ ...resource })),
                activeBoardResources: (state.boardResources ?? [])
                    .filter((resource) => !resource.consumed)
                    .map((resource) => ({ ...resource })),
                consumedBoardResources: (state.boardResources ?? [])
                    .filter((resource) => resource.consumed)
                    .map((resource) => ({ ...resource })),
                resourceEvents: [...state.resourceEvents ?? []],
                eventBadges: getLatestEventBadges(state),
                lastPlacementResourceResult: state.lastPlacementResourceResult,
                lastClosureResourceResult: state.lastClosureResourceResult,
                lastInvalidPlacement: state.lastInvalidPlacement ?? null,
                submitCost: getHandSubmitCostPreview(state, settings),
                handSubmitLocked: state.handSubmitLocked ?? false,
                lockedSubmitCost: state.lockedSubmitCost ?? null,
                handSubmitsThisBattle: state.handSubmitsThisBattle ?? 0,
                lastSubmitResult: state.lastSubmitResult,
                strikeCount: state.strikeCount ?? 0,
                strikeWindowOpen: state.strikeWindowOpen ?? false,
                lastPlacementClosedZone: state.lastPlacementClosedZone ?? false,
                battleLog: [...state.battleLog ?? []],
                queuePlayedThisRound: state.queuePlayedThisRound ?? 0,
                queueReserve: state.queueReserve?.map((tileDef) => tileDef ? {
                    id: tileDef.id,
                    color: tileDef.color,
                    pattern: tileDef.pattern,
                } : null) ?? [],
                validCells: getValidCells(state, settings, run, battle),
                lastResult: state.lastResult ? {
                    enemyDamage: state.lastResult.enemyDamage,
                    playerDamage: state.lastResult.playerDamage,
                    zones: state.lastResult.score.zones.length,
                    areaByColor: getCaptureAreaByColor(state.lastResult),
                    byColor: state.lastResult.byColor,
                    damageByColor: state.lastResult.score.damageByColor,
                    zoneMultipliers: state.lastResult.score.zones.map((zone) => ({
                        color: zone.color,
                        multiplier: zone.multiplier,
                        areaBonus: zone.areaBonus,
                        grayBonus: zone.grayBonus,
                        grayInteriorCells: zone.grayInteriorCells,
                        wildcardBoundarySize: zone.wildcardBoundarySize ?? 0,
                        focusBonus: zone.focusBonus ?? 0,
                        chainBonus: zone.chainBonus ?? 0,
                    })),
                    connectTargetBonus: state.lastResult.connectTargetBonus ?? 0,
                    connectTargetConnected: state.lastResult.connectTargetConnected ?? false,
                    connectTargets: state.lastResult.connectTargets,
                    roadConnected: state.lastResult.roadConnected ?? false,
                    roadLength: state.lastResult.roadLength ?? 0,
                    roadShortestLength: state.lastResult.roadShortestLength ?? 0,
                    roadExtraLength: state.lastResult.roadExtraLength ?? 0,
                    roadScoredExtraLength: state.lastResult.roadScoredExtraLength ?? 0,
                    roadBaseDamage: state.lastResult.roadBaseDamage ?? 0,
                    roadDamage: state.lastResult.roadDamage ?? 0,
                    roadTileKeys: [...state.lastResult.roadTileKeys ?? []],
                    newPickDamage: state.lastResult.newPickDamage,
                    newPickDamageApplied: state.lastResult.newPickDamageApplied ?? false,
                    submitCost: state.lastResult.submitCost,
                    lastClosureImmediate: state.lastResult.lastClosureImmediate ?? false,
                    closedZones: state.lastResult.closedZones ?? 0,
                    monsterHeartsBefore: state.lastResult.monsterHeartsBefore,
                    monsterHeartsAfter: state.lastResult.monsterHeartsAfter,
                    closureGold: state.lastResult.closureGold ?? 0,
                    strikeGold: state.lastResult.strikeGold ?? 0,
                    fieldGold: state.lastResult.fieldGold ?? 0,
                    heartHeal: state.lastResult.heartHeal ?? 0,
                    fieldHeartAmount: state.lastResult.fieldHeartAmount ?? 0,
                    goldEarned: state.lastResult.goldEarned ?? 0,
                    goldBefore: state.lastResult.goldBefore,
                    goldAfter: state.lastResult.goldAfter,
                    playerHeartsBefore: state.lastResult.playerHeartsBefore,
                    playerHeartsAfter: state.lastResult.playerHeartsAfter,
                    closureResources: state.lastResult.closureResources,
                    strikeCount: state.lastResult.strikeCount ?? 0,
                    strikeWindowOpen: state.lastResult.strikeWindowOpen ?? false,
                    placementFocusSpent: state.lastResult.placementFocusSpent,
                    placementFocusBonus: state.lastResult.placementFocusBonus,
                    placementFocusRemaining: state.lastResult.placementFocusRemaining,
                    chainSpent: state.lastResult.chainSpent,
                    chainBonus: state.lastResult.chainBonus,
                    chainRemaining: state.lastResult.chainRemaining,
                } : null,
                placementFocus: state.placementFocus ?? 0,
                lastPlacementFocusDelta: state.lastPlacementFocusDelta ?? 0,
                lastPlacementClosedZones: state.lastPlacementClosedZones ?? 0,
                chainMeter: state.chainMeter ?? 0,
                lastChainDelta: state.lastChainDelta ?? 0,
                chainRegionKeys: [...state.chainRegionKeys ?? []],
                connectTargets: state.connectTargets ? {
                    ...state.connectTargets,
                    a: { ...state.connectTargets.a },
                    b: { ...state.connectTargets.b },
                } : null,
                roadGates: isRoadModeVariant(settings) && state.connectTargets ? {
                    ...state.connectTargets,
                    start: { ...state.connectTargets.a },
                    end: { ...state.connectTargets.b },
                } : null,
                deck: getRunDeckStats(run),
                colorMultipliers: { ...run.colorMultipliers },
                visibleCombatColors: getVisibleCombatColors(settings),
                uiState: getBattleUiState(state, settings),
                primaryButtonContent: getPrimaryButtonContentDebug(this.layout, state, settings),
                layout: this.layout,
            };
        },
    };
}
