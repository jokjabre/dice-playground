// @ts-nocheck
import { describe, expect, it } from 'vitest';

import {
  countByValue,
  createKeepPlan,
  hasAtLeast,
  hasExactly,
  isFullHouse,
  isNOfAKind,
  isStraight,
  isValidKeepPlan,
  sum,
  topValues
} from '../src/index.js';

describe('sum and counts', () => {
  it('sums values and treats an empty list as zero', () => {
    expect(sum([1, 2, 3, 4, 5, 6])).toBe(21);
    expect(sum([])).toBe(0);
    expect(sum([6])).toBe(6);
  });

  it('rejects non-numeric values', () => {
    expect(() => sum([1, '2'])).toThrow();
    expect(() => sum('123')).toThrow();
    expect(() => countByValue([1, Number.NaN])).toThrow();
  });

  it('counts occurrences per value without mutating the input', () => {
    const values = [3, 3, 5, 3, 1];
    expect(countByValue(values)).toEqual({ 1: 1, 3: 3, 5: 1 });
    expect(values).toEqual([3, 3, 5, 3, 1]);
  });

  it('answers at-least and exactly questions', () => {
    expect(hasAtLeast([4, 4, 4, 2], 4, 3)).toBe(true);
    expect(hasAtLeast([4, 4, 2], 4, 3)).toBe(false);
    expect(hasExactly([4, 4, 2], 4, 2)).toBe(true);
    expect(hasExactly([4, 4, 4], 4, 2)).toBe(false);
    expect(hasExactly([1, 2], 6, 0 + 1)).toBe(false);
    expect(() => hasAtLeast([1], 1, 0)).toThrow();
  });

  it('returns the largest values in descending order', () => {
    const values = [2, 6, 1, 5, 3];
    expect(topValues(values, 2)).toEqual([6, 5]);
    expect(topValues(values, 0)).toEqual([]);
    expect(values).toEqual([2, 6, 1, 5, 3]);
  });
});

describe('combinations', () => {
  it('detects n-of-a-kind from two to five', () => {
    expect(isNOfAKind([2, 2, 5, 5, 5], 3)).toBe(true);
    expect(isNOfAKind([2, 2, 5, 5, 5], 2)).toBe(true);
    expect(isNOfAKind([2, 2, 5, 5, 5], 4)).toBe(false);
    expect(isNOfAKind([6, 6, 6, 6, 6], 5)).toBe(true);
    expect(isNOfAKind([1, 2, 3, 4, 5], 2)).toBe(false);
  });

  it('detects full houses and excludes five of a kind', () => {
    expect(isFullHouse([3, 3, 3, 5, 5])).toBe(true);
    expect(isFullHouse([5, 5, 3, 3, 3])).toBe(true);
    expect(isFullHouse([3, 3, 3, 3, 3])).toBe(false);
    expect(isFullHouse([3, 3, 5, 5, 1])).toBe(false);
    expect(isFullHouse([3, 3, 3, 3, 5])).toBe(false);
  });

  it('detects straights for the whole hand and for a run length', () => {
    expect(isStraight([2, 3, 4, 5, 6])).toBe(true);
    expect(isStraight([6, 5, 4, 3, 2])).toBe(true);
    expect(isStraight([1, 2, 3, 4, 6])).toBe(false);
    expect(isStraight([1, 2, 4, 5, 6], 3)).toBe(true);
    expect(isStraight([1, 2, 4, 6, 6], 3)).toBe(false);
    expect(isStraight([1, 1, 2, 3, 4], 4)).toBe(true);
  });
});

describe('keep plans', () => {
  it('builds a plan from keep indices', () => {
    const plan = createKeepPlan({ values: [1, 2, 3, 4, 5], keep: [3, 1] });
    expect(plan.keepIndices).toEqual([1, 3]);
    expect(plan.keptValues).toEqual([2, 4]);
    expect(plan.rerollIndices).toEqual([0, 2, 4]);
    expect(plan.rerolledValues).toEqual([1, 3, 5]);
    expect(plan.keptCount).toBe(2);
    expect(plan.rerollCount).toBe(3);
  });

  it('builds a plan from keep booleans', () => {
    const plan = createKeepPlan({
      values: [6, 6, 1],
      keep: [true, false, true]
    });
    expect(plan.keepIndices).toEqual([0, 2]);
    expect(plan.keptValues).toEqual([6, 1]);
    expect(plan.rerollIndices).toEqual([1]);
  });

  it('allows keeping everything or nothing', () => {
    expect(createKeepPlan({ values: [1, 2], keep: [0, 1] }).rerollCount).toBe(0);
    expect(createKeepPlan({ values: [1, 2], keep: [] }).keptCount).toBe(0);
  });

  it('rejects out-of-range, duplicate, and mismatched keep plans', () => {
    expect(() => createKeepPlan({ values: [1, 2], keep: [2] })).toThrow();
    expect(() => createKeepPlan({ values: [1, 2], keep: [0, 0] })).toThrow();
    expect(() => createKeepPlan({ values: [1, 2], keep: [true] })).toThrow();
    expect(isValidKeepPlan({ values: [1, 2], keep: [0] })).toBe(true);
    expect(isValidKeepPlan({ values: [1, 2], keep: [5] })).toBe(false);
  });
});
