import { describe, expect, it } from 'vitest';

import {
  SANDBOX_CAMERA,
  SANDBOX_DICE_COUNT,
  SANDBOX_ENCLOSURE_SCALES,
  SANDBOX_ENCLOSURES,
  SANDBOX_LIGHT,
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

  it('keeps camera slider limits sane around the default', () => {
    expect(SANDBOX_CAMERA.min).toBeLessThan(SANDBOX_CAMERA.defaultDistance);
    expect(SANDBOX_CAMERA.defaultDistance).toBeLessThan(SANDBOX_CAMERA.max);
    expect(SANDBOX_CAMERA.step).toBeGreaterThan(0);
  });

  it('offers enclosure size presets relative to the default', () => {
    expect(SANDBOX_ENCLOSURE_SCALES.map((preset) => preset.value)).toEqual([
      0.75,
      1,
      1.25,
      1.5,
      2
    ]);
    expect(
      SANDBOX_ENCLOSURE_SCALES.some((preset) => preset.value === 1)
    ).toBe(true);
  });

  it('keeps light slider limits sane around the default position', () => {
    const { x, y, z } = SANDBOX_LIGHT.defaultPosition;
    for (const value of [x, y, z]) {
      expect(value).toBeGreaterThanOrEqual(SANDBOX_LIGHT.min);
      expect(value).toBeLessThanOrEqual(SANDBOX_LIGHT.max);
    }
    expect(SANDBOX_LIGHT.step).toBeGreaterThan(0);
  });
});
