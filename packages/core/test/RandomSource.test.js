import { describe, expect, it } from 'vitest';

import {
  RandomSource,
  createBrowserRandom,
  createSeededRandom
} from '../src/index.js';

describe('RandomSource', () => {
  it('produces repeatable sequences for the same seed', () => {
    const first = createSeededRandom('dice-playground');
    const second = createSeededRandom('dice-playground');

    for (let i = 0; i < 8; i += 1) {
      expect(first.next()).toBe(second.next());
    }
  });

  it('supports numeric and string seeds', () => {
    const numeric = createSeededRandom(42);
    const text = createSeededRandom('42');

    expect(numeric.next()).toBeGreaterThanOrEqual(0);
    expect(numeric.next()).toBeLessThan(1);
    expect(text.next()).toBeGreaterThanOrEqual(0);
    expect(text.next()).toBeLessThan(1);
  });

  it('returns integers inclusively within the requested range', () => {
    const random = createSeededRandom('int');
    const seen = new Set();

    for (let i = 0; i < 200; i += 1) {
      const value = random.int(1, 6);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(6);
      seen.add(value);
    }

    expect(seen.size).toBeGreaterThan(1);
  });

  it('picks from arrays and rejects empty arrays', () => {
    const random = createSeededRandom('pick');

    expect(['a', 'b']).toContain(random.pick(['a', 'b']));
    expect(() => random.pick([])).toThrow(RangeError);
  });

  it('forks independent streams without advancing the parent', () => {
    const parent = createSeededRandom('parent');
    const reference = createSeededRandom('parent');
    const child = parent.fork('child');
    const childReference = createSeededRandom('child');

    expect(child.next()).toBe(childReference.next());
    expect(parent.next()).toBe(reference.next());
    expect(parent.next()).toBe(reference.next());
  });

  it('rejects invalid constructor and fork inputs', () => {
    // @ts-expect-error runtime guard
    expect(() => new RandomSource()).toThrow(TypeError);
    // @ts-expect-error runtime guard
    expect(() => createSeededRandom('seed').fork()).toThrow(TypeError);
    expect(() => createSeededRandom('seed').int(1.5, 3)).toThrow(RangeError);
    expect(() => createSeededRandom('seed').int(5, 1)).toThrow(RangeError);
  });

  it('creates a browser random stream in Node', () => {
    const random = createBrowserRandom();
    const value = random.next();

    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
  });
});
