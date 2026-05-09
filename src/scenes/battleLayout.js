const PORTRAIT_BREAKPOINT = 760;
const PORTRAIT_ASPECT = 1.08;
const MIN_TOUCH_SIZE = 44;

function isQueueDrawMode(settings) {
    return settings.drawMode === 'queue';
}

function isHoldEnabled(settings) {
    return settings.holdEnabled === true && !isQueueDrawMode(settings);
}

function rect(x, y, width, height) {
    return { x, y, width, height };
}

function collectLayoutRects(layout) {
    return [
        layout.hud,
        layout.monsterBanner,
        layout.board,
        layout.feedback,
        layout.log,
        layout.sidePanel,
        layout.primaryButton,
        layout.hold,
        ...(layout.hand ?? []),
    ].filter(Boolean);
}

function getViewportStatus(layout, screen) {
    const rects = collectLayoutRects(layout);
    const bounds = rects.reduce((result, item) => ({
        minX: Math.min(result.minX, item.x),
        minY: Math.min(result.minY, item.y),
        maxX: Math.max(result.maxX, item.x + item.width),
        maxY: Math.max(result.maxY, item.y + item.height),
    }), {
        minX: Number.POSITIVE_INFINITY,
        minY: Number.POSITIVE_INFINITY,
        maxX: Number.NEGATIVE_INFINITY,
        maxY: Number.NEGATIVE_INFINITY,
    });
    const overflow = {
        left: Math.max(0, -bounds.minX),
        top: Math.max(0, -bounds.minY),
        right: Math.max(0, bounds.maxX - screen.width),
        bottom: Math.max(0, bounds.maxY - screen.height),
    };

    return {
        screen: {
            width: screen.width,
            height: screen.height,
        },
        bounds,
        overflow,
        overflows: Object.values(overflow).some((value) => value > 0),
    };
}

function getMinTouchTarget(layout) {
    const touchRects = [
        layout.primaryButton,
        layout.hold,
        ...(layout.hand ?? []),
    ].filter(Boolean);

    if (touchRects.length === 0) {
        return 0;
    }

    return Math.min(...touchRects.map((item) => Math.min(item.width, item.height)));
}

function withMetadata(layout, screen, safeArea) {
    const cellSize = layout.board.width / layout.boardCells;
    const metadata = {
        ...layout,
        cellSize,
        endRoundButton: layout.primaryButton,
        safeArea,
    };

    metadata.viewport = getViewportStatus(metadata, screen);
    metadata.minTouchTarget = getMinTouchTarget(metadata);
    return metadata;
}

function createDesktopLayout(screen, settings) {
    const boardPixels = Math.min(screen.width - 360, screen.height - 290, 438);
    const boardSize = Math.max(300, boardPixels);
    const boardX = Math.max(
        24,
        Math.min(screen.width * 0.5 - boardSize / 2, screen.width - boardSize - 300),
    );
    const boardY = 144;
    const isQueue = isQueueDrawMode(settings);
    const holdEnabled = isHoldEnabled(settings);
    const holdGap = holdEnabled ? 14 : 0;
    const handSlot = isQueue
        ? Math.min(116, (screen.width - 96) / 2.1)
        : Math.min(82, Math.max(
            54,
            (screen.width - 64 - holdGap - (settings.handSize - 1) * 8)
                / (settings.handSize + (holdEnabled ? 1 : 0)),
        ));
    const previewSlot = isQueue ? Math.floor(handSlot * 0.72) : handSlot;
    const handCount = isQueue ? 2 : settings.handSize;
    const handWidth = isQueue
        ? handSlot + 14 + previewSlot
        : settings.handSize * handSlot + (settings.handSize - 1) * 8;
    const groupWidth = handWidth + (holdEnabled ? handSlot + holdGap : 0);
    const groupX = screen.width / 2 - groupWidth / 2;
    const handX = groupX + (holdEnabled ? handSlot + holdGap : 0);
    const handY = screen.height - handSlot - 28;
    const sideX = boardX + boardSize + 24;
    const sideWidth = Math.max(240, screen.width - sideX - 24);
    const sidePanel = rect(sideX, boardY, sideWidth, boardSize);
    const hand = Array.from({ length: handCount }, (_, index) => {
        if (!isQueue) {
            return rect(
                handX + index * (handSlot + 8),
                handY,
                handSlot,
                handSlot,
            );
        }

        const size = index === 0 ? handSlot : previewSlot;
        return rect(
            screen.width / 2 - handWidth / 2 + (index === 0 ? 0 : handSlot + 14),
            handY + (handSlot - size),
            size,
            size,
        );
    });

    return withMetadata({
        mode: 'desktop',
        boardCells: settings.boardSize,
        hud: rect(28, 20, Math.min(620, screen.width - 56), 58),
        monsterBanner: rect(sidePanel.x + 16, sidePanel.y + 16, sidePanel.width - 32, 72),
        board: rect(boardX, boardY, boardSize, boardSize),
        feedback: rect(boardX, handY - 38, boardSize, 26),
        log: rect(sidePanel.x + 16, sidePanel.y + sidePanel.height - 86, sidePanel.width - 32, 70),
        hold: holdEnabled ? rect(groupX, handY, handSlot, handSlot) : null,
        hand,
        primaryButton: rect(sideX, handY - 82, sideWidth, 56),
        sidePanel,
    }, screen, {
        left: 24,
        right: 24,
        top: 20,
        bottom: 24,
    });
}

function createPortraitLayout(screen, settings) {
    const margin = screen.width <= 370 ? 10 : 12;
    const gap = screen.width <= 370 ? 6 : 8;
    const availableWidth = screen.width - margin * 2;
    const isQueue = isQueueDrawMode(settings);
    const holdEnabled = isHoldEnabled(settings);
    const handCount = isQueue ? 2 : settings.handSize;
    const slotCount = handCount + (holdEnabled ? 1 : 0);
    const columns = isQueue ? slotCount : 4;
    const maxSlot = isQueue ? 112 : 92;
    const slot = Math.max(
        MIN_TOUCH_SIZE,
        Math.min(maxSlot, Math.floor((availableWidth - gap * (columns - 1)) / columns)),
    );
    const rows = Math.ceil(slotCount / columns);
    const handHeight = rows * slot + (rows - 1) * gap;
    const buttonHeight = 56;
    const buttonY = screen.height - margin - buttonHeight;
    const handY = buttonY - 10 - handHeight;
    const hud = rect(margin, 8, availableWidth, 34);
    const monsterBannerHeight = Math.max(68, Math.min(118, Math.round(screen.height * 0.13)));
    const monsterBanner = rect(margin, hud.y + hud.height + 6, availableWidth, monsterBannerHeight);
    const boardTop = monsterBanner.y + monsterBanner.height + 8;
    const feedbackHeight = 34;
    const logHeight = Math.max(30, Math.min(48, Math.round(screen.height * 0.055)));
    const afterBoardHeight = 8 + feedbackHeight + 6 + logHeight + 8;
    const maxBoardByHeight = handY - boardTop - afterBoardHeight;
    const boardSize = Math.floor(Math.min(availableWidth, Math.max(238, maxBoardByHeight)));
    const boardX = Math.round(screen.width / 2 - boardSize / 2);
    const board = rect(boardX, boardTop, boardSize, boardSize);
    const feedback = rect(margin, board.y + board.height + 8, availableWidth, feedbackHeight);
    const log = rect(margin, feedback.y + feedback.height + 6, availableWidth, logHeight);
    const gridWidth = columns * slot + (columns - 1) * gap;
    const gridX = Math.round(screen.width / 2 - gridWidth / 2);
    const slotRects = Array.from({ length: slotCount }, (_, index) => {
        const row = Math.floor(index / columns);
        const column = index % columns;

        return rect(
            gridX + column * (slot + gap),
            handY + row * (slot + gap),
            slot,
            slot,
        );
    });
    const hold = holdEnabled ? slotRects[0] : null;
    const hand = holdEnabled ? slotRects.slice(1) : slotRects;

    return withMetadata({
        mode: 'portrait',
        boardCells: settings.boardSize,
        hud,
        monsterBanner,
        board,
        feedback,
        log,
        hold,
        hand,
        primaryButton: rect(margin, buttonY, availableWidth, buttonHeight),
        sidePanel: null,
    }, screen, {
        left: margin,
        right: margin,
        top: hud.y,
        bottom: margin,
    });
}

export function createBattleLayout(screen, settings) {
    const portrait = screen.width < PORTRAIT_BREAKPOINT
        || screen.height / Math.max(1, screen.width) > PORTRAIT_ASPECT;

    return portrait
        ? createPortraitLayout(screen, settings)
        : createDesktopLayout(screen, settings);
}
