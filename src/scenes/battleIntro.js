const PORTRAIT_BREAKPOINT = 760;
const PORTRAIT_ASPECT = 1.08;
const MIN_TOUCH_SIZE = 44;

function rect(x, y, width, height) {
    return { x, y, width, height };
}

function formatHearts(value) {
    const hearts = Math.max(0, Math.ceil(value || 0));

    if (hearts <= 12) {
        return '♥'.repeat(hearts);
    }

    return `♥ x${hearts}`;
}

function getBattleNumber(battle) {
    const match = /_(\d+)$/.exec(battle.id ?? '');
    const parsed = match ? Number(match[1]) : NaN;

    return Number.isFinite(parsed) ? parsed : 1;
}

function getBattleDanger(battle) {
    const ante = Math.max(0, battle.ante ?? 0);

    if (ante >= 3) {
        return 'Критический прорыв';
    }

    if (ante >= 2) {
        return 'Сильный прорыв';
    }

    return 'Первый прорыв';
}

function getRewardPreview(battle) {
    const reward = battle.reward ?? 0;

    return reward > 0
        ? `Награда после победы: +${reward} золота`
        : 'Награда после победы будет уточнена';
}

function getAssetId(prefix, battle) {
    return `${prefix}_${battle.id}`;
}

function collectLayoutRects(layout) {
    return [
        layout.hud,
        layout.backdrop,
        layout.portrait,
        layout.icon,
        layout.details,
        layout.primaryButton,
    ].filter(Boolean);
}

function getViewportStatus(layout, screen) {
    const rects = collectLayoutRects(layout);
    const bounds = rects.reduce((result, item) => ({
        minX: Math.min(result.minX, item.x),
        minY: Math.min(result.minY, item.y),
        maxX: Math.max(result.maxX, item.x + item.width),
        maxY: Math.max(result.maxY, item.y + item.height),
    }), {
        minX: Number.POSITIVE_INFINITY,
        minY: Number.POSITIVE_INFINITY,
        maxX: Number.NEGATIVE_INFINITY,
        maxY: Number.NEGATIVE_INFINITY,
    });
    const overflow = {
        left: Math.max(0, -bounds.minX),
        top: Math.max(0, -bounds.minY),
        right: Math.max(0, bounds.maxX - screen.width),
        bottom: Math.max(0, bounds.maxY - screen.height),
    };

    return {
        screen: {
            width: screen.width,
            height: screen.height,
        },
        bounds,
        overflow,
        overflows: Object.values(overflow).some((value) => value > 0),
    };
}

function withMetadata(layout, screen, safeArea) {
    const metadata = {
        ...layout,
        buttonRect: layout.primaryButton,
        safeArea,
        minTouchTarget: Math.min(layout.primaryButton.width, layout.primaryButton.height),
    };

    metadata.viewport = getViewportStatus(metadata, screen);
    return metadata;
}

function createPortraitLayout(screen) {
    const margin = screen.width <= 370 ? 10 : 12;
    const gap = screen.width <= 370 ? 8 : 10;
    const availableWidth = screen.width - margin * 2;
    const buttonHeight = 56;
    const buttonY = screen.height - margin - buttonHeight;
    const hud = rect(margin, 8, availableWidth, 34);
    const detailsHeight = 150;
    const details = rect(margin, buttonY - gap - detailsHeight, availableWidth, detailsHeight);
    const titleY = hud.y + hud.height + gap;
    const portraitTop = titleY + 48;
    const portraitMaxHeight = details.y - portraitTop - gap;
    const portraitSize = Math.floor(Math.min(availableWidth, Math.max(176, portraitMaxHeight)));
    const portrait = rect(
        Math.round(screen.width / 2 - portraitSize / 2),
        portraitTop,
        portraitSize,
        portraitSize,
    );
    const iconSize = Math.max(56, Math.min(72, Math.floor(portraitSize * 0.27)));
    const icon = rect(
        portrait.x + portrait.width - iconSize - 8,
        portrait.y + portrait.height - iconSize - 8,
        iconSize,
        iconSize,
    );

    return withMetadata({
        mode: 'portrait',
        hud,
        title: rect(margin, titleY, availableWidth, 40),
        backdrop: portrait,
        portrait,
        icon,
        details,
        primaryButton: rect(margin, buttonY, availableWidth, buttonHeight),
    }, screen, {
        left: margin,
        right: margin,
        top: hud.y,
        bottom: margin,
    });
}

function createDesktopLayout(screen) {
    const margin = 28;
    const hud = rect(margin, 20, Math.min(620, screen.width - margin * 2), 58);
    const buttonHeight = 56;
    const boardLikeSize = Math.max(300, Math.min(screen.width - 380, screen.height - 220, 438));
    const backdropX = Math.max(
        24,
        Math.min(screen.width * 0.5 - boardLikeSize / 2, screen.width - boardLikeSize - 320),
    );
    const backdropY = 144;
    const backdrop = rect(backdropX, backdropY, boardLikeSize, boardLikeSize);
    const sideX = backdrop.x + backdrop.width + 24;
    const sideWidth = Math.max(250, screen.width - sideX - 24);
    const details = rect(sideX, backdrop.y, sideWidth, backdrop.height);
    const portrait = rect(
        backdrop.x + Math.round(backdrop.width * 0.08),
        backdrop.y + Math.round(backdrop.height * 0.08),
        Math.round(backdrop.width * 0.84),
        Math.round(backdrop.height * 0.84),
    );
    const iconSize = 86;
    const icon = rect(details.x + 20, details.y + 18, iconSize, iconSize);

    return withMetadata({
        mode: 'desktop',
        hud,
        title: rect(margin, 92, Math.min(640, screen.width - margin * 2), 40),
        backdrop,
        portrait,
        icon,
        details,
        primaryButton: rect(sideX, screen.height - 110, sideWidth, buttonHeight),
    }, screen, {
        left: margin,
        right: 24,
        top: hud.y,
        bottom: 24,
    });
}

export function createBattleIntroLayout(screen) {
    const portrait = screen.width < PORTRAIT_BREAKPOINT
        || screen.height / Math.max(1, screen.width) > PORTRAIT_ASPECT;

    return portrait
        ? createPortraitLayout(screen)
        : createDesktopLayout(screen);
}

function getTexture(artTextures, assetId) {
    return artTextures?.textures?.get(assetId) ?? null;
}

function drawImageOrRect(ui, artTextures, assetId, rect, fallbackColor, alpha = 1, fit = 'cover') {
    const texture = getTexture(artTextures, assetId);

    if (texture) {
        ui.drawImage(texture, rect, { alpha, fit });
        return true;
    }

    ui.drawRect(rect, fallbackColor, alpha);
    return false;
}

function drawArtButton(ui, artTextures, rect, label, options = {}) {
    const hovered = options.mouse ? ui.contains(rect, options.mouse) : false;
    const state = options.disabled ? 'disabled' : hovered ? 'hover' : 'default';
    const texture = getTexture(artTextures, `button_primary_${state}`);

    if (!texture) {
        ui.drawButton(rect, label, options);
        return;
    }

    ui.drawImage(texture, rect, { alpha: 1 });
    ui.drawText(label, rect.x + rect.width / 2, rect.y + rect.height / 2 - (options.textSize ?? 22) / 2 - 2, {
        align: 'center',
        size: options.textSize ?? 22,
        color: '#fff2ca',
        weight: 700,
    });
}

function drawBorder(ui, rect, color, thickness = 2, alpha = 1) {
    ui.drawRect({ x: rect.x, y: rect.y, width: rect.width, height: thickness }, color, alpha);
    ui.drawRect({ x: rect.x, y: rect.y + rect.height - thickness, width: rect.width, height: thickness }, color, alpha);
    ui.drawRect({ x: rect.x, y: rect.y, width: thickness, height: rect.height }, color, alpha);
    ui.drawRect({ x: rect.x + rect.width - thickness, y: rect.y, width: thickness, height: rect.height }, color, alpha);
}

function drawStatRow(ui, x, y, label, value, color = '#d8e7f2') {
    ui.drawText(label, x, y, {
        size: 15,
        color: '#8fb1cb',
    });
    ui.drawText(value, x + 118, y, {
        size: 15,
        color,
    });
}

function createPreview(battle, run) {
    const monsterName = battle.monsterName ?? battle.name;

    return {
        battleId: battle.id,
        battleNumber: run.currentBattle,
        totalBattles: run.totalBattles,
        name: monsterName,
        monsterName,
        battleName: battle.name,
        enemyHp: battle.enemyHp,
        ante: battle.ante ?? 0,
        danger: getBattleDanger(battle),
        reward: battle.reward ?? 0,
        rewardPreview: getRewardPreview(battle),
        playerHp: run.playerHp,
        gold: run.gold ?? 0,
        assetIds: {
            background: 'screen_background_battle_intro',
            backdrop: getAssetId('level_backdrop', battle),
            portrait: getAssetId('monster_portrait', battle),
            icon: getAssetId('monster_icon', battle),
        },
    };
}

export function createBattleIntroScene({
    input,
    ui,
    run,
    battle,
    artTextures = null,
    onStart,
}) {
    const preview = createPreview(battle, run);

    return {
        name: 'battleIntro',
        layout: null,
        update() {
            const click = input.consumeClick();

            if (click && this.layout && ui.contains(this.layout.primaryButton, click)) {
                onStart();
            }

            if (input.isKeyDown('Enter') || input.isKeyDown('Space')) {
                onStart();
            }
        },
        render(app) {
            ui.begin();
            const screen = app.screen;
            const mouse = input.getMouse();
            this.layout = createBattleIntroLayout(screen);
            const layout = this.layout;

            drawImageOrRect(
                ui,
                artTextures,
                preview.assetIds.background,
                rect(0, 0, screen.width, screen.height),
                '#091522',
                1,
            );

            ui.drawRect(rect(0, 0, screen.width, screen.height), '#06101a', 0.38);

            if (layout.mode === 'portrait') {
                drawImageOrRect(ui, artTextures, 'panel_dark', layout.hud, '#0f1d2b', 0.92, 'stretch');
                ui.drawText(`Б${preview.battleNumber}/${preview.totalBattles}`, layout.hud.x + 10, layout.hud.y + 9, {
                    size: 13,
                    color: '#eef8ff',
                });
                ui.drawText(`Игрок ${formatHearts(preview.playerHp)}`, layout.hud.x + layout.hud.width * 0.24, layout.hud.y + 8, {
                    size: 14,
                    color: '#c8f7dd',
                });
                ui.drawText(`${preview.gold} зол`, layout.hud.x + layout.hud.width - 58, layout.hud.y + 8, {
                    size: 14,
                    color: '#f3d991',
                });
                ui.drawText(preview.monsterName, layout.title.x + layout.title.width / 2, layout.title.y + 5, {
                    align: 'center',
                    size: 25,
                    color: '#f3fbff',
                });
                drawImageOrRect(ui, artTextures, preview.assetIds.portrait, layout.portrait, '#182838', 0.98);
                drawBorder(ui, layout.portrait, '#486a87', 2, 0.9);
                drawImageOrRect(ui, artTextures, preview.assetIds.icon, layout.icon, '#20394d', 0.98);
                drawBorder(ui, layout.icon, '#f3d991', 2, 0.9);
            } else {
                ui.drawText(`Битва ${preview.battleNumber} / ${preview.totalBattles}`, layout.hud.x, layout.hud.y + 4, {
                    size: 24,
                    color: '#eef8ff',
                });
                ui.drawText('Прорыв у звездного архива', layout.hud.x, layout.hud.y + 36, {
                    size: 17,
                    color: '#98b4c8',
                });
                drawImageOrRect(ui, artTextures, preview.assetIds.backdrop, layout.backdrop, '#101d2b', 0.96);
                ui.drawRect(layout.backdrop, '#07121f', 0.28);
                drawImageOrRect(ui, artTextures, preview.assetIds.portrait, layout.portrait, '#182838', 0.98);
                drawBorder(ui, layout.backdrop, '#31566b', 2, 0.85);
                drawBorder(ui, layout.portrait, '#486a87', 2, 0.9);
            }

            drawImageOrRect(ui, artTextures, 'panel_dark', layout.details, '#0f1d2b', 0.92, 'stretch');

            if (layout.mode === 'desktop') {
                drawImageOrRect(ui, artTextures, preview.assetIds.icon, layout.icon, '#20394d', 0.98);
                drawBorder(ui, layout.icon, '#f3d991', 2, 0.9);
                ui.drawText(preview.monsterName, layout.details.x + 122, layout.details.y + 20, {
                    size: 28,
                    color: '#f3fbff',
                });
                ui.drawText(`${preview.battleName} · ${preview.danger}`, layout.details.x + 122, layout.details.y + 58, {
                    size: 17,
                    color: '#f3d991',
                });
            } else {
                ui.drawText(`${preview.battleName} · ${preview.danger}`, layout.details.x + 14, layout.details.y + 12, {
                    size: 17,
                    color: '#f3d991',
                });
            }

            const statX = layout.details.x + (layout.mode === 'desktop' ? 24 : 14);
            const statY = layout.details.y + (layout.mode === 'desktop' ? 128 : 44);
            drawStatRow(ui, statX, statY, 'Сердца', formatHearts(preview.enemyHp), '#ffd4d8');
            drawStatRow(ui, statX, statY + 26, 'Ставка', `${preview.ante} сердца риска`, '#f3d991');
            drawStatRow(ui, statX, statY + 52, 'Игрок', formatHearts(preview.playerHp), '#c8f7dd');
            drawStatRow(ui, statX, statY + 78, 'Золото', String(preview.gold), '#f3d991');

            const rewardY = layout.mode === 'desktop' ? layout.details.y + 260 : statY + 102;
            if (layout.mode === 'portrait') {
                ui.drawText(`Победа: +${preview.reward} золота`, statX, rewardY, {
                    size: 12,
                    color: '#9fb8ca',
                });
            } else {
                ui.drawText(preview.rewardPreview, statX, rewardY, {
                    size: 16,
                    color: '#9fb8ca',
                    lineHeight: 20,
                });
            }

            drawArtButton(ui, artTextures, layout.primaryButton, 'Битва', {
                mouse,
                color: '#243f54',
                hoverColor: '#66c7f4',
                edgeColor: '#9fdfff',
                textSize: layout.mode === 'portrait' ? 18 : 22,
            });
        },
        getDebugState() {
            return {
                layout: this.layout,
                layoutMode: this.layout?.mode ?? null,
                buttonRect: this.layout?.primaryButton ?? null,
                monsterPreview: {
                    id: preview.battleId,
                    name: preview.name,
                    monsterName: preview.monsterName,
                    battleName: preview.battleName,
                    enemyHp: preview.enemyHp,
                    assetIds: preview.assetIds,
                },
                danger: {
                    ante: preview.ante,
                    label: preview.danger,
                },
                rewardPreview: preview.rewardPreview,
                player: {
                    hearts: preview.playerHp,
                    gold: preview.gold,
                },
                battleNumber: preview.battleNumber,
                totalBattles: preview.totalBattles,
                artImageIds: artTextures?.textures ? [...artTextures.textures.keys()] : [],
                minTouchTarget: this.layout?.minTouchTarget ?? 0,
                viewport: this.layout?.viewport ?? null,
            };
        },
    };
}
