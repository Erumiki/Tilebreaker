export function colorArrayToHex(color) {
    return color.slice(0, 3).reduce((result, channel) => (
        (result << 8) + Math.round(channel * 255)
    ), 0);
}

export async function initPixi(PIXI, canvas, config) {
    const app = new PIXI.Application();
    await app.init({
        canvas,
        resizeTo: window,
        backgroundColor: colorArrayToHex(config.game.clearColor),
        backgroundAlpha: config.game.clearColor[3] ?? 1,
        antialias: false,
        autoDensity: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        preference: 'webgl',
    });

    return app;
}
