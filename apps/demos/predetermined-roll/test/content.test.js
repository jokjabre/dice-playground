import { describe, expect, it } from 'vitest';

import {
  DETERMINISM_MODES,
  TARGET_MAX,
  TARGET_MIN,
  compareTargets,
  defaultTargetsFor,
  formatValues,
  getDeterminismMode,
  isDeterminismMode,
  validateTargets
} from '../src/content.js';

describe('predetermined roll content', () => {
  it('lists the determinism modes', () => {
    expect(DETERMINISM_MODES.map((mode) => mode.id)).toEqual([
      'predict-and-shift',
      'predict-only'
    ]);
    expect(isDeterminismMode('predict-only')).toBe(true);
    expect(isDeterminismMode('nope')).toBe(false);
    expect(getDeterminismMode('predict-and-shift').label).toBe('Predict and shift');
    expect(() => getDeterminismMode('nope')).toThrow(/Unknown determinism mode/);
  });

  it('builds default targets for a dice count', () => {
    expect(defaultTargetsFor(3)).toEqual([6, 6, 6]);
    expect(defaultTargetsFor(1)).toEqual([6]);
    expect(defaultTargetsFor(5)).toEqual([6, 6, 6, 6, 6]);
    expect(defaultTargetsFor(99)).toHaveLength(6);
  });

  it('accepts valid per-die targets', () => {
    expect(validateTargets(['6', '6', '6'], 3)).toEqual({
      values: [6, 6, 6],
      error: null
    });
    expect(validateTargets([1, 2, 3], 3).values).toEqual([1, 2, 3]);
  });

  it('rejects invalid targets with a die-specific error', () => {
    expect(validateTargets(['9', '1'], 2).error).toContain('Die 1');
    expect(validateTargets(['x', '1'], 2).error).toContain('Die 1');
    expect(validateTargets(['0'], 1).error).toContain('Die 1');
    expect(validateTargets(['2.5'], 1).error).toContain('Die 1');
    expect(validateTargets([''], 1).error).toContain('Die 1');
  });

  it('rejects fewer or more targets than dice', () => {
    expect(validateTargets(['6', '6'], 3).error).toContain('each of the 3 dice');
    expect(validateTargets(['6', '6', '6', '6'], 3).error).toContain('exactly 3 targets');
  });

  it('compares settled values against targets', () => {
    expect(compareTargets([6, 6, 6], [6, 6, 6])).toEqual({
      matched: true,
      matches: [true, true, true]
    });
    expect(compareTargets([6, 1, 6], [6, 6, 6]).matched).toBe(false);
    expect(compareTargets([6, 6], [6, 6, 6]).matched).toBe(false);
  });

  it('formats values for display', () => {
    expect(formatValues([6, 6, 6])).toBe('6, 6, 6');
    expect(TARGET_MIN).toBe(1);
    expect(TARGET_MAX).toBe(6);
  });
});
