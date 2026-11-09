import { describe, expect, it } from 'vitest';

import * as rendering from '../src/index.js';

describe('@dice/rendering public entry', () => {
  it('exports the public surface from one entry point', () => {
    expect(typeof rendering.RenderScene).toBe('function');
    expect(typeof rendering.createRenderScene).toBe('function');
    expect(typeof rendering.createThreeLegacyBackend).toBe('function');
    expect(typeof rendering.CameraController).toBe('function');
    expect(typeof rendering.LightingRig).toBe('function');
    expect(typeof rendering.RaycastService).toBe('function');
    expect(typeof rendering.TextureFactory).toBe('function');
    expect(typeof rendering.createDiceMaterialSet).toBe('function');
    expect(typeof rendering.createRenderConfig).toBe('function');
    expect(rendering.DEFAULT_RENDER_CONFIG.fov).toBe(20);
  });

  it('imports safely in Node without touching the DOM or loading Three', () => {
    expect(typeof document).toBe('undefined');
    expect(typeof window).toBe('undefined');
    expect(/** @type {any} */ (globalThis).THREE).toBeUndefined();
  });
});
