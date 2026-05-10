import { drawArtImage, drawMissingArtAsset } from '../render/art.js';

function getShopLayout(screen, offerCount) {
    const isPortrait = screen.width < 620;
    const gap = isPortrait ? 10 : 16;
    const columns = Math.max(1, Math.min(
        offerCount,
        isPortrait ? 2 : screen.width < 960 ? 3 : offerCount,
    ));
    const rows = Math.ceil(offerCount / columns);
    const maxGridWidth = isPortrait ? screen.width - 32 : Math.min(screen.width - 56, columns * 190 + gap * (columns - 1));
    const cardWidth = (maxGridWidth - gap * (columns - 1)) / columns;
    const startY = isPortrait ? Math.max(124, screen.height * 0.2) : screen.height * 0.34;
    const continueHeight = isPortrait ? 56 : 62;
    const continueGap = isPortrait ? 12 : 26;
    const bottomPadding = isPortrait ? 18 : 0;
    const availableGridHeight = screen.height - startY - continueHeight - continueGap - bottomPadding;
    const portraitCardHeight = (availableGridHeight - gap * (rows - 1)) / Math.max(1, rows);
    const cardHeight = isPortrait
        ? Math.max(98, Math.min(146, portraitCardHeight))
        : screen.height < 720 ? 166 : 210;
    const gridWidth = cardWidth * columns + gap * (columns - 1);
    const startX = screen.width / 2 - gridWidth / 2;
    const offerRects = Array.from({ length: offerCount }, (_, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);

        return {
            x: startX + column * (cardWidth + gap),
            y: startY + row * (cardHeight + gap),
            width: cardWidth,
            height: cardHeight,
        };
    });
    const continueWidth = Math.min(isPortrait ? screen.width - 48 : 340, 380);
    const gridBottom = startY + rows * cardHeight + (rows - 1) * gap;
    const continueButton = {
        x: screen.width / 2 - continueWidth / 2,
        y: Math.min(screen.height - continueHeight - bottomPadding, gridBottom + continueGap),
        width: continueWidth,
        height: continueHeight,
    };
    const viewport = {
        width: screen.width,
        height: screen.height,
    };
    const allRects = [...offerRects, continueButton];
    const isInsideViewport = (rect) => rect.x >= 0
        && rect.y >= 0
        && rect.x + rect.width <= viewport.width
        && rect.y + rect.height <= viewport.height;
    const overlapsContinue = offerRects.some((rect) => !(
        rect.x + rect.width <= continueButton.x
        || continueButton.x + continueButton.width <= rect.x
        || rect.y + rect.height <= continueButton.y
        || continueButton.y + continueButton.height <= rect.y
    ));

    return {
        mode: isPortrait ? 'portrait' : 'desktop',
        offers: offerRects,
        continueButton,
        minTouchTarget: Math.min(
            continueButton.width,
            continueButton.height,
            ...offerRects.flatMap((rect) => [rect.width, rect.height]),
        ),
        viewport: {
            screen: {
                width: screen.width,
                height: screen.height,
            },
            overflows: allRects.some((rect) => !isInsideViewport(rect)),
            overlapsContinue,
        },
    };
}

function drawArtButton(ui, artTextures, rect, label, options = {}) {
    const hovered = options.mouse ? ui.contains(rect, options.mouse) : false;
    const state = options.disabled ? 'disabled' : hovered ? 'hover' : 'default';
    const drawn = drawArtImage(ui, artTextures, `button_primary_${state}`, rect, {
        required: true,
    });

    if (!drawn) {
        ui.drawButton(rect, label, options);
        return;
    }

    ui.drawText(label, rect.x + rect.width / 2, rect.y + rect.height / 2 - 12, {
        align: 'center',
        size: options.textSize ?? 22,
        color: options.textColor ?? '#f7e7bd',
        weight: 700,
        maxWidth: rect.width - 28,
    });
}

function wrapText(text, maxChars, maxLines = 2) {
    const words = String(text).split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';

    for (const word of words) {
        const next = line ? `${line} ${word}` : word;

        if (next.length > maxChars && line) {
            lines.push(line);
            line = word;
        } else {
            line = next;
        }

        if (lines.length === maxLines) {
            break;
        }
    }

    if (line && lines.length < maxLines) {
        lines.push(line);
    }

    if (words.join(' ').length > lines.join(' ').length && lines.length > 0) {
        lines[lines.length - 1] = `${lines[lines.length - 1].replace(/[.,;:!?]+$/, '')}...`;
    }

    return lines.join('\n');
}

function getTileTexture(tileTextures, offer) {
    return tileTextures?.get(offer.assetId)
        ?? tileTextures?.get(offer.tileId)
        ?? tileTextures?.get(offer.specialTile?.id)
        ?? null;
}

function drawOfferCard(ui, {
    artTextures,
    tileTextures,
    offer,
    rect,
    mouse,
    gold,
}) {
    const hovered = ui.contains(rect, mouse);
    const affordable = !offer.bought && gold >= offer.cost;
    const assetId = offer.bought
        ? 'shop_card_bought'
        : affordable ? 'shop_card_affordable' : 'shop_card_unaffordable';

    if (!drawArtImage(ui, artTextures, assetId, rect, { required: true })) {
        ui.drawRect(rect, offer.bought ? '#263421' : affordable ? '#173747' : '#201d25', 0.96);
        ui.drawRect({
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: 3,
        }, affordable ? '#f4d36f' : '#6f6370', hovered ? 1 : 0.65);
    }

    const compact = rect.height < 160;
    const textColor = offer.bought ? '#cbf0b8' : affordable ? '#fff2ca' : '#9f97a0';
    const previewSize = compact ? 40 : 58;
    const previewRect = {
        x: rect.x + rect.width / 2 - previewSize / 2,
        y: rect.y + (compact ? 34 : 50),
        width: previewSize,
        height: previewSize,
    };
    const tileTexture = getTileTexture(tileTextures, offer);

    ui.drawText(wrapText(offer.name, compact ? 18 : 22, compact ? 2 : 1), rect.x + rect.width / 2, rect.y + (compact ? 9 : 12), {
        align: 'center',
        size: compact ? 13 : 17,
        color: textColor,
        weight: 700,
        lineHeight: compact ? 15 : 20,
        maxWidth: rect.width - 24,
    });

    if (tileTexture) {
        ui.drawImage(tileTexture, previewRect, { fit: 'contain', alpha: offer.bought ? 0.78 : 1 });
    } else {
        drawMissingArtAsset(ui, previewRect, offer.assetId ?? offer.tileId ?? offer.cardId);
    }

    if (!compact) {
        ui.drawText(wrapText(offer.description, 28, 2), rect.x + rect.width / 2, rect.y + 120, {
            align: 'center',
            size: 13,
            color: offer.bought ? '#b7c9aa' : '#d7c59e',
            lineHeight: 17,
            maxWidth: rect.width - 28,
        });
    }

    const shortage = Math.max(0, offer.cost - gold);
    const priceLabel = offer.bought
        ? 'Куплено'
        : affordable
            ? `${offer.cost} золота`
            : `Не хватает ${shortage}`;
    ui.drawText(priceLabel, rect.x + rect.width / 2, rect.y + rect.height - (compact ? 31 : 43), {
        align: 'center',
        size: compact ? 13 : 16,
        color: affordable || offer.bought ? '#f3d991' : '#8f7780',
        weight: 700,
        maxWidth: rect.width - 24,
    });
    const statusLabel = offer.balanceStatus?.startsWith('mvp_keep') ? 'пул MVP' : 'стейдж';
    ui.drawText(statusLabel, rect.x + rect.width / 2, rect.y + rect.height - (compact ? 15 : 22), {
        align: 'center',
        size: compact ? 10 : 11,
        color: '#9e8d71',
        maxWidth: rect.width - 24,
    });

    if (hovered && affordable) {
        ui.drawRect(rect, '#f4d36f', 0.08);
    }
}

function getShopFeedback(result, run, shopState) {
    if (!result) {
        const boughtCount = shopState.boughtCards.length;

        return boughtCount > 0
            ? `Куплено карт: ${boughtCount}. Золото ${run.gold ?? 0}.`
            : `Золото ${run.gold ?? 0}. Можно купить карту или идти дальше.`;
    }

    if (result.bought) {
        return `Куплено: ${result.offer.name}. -${result.offer.cost} золота, карта ушла в сброс.`;
    }

    if (result.reason === 'not_enough_gold') {
        const missing = Math.max(0, (result.offer?.cost ?? 0) - (run.gold ?? 0));
        return `Не хватает золота для "${result.offer?.name ?? 'карты'}": нужно еще ${missing}.`;
    }

    if (result.reason === 'already_bought') {
        return 'Эта карта уже куплена.';
    }

    return 'Эту карту сейчас купить нельзя.';
}

function getDeckDebug(run) {
    return {
        deck: run.deck.length,
        drawPile: run.drawPile.length,
        discardPile: run.discardPile.length,
    };
}

export function createShopScene({
    input,
    ui,
    artTextures = null,
    tileTextures = null,
    run,
    shopState,
    onBuy,
    onContinue,
}) {
    return {
        name: 'shop',
        layout: null,
        lastPurchaseResult: null,
        shopFeedback: null,
        update() {
            const click = input.consumeClick();

            if (!click || !this.layout) {
                return;
            }

            if (ui.contains(this.layout.continueButton, click)) {
                onContinue();
                return;
            }

            const index = this.layout.offers.findIndex((rect) => ui.contains(rect, click));

            if (index >= 0) {
                this.lastPurchaseResult = onBuy(shopState.offers[index]);
                this.shopFeedback = getShopFeedback(this.lastPurchaseResult, run, shopState);
            }
        },
        render(app) {
            ui.begin();
            const screen = app.screen;
            this.layout = getShopLayout(screen, shopState.offers.length);
            const mouse = input.getMouse();
            const screenRect = {
                x: 0,
                y: 0,
                width: screen.width,
                height: screen.height,
            };

            if (!drawArtImage(ui, artTextures, 'screen_background_shop', screenRect, {
                fit: 'cover',
                required: true,
            })) {
                ui.drawRect(screenRect, '#07111d', 1);
            }
            ui.drawRect(screenRect, '#03070c', 0.26);

            ui.drawText('Магазин карт', screen.width / 2, screen.width < 620 ? 24 : screen.height * 0.12, {
                align: 'center',
                size: screen.width < 620 ? 32 : 46,
                color: '#ffe7ad',
                maxWidth: screen.width - 32,
            });
            ui.drawText(`Перед битвой ${shopState.nextBattle}: покупай сколько хватает золота`, screen.width / 2, screen.width < 620 ? 68 : screen.height * 0.23, {
                align: 'center',
                size: screen.width < 620 ? 15 : 21,
                color: '#d7c59e',
                maxWidth: screen.width - 28,
            });
            ui.drawText(`Золото ${run.gold ?? 0}  |  Колода ${run.deck.length}  |  Добор ${run.drawPile.length}  |  Сброс ${run.discardPile.length}`, screen.width / 2, screen.width < 620 ? 96 : screen.height * 0.29, {
                align: 'center',
                size: screen.width < 620 ? 13 : 17,
                color: '#f3d991',
                maxWidth: screen.width - 28,
            });
            const feedbackText = this.shopFeedback ?? getShopFeedback(null, run, shopState);
            ui.drawText(feedbackText, screen.width / 2, screen.width < 620 ? 111 : screen.height * 0.315, {
                align: 'center',
                size: screen.width < 620 ? 12 : 14,
                color: this.lastPurchaseResult?.bought ? '#c8f7dd' : this.lastPurchaseResult?.reason ? '#ffb4c0' : '#9fb8ca',
                maxWidth: screen.width - 32,
            });

            shopState.offers.forEach((offer, index) => {
                drawOfferCard(ui, {
                    artTextures,
                    tileTextures,
                    offer,
                    rect: this.layout.offers[index],
                    mouse,
                    gold: run.gold ?? 0,
                });
            });

            drawArtButton(ui, artTextures, this.layout.continueButton, 'К следующему монстру', {
                mouse,
                color: '#1c3346',
                hoverColor: '#66c7f4',
                textSize: screen.width < 620 ? 18 : 22,
            });
        },
        getDebugState() {
            return {
                shop: {
                    id: shopState.id,
                    battleNumber: shopState.battleNumber,
                    nextBattle: shopState.nextBattle,
                    offerCount: shopState.offerCount,
                    goldBefore: shopState.goldBefore,
                    goldAfter: run.gold ?? 0,
                    balanceStatus: shopState.balanceStatus,
                },
                offers: shopState.offers.map((offer) => ({
                    offerId: offer.offerId,
                    cardId: offer.cardId,
                    tileId: offer.tileId,
                    type: offer.type,
                    name: offer.name,
                    cost: offer.cost,
                    rarity: offer.rarity,
                    family: offer.family,
                    bought: offer.bought,
                    affordable: !offer.bought && (run.gold ?? 0) >= offer.cost,
                    balanceStatus: offer.balanceStatus,
                })),
                boughtCards: [...shopState.boughtCards],
                lastPurchaseResult: this.lastPurchaseResult,
                feedback: this.shopFeedback ?? getShopFeedback(null, run, shopState),
                uiState: {
                    canContinue: true,
                    boughtCount: shopState.boughtCards.length,
                    unaffordableCount: shopState.offers.filter((offer) => !offer.bought && (run.gold ?? 0) < offer.cost).length,
                },
                deck: getDeckDebug(run),
                layout: this.layout,
            };
        },
    };
}

export const createUpgradeScene = createShopScene;
