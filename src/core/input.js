export function initInput(canvas) {
    const state = {
        mouseX: 0,
        mouseY: 0,
        mouseDown: false,
        mousePressed: false,
        keys: new Set(),
    };

    function updateMousePosition(event) {
        const rect = canvas.getBoundingClientRect();
        state.mouseX = event.clientX - rect.left;
        state.mouseY = event.clientY - rect.top;
    }

    canvas.addEventListener('mousemove', updateMousePosition);

    canvas.addEventListener('mousedown', (event) => {
        updateMousePosition(event);
        state.mouseDown = true;
        state.mousePressed = true;
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
        consumeClick() {
            if (!state.mousePressed) {
                return null;
            }

            state.mousePressed = false;
            return { x: state.mouseX, y: state.mouseY };
        },
        isKeyDown(code) {
            return state.keys.has(code);
        },
    };
}
