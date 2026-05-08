import { BattleOutcome } from '../entities/run.js';

function getLayout(screen) {
    const centerX = screen.width / 2;
    const buttonWidth = Math.min(260, screen.width / 2 - 36);
    const buttonY = screen.height - 112;

    return {
        panel: {
            x: Math.max(24, centerX - 360),
            y: Math.max(92, screen.height * 0.24),
            width: Math.min(720, screen.width - 48),
            height: 250,
        },
        victoryButton: {
            x: centerX - buttonWidth - 12,
            y: buttonY,
            width: buttonWidth,
            height: 58,
        },
        defeatButton: {
            x: centerX + 12,
            y: buttonY,
            width: buttonWidth,
            height: 58,
        },
    };
}

export function createBattleScene({
    input,
    ui,
    run,
    battle,
    onFinish,
}) {
    return {
        name: 'battle',
        layout: null,
        update() {
            const click = input.consumeClick();

            if (!click || !this.layout) {
                return;
            }

            if (ui.contains(this.layout.victoryButton, click)) {
                onFinish(BattleOutcome.Victory);
            }

            if (ui.contains(this.layout.defeatButton, click)) {
                onFinish(BattleOutcome.Defeat);
            }
        },
        render(app) {
            ui.begin();
            const screen = app.screen;
            this.layout = getLayout(screen);
            const mouse = input.getMouse();

            ui.drawText(`Битва ${run.currentBattle} / ${run.totalBattles}`, screen.width / 2, 48, {
                align: 'center',
                size: 32,
                color: '#f5fbff',
            });

            ui.drawRect(this.layout.panel, '#102031', 0.9);
            ui.drawText(battle.name, screen.width / 2, this.layout.panel.y + 34, {
                align: 'center',
                size: 34,
                color: '#ffffff',
            });
            ui.drawText([
                `Анте: ${battle.ante}`,
                `Цель: ${battle.targetScore}`,
                `Награда: ${battle.reward}`,
            ], screen.width / 2, this.layout.panel.y + 92, {
                align: 'center',
                size: 22,
                color: '#b9ccdd',
                lineHeight: 34,
            });

            ui.drawButton(this.layout.victoryButton, 'Победа', {
                mouse,
                color: '#1f4b3c',
                hoverColor: '#69d29d',
                edgeColor: '#9ff0bd',
            });
            ui.drawButton(this.layout.defeatButton, 'Поражение', {
                mouse,
                color: '#4a2430',
                hoverColor: '#f0788b',
                edgeColor: '#ffadba',
            });
        },
    };
}
