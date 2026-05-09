import { BattleOutcome } from '../entities/run.js';

function getActionButton(screen) {
    const width = Math.min(340, screen.width - 48);
    return {
        x: screen.width / 2 - width / 2,
        y: screen.height * 0.68,
        width,
        height: 62,
    };
}

function getArtTexture(artTextures, assetId) {
    return artTextures?.textures?.get(assetId) ?? null;
}

function drawArtImage(ui, artTextures, assetId, rect, options = {}) {
    const texture = getArtTexture(artTextures, assetId);

    if (!texture) {
        return false;
    }

    ui.drawImage(texture, rect, {
        alpha: options.alpha ?? 1,
        fit: options.fit,
    });
    return true;
}

function drawArtButton(ui, artTextures, rect, label, options = {}) {
    const hovered = options.mouse ? ui.contains(rect, options.mouse) : false;
    const state = options.disabled ? 'disabled' : hovered ? 'hover' : 'default';
    const drawn = drawArtImage(ui, artTextures, `button_primary_${state}`, rect);

    if (!drawn) {
        ui.drawButton(rect, label, options);
        return;
    }

    ui.drawText(label, rect.x + rect.width / 2, rect.y + rect.height / 2 - 12, {
        align: 'center',
        size: options.textSize ?? 22,
        color: options.textColor ?? '#f7e7bd',
        weight: 700,
    });
}

export function createBattleResultScene({
    input,
    ui,
    artTextures = null,
    result,
    onContinue,
}) {
    return {
        name: 'result',
        actionButton: null,
        update() {
            const click = input.consumeClick();

            if (click && this.actionButton && ui.contains(this.actionButton, click)) {
                onContinue();
            }
        },
        render(app) {
            ui.begin();
            const screen = app.screen;
            this.actionButton = getActionButton(screen);
            const mouse = input.getMouse();
            const isDefeat = result.outcome === BattleOutcome.Defeat;
            const isRunVictory = result.isRunVictory;
            const title = isRunVictory
                ? 'Победа в забеге'
                : isDefeat
                    ? 'Поражение'
                    : 'Битва выиграна';
            const subtitle = isRunVictory
                ? `Все ${result.totalBattles} битв пройдены`
                : isDefeat
                    ? `Забег закончился на битве ${result.battleNumber}`
                    : 'Открылся магазин карт';
            const label = isRunVictory || isDefeat ? 'В меню' : 'В магазин';
            const screenRect = {
                x: 0,
                y: 0,
                width: screen.width,
                height: screen.height,
            };

            if (!drawArtImage(ui, artTextures, 'screen_background_result', screenRect, { fit: 'cover' })) {
                ui.drawRect(screenRect, '#07111d', 1);
            }
            ui.drawRect(screenRect, '#03070c', isDefeat ? 0.38 : 0.24);
            drawArtImage(ui, artTextures, 'panel_dark', {
                x: Math.max(20, screen.width / 2 - 290),
                y: screen.height * 0.17,
                width: Math.min(580, screen.width - 40),
                height: Math.min(310, screen.height * 0.46),
            }, { alpha: 0.88 });

            ui.drawText(title, screen.width / 2, screen.height * 0.25, {
                align: 'center',
                size: 48,
                color: isDefeat ? '#ffb4c0' : '#ffe7ad',
            });
            ui.drawText(subtitle, screen.width / 2, screen.height * 0.39, {
                align: 'center',
                size: 24,
                color: '#d7c59e',
            });
            ui.drawText(`Пройдено: ${result.completedBattles} / ${result.totalBattles}`, screen.width / 2, screen.height * 0.49, {
                align: 'center',
                size: 22,
                color: '#bca77e',
            });
            if (!isDefeat && (result.bountyGold ?? 0) > 0) {
                ui.drawText(`Награда за монстра: +${result.bountyGold} золота · всего ${result.gold}`, screen.width / 2, screen.height * 0.55, {
                    align: 'center',
                    size: 20,
                    color: '#f3d991',
                });
            }
            drawArtButton(ui, artTextures, this.actionButton, label, {
                mouse,
                color: isDefeat ? '#4a2430' : '#1c3346',
                hoverColor: isDefeat ? '#f0788b' : '#66c7f4',
            });
        },
    };
}
