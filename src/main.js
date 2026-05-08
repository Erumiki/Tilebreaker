import { loadConfig } from './core/config.js';
import { createGameLoop } from './core/gameloop.js';
import { initInput } from './core/input.js';
import { initWebGL, resizeCanvas, clearScreen } from './core/renderer.js';
import { createMainMenuScene } from './scenes/mainmenu.js';

const canvas = document.getElementById('game');
const gl = initWebGL(canvas);

if (!gl) {
    throw new Error('WebGL is not supported');
}

const config = await loadConfig();
const input = initInput(canvas);
let scene = createMainMenuScene({ config, input });

const loop = createGameLoop({
    update(dt) {
        scene?.update?.(dt);
    },
    render() {
        resizeCanvas(gl, canvas);
        clearScreen(gl, config.game.clearColor);
        scene?.render?.(gl, canvas);
    },
});

loop.start();
