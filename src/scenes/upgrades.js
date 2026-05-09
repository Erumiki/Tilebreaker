function getChoiceRects(screen, choiceCount) {
    const gap = 18;
    const isStacked = screen.width < 720;
    const columns = isStacked ? 1 : choiceCount;
    const totalGap = gap * (columns - 1);
    const availableWidth = screen.width - 48 - totalGap;
    const width = Math.min(230, availableWidth / columns);
    const totalWidth = width * columns + totalGap;
    const startX = screen.width / 2 - totalWidth / 2;
    const startY = screen.height * 0.48;

    return Array.from({ length: choiceCount }, (_, index) => ({
        x: startX + (isStacked ? 0 : index * (width + gap)),
        y: startY + (isStacked ? index * 154 : 0),
        width,
        height: isStacked ? 136 : 142,
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

export function createUpgradeScene({
    input,
    ui,
    artTextures = null,
    run,
    upgrades,
    onChoose,
}) {
    return {
        name: 'upgrades',
        choiceRects: [],
        update() {
            const click = input.consumeClick();

            if (!click) {
                return;
            }

            const index = this.choiceRects.findIndex((rect) => ui.contains(rect, click));
            if (index >= 0) {
                onChoose(upgrades[index]);
            }
        },
        render(app) {
            ui.begin();
            const screen = app.screen;
            this.choiceRects = getChoiceRects(screen, upgrades.length);
            const mouse = input.getMouse();
            const screenRect = {
                x: 0,
                y: 0,
                width: screen.width,
                height: screen.height,
            };

            if (!drawArtImage(ui, artTextures, 'screen_background_shop', screenRect, { fit: 'cover' })) {
                ui.drawRect(screenRect, '#07111d', 1);
            }
            ui.drawRect(screenRect, '#03070c', 0.22);

            ui.drawText('Улучшения', screen.width / 2, screen.height * 0.18, {
                align: 'center',
                size: 46,
                color: '#ffe7ad',
            });
            ui.drawText(`Перед битвой ${run.completedBattles + 1} выбери одно мета-усиление`, screen.width / 2, screen.height * 0.32, {
                align: 'center',
                size: 22,
                color: '#d7c59e',
            });
            ui.drawText(`Колода ${run.deck.length}  |  Добор ${run.drawPile.length}  |  Сброс ${run.discardPile.length}`, screen.width / 2, screen.height * 0.38, {
                align: 'center',
                size: 17,
                color: '#bca77e',
            });

            upgrades.forEach((upgrade, index) => {
                const rect = this.choiceRects[index];
                const hovered = ui.contains(rect, mouse);
                const assetId = hovered ? 'shop_card_affordable' : 'shop_card_offer';
                if (!drawArtImage(ui, artTextures, assetId, rect)) {
                    ui.drawRect(rect, hovered ? '#355e78' : '#17293b', 0.96);
                    ui.drawRect({
                        x: rect.x,
                        y: rect.y,
                        width: rect.width,
                        height: 3,
                    }, '#8bd7ff', hovered ? 1 : 0.65);
                }
                ui.drawText(upgrade.name, rect.x + rect.width / 2, rect.y + 22, {
                    align: 'center',
                    size: 21,
                    color: '#fff2ca',
                });
                ui.drawText(upgrade.description, rect.x + rect.width / 2, rect.y + 72, {
                    align: 'center',
                    size: 16,
                    color: '#d7c59e',
                    lineHeight: 22,
                });
            });
        },
        getDebugState() {
            return {
                upgrades,
                layout: {
                    choices: this.choiceRects,
                },
            };
        },
    };
}
