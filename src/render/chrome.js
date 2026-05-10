export function insetRect(rect, amount) {
    return {
        x: rect.x + amount,
        y: rect.y + amount,
        width: rect.width - amount * 2,
        height: rect.height - amount * 2,
    };
}

export function drawBorder(ui, rect, color, thickness = 2, alpha = 1) {
    ui.drawRect({ x: rect.x, y: rect.y, width: rect.width, height: thickness }, color, alpha);
    ui.drawRect({ x: rect.x, y: rect.y + rect.height - thickness, width: rect.width, height: thickness }, color, alpha);
    ui.drawRect({ x: rect.x, y: rect.y, width: thickness, height: rect.height }, color, alpha);
    ui.drawRect({ x: rect.x + rect.width - thickness, y: rect.y, width: thickness, height: rect.height }, color, alpha);
}

export function drawCornerBrackets(ui, rect, color, options = {}) {
    const inset = options.inset ?? 8;
    const alpha = options.alpha ?? 0.9;
    const thickness = Math.max(1, Math.min(
        options.thickness ?? 3,
        rect.width / 6,
        rect.height / 6,
    ));
    const maxLength = Math.max(0, Math.min(
        rect.width / 2 - inset,
        rect.height / 2 - inset,
    ));
    const length = Math.max(thickness, Math.min(options.length ?? 28, maxLength));
    const left = rect.x + inset;
    const right = rect.x + rect.width - inset;
    const top = rect.y + inset;
    const bottom = rect.y + rect.height - inset;

    ui.drawRect({ x: left, y: top, width: length, height: thickness }, color, alpha);
    ui.drawRect({ x: left, y: top, width: thickness, height: length }, color, alpha);
    ui.drawRect({ x: right - length, y: top, width: length, height: thickness }, color, alpha);
    ui.drawRect({ x: right - thickness, y: top, width: thickness, height: length }, color, alpha);
    ui.drawRect({ x: left, y: bottom - thickness, width: length, height: thickness }, color, alpha);
    ui.drawRect({ x: left, y: bottom - length, width: thickness, height: length }, color, alpha);
    ui.drawRect({ x: right - length, y: bottom - thickness, width: length, height: thickness }, color, alpha);
    ui.drawRect({ x: right - thickness, y: bottom - length, width: thickness, height: length }, color, alpha);
}

export function drawFramedPanel(ui, rect, options = {}) {
    const accent = options.accent ?? '#d6a25c';
    const border = options.border ?? '#1c130f';
    const fill = options.fill ?? '#050911';
    const innerFill = options.innerFill ?? '#0b121d';
    const urgent = options.urgent ?? false;
    const innerInset = options.innerInset ?? 10;
    const lineInset = options.lineInset ?? 7;

    ui.drawRect(rect, fill, options.alpha ?? 0.84);
    ui.drawRect(insetRect(rect, innerInset), innerFill, options.innerAlpha ?? 0.56);
    drawBorder(ui, rect, border, options.outerThickness ?? 4, options.borderAlpha ?? 0.9);
    drawBorder(ui, insetRect(rect, lineInset), accent, options.innerThickness ?? 2, options.accentAlpha ?? (urgent ? 0.54 : 0.48));
    drawCornerBrackets(ui, rect, accent, {
        inset: lineInset,
        length: options.cornerLength ?? 28,
        thickness: options.cornerThickness ?? 4,
        alpha: options.cornerAlpha ?? (urgent ? 0.72 : 0.62),
    });
}
