import { describe, expect, it } from 'vitest';

import {
  DEFAULT_TARGET_VALUES,
  SANDBOX_MODES,
  engineModeFor,
  formatTargetValues,
  getSandboxMode,
  isSandboxMode,
  parseTargetValues,
  shouldShowMotion,
  shouldShowPredetermined
} from '../src/modes.js';

describe('sandbox modes', () => {
  it('lists standard, continuous, and predetermined in selector order', () => {
    expect(SANDBOX_MODES.map((mode) => mode.id)).toEqual([
      'standard',
      'continuous',
      'predetermined'
    ]);
    expect(isSandboxMode('continuous')).toBe(true);
    expect(isSandboxMode('nope')).toBe(false);
    expect(getSandboxMode('standard').engineMode).toBe('standard');
    expect(() => getSandboxMode('nope')).toThrow(/Unknown sandbox mode/);
  });

  it('maps only continuous to the continuous loop strategy', () => {
    expect(engineModeFor('continuous')).toBe('continuous');
    expect(engineModeFor('standard')).toBe('standard');
    expect(engineModeFor('predetermined')).toBe('standard');
  });

  it('shows motion controls only in continuous mode', () => {
    expect(shouldShowMotion('continuous')).toBe(true);
    expect(shouldShowMotion('standard')).toBe(false);
    expect(shouldShowMotion('predetermined')).toBe(false);
  });

  it('shows predetermined controls only in predetermined mode', () => {
    expect(shouldShowPredetermined('predetermined')).toBe(true);
    expect(shouldShowPredetermined('standard')).toBe(false);
    expect(shouldShowPredetermined('continuous')).toBe(false);
  });
});

describe('parseTargetValues', () => {
  it('parses the legacy default input', () => {
    expect(parseTargetValues('6, 6, 6')).toEqual({
      values: [6, 6, 6],
      error: null
    });
  });

  it('falls back to the default targets for empty input', () => {
    expect(parseTargetValues('')).toEqual({
      values: [...DEFAULT_TARGET_VALUES],
      error: null
    });
    expect(parseTargetValues('   ')).toEqual({
      values: [...DEFAULT_TARGET_VALUES],
      error: null
    });
    expect(parseTargetValues(', ,')).toEqual({
      values: [...DEFAULT_TARGET_VALUES],
      error: null
    });
  });

  it('parses a single target and ranges', () => {
    expect(parseTargetValues('1')).toEqual({ values: [1], error: null });
    expect(parseTargetValues('1,2,3,4,5,6')).toEqual({
      values: [1, 2, 3, 4, 5, 6],
      error: null
    });
  });

  it('rejects out-of-range values', () => {
    expect(parseTargetValues('9')).toMatchObject({ values: [] });
    expect(parseTargetValues('9').error).toMatch(/Invalid target "9"/);
    expect(parseTargetValues('0, 6').error).toMatch(/Invalid target "0"/);
  });

  it('rejects non-numeric and non-integer entries', () => {
    expect(parseTargetValues('six').error).toMatch(/Invalid target "six"/);
    expect(parseTargetValues('3.5').error).toMatch(/Invalid target "3.5"/);
    expect(parseTargetValues('6x').error).toMatch(/Invalid target "6x"/);
  });

  it('formats values for prefilling the input', () => {
    expect(formatTargetValues([6, 6, 6])).toBe('6, 6, 6');
    expect(formatTargetValues([])).toBe('');
  });
});
