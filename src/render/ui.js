function colorToPixi(color) {
    if (Array.isArray(color)) {
        return color.slice(0, 3).reduce((result, channel) => (
            (result << 8) + Math.round(channel * 255)
        ), 0);
    }

    return color;
}

function destroyChildren(container) {
    const children = container.removeChildren();
    children.forEach((child) => {
        child.destroy({ children: true });
    });
}

function contains(rect, point) {
    return point.x >= rect.x
        && point.x <= rect.x + rect.width
        && point.y >= rect.y
        && point.y <= rect.y + rect.height;
}

export function createUiRenderer(PIXI, stage) {
    const layer = new PIXI.Container();
    stage.addChild(layer);

    function drawRect(rect, color, alpha = 1) {
        const graphic = new PIXI.Graphics()
            .rect(rect.x, rect.y, rect.width, rect.height)
            .fill({
                color: colorToPixi(color),
                alpha,
            });

        layer.addChild(graphic);
        return graphic;
    }

    function drawText(text, x, y, options = {}) {
        const content = Array.isArray(text) ? text.join('\n') : String(text);
        const align = options.align ?? 'left';
        const label = new PIXI.Text({
            text: content,
            style: {
                fontFamily: options.family ?? 'Arial, sans-serif',
                fontSize: options.size ?? 24,
                fontWeight: options.weight ?? 600,
                fill: colorToPixi(options.color ?? '#ffffff'),
                align,
                lineHeight: options.lineHeight ?? Math.round((options.size ?? 24) * 1.25),
            },
        });

        if (align === 'center') {
            label.anchor.set(0.5, 0);
        }

        label.x = x;
        label.y = y;
        layer.addChild(label);
        return label;
    }

    function drawButton(rect, label, options = {}) {
        const hovered = options.mouse ? contains(rect, options.mouse) : false;
        drawRect(rect, hovered ? options.hoverColor ?? '#6ed4ff' : options.color ?? '#24364d');
        drawRect({
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: 2,
        }, options.edgeColor ?? '#9fdfff', hovered ? 1 : 0.7);
        drawText(label, rect.x + rect.width / 2, rect.y + rect.height / 2 - 17, {
            align: 'center',
            size: options.textSize ?? 22,
            color: hovered ? options.hoverTextColor ?? '#061018' : options.textColor ?? '#ffffff',
        });
    }

    return {
        begin() {
            destroyChildren(layer);
        },
        drawRect,
        drawText,
        drawButton,
        contains,
    };
}
