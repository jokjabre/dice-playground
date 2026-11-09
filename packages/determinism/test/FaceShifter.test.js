import { D6, FaceReader, createFaceMapping, isValidFaceMapping } from '@dice/dice';
import { quat } from '@dice/core';
import { describe, expect, it } from 'vitest';

import { FaceShifter } from '../src/index.js';

describe('FaceShifter', () => {
  it('returns a complete permutation for every shift', () => {
    const base = createFaceMapping(D6);
    for (let natural = 1; natural <= 6; natural += 1) {
      for (let target = 1; target <= 6; target += 1) {
        const mapping = FaceShifter.shiftFaceMapping(D6, base, natural, target);
        expect(isValidFaceMapping(D6, mapping)).toBe(true);
        expect(new Set(mapping).size).toBe(6);
      }
    }
  });

  it('produces the requested top value and does not mutate the input', () => {
    const base = [1, 2, 3, 4, 5, 6];
    const identity = quat.identity();

    // Identity quaternion naturally shows 6.
    expect(FaceReader.getValue(D6, identity, base)).toBe(6);

    const shifted = FaceShifter.shiftFaceMapping(D6, base, 6, 4);
    expect(base).toEqual([1, 2, 3, 4, 5, 6]);
    expect(shifted).not.toBe(base);
    expect(isValidFaceMapping(D6, shifted)).toBe(true);
    expect(FaceReader.getValue(D6, identity, shifted)).toBe(4);
  });

  it('builds one mapping per die and keeps untargeted dice at base', () => {
    const mappings = FaceShifter.createFaceMappings(D6, [6, 3, 2], [1, 5]);
    expect(mappings).toHaveLength(3);
    expect(isValidFaceMapping(D6, mappings[0])).toBe(true);
    expect(FaceReader.getValue(D6, quat.identity(), mappings[0])).toBe(1);
    expect(mappings[2]).toEqual(createFaceMapping(D6));
  });

  it('rejects targets outside the label range with a descriptive error', () => {
    const base = createFaceMapping(D6);
    expect(() => FaceShifter.shiftFaceMapping(D6, base, 6, 0)).toThrow(
      /outside the die label range 1\.\.6/
    );
    expect(() => FaceShifter.shiftFaceMapping(D6, base, 6, 7)).toThrow(
      /outside the die label range 1\.\.6/
    );
  });
});
