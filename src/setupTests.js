import '@testing-library/jest-dom';

// ── requestAnimationFrame / cancelAnimationFrame ─────────────────────────────
// jsdom does not implement these; polyfill them globally before any component loads.
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);

// ── Canvas (getContext) ───────────────────────────────────────────────────────
// jsdom has no canvas implementation; stub the whole context.
HTMLCanvasElement.prototype.getContext = () => ({
    clearRect: () => { },
    beginPath: () => { },
    arc: () => { },
    fill: () => { },
    stroke: () => { },
    save: () => { },
    restore: () => { },
    moveTo: () => { },
    lineTo: () => { },
    createLinearGradient: () => ({ addColorStop: () => { } }),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
});

// ── URL.createObjectURL ───────────────────────────────────────────────────────
// Used by Miraje when loading audio files.
global.URL.createObjectURL = () => 'blob:mock';
global.URL.revokeObjectURL = () => { };