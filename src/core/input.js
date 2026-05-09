export function initInput(canvas) {
    const state = {
        mouseX: 0,
        mouseY: 0,
        mouseDown: false,
        mousePressed: false,
        keys: new Set(),
    };

    canvas.style.touchAction = 'none';

    function updateMousePosition(event) {
        const rect = canvas.getBoundingClientRect();
        state.mouseX = event.clientX - rect.left;
        state.mouseY = event.clientY - rect.top;
    }

    function press(event) {
        updateMousePosition(event);
        state.mouseDown = true;
        state.mousePressed = true;
        event.preventDefault?.();
    }

    if (window.PointerEvent) {
        canvas.addEventListener('pointermove', updateMousePosition);
        canvas.addEventListener('pointerdown', (event) => {
            press(event);
            canvas.setPointerCapture?.(event.pointerId);
        });
        window.addEventListener('pointerup', (event) => {
            state.mouseDown = false;
            try {
                canvas.releasePointerCapture?.(event.pointerId);
            } catch {
                // The pointer may already be released when the browser synthesizes mouse events.
            }
        });
        window.addEventListener('pointercancel', () => {
            state.mouseDown = false;
        });
    } else {
        canvas.addEventListener('mousemove', updateMousePosition);
        canvas.addEventListener('mousedown', press);

        canvas.addEventListener('touchstart', (event) => {
            const touch = event.changedTouches[0];

            if (touch) {
                event.preventDefault();
                press(touch);
            }
        }, { passive: false });

        canvas.addEventListener('touchmove', (event) => {
            const touch = event.changedTouches[0];

            if (touch) {
                event.preventDefault();
                updateMousePosition(touch);
            }
        }, { passive: false });

        window.addEventListener('touchend', () => {
            state.mouseDown = false;
        });
    }

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
