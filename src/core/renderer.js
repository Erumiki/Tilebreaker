export function initWebGL(canvas) {
    return canvas.getContext('webgl', {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
    });
}

export function resizeCanvas(gl, canvas) {
    const width = Math.floor(canvas.clientWidth * window.devicePixelRatio);
    const height = Math.floor(canvas.clientHeight * window.devicePixelRatio);

    if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
    }
}

export function clearScreen(gl, color) {
    gl.clearColor(color[0], color[1], color[2], color[3]);
    gl.clear(gl.COLOR_BUFFER_BIT);
}
