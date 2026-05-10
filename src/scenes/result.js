import { BattleOutcome } from '../entities/run.js';
import { drawBorder, drawCornerBrackets } from '../render/chrome.js';

function getResultLayout(screen) {
    const isPortrait = screen.width < 620;
    const margin = isPortrait ? 24 : 48;
    const panelWidth = Math.min(isPortrait ? screen.width - margin * 2 : 620, screen.width - margin * 2);
    const panelY = Math.max(isPortrait ? 52 : 76, screen.height * 0.14);
    const buttonHeight = 62;
    const buttonGap = isPortrait ? 34 : 48;
    const bottomPadding = isPortrait ? 36 : 56;
    const availablePanelHeight = screen.height - panelY - buttonGap - buttonHeight - bottomPadding;
    const panelHeight = Math.max(250, Math.min(isPortrait ? 300 : 320, availablePanelHeight));
    const panel = {
        x: screen.width / 2 - panelWidth / 2,
        y: panelY,
        width: panelWidth,
        height: panelHeight,
    };
    const buttonWidth = Math.min(340, screen.width - 48);
    const actionButton = {
        x: screen.width / 2 - buttonWidth / 2,
        y: panel.y + panel.height + buttonGap,
        width: buttonWidth,
        height: buttonHeight,
    };

    return {
        mode: isPortrait ? 'portrait' : 'desktop',
        panel,
        actionButton,
        titleY: panel.y + (isPortrait ? 52 : 64),
        subtitleY: panel.y + (isPortrait ? 136 : 154),
        progressY: panel.y + (isPortrait ? 198 : 224),
        rewardY: panel.y + (isPortrait ? 242 : 266),
        viewport: {
            screen: {
                width: screen.width,
                height: screen.height,
            },
            overflows: [panel, actionButton].some((rect) => (
                rect.x < 0
                || rect.y < 0
                || rect.x + rect.width > screen.width
                || rect.y + rect.height > screen.height
            )),
            overlaps: !(
                panel.x + panel.width <= actionButton.x
                || actionButton.x + actionButton.width <= panel.x
                || panel.y + panel.height <= actionButton.y
                || actionButton.y + actionButton.height <= panel.y
            ),
        },
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

function drawResultPanel(ui, rect, isDefeat) {
    const accent = isDefeat ? '#d78486' : '#d6a25c';
    ui.drawRect(rect, '#050911', isDefeat ? 0.9 : 0.86);
    ui.drawRect({
        x: rect.x + 12,
        y: rect.y + 12,
        width: rect.width - 24,
        height: rect.height - 24,
    }, '#0c111a', 0.58);
    drawBorder(ui, rect, '#1c130f', 4, 0.94);
    drawBorder(ui, {
        x: rect.x + 8,
        y: rect.y + 8,
        width: rect.width - 16,
        height: rect.height - 16,
    }, accent, 2, isDefeat ? 0.48 : 0.58);
    drawCornerBrackets(ui, rect, accent, {
        inset: 8,
        length: 36,
        thickness: 4,
        alpha: isDefeat ? 0.7 : 0.78,
    });
}

function drawResultButton(ui, rect, label, options = {}) {
    const hovered = options.mouse ? ui.contains(rect, options.mouse) : false;
    const accent = options.accent ?? '#d6a25c';
    const fill = hovered ? options.hoverColor ?? '#294a5d' : options.color ?? '#1c3346';

    ui.drawRect(rect, fill, 0.96);
    drawBorder(ui, rect, '#1c130f', 3, 0.88);
    drawBorder(ui, {
        x: rect.x + 6,
        y: rect.y + 6,
        width: rect.width - 12,
        height: rect.height - 12,
    }, accent, 2, hovered ? 0.9 : 0.7);
    drawCornerBrackets(ui, rect, accent, {
        inset: 5,
        length: 24,
        thickness: 3,
        alpha: hovered ? 0.95 : 0.82,
    });
    ui.drawText(label, rect.x + rect.width / 2, rect.y + rect.height / 2 - 12, {
        align: 'center',
        size: options.textSize ?? 22,
        color: options.textColor ?? '#f7e7bd',
        weight: 700,
        maxWidth: rect.width - 28,
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
        layout: null,
        update() {
            const click = input.consumeClick();

            if (click && this.actionButton && ui.contains(this.actionButton, click)) {
                onContinue();
            }
        },
        render(app) {
            ui.begin();
            const screen = app.screen;
            this.layout = getResultLayout(screen);
            this.actionButton = this.layout.actionButton;
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
            drawResultPanel(ui, this.layout.panel, isDefeat);

            ui.drawText(title, screen.width / 2, this.layout.titleY, {
                align: 'center',
                size: this.layout.mode === 'portrait' ? 42 : 48,
                color: isDefeat ? '#ffb4c0' : '#ffe7ad',
                maxWidth: this.layout.panel.width - 32,
            });
            ui.drawText(subtitle, screen.width / 2, this.layout.subtitleY, {
                align: 'center',
                size: this.layout.mode === 'portrait' ? 22 : 24,
                color: '#d7c59e',
                maxWidth: this.layout.panel.width - 36,
            });
            ui.drawText(`Пройдено: ${result.completedBattles} / ${result.totalBattles}`, screen.width / 2, this.layout.progressY, {
                align: 'center',
                size: 22,
                color: '#bca77e',
                maxWidth: this.layout.panel.width - 36,
            });
            if (!isDefeat && (result.bountyGold ?? 0) > 0) {
                ui.drawText(`Награда за монстра: +${result.bountyGold} золота · всего ${result.gold}`, screen.width / 2, this.layout.rewardY, {
                    align: 'center',
                    size: this.layout.mode === 'portrait' ? 18 : 20,
                    color: '#f3d991',
                    lineHeight: this.layout.mode === 'portrait' ? 21 : 24,
                    maxWidth: this.layout.panel.width - 38,
                    wordWrap: this.layout.mode === 'portrait',
                });
            }
            drawResultButton(ui, this.actionButton, label, {
                mouse,
                color: isDefeat ? '#4a2430' : '#1c3346',
                hoverColor: isDefeat ? '#6d2f3e' : '#244c61',
                accent: isDefeat ? '#d78486' : '#d6a25c',
            });
        },
        getDebugState() {
            return {
                result: {
                    outcome: result.outcome,
                    battleNumber: result.battleNumber,
                    completedBattles: result.completedBattles,
                    totalBattles: result.totalBattles,
                    isRunVictory: result.isRunVictory,
                },
                layout: this.layout,
            };
        },
    };
}
