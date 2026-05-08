export function createMainMenuScene({ config }) {
    return {
        update() {},
        render(gl) {
            const pulse = (Math.sin(performance.now() * 0.002) + 1) * 0.5;
            const color = config.game.menuPulseColor;
            gl.clearColor(
                color[0] * pulse,
                color[1] * pulse,
                color[2] * pulse,
                1,
            );
            gl.clear(gl.COLOR_BUFFER_BIT);
        },
    };
}
