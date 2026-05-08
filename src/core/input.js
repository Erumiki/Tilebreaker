export function initInput(canvas) {
    const state = {
        mouseX: 0,
        mouseY: 0,
        mouseDown: false,
        keys: new Set(),
    };

    canvas.addEventListener('mousemove', (event) => {
        const rect = canvas.getBoundingClientRect();
        state.mouseX = event.clientX - rect.left;
        state.mouseY = event.clientY - rect.top;
    });

    canvas.addEventListener('mousedown', () => {
        state.mouseDown = true;
    });

    window.addEventListener('mouseup', () => {
        state.mouseDown = false;
    });

    window.addEventListener('keydown', (event) => {
        state.keys.add(event.code);
    });

    window.addEventListener('keyup', (event) => {
        state.keys.delete(event.code);
    });

    return {
        getMouse() {
            return { x: state.mouseX, y: state.mouseY, down: state.mouseDown };
        },
        isKeyDown(code) {
            return state.keys.has(code);
        },
    };
}
