import { getGameplayVariant } from '../entities/gameplayVariants.js';
import { drawArtImage } from '../render/art.js';

function getStartButton(screen) {
    const width = Math.min(340, screen.width - 48);
    return {
        x: screen.width / 2 - width / 2,
        y: screen.height * 0.64,
        width,
        height: 64,
    };
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function getLogoLayout(screen) {
    const compact = screen.width < 460 || screen.height < 700;
    const narrow = screen.width < 380;
    const width = Math.min(screen.width - (compact ? 24 : 80), compact ? 390 : 980);
    const titleSize = compact
        ? narrow ? 45 : 52
        : screen.width < 900 ? 74 : 96;
    const taglineSize = compact
        ? narrow ? 19 : 22
        : 30;
    const titleY = Math.round(clamp(screen.height * (compact ? 0.18 : 0.19), compact ? 116 : 112, compact ? 154 : 150));
    const taglineY = Math.max(28, titleY - taglineSize - (compact ? 10 : 14));
    const dividerY = titleY + Math.round(titleSize * 0.9);
    const height = dividerY + taglineSize - taglineY;

    return {
        x: screen.width / 2 - width / 2,
        y: taglineY,
        width,
        height,
        centerX: screen.width / 2,
        titleY,
        titleSize,
        taglineY,
        taglineSize,
        dividerY,
        compact,
    };
}

function drawArtButton(ui, artTextures, rect, label, options = {}) {
    const hovered = options.mouse ? ui.contains(rect, options.mouse) : false;
    const state = options.disabled ? 'disabled' : hovered ? 'hover' : 'default';
    const prefix = options.secondary ? 'button_secondary' : 'button_primary';
    const drawn = drawArtImage(ui, artTextures, `${prefix}_${state}`, rect, {
        alpha: 1,
        required: true,
    });

    if (!drawn) {
        ui.drawButton(rect, label, options);
        return;
    }

    ui.drawText(label, rect.x + rect.width / 2, rect.y + rect.height / 2 - (options.textSize ?? 22) / 2 - 2, {
        align: 'center',
        size: options.textSize ?? 22,
        color: hovered ? options.hoverTextColor ?? '#fff2ca' : options.textColor ?? '#f7e7bd',
        weight: 700,
        maxWidth: rect.width - 28,
    });
}

function drawLogoLine(graphic, points, color, width, alpha = 1) {
    const [start, ...rest] = points;

    graphic.moveTo(start.x, start.y);
    for (const point of rest) {
        graphic.lineTo(point.x, point.y);
    }
    graphic.stroke({
        color,
        width,
        alpha,
        cap: 'round',
        join: 'round',
    });
}

function drawLogoBackplate(ui, layout, pulse) {
    const centerX = layout.centerX;
    const titleY = layout.titleY;
    const titleSize = layout.titleSize;
    const left = layout.x + layout.width * 0.08;
    const right = layout.x + layout.width * 0.92;
    const pathTop = titleY + titleSize * 0.2;
    const pathMid = titleY + titleSize * 0.5;
    const pathBottom = titleY + titleSize * 0.78;
    const pathWidth = layout.compact ? 4 : 6;

    ui.drawGraphic((graphic) => {
        graphic
            .ellipse(centerX, titleY + titleSize * 0.48, layout.width * 0.42, titleSize * 0.74)
            .fill({ color: 0x07111c, alpha: 0.46 });
        graphic
            .ellipse(centerX, titleY + titleSize * 0.5, layout.width * 0.35, titleSize * 0.56)
            .stroke({ color: 0xc59b56, width: Math.max(1, titleSize * 0.012), alpha: 0.18 + pulse * 0.08 });

        drawLogoLine(graphic, [
            { x: left, y: pathTop },
            { x: centerX - layout.width * 0.16, y: pathTop },
            { x: centerX - layout.width * 0.16, y: pathBottom },
            { x: centerX - layout.width * 0.05, y: pathBottom },
        ], 0xf4543e, pathWidth, 0.34);
        drawLogoLine(graphic, [
            { x: centerX + layout.width * 0.03, y: pathBottom },
            { x: centerX + layout.width * 0.2, y: pathBottom },
            { x: centerX + layout.width * 0.2, y: pathMid },
            { x: right, y: pathMid },
        ], 0x63c8ff, pathWidth, 0.34);
        graphic
            .circle(centerX, pathBottom, Math.max(4, titleSize * 0.07))
            .fill({ color: 0xffe4a8, alpha: 0.35 + pulse * 0.14 });
    });
}

function drawLogoTitle(ui, layout) {
    const title = 'tilebreaker';
    const outline = Math.max(2, Math.round(layout.titleSize * 0.045));
    const titleStyle = {
        align: 'center',
        family: 'Georgia, Times New Roman, serif',
        size: layout.titleSize,
        weight: 700,
        fontStyle: 'italic',
        lineHeight: Math.round(layout.titleSize * 1.02),
    };
    const outlineOffsets = [
        [0, outline],
        [outline, 0],
        [0, -outline],
        [-outline, 0],
        [outline, outline],
        [outline, -outline],
        [-outline, outline],
        [-outline, -outline],
    ];

    ui.drawText(title, layout.centerX + outline + 4, layout.titleY + outline + 5, {
        ...titleStyle,
        color: '#02050a',
        alpha: 0.9,
    });
    for (const [dx, dy] of outlineOffsets) {
        ui.drawText(title, layout.centerX + dx, layout.titleY + dy, {
            ...titleStyle,
            color: '#7c5228',
        });
    }

    for (const [dx, dy] of [
        [0, Math.max(1, Math.round(outline * 0.55))],
        [Math.max(1, Math.round(outline * 0.55)), 0],
        [-Math.max(1, Math.round(outline * 0.55)), 0],
    ]) {
        ui.drawText(title, layout.centerX + dx, layout.titleY + dy, {
            ...titleStyle,
            color: '#d8b675',
        });
    }
    ui.drawText(title, layout.centerX, layout.titleY + Math.max(2, Math.round(layout.titleSize * 0.045)), {
        ...titleStyle,
        color: '#a7783d',
        alpha: 0.72,
    });
    ui.drawText(title, layout.centerX, layout.titleY, {
        ...titleStyle,
        color: '#f3f6f8',
    });
    ui.drawText(title, layout.centerX, layout.titleY - Math.max(1, Math.round(layout.titleSize * 0.025)), {
        ...titleStyle,
        color: '#fff6df',
        alpha: 0.48,
    });
}

function drawLogoDivider(ui, layout, pulse) {
    const width = Math.min(layout.width * 0.8, layout.compact ? 330 : 720);
    const x = layout.centerX - width / 2;
    const y = layout.dividerY;

    ui.drawGraphic((graphic) => {
        graphic.rect(x, y, width / 2 - 6, 2).fill({ color: 0xf4543e, alpha: 0.62 + pulse * 0.18 });
        graphic.rect(layout.centerX + 6, y, width / 2 - 6, 2).fill({ color: 0x63c8ff, alpha: 0.62 + pulse * 0.18 });
        graphic.poly([
            layout.centerX, y - 5,
            layout.centerX + 6, y + 1,
            layout.centerX, y + 7,
            layout.centerX - 6, y + 1,
        ]).fill({ color: 0xffe7ad, alpha: 0.88 });
    });
}

function drawLogoSwashes(ui, layout) {
    const titleSize = layout.titleSize;
    const left = layout.x + layout.width * 0.05;
    const right = layout.x + layout.width * 0.95;
    const y = layout.titleY + titleSize * 0.78;
    const strokeWidth = Math.max(2, titleSize * 0.035);

    ui.drawGraphic((graphic) => {
        graphic
            .moveTo(left + titleSize * 0.28, layout.titleY + titleSize * 0.16)
            .quadraticCurveTo(left - titleSize * 0.12, y + titleSize * 0.25, left + titleSize * 0.6, y + titleSize * 0.34)
            .stroke({ color: 0x8a5d2b, width: strokeWidth + 1, alpha: 0.82, cap: 'round' });
        graphic
            .moveTo(left + titleSize * 0.28, layout.titleY + titleSize * 0.16)
            .quadraticCurveTo(left - titleSize * 0.1, y + titleSize * 0.22, left + titleSize * 0.56, y + titleSize * 0.3)
            .stroke({ color: 0xf4e7c4, width: Math.max(1, strokeWidth * 0.45), alpha: 0.58, cap: 'round' });

        graphic
            .moveTo(right - titleSize * 0.72, y + titleSize * 0.18)
            .quadraticCurveTo(right + titleSize * 0.1, y + titleSize * 0.24, right - titleSize * 0.14, layout.titleY + titleSize * 0.2)
            .stroke({ color: 0x8a5d2b, width: strokeWidth + 1, alpha: 0.82, cap: 'round' });
        graphic
            .moveTo(right - titleSize * 0.68, y + titleSize * 0.15)
            .quadraticCurveTo(right + titleSize * 0.05, y + titleSize * 0.2, right - titleSize * 0.18, layout.titleY + titleSize * 0.22)
            .stroke({ color: 0xf4e7c4, width: Math.max(1, strokeWidth * 0.45), alpha: 0.58, cap: 'round' });
    });
}

function drawTagline(ui, layout, pulse) {
    const text = 'Build the path';
    const width = Math.min(layout.width * (layout.compact ? 0.68 : 0.42), layout.compact ? 260 : 360);
    const height = layout.taglineSize + (layout.compact ? 16 : 18);
    const rect = {
        x: layout.centerX - width / 2,
        y: layout.taglineY - (layout.compact ? 7 : 8),
        width,
        height,
    };

    ui.drawGraphic((graphic) => {
        graphic
            .roundRect(rect.x, rect.y, rect.width, rect.height, height / 2)
            .fill({ color: 0x07101a, alpha: 0.68 })
            .stroke({ color: 0xd2a460, width: 1, alpha: 0.44 + pulse * 0.14 });
        graphic
            .rect(rect.x + 16, rect.y + rect.height - 2, rect.width - 32, 1)
            .fill({ color: 0xffe7ad, alpha: 0.3 + pulse * 0.1 });
    });
    ui.drawText(text, layout.centerX + 1, layout.taglineY + 1, {
        align: 'center',
        family: 'Georgia, Times New Roman, serif',
        size: layout.taglineSize,
        weight: 700,
        color: '#03070c',
        alpha: 0.75,
    });
    ui.drawText(text, layout.centerX, layout.taglineY, {
        align: 'center',
        family: 'Georgia, Times New Roman, serif',
        size: layout.taglineSize,
        weight: 700,
        color: '#fff1cf',
    });
}

function drawGameLogo(ui, layout, pulse) {
    drawTagline(ui, layout, pulse);
    drawLogoBackplate(ui, layout, pulse);
    drawLogoSwashes(ui, layout);
    drawLogoTitle(ui, layout);
    drawLogoDivider(ui, layout, pulse);
}

export function createMainMenuScene({ config, input, ui, artTextures = null, onStart }) {
    let selectedVariantId = getGameplayVariant(config.game.tileBattle).id;

    return {
        name: 'mainmenu',
        update() {
            const click = input.consumeClick();

            if (click) {
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

            if (!drawArtImage(ui, artTextures, 'screen_background_menu', screenRect, {
                fit: 'cover',
                required: true,
            })) {
                ui.drawRect(screenRect, [
                    color[0] * pulse,
                    color[1] * pulse,
                    color[2] * pulse,
                ]);
            }
            ui.drawRect(screenRect, '#03070c', 0.24);
            this.logoLayout = getLogoLayout(screen);
            this.startButton = getStartButton(screen);
            const mouse = input.getMouse();

            drawGameLogo(ui, this.logoLayout, pulse);
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
                variants: [],
                layout: {
                    variants: [],
                    logo: this.logoLayout,
                    startButton: this.startButton,
                },
            };
        },
        startButton: { x: 0, y: 0, width: 0, height: 0 },
        logoLayout: { x: 0, y: 0, width: 0, height: 0 },
    };
}
