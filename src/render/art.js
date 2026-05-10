export function getArtTexture(artTextures, assetId) {
    return artTextures?.textures?.get(assetId) ?? null;
}

export function drawMissingArtAsset(ui, rect, assetId, options = {}) {
    const alpha = options.alpha ?? 0.98;
    const stripeCount = Math.max(3, Math.ceil(rect.width / 28));

    ui.drawRect(rect, '#250817', alpha);
    for (let index = 0; index < stripeCount; index += 1) {
        ui.drawRect({
            x: rect.x + index * 32,
            y: rect.y,
            width: 12,
            height: rect.height,
        }, index % 2 === 0 ? '#ff3fa4' : '#141820', 0.45);
    }
    ui.drawRect({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: Math.min(6, Math.max(2, rect.height * 0.08)),
    }, '#ff4fb2', 0.9);
    ui.drawText('MISSING ART', rect.x + rect.width / 2, rect.y + Math.max(8, rect.height * 0.24), {
        align: 'center',
        size: Math.max(11, Math.min(18, rect.height * 0.16)),
        color: '#fff2ca',
        weight: 700,
        maxWidth: rect.width - 8,
    });
    ui.drawText(assetId, rect.x + rect.width / 2, rect.y + Math.max(26, rect.height * 0.52), {
        align: 'center',
        size: Math.max(9, Math.min(13, rect.height * 0.11)),
        color: '#ffd4ea',
        weight: 600,
        maxWidth: rect.width - 10,
        breakWords: true,
    });
}

export function drawArtImage(ui, artTextures, assetId, rect, options = {}) {
    const texture = getArtTexture(artTextures, assetId);

    if (!texture) {
        if (options.required) {
            drawMissingArtAsset(ui, rect, assetId, {
                alpha: options.alpha,
            });
            return true;
        }

        return false;
    }

    ui.drawImage(texture, rect, {
        alpha: options.alpha ?? 1,
        tint: options.tint,
        fit: options.fit,
    });
    return true;
}
