import { describe, expect, it } from 'vitest';

import {
  SANDBOX_CAMERA,
  SANDBOX_DICE_COUNT,
  SANDBOX_ENCLOSURES,
  isSandboxEnclosure,
  sandboxContent
} from '../src/content.js';

describe('sandbox content', () => {
  it('defaults to six D6 dice', () => {
    expect(SANDBOX_DICE_COUNT).toBe(6);
  });

  it('lists box, sphere, and cylinder enclosures with legacy labels', () => {
    expect(SANDBOX_ENCLOSURES.map((entry) => entry.id)).toEqual([
      'box',
      'sphere',
      'cylinder'
    ]);
    expect(SANDBOX_ENCLOSURES[0].label).toBe('Box (Classic Tray)');
    expect(SANDBOX_ENCLOSURES[1].label).toBe('Sphere (Orbe)');
    expect(SANDBOX_ENCLOSURES[2].label).toBe('Cylinder (Dice Cup)');
    expect(isSandboxEnclosure('sphere')).toBe(true);
    expect(isSandboxEnclosure('unknown')).toBe(false);
  });

  it('reuses the shared classic tray content pack', () => {
    expect(sandboxContent.id).toBe('classic-tray');
    expect(sandboxContent.enclosure.type).toBe('box');
    expect(sandboxContent.physics.gravity).toEqual({ x: 0, y: 0, z: -2940 });
  });

  it('keeps camera slider limits sane around the defaults', () => {
    expect(SANDBOX_CAMERA.min).toBeLessThan(SANDBOX_CAMERA.defaultDistance);
    expect(SANDBOX_CAMERA.defaultDistance).toBeLessThan(SANDBOX_CAMERA.max);
    expect(SANDBOX_CAMERA.step).toBeGreaterThan(0);
    expect(SANDBOX_CAMERA.defaultNear).toBe(1);
    expect(SANDBOX_CAMERA.defaultFar).toBe(0);
  });
});
