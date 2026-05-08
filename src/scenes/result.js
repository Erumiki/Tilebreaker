import { BattleOutcome } from '../entities/run.js';

function getActionButton(screen) {
    const width = Math.min(340, screen.width - 48);
    return {
        x: screen.width / 2 - width / 2,
        y: screen.height * 0.68,
        width,
        height: 62,
    };
}

export function createBattleResultScene({
    input,
    ui,
    result,
    onContinue,
}) {
    return {
        name: 'result',
        actionButton: null,
        update() {
            const click = input.consumeClick();

            if (click && this.actionButton && ui.contains(this.actionButton, click)) {
                onContinue();
            }
        },
        render(app) {
            ui.begin();
            const screen = app.screen;
            this.actionButton = getActionButton(screen);
            const mouse = input.getMouse();
            const isDefeat = result.outcome === BattleOutcome.Defeat;
            const isRunVictory = result.isRunVictory;
            const title = isRunVictory
                ? 'Победа в забеге'
                : isDefeat
                    ? 'Поражение'
                    : 'Битва выиграна';
            const subtitle = isRunVictory
                ? `Все ${result.totalBattles} битв пройдены`
                : isDefeat
                    ? `Забег закончился на битве ${result.battleNumber}`
                    : 'Открылся этап улучшений';
            const label = isRunVictory || isDefeat ? 'В меню' : 'К улучшениям';

            ui.drawText(title, screen.width / 2, screen.height * 0.25, {
                align: 'center',
                size: 48,
                color: isDefeat ? '#ffb4c0' : '#eafcff',
            });
            ui.drawText(subtitle, screen.width / 2, screen.height * 0.39, {
                align: 'center',
                size: 24,
                color: '#b8c8d8',
            });
            ui.drawText(`Пройдено: ${result.completedBattles} / ${result.totalBattles}`, screen.width / 2, screen.height * 0.49, {
                align: 'center',
                size: 22,
                color: '#8fb1cb',
            });
            ui.drawButton(this.actionButton, label, {
                mouse,
                color: isDefeat ? '#4a2430' : '#1c3346',
                hoverColor: isDefeat ? '#f0788b' : '#66c7f4',
            });
        },
    };
}
