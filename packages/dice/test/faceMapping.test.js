import { describe, expect, it } from 'vitest';

import {
  D6,
  FaceReader,
  assertFaceMapping,
  createFaceMapping,
  createShiftedFaceMapping,
  getFaceLabel,
  isValidFaceMapping,
  shiftFaceMapping
} from '../src/index.js';

const identity = { x: 0, y: 0, z: 0, w: 1 };

describe('face mapping', () => {
  it('creates the identity permutation by default', () => {
    expect(createFaceMapping(D6)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('round-trips the label for a geometric face', () => {
    expect(getFaceLabel(D6, [6, 5, 4, 3, 2, 1], 0)).toBe(6);
    expect(getFaceLabel(D6, [6, 5, 4, 3, 2, 1], 5)).toBe(1);
  });

  it('rejects incomplete, duplicated, and out-of-range permutations', () => {
    expect(isValidFaceMapping(D6, [1, 2, 3, 4, 5, 6])).toBe(true);
    expect(isValidFaceMapping(D6, [1, 2, 3, 4, 5, 6, 7])).toBe(false);
    expect(isValidFaceMapping(D6, [1, 2, 3, 4, 5, 5])).toBe(false);
    expect(isValidFaceMapping(D6, [1, 2, 3, 4, 5])).toBe(false);
    expect(isValidFaceMapping(D6, [1, 2, 3, 4, 5, 9])).toBe(false);

    expect(() => assertFaceMapping(D6, [1, 1, 3, 4, 5, 6])).toThrow(
      /each definition label exactly once/
    );
    expect(() => assertFaceMapping(D6, [1, 2, 3, 4, 5, 6.5])).toThrow(
      /must be integers/
    );
  });

  it('shifts labels cyclically while preserving the permutation', () => {
    const mapping = [1, 2, 3, 4, 5, 6];
    expect(shiftFaceMapping(D6, mapping, 1)).toEqual([2, 3, 4, 5, 6, 1]);
    expect(shiftFaceMapping(D6, mapping, -1)).toEqual([6, 1, 2, 3, 4, 5]);
    expect(shiftFaceMapping(D6, mapping, 6)).toEqual(mapping);
    expect(shiftFaceMapping(D6, mapping, 7)).toEqual([2, 3, 4, 5, 6, 1]);

    for (let offset = -12; offset <= 12; offset++) {
      const shifted = shiftFaceMapping(D6, mapping, offset);
      expect(new Set(shifted).size).toBe(6);
      expect(isValidFaceMapping(D6, shifted)).toBe(true);
    }
  });

  it('makes the naturally top face display the requested value', () => {
    const mapping = createFaceMapping(D6);
    const natural = FaceReader.getValue(D6, identity, mapping);
    expect(natural).toBe(6);

    const shifted = createShiftedFaceMapping(D6, mapping, natural, 4);
    expect(new Set(shifted).size).toBe(6);
    expect(FaceReader.getValue(D6, identity, shifted)).toBe(4);
    expect(isValidFaceMapping(D6, shifted)).toBe(true);

    const unchanged = createShiftedFaceMapping(D6, mapping, natural, natural);
    expect(unchanged).toEqual(mapping);
  });

  it('rejects targets outside the label range and missing natural values', () => {
    const mapping = createFaceMapping(D6);

    expect(() => createShiftedFaceMapping(D6, mapping, 6, 0)).toThrow(
      /outside the die label range 1\.\.6/
    );
    expect(() => createShiftedFaceMapping(D6, mapping, 6, 7)).toThrow(
      /outside the die label range 1\.\.6/
    );
    expect(() => createShiftedFaceMapping(D6, mapping, 42, 3)).toThrow(
      /not present in the current face mapping/
    );
  });
});
