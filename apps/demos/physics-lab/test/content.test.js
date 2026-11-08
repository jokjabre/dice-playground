import { describe, expect, it } from 'vitest';

import {
  LAB_CONTACT_LIMITS,
  LAB_SURFACES,
  clampControlValue,
  defaultLabSettings,
  getLabSurface,
  isLabSurface
} from '../src/content.js';

describe('physics lab content', () => {
  it('lists the contact surfaces in a stable order', () => {
    expect(LAB_SURFACES.map((surface) => surface.id)).toEqual([
      'desk',
      'die',
      'barrier',
      'sphere',
      'glass'
    ]);
    expect(isLabSurface('desk')).toBe(true);
    expect(isLabSurface('unknown')).toBe(false);
    expect(getLabSurface('barrier').materialB).toBe('barrier_left');
    expect(() => getLabSurface('unknown')).toThrow(/Unknown lab surface/);
  });

  it('carries the physics package contact defaults per surface', () => {
    expect(getLabSurface('desk').friction).toBe(0.01);
    expect(getLabSurface('desk').restitution).toBe(0.5);
    expect(getLabSurface('barrier').restitution).toBe(1);
    expect(getLabSurface('die').friction).toBe(0);
  });

  it('returns fresh defaults matching a fresh world', () => {
    const defaults = defaultLabSettings();
    expect(defaults.gravity).toEqual({ x: 0, y: 0, z: -2940 });
    expect(defaults.mass).toBe(300);
    expect(defaults.solverIterations).toBe(20);
    expect(defaults.fixedStep).toBeCloseTo(1 / 60);
    expect(defaults.velocityThreshold).toBe(6);
    expect(defaults.settleFrames).toBe(3);

    // Mutating one result must not leak into the next.
    defaults.gravity.z = 0;
    expect(defaultLabSettings().gravity.z).toBe(-2940);
  });

  it('clamps control values and falls back on non-finite input', () => {
    expect(
      clampControlValue(5, LAB_CONTACT_LIMITS.friction.min, LAB_CONTACT_LIMITS.friction.max, 0)
    ).toBe(2);
    expect(
      clampControlValue(-1, LAB_CONTACT_LIMITS.friction.min, LAB_CONTACT_LIMITS.friction.max, 0.5)
    ).toBe(0);
    expect(clampControlValue(Number.NaN, 0, 1, 0.25)).toBe(0.25);
  });
});
