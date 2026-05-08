function getStartButton(screen) {
    const width = Math.min(340, screen.width - 48);
    return {
        x: screen.width / 2 - width / 2,
        y: screen.height * 0.58,
        width,
        height: 64,
    };
}

export function createMainMenuScene({ config, input, ui, onStart }) {
    return {
        name: 'mainmenu',
        update() {
            const click = input.consumeClick();
            if (click && ui.contains(this.startButton, click)) {
                onStart();
            }

            if (input.isKeyDown('Enter') || input.isKeyDown('Space')) {
                onStart();
            }
        },
        render(app) {
            ui.begin();
            const screen = app.screen;
            const pulse = (Math.sin(performance.now() * 0.002) + 1) * 0.5;
            const color = config.game.menuPulseColor;
            ui.drawRect({
                x: 0,
                y: 0,
                width: screen.width,
                height: screen.height,
            }, [
                color[0] * pulse,
                color[1] * pulse,
                color[2] * pulse,
            ]);
            this.startButton = getStartButton(screen);
            const mouse = input.getMouse();

            ui.drawText('Tilebreaker', screen.width / 2, screen.height * 0.24, {
                align: 'center',
                size: 56,
                color: '#f3fbff',
            });
            ui.drawText('Прототип забега: 5 битв, результат и улучшения', screen.width / 2, screen.height * 0.38, {
                align: 'center',
                size: 22,
                color: '#b8c8d8',
            });
            ui.drawButton(this.startButton, 'Начать забег', {
                mouse,
                color: '#1c3346',
                hoverColor: '#66c7f4',
            });
        },
        startButton: { x: 0, y: 0, width: 0, height: 0 },
    };
}
