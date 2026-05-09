import { BattleOutcome, getRunDeckStats } from '../entities/run.js';
import { getGameplayVariant } from '../entities/gameplayVariants.js';
import {
    advanceTileQueue,
    canPlaceTile,
    COMBAT_COLORS,
    createTileBattleState,
    createTilesFromManifest,
    discardRoundHand,
    getRoundAttack,
    getConnectedCombatTileKeys,
    getShortestCombatPathKeys,
    holdSelectedTile,
    placeTile,
    resolveTileRound,
    scoreTileBoard,
    startNextTileRound,
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

function insetRect(rect, amount) {
    return {
        x: rect.x + amount,
        y: rect.y + amount,
        width: rect.width - amount * 2,
        height: rect.height - amount * 2,
    };
}

function drawBorder(ui, rect, color, thickness = 2, alpha = 1) {
    ui.drawRect({ x: rect.x, y: rect.y, width: rect.width, height: thickness }, color, alpha);
    ui.drawRect({ x: rect.x, y: rect.y + rect.height - thickness, width: rect.width, height: thickness }, color, alpha);
    ui.drawRect({ x: rect.x, y: rect.y, width: thickness, height: rect.height }, color, alpha);
    ui.drawRect({ x: rect.x + rect.width - thickness, y: rect.y, width: thickness, height: rect.height }, color, alpha);
}

function getLayout(screen, settings) {
    const boardPixels = Math.min(screen.width - 360, screen.height - 290, 438);
    const boardSize = Math.max(300, boardPixels);
    const boardX = Math.max(24, Math.min(screen.width * 0.5 - boardSize / 2, screen.width - boardSize - 300));
    const boardY = 144;
    const isQueue = isQueueDrawMode(settings);
    const holdEnabled = isHoldEnabled(settings);
    const holdGap = holdEnabled ? 14 : 0;
    const handSlot = isQueue
        ? Math.min(116, (screen.width - 96) / 2.1)
        : Math.min(82, Math.max(
            54,
            (screen.width - 64 - holdGap - (settings.handSize - 1) * 8)
                / (settings.handSize + (holdEnabled ? 1 : 0)),
        ));
    const previewSlot = isQueue ? Math.floor(handSlot * 0.72) : handSlot;
    const handCount = isQueue ? 2 : settings.handSize;
    const handWidth = isQueue
        ? handSlot + 14 + previewSlot
        : settings.handSize * handSlot + (settings.handSize - 1) * 8;
    const groupWidth = handWidth + (holdEnabled ? handSlot + holdGap : 0);
    const groupX = screen.width / 2 - groupWidth / 2;
    const handX = groupX + (holdEnabled ? handSlot + holdGap : 0);
    const handY = screen.height - handSlot - 28;
    const sideX = boardX + boardSize + 24;
    const sideWidth = Math.max(240, screen.width - sideX - 24);

    return {
        board: {
            x: boardX,
            y: boardY,
            width: boardSize,
            height: boardSize,
        },
        cellSize: boardSize / settings.boardSize,
        hold: holdEnabled ? {
            x: groupX,
            y: handY,
            width: handSlot,
            height: handSlot,
        } : null,
        hand: Array.from({ length: handCount }, (_, index) => {
            if (!isQueue) {
                return {
                    x: handX + index * (handSlot + 8),
                    y: handY,
                    width: handSlot,
                    height: handSlot,
                };
            }

            const size = index === 0 ? handSlot : previewSlot;
            return {
                x: screen.width / 2 - handWidth / 2 + (index === 0 ? 0 : handSlot + 14),
                y: handY + (handSlot - size),
                width: size,
                height: size,
            };
        }),
        endRoundButton: {
            x: sideX,
            y: handY - 82,
            width: sideWidth,
            height: 56,
        },
        sidePanel: {
            x: sideX,
            y: boardY,
            width: sideWidth,
            height: boardSize,
        },
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

    const gap = Math.max(1, Math.floor(rect.width * 0.035));
    const microSize = (rect.width - gap * 4) / 3;
    ui.drawRect(rect, options.background ?? '#202b34', options.alpha ?? 1);

    for (let y = 0; y < 3; y += 1) {
        for (let x = 0; x < 3; x += 1) {
            const symbol = tileDef.cells[y][x];
            const color = options.oneColorLand && symbol !== '.'
                ? COLOR_HEX.land
                : symbol === 'R'
                ? COLOR_HEX.red
                : symbol === 'B'
                    ? COLOR_HEX.blue
                    : symbol === 'G'
                        ? COLOR_HEX.green
                        : COLOR_HEX.gray;
            ui.drawRect({
                x: rect.x + gap + x * (microSize + gap),
                y: rect.y + gap + y * (microSize + gap),
                width: microSize,
                height: microSize,
            }, color, symbol === '.' ? 0.52 : 0.95);
        }
    }
}

function drawAttackRow(ui, rect, color, attack, result, settings) {
    ui.drawRect(rect, '#132334', 0.96);
    ui.drawRect({ x: rect.x, y: rect.y, width: 6, height: rect.height }, getColorHex(color, settings), 1);
    ui.drawText(getColorLabel(color, settings), rect.x + 18, rect.y + 9, {
        size: 16,
        color: '#ecf6ff',
    });
    ui.drawText(`Атака ${formatHearts(attack[color] ?? 0)}`, rect.x + rect.width - 124, rect.y + 9, {
        size: 15,
        color: '#afc4d7',
    });

    if (!result) {
        ui.drawText('Ждет твоего захвата', rect.x + 18, rect.y + 34, {
            size: 14,
            color: '#7f9aad',
        });
        return;
    }

    const colorResult = result.byColor[color];
    const areaByColor = getCaptureAreaByColor(result);
    const bonusByColor = getCaptureBonusByColor(result);
    const outcomeLabel = colorResult.enemyDamage > 0
        ? `Бонус ${formatHearts(bonusByColor[color])}  |  Врагу ${formatHeartDelta(colorResult.enemyDamage)}`
        : `Бонус ${formatHearts(bonusByColor[color])}  |  Игроку ${formatHeartDelta(colorResult.playerDamage)}`;
    const outcomeColor = colorResult.enemyDamage > 0 ? '#c9ffd9' : '#ffd0d7';

    const multiplier = result.score.zones.find((zone) => zone.color === color)?.multiplier ?? 1;
    ui.drawText(`Площадь ${areaByColor[color]}  |  Удар ${formatHearts(colorResult.closedDamage)}  |  x${multiplier}`, rect.x + 18, rect.y + 29, {
        size: 14,
        color: '#d8e7f2',
    });
    ui.drawText(outcomeLabel, rect.x + 18, rect.y + 49, {
        size: 14,
        color: outcomeColor,
    });
}

function drawBoard(ui, layout, settings, state, mouse) {
    const selectedTile = state.hand[state.selectedHandIndex];

    for (let y = 0; y < settings.boardSize; y += 1) {
        for (let x = 0; x < settings.boardSize; x += 1) {
            const rect = {
                x: layout.board.x + x * layout.cellSize,
                y: layout.board.y + y * layout.cellSize,
                width: layout.cellSize,
                height: layout.cellSize,
            };
            const isHovered = ui.contains(rect, mouse);
            const isValid = state.phase === 'placing'
                && canPlaceTile(state.board, selectedTile, x, y, settings);
            const fill = isValid
                ? isHovered ? '#31566b' : '#203748'
                : '#162432';
            const border = isValid
                ? isHovered ? '#9de7ff' : '#4f93b2'
                : '#24394c';

            ui.drawRect(rect, fill, 1);
            drawBorder(ui, rect, border, isHovered && isValid ? 3 : 1, isValid ? 1 : 0.7);
            drawTile(ui, state.board[y][x], insetRect(rect, 5), {
                oneColorLand: isOneColorLandVariant(settings),
            });

            const targets = state.connectTargets;
            const isTargetA = targets?.a.x === x && targets?.a.y === y;
            const isTargetB = targets?.b.x === x && targets?.b.y === y;

            if (isTargetA || isTargetB) {
                const targetColor = targets.connected ? '#c9ffd9' : '#f3d991';
                const label = isRoadModeVariant(settings)
                    ? isTargetA ? 'S' : 'E'
                    : isTargetA ? 'A' : 'B';
                drawBorder(ui, insetRect(rect, 4), targetColor, 4, 1);
                ui.drawText(label, rect.x + rect.width / 2, rect.y + rect.height / 2 - 13, {
                    align: 'center',
                    size: 26,
                    color: targetColor,
                });
            }
        }
    }

    if (state.phase !== 'result' || !state.lastResult) {
        return;
    }

    const microSize = layout.cellSize / 3;
    for (const zone of state.lastResult.score.zones) {
        for (const cell of zone.interiorCells) {
            ui.drawRect({
                x: layout.board.x + cell.x * microSize,
                y: layout.board.y + cell.y * microSize,
                width: microSize,
                height: microSize,
            }, getColorHex(zone.color, settings), 0.42);
        }
    }
}

function drawHand(ui, layout, settings, state, mouse) {
    const isQueue = isQueueDrawMode(settings);

    layout.hand.forEach((rect, index) => {
        const tileDef = state.hand[index];
        const hovered = ui.contains(rect, mouse);
        const selected = index === state.selectedHandIndex && tileDef;
        const label = isQueue
            ? index === 0 ? 'Текущий' : 'Следующий'
            : null;

        ui.drawRect(rect, hovered && (!isQueue || index === 0) ? '#263d4f' : '#182838', tileDef ? 1 : 0.45);
        drawBorder(ui, rect, selected ? '#f6f0a8' : '#38536a', selected ? 4 : 2, selected ? 1 : 0.8);
        drawTile(ui, tileDef, insetRect(rect, 8), {
            oneColorLand: isOneColorLandVariant(settings),
        });

        if (label) {
            ui.drawText(label, rect.x, rect.y - 24, {
                size: index === 0 ? 16 : 14,
                color: index === 0 ? '#f6f0a8' : '#8fb1cb',
            });
        }
    });
}

function drawHold(ui, layout, settings, state, mouse) {
    if (!layout.hold) {
        return;
    }

    const rect = layout.hold;
    const hovered = ui.contains(rect, mouse);
    const tileDef = state.heldTile;

    ui.drawRect(rect, hovered ? '#263d4f' : '#182838', tileDef ? 1 : 0.5);
    drawBorder(ui, rect, tileDef ? '#f3d991' : '#38536a', tileDef ? 3 : 2, tileDef ? 1 : 0.8);
    drawTile(ui, tileDef, insetRect(rect, 8), {
        oneColorLand: isOneColorLandVariant(settings),
    });
    ui.drawText('Запас', rect.x, rect.y - 24, {
        size: 14,
        color: tileDef ? '#f3d991' : '#8fb1cb',
    });
}

function drawSidePanel(ui, layout, battle, run, settings, state) {
    const panel = layout.sidePanel;
    const attack = getRoundAttack(battle, state.round, settings);
    const deck = getRunDeckStats(run);
    const variant = getGameplayVariant(settings);
    const visibleColors = getVisibleCombatColors(settings);
    const totalCaptureArea = state.lastResult
        ? state.lastResult.score.zones.reduce((sum, zone) => sum + zone.area, 0)
        : 0;

    ui.drawRect(panel, '#0f1d2b', 0.94);
    drawBorder(ui, panel, '#28445c', 2, 0.9);
    ui.drawText(battle.name, panel.x + 18, panel.y + 18, {
        size: 24,
        color: '#ffffff',
    });
    ui.drawText(`Раунд ${state.round} · ${variant.shortLabel}`, panel.x + 18, panel.y + 52, {
        size: 17,
        color: '#9fb8ca',
    });
    ui.drawText(`Игрок ${formatHearts(state.playerHp)}`, panel.x + 18, panel.y + 86, {
        size: 20,
        color: '#c8f7dd',
    });
    ui.drawText(`Монстр ${formatHearts(state.enemyHp)}`, panel.x + 18, panel.y + 116, {
        size: 20,
        color: '#ffd4d8',
    });
    ui.drawText(`Колода ${deck.drawPile}  |  Сброс ${deck.discardPile}`, panel.x + 18, panel.y + 144, {
        size: 15,
        color: '#8fb1cb',
    });
    if (isQueueDrawMode(settings)) {
        ui.drawText(`Queue ${state.queuePlayedThisRound} / ${settings.handSize}`, panel.x + panel.width - 112, panel.y + 52, {
            size: 15,
            color: '#f6f0a8',
        });
    }
    if (isPlacementPayoffVariant(settings)) {
        ui.drawText(`Focus ${state.placementFocus ?? 0}/${getPlacementFocusMax(settings)}`, panel.x + panel.width - 112, panel.y + 144, {
            size: 15,
            color: '#f3d991',
        });
    }
    if (isOneColorChainVariant(settings)) {
        ui.drawText(`Chain x${state.chainMeter ?? 0}/${getOneColorChainMax(settings)}`, panel.x + panel.width - 118, panel.y + 144, {
            size: 15,
            color: '#f3d991',
        });
    }
    if (isConnectTargetsVariant(settings) && state.connectTargets) {
        const targetStatus = state.connectTargets.connected
            ? `Targets +${settings.connectTargets?.bonusDamage ?? 30}`
            : `Targets ${state.connectTargets.distance}`;
        ui.drawText(targetStatus, panel.x + panel.width - 128, panel.y + 144, {
            size: 15,
            color: state.connectTargets.connected ? '#c9ffd9' : '#f3d991',
        });
    }
    if (isRoadModeVariant(settings) && state.connectTargets) {
        const roadStatus = state.connectTargets.connected
            ? `Road +${state.lastResult?.roadDamage ?? 0}`
            : `Road ${state.connectTargets.distance}`;
        ui.drawText(roadStatus, panel.x + panel.width - 128, panel.y + 144, {
            size: 15,
            color: state.connectTargets.connected ? '#c9ffd9' : '#f3d991',
        });
    }

    ui.drawText(state.lastResult ? 'Итог раунда' : 'Атаки врага', panel.x + 18, panel.y + 168, {
        size: 16,
        color: '#8fb1cb',
    });

    visibleColors.forEach((color, index) => {
        drawAttackRow(ui, {
            x: panel.x + 16,
            y: panel.y + 190 + index * 68,
            width: panel.width - 32,
            height: 62,
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
            : `Зон ${zones}  |  Площадь ${totalCaptureArea}  |  Бонус +${totalBonus}`;
        ui.drawText(summary, panel.x + 18, panel.y + 400, {
            size: 15,
            color: '#d8e7f2',
        });
        ui.drawText(`Монстру ${formatHeartDelta(state.lastResult.enemyDamage)}  |  Игроку ${formatHeartDelta(state.lastResult.playerDamage)}`, panel.x + 18, panel.y + 422, {
            size: 15,
            color: state.lastResult.playerDamage > 0 ? '#ffd0d7' : '#c9ffd9',
        });
        if (!state.outcome && (state.lastResult.newPickDamage?.totalDamage ?? 0) > 0) {
            const pickDamage = state.lastResult.newPickDamage;
            ui.drawText(`Новый пик ${formatHeartDelta(pickDamage.totalDamage)}: база ${formatHearts(pickDamage.baseDamage)}, невыставлено ${pickDamage.unplayedTiles}`, panel.x + 18, panel.y + 444, {
                size: 15,
                color: pickDamage.totalDamage > 0 ? '#ffd0d7' : '#c9ffd9',
            });
        }
    }
}

function getButtonLabel(state) {
    if (state.phase === 'placing') {
        return 'Закончить раунд';
    }

    if (state.outcome) {
        return 'К результату битвы';
    }

    if ((state.lastResult?.newPickDamage?.totalDamage ?? 0) > 0) {
        return `Новый пик (${formatHeartDelta(state.lastResult.newPickDamage.totalDamage)})`;
    }

    return 'Новый раунд';
}

function getPlacedFeedback(state, settings) {
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

function cloneBoard(board) {
    return board.map((row) => [...row]);
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
    const nextBoard = cloneBoard(board);
    nextBoard[y][x] = tileDef;
    const score = scoreTileBoard(nextBoard, settings, run);
    const immediateValue = score.totalDamage * 12 + score.zones.length * 40;
    let previewValue = 0;

    if (previewTile) {
        for (let previewY = 0; previewY < settings.boardSize; previewY += 1) {
            for (let previewX = 0; previewX < settings.boardSize; previewX += 1) {
                if (!canPlaceTile(nextBoard, previewTile, previewX, previewY, settings)) {
                    continue;
                }

                const previewBoard = cloneBoard(nextBoard);
                previewBoard[previewY][previewX] = previewTile;
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
    if (state.phase !== 'placing') {
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
    const deck = getRunDeckStats(run);
    const resultKey = state.lastResult
        ? `${state.lastResult.enemyDamage}:${state.lastResult.playerDamage}:${state.lastResult.score.zones.length}:${state.lastResult.placementFocusBonus ?? 0}:${state.lastResult.chainBonus ?? 0}:${state.lastResult.connectTargetBonus ?? 0}:${state.lastResult.roadDamage ?? 0}:${state.lastResult.newPickDamage?.totalDamage ?? 0}:${state.lastResult.newPickDamageApplied ?? false}`
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
        connectTargetKey,
        getGameplayVariant(settings).id,
        boardKey,
        handKey,
        heldKey,
        `${deck.deck}:${deck.drawPile}:${deck.discardPile}:${deck.reshuffles}`,
        COMBAT_COLORS.map((color) => run.colorMultipliers[color]).join(','),
        resultKey,
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
                && handIndex >= 0
                && state.hand[handIndex]
                && (!isQueueDrawMode(settings) || handIndex === 0)) {
                state.selectedHandIndex = handIndex;
                state.feedback = `Выбран ${getColorLabel(state.hand[handIndex].color, settings) ?? 'Серый'} ${state.hand[handIndex].pattern}`;
                return;
            }

            const boardCell = getBoardCell(this.layout, settings, click);
            if (state.phase === 'placing' && boardCell) {
                const placed = placeTile(state, settings, boardCell.x, boardCell.y);
                if (placed) {
                    advanceTileQueue(run, state, settings, tiles);
                }
                state.feedback = placed
                    ? getPlacedFeedback(state, settings)
                    : 'Нельзя поставить: смежные края должны совпасть';
                return;
            }

            if (!ui.contains(this.layout.endRoundButton, click)) {
                return;
            }

            if (state.phase === 'placing') {
                resolveTileRound(state, battle, settings, run);
                discardRoundHand(run, state);
                run.playerHp = state.playerHp;
                state.feedback = null;
                return;
            }

            if (state.outcome === 'victory') {
                onFinish(BattleOutcome.Victory);
                return;
            }

            if (state.outcome === 'defeat') {
                onFinish(BattleOutcome.Defeat);
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
            this.layout = getLayout(screen, settings);
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

            ui.drawText(`Битва ${run.currentBattle} / ${run.totalBattles}`, 28, 24, {
                size: 24,
                color: '#eef8ff',
            });
            ui.drawText(isRoadModeVariant(settings)
                ? 'Проведи дорогу от S к E и перебей атаки'
                : 'Собери замкнутую цветную границу и перебей атаки', 28, 58, {
                size: 17,
                color: '#98b4c8',
            });

            drawBoard(ui, this.layout, settings, state, mouse);
            drawSidePanel(ui, this.layout, battle, run, settings, state);
            drawHold(ui, this.layout, settings, state, mouse);
            drawHand(ui, this.layout, settings, state, mouse);
            if (state.feedback) {
                ui.drawText(state.feedback, this.layout.board.x, this.layout.hand[0].y - 34, {
                    size: 16,
                    color: '#f3d991',
                });
            }
            ui.drawButton(this.layout.endRoundButton, getButtonLabel(state), {
                mouse,
                color: state.phase === 'placing' ? '#243f54' : '#1f4b3c',
                hoverColor: state.phase === 'placing' ? '#66c7f4' : '#69d29d',
                edgeColor: '#9fdfff',
                textSize: 20,
            });
        },
        getDebugState() {
            return {
                phase: state.phase,
                outcome: state.outcome,
                enemyHp: state.enemyHp,
                playerHp: state.playerHp,
                round: state.round,
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
                layout: this.layout,
            };
        },
    };
}
