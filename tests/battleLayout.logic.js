import assert from 'node:assert/strict';
import test from 'node:test';
import { createBattleLayout } from '../src/scenes/battleLayout.js';

const baseSettings = {
    boardSize: 7,
    handSize: 7,
    drawMode: 'hand',
    holdEnabled: true,
};

function assertRectInside(rect, screen, label) {
    assert.ok(rect.x >= 0, `${label}.x is inside viewport`);
    assert.ok(rect.y >= 0, `${label}.y is inside viewport`);
    assert.ok(rect.x + rect.width <= screen.width, `${label}.right is inside viewport`);
    assert.ok(rect.y + rect.height <= screen.height, `${label}.bottom is inside viewport`);
}

test('portrait battle layout keeps board, hand, hold and action inside phone viewports', () => {
    for (const screen of [
        { width: 390, height: 844 },
        { width: 360, height: 740 },
        { width: 430, height: 932 },
    ]) {
        const layout = createBattleLayout(screen, baseSettings);

        assert.equal(layout.mode, 'portrait');
        assert.equal(layout.viewport.overflows, false);
        assert.equal(layout.hand.length, 7);
        assert.ok(layout.hold);
        assert.ok(layout.minTouchTarget >= 44);
        assert.equal(layout.cellSize, layout.board.width / 7);
        assert.ok(layout.board.y > layout.monsterBanner.y);
        assert.ok(layout.feedback.y > layout.board.y + layout.board.height);
        assert.ok(layout.hand[0].y > layout.log.y);
        assert.ok(layout.primaryButton.y > layout.hand.at(-1).y);

        [
            ['hud', layout.hud],
            ['monsterBanner', layout.monsterBanner],
            ['board', layout.board],
            ['feedback', layout.feedback],
            ['log', layout.log],
            ['hold', layout.hold],
            ['primaryButton', layout.primaryButton],
            ...layout.hand.map((rect, index) => [`hand.${index}`, rect]),
        ].forEach(([label, rect]) => assertRectInside(rect, screen, label));
    }
});

test('desktop battle layout preserves detailed side panel and action alias', () => {
    const screen = { width: 1280, height: 720 };
    const layout = createBattleLayout(screen, baseSettings);

    assert.equal(layout.mode, 'desktop');
    assert.equal(layout.viewport.overflows, false);
    assert.ok(layout.sidePanel);
    assert.equal(layout.endRoundButton, layout.primaryButton);
    assert.equal(layout.hand.length, 7);
    assert.ok(layout.board.width >= 300);
    assert.ok(layout.sidePanel.x > layout.board.x + layout.board.width);
});
