function colorToPixi(color) {
    if (Array.isArray(color)) {
        return color.slice(0, 3).reduce((result, channel) => (
            (result << 8) + Math.round(channel * 255)
        ), 0);
    }

    return color;
}

function contains(rect, point) {
    return point.x >= rect.x
        && point.x <= rect.x + rect.width
        && point.y >= rect.y
        && point.y <= rect.y + rect.height;
}

export function createUiRenderer(PIXI, stage) {
    const layer = new PIXI.Container();
    const drawItems = [];
    let drawCursor = 0;
    stage.addChild(layer);

    function useDrawItem(kind, create) {
        const index = drawCursor;
        drawCursor += 1;
        const existing = drawItems[index];

        if (existing?.kind === kind) {
            existing.object.visible = true;
            return existing.object;
        }

        if (existing) {
            layer.removeChild(existing.object);
            existing.object.destroy({ children: true });
        }

        const object = create();
        drawItems[index] = { kind, object };
        layer.addChildAt(object, Math.min(index, layer.children.length));
        return object;
    }

    function drawRect(rect, color, alpha = 1) {
        const graphic = useDrawItem('rect', () => new PIXI.Graphics());
        graphic
            .clear()
            .rect(rect.x, rect.y, rect.width, rect.height)
            .fill({
                color: colorToPixi(color),
                alpha,
            });

        return graphic;
    }

    function drawText(text, x, y, options = {}) {
        const content = Array.isArray(text) ? text.join('\n') : String(text);
        const align = options.align ?? 'left';
        const label = useDrawItem('text', () => new PIXI.Text({
            text: '',
            style: {},
        }));

        label.text = content;
        label.style = {
            fontFamily: options.family ?? 'Arial, sans-serif',
            fontSize: options.size ?? 24,
            fontWeight: options.weight ?? 600,
            fill: colorToPixi(options.color ?? '#ffffff'),
            align,
            lineHeight: options.lineHeight ?? Math.round((options.size ?? 24) * 1.25),
        };

        if (align === 'center') {
            label.anchor.set(0.5, 0);
        } else {
            label.anchor.set(0, 0);
        }

        label.x = x;
        label.y = y;
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
            drawCursor = 0;
            for (const item of drawItems) {
                if (item) {
                    item.object.visible = false;
                }
            }
        },
        drawRect,
        drawText,
        drawButton,
        contains,
    };
}
