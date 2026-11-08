import { describe, expect, it } from 'vitest';

import {
  assertHand,
  columnSubtotal,
  grandTotal,
  hasUpperBonus,
  isScorecardComplete,
  scoreCategory,
  upperSubtotal,
  winningPlayers
} from '../src/game/scoring.js';
import { emptyScorecard } from '../src/game/variant.js';

// Fixtures derived from docs/adr/ADR-015-yamb-variant.md.

describe('yamb scoring fixtures (ADR-015)', () => {
  it('scores number categories as the sum of matching dice', () => {
    expect(scoreCategory([1, 1, 1, 1, 1], 'ones')).toBe(5);
    expect(scoreCategory([6, 6, 6, 6, 6], 'sixes')).toBe(30);
    expect(scoreCategory([2, 2, 3, 5, 6], 'ones')).toBe(0);
    expect(scoreCategory([2, 2, 3, 5, 6], 'twos')).toBe(4);
    expect(scoreCategory([2, 2, 3, 5, 6], 'threes')).toBe(3);
    expect(scoreCategory([2, 2, 3, 5, 6], 'fives')).toBe(5);
    expect(scoreCategory([2, 2, 3, 5, 6], 'sixes')).toBe(6);
    expect(scoreCategory([4, 4, 4, 4, 2], 'fours')).toBe(16);
  });

  it('scores total, min, and max', () => {
    expect(scoreCategory([1, 2, 3, 4, 5], 'total')).toBe(15);
    expect(scoreCategory([2, 3, 4, 5, 6], 'total')).toBe(20);
    expect(scoreCategory([1, 2, 3, 4, 5], 'min')).toBe(1);
    expect(scoreCategory([1, 2, 3, 4, 5], 'max')).toBe(5);
    expect(scoreCategory([6, 6, 6, 6, 6], 'min')).toBe(6);
    expect(scoreCategory([6, 6, 6, 6, 6], 'max')).toBe(6);
  });

  it('scores straights only for the two five-runs', () => {
    expect(scoreCategory([1, 2, 3, 4, 5], 'straight')).toBe(30);
    expect(scoreCategory([2, 3, 4, 5, 6], 'straight')).toBe(30);
    expect(scoreCategory([1, 1, 2, 3, 4], 'straight')).toBe(0);
    expect(scoreCategory([3, 3, 3, 5, 5], 'straight')).toBe(0);
  });

  it('scores full house as 3+2 only, never five of a kind', () => {
    expect(scoreCategory([3, 3, 3, 5, 5], 'fullHouse')).toBe(25);
    expect(scoreCategory([1, 1, 1, 1, 1], 'fullHouse')).toBe(0);
    expect(scoreCategory([4, 4, 4, 4, 2], 'fullHouse')).toBe(0);
  });

  it('scores poker for four or more of a kind', () => {
    expect(scoreCategory([4, 4, 4, 4, 2], 'poker')).toBe(30);
    expect(scoreCategory([1, 1, 1, 1, 1], 'poker')).toBe(30);
    expect(scoreCategory([3, 3, 3, 5, 5], 'poker')).toBe(0);
  });

  it('scores yamb only for five of a kind', () => {
    expect(scoreCategory([1, 1, 1, 1, 1], 'yamb')).toBe(50);
    expect(scoreCategory([6, 6, 6, 6, 6], 'yamb')).toBe(50);
    expect(scoreCategory([4, 4, 4, 4, 2], 'yamb')).toBe(0);
  });

  it('rejects hands that are not five D6 values', () => {
    expect(() => assertHand([1, 2, 3])).toThrow(RangeError);
    expect(() => assertHand([1, 2, 3, 4, 7])).toThrow(RangeError);
    expect(() => scoreCategory([1, 2, 3, 4, 5], 'nope')).toThrow(/Unknown Yamb category/);
  });
});

describe('yamb totals and bonuses', () => {
  it('applies the upper bonus at a subtotal of 60 or more', () => {
    const scorecard = emptyScorecard();
    const column = scorecard.down;
    column.ones = 3;
    column.twos = 6;
    column.threes = 9;
    column.fours = 12;
    column.fives = 15;
    column.sixes = 18;
    expect(upperSubtotal(column)).toBe(63);
    expect(hasUpperBonus(column)).toBe(true);
    expect(columnSubtotal(column)).toBe(83);
  });

  it('denies the upper bonus below 60 or while incomplete', () => {
    const scorecard = emptyScorecard();
    const column = scorecard.down;
    column.ones = 5;
    column.twos = 10;
    column.threes = 15;
    column.fours = 20;
    column.fives = 9;
    column.sixes = 0;
    expect(upperSubtotal(column)).toBe(59);
    expect(hasUpperBonus(column)).toBe(false);
    expect(columnSubtotal(column)).toBe(59);

    column.sixes = null;
    expect(hasUpperBonus(column)).toBe(false);
  });

  it('computes grand totals and winners including ties', () => {
    const first = { scorecard: emptyScorecard() };
    const second = { scorecard: emptyScorecard() };
    first.scorecard.down.ones = 5;
    second.scorecard.down.ones = 10;
    expect(grandTotal(first)).toBe(5);
    expect(grandTotal(second)).toBe(10);
    expect(winningPlayers([first, second])).toEqual([1]);

    second.scorecard.down.ones = 5;
    expect(winningPlayers([first, second])).toEqual([0, 1]);
    expect(winningPlayers([])).toEqual([]);
  });

  it('detects complete scorecards', () => {
    const scorecard = emptyScorecard();
    expect(isScorecardComplete(scorecard)).toBe(false);
    for (const column of Object.values(scorecard)) {
      for (const key of Object.keys(column)) {
        column[key] = 0;
      }
    }
    expect(isScorecardComplete(scorecard)).toBe(true);
  });
});
