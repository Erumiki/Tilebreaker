import { GAMEPLAY_VARIANTS, getGameplayVariant } from '../entities/gameplayVariants.js';

const HIDDEN_PLAYTEST_VARIANTS = new Set([
    'placement_payoff',
    'road_mode',
]);

function getMenuVariants() {
    return GAMEPLAY_VARIANTS.filter((variant) => !HIDDEN_PLAYTEST_VARIANTS.has(variant.id));
}

function getStartButton(screen) {
    const width = Math.min(340, screen.width - 48);
    return {
        x: screen.width / 2 - width / 2,
        y: screen.height * 0.77,
        width,
        height: 64,
    };
}

function getVariantButtons(screen) {
    const gap = 10;
    const variants = getMenuVariants();
    const availableWidth = Math.min(screen.width - 48, 760);
    const buttonWidth = Math.max(116, (availableWidth - gap * (variants.length - 1)) / variants.length);
    const width = buttonWidth * variants.length + gap * (variants.length - 1);
    const startX = screen.width / 2 - width / 2;
    const y = screen.height * 0.52;

    return variants.map((variant, index) => ({
        variant,
        rect: {
            x: startX + index * (buttonWidth + gap),
            y,
            width: buttonWidth,
            height: 58,
        },
    }));
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
    const prefix = options.secondary ? 'button_secondary' : 'button_primary';
    const drawn = drawArtImage(ui, artTextures, `${prefix}_${state}`, rect, { alpha: 1 });

    if (!drawn) {
        ui.drawButton(rect, label, options);
        return;
    }

    ui.drawText(label, rect.x + rect.width / 2, rect.y + rect.height / 2 - (options.textSize ?? 22) / 2 - 2, {
        align: 'center',
        size: options.textSize ?? 22,
        color: hovered ? options.hoverTextColor ?? '#fff2ca' : options.textColor ?? '#f7e7bd',
        weight: 700,
    });
}

export function createMainMenuScene({ config, input, ui, artTextures = null, onStart }) {
    let selectedVariantId = getGameplayVariant(config.game.tileBattle).id;

    return {
        name: 'mainmenu',
        update() {
            const click = input.consumeClick();

            if (click) {
                const variantButton = this.variantButtons.find((button) => (
                    ui.contains(button.rect, click)
                ));

                if (variantButton) {
                    selectedVariantId = variantButton.variant.id;
                    return;
                }

                if (ui.contains(this.startButton, click)) {
                    onStart(selectedVariantId);
                }
            }

            if (input.isKeyDown('Enter') || input.isKeyDown('Space')) {
                onStart(selectedVariantId);
            }
        },
        render(app) {
            ui.begin();
            const screen = app.screen;
            const pulse = (Math.sin(performance.now() * 0.002) + 1) * 0.5;
            const color = config.game.menuPulseColor;
            const screenRect = {
                x: 0,
                y: 0,
                width: screen.width,
                height: screen.height,
            };

            if (!drawArtImage(ui, artTextures, 'screen_background_menu', screenRect, { fit: 'cover' })) {
                ui.drawRect(screenRect, [
                    color[0] * pulse,
                    color[1] * pulse,
                    color[2] * pulse,
                ]);
            }
            ui.drawRect(screenRect, '#03070c', 0.24);
            this.variantButtons = getVariantButtons(screen);
            this.startButton = getStartButton(screen);
            const mouse = input.getMouse();

            ui.drawText('Tilebreaker', screen.width / 2, screen.height * 0.24, {
                align: 'center',
                size: 56,
                color: '#ffe7ad',
            });
            ui.drawText('Звездный архив под ударом', screen.width / 2, screen.height * 0.38, {
                align: 'center',
                size: screen.width < 460 ? 19 : 22,
                color: '#d7c59e',
            });
            ui.drawText('Выбор варианта', screen.width / 2, screen.height * 0.465, {
                align: 'center',
                size: 18,
                color: '#bda172',
            });
            for (const button of this.variantButtons) {
                const selected = button.variant.id === selectedVariantId;
                drawArtButton(ui, artTextures, button.rect, button.variant.shortLabel, {
                    mouse,
                    secondary: true,
                    color: selected ? '#385737' : '#162a3b',
                    hoverColor: selected ? '#8bdc82' : '#66c7f4',
                    edgeColor: selected ? '#b6f2a4' : '#5f8faa',
                    textSize: 19,
                    textColor: selected ? '#c9ffd9' : '#f7e7bd',
                });
                ui.drawText(button.variant.title, button.rect.x + button.rect.width / 2, button.rect.y + 62, {
                    align: 'center',
                    size: 12,
                    color: selected ? '#d9ffd1' : '#bca77e',
                });
            }
            drawArtButton(ui, artTextures, this.startButton, 'Начать забег', {
                mouse,
                color: '#1c3346',
                hoverColor: '#66c7f4',
                textSize: 22,
            });
        },
        getDebugState() {
            return {
                selectedVariant: selectedVariantId,
                variants: getMenuVariants().map((variant) => ({
                    id: variant.id,
                    shortLabel: variant.shortLabel,
                    title: variant.title,
                })),
                layout: {
                    variants: this.variantButtons,
                    startButton: this.startButton,
                },
            };
        },
        startButton: { x: 0, y: 0, width: 0, height: 0 },
        variantButtons: [],
    };
}
