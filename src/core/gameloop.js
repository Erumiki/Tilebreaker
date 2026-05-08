export function createGameLoop({ update, render }) {
    let running = false;
    let lastTime = 0;
    let frameId = 0;

    function frame(time) {
        if (!running) {
            return;
        }

        const dt = Math.min((time - lastTime) / 1000, 0.1);
        lastTime = time;

        update(dt);
        render();

        frameId = requestAnimationFrame(frame);
    }

    return {
        start() {
            if (running) {
                return;
            }
            running = true;
            lastTime = performance.now();
            frameId = requestAnimationFrame(frame);
        },
        stop() {
            running = false;
            cancelAnimationFrame(frameId);
        },
    };
}
