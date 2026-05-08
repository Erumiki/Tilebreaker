import { GAMEPLAY_VARIANTS, getGameplayVariant } from '../entities/gameplayVariants.js';

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
    const availableWidth = Math.min(screen.width - 48, 760);
    const buttonWidth = Math.max(116, (availableWidth - gap * (GAMEPLAY_VARIANTS.length - 1)) / GAMEPLAY_VARIANTS.length);
    const width = buttonWidth * GAMEPLAY_VARIANTS.length + gap * (GAMEPLAY_VARIANTS.length - 1);
    const startX = screen.width / 2 - width / 2;
    const y = screen.height * 0.52;

    return GAMEPLAY_VARIANTS.map((variant, index) => ({
        variant,
        rect: {
            x: startX + index * (buttonWidth + gap),
            y,
            width: buttonWidth,
            height: 58,
        },
    }));
}

export function createMainMenuScene({ config, input, ui, onStart }) {
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
            ui.drawRect({
                x: 0,
                y: 0,
                width: screen.width,
                height: screen.height,
            }, [
                color[0] * pulse,
                color[1] * pulse,
                color[2] * pulse,
            ]);
            this.variantButtons = getVariantButtons(screen);
            this.startButton = getStartButton(screen);
            const mouse = input.getMouse();

            ui.drawText('Tilebreaker', screen.width / 2, screen.height * 0.24, {
                align: 'center',
                size: 56,
                color: '#f3fbff',
            });
            ui.drawText('Прототип забега: 5 битв, результат и улучшения', screen.width / 2, screen.height * 0.38, {
                align: 'center',
                size: 22,
                color: '#b8c8d8',
            });
            ui.drawText('Выбор варианта', screen.width / 2, screen.height * 0.465, {
                align: 'center',
                size: 18,
                color: '#9fb8ca',
            });
            for (const button of this.variantButtons) {
                const selected = button.variant.id === selectedVariantId;
                ui.drawButton(button.rect, button.variant.shortLabel, {
                    mouse,
                    color: selected ? '#385737' : '#162a3b',
                    hoverColor: selected ? '#8bdc82' : '#66c7f4',
                    edgeColor: selected ? '#b6f2a4' : '#5f8faa',
                    textSize: 19,
                    textColor: selected ? '#f1ffe8' : '#d8e7f2',
                });
                ui.drawText(button.variant.title, button.rect.x + button.rect.width / 2, button.rect.y + 62, {
                    align: 'center',
                    size: 12,
                    color: selected ? '#d9ffd1' : '#8fb1cb',
                });
            }
            ui.drawButton(this.startButton, 'Начать забег', {
                mouse,
                color: '#1c3346',
                hoverColor: '#66c7f4',
            });
        },
        getDebugState() {
            return {
                selectedVariant: selectedVariantId,
                variants: GAMEPLAY_VARIANTS.map((variant) => ({
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
