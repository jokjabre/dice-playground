import { describe, expect, it } from 'vitest';

import {
  activeColumn,
  canRoll,
  canScore,
  gameReducer,
  initialGameState,
  parseSavedGame,
  serializeGame
} from '../src/game/gameState.js';
import { grandTotal } from '../src/game/scoring.js';
import { YAMB_CATEGORIES, YAMB_COLUMNS } from '../src/game/variant.js';

/**
 * @param {string[]} names
 * @returns {import('../src/game/gameState.js').GameState}
 */
function started(names = ['Alice', 'Bob']) {
  return gameReducer(initialGameState(), { type: 'START', players: names });
}

/**
 * Roll once and settle, returning the selecting state.
 *
 * @param {import('../src/game/gameState.js').GameState} state
 * @param {number[]} values
 * @returns {import('../src/game/gameState.js').GameState}
 */
function rolled(state, values) {
  const rolling = gameReducer(state, { type: 'ROLL_START' });
  return gameReducer(rolling, { type: 'ROLL_SETTLE', values });
}

describe('yamb turn reducer', () => {
  it('starts a game only from setup with 2-4 players', () => {
    expect(gameReducer(initialGameState(), { type: 'START', players: ['Solo'] }).phase).toBe('setup');
    const state = started();
    expect(state.phase).toBe('idle');
    expect(state.players).toHaveLength(2);
    expect(state.players.map((player) => player.name)).toEqual(['Alice', 'Bob']);
    expect(activeColumn(state)).toBe('down');
    // START is ignored once a game is running.
    const again = gameReducer(state, { type: 'START', players: ['X', 'Y'] });
    expect(again.players.map((player) => player.name)).toEqual(['Alice', 'Bob']);
  });

  it('rejects scoring before rolling and rolling more than three times', () => {
    const state = started();
    expect(canScore(state)).toBe(false);
    expect(canRoll(state)).toBe(true);

    let current = rolled(state, [1, 2, 3, 4, 5]);
    expect(current.phase).toBe('selecting');
    expect(current.turn.rollCount).toBe(1);

    current = rolled(current, [2, 3, 4, 5, 6]);
    current = rolled(current, [6, 6, 6, 6, 6]);
    expect(current.turn.rollCount).toBe(3);
    expect(canRoll(current)).toBe(false);
    // A fourth roll is ignored.
    expect(gameReducer(current, { type: 'ROLL_START' })).toBe(current);
  });

  it('toggles keeps and forbids rerolling with all dice held', () => {
    let state = rolled(started(), [1, 1, 2, 3, 4]);
    expect(state.turn.kept).toEqual([false, false, false, false, false]);
    state = gameReducer(state, { type: 'TOGGLE_KEEP', index: 0 });
    state = gameReducer(state, { type: 'TOGGLE_KEEP', index: 1 });
    expect(state.turn.kept).toEqual([true, true, false, false, false]);
    state = gameReducer(state, { type: 'TOGGLE_KEEP', index: 0 });
    expect(state.turn.kept).toEqual([false, true, false, false, false]);

    state = gameReducer(state, { type: 'TOGGLE_KEEP', index: 0 });
    state = gameReducer(state, { type: 'TOGGLE_KEEP', index: 2 });
    state = gameReducer(state, { type: 'TOGGLE_KEEP', index: 3 });
    state = gameReducer(state, { type: 'TOGGLE_KEEP', index: 4 });
    expect(state.turn.kept.every(Boolean)).toBe(true);
    expect(canRoll(state)).toBe(false);

    state = gameReducer(state, { type: 'CLEAR_KEEP' });
    expect(state.turn.kept.every(Boolean)).toBe(false);
    expect(canRoll(state)).toBe(true);
  });

  it('scores a selected category and passes the turn', () => {
    let state = rolled(started(), [1, 1, 1, 1, 1]);
    state = gameReducer(state, { type: 'SELECT_CATEGORY', category: 'ones' });
    expect(canScore(state)).toBe(true);
    state = gameReducer(state, { type: 'SCORE' });

    expect(state.players[0].scorecard.down.ones).toBe(5);
    expect(state.activePlayerIndex).toBe(1);
    expect(state.phase).toBe('idle');
    expect(state.turn.rollCount).toBe(0);
    expect(state.turn.values).toEqual([]);
    expect(grandTotal(state.players[0])).toBe(5);
  });

  it('refuses to score a filled category twice', () => {
    let state = rolled(started(), [2, 2, 2, 2, 2]);
    state = gameReducer(state, { type: 'SELECT_CATEGORY', category: 'twos' });
    state = gameReducer(state, { type: 'SCORE' });
    expect(state.players[0].scorecard.down.twos).toBe(10);

    // Bob plays a full turn back to Alice, who tries Ones again fine but
    // Twos is now locked: selecting it is ignored.
    let bob = rolled(state, [1, 1, 1, 1, 1]);
    bob = gameReducer(bob, { type: 'SELECT_CATEGORY', category: 'ones' });
    bob = gameReducer(bob, { type: 'SCORE' });
    let alice = rolled(bob, [2, 2, 2, 2, 2]);
    const before = alice;
    alice = gameReducer(alice, { type: 'SELECT_CATEGORY', category: 'twos' });
    expect(alice).toBe(before);
    expect(canScore(alice)).toBe(false);
  });

  it('enforces column fill order down -> up -> free -> announcement', () => {
    let state = started(['Alice', 'Bob']);
    // Fill Alice's entire down column over her turns (Bob scores zeros
    // for his own down column in between).
    for (const category of YAMB_CATEGORIES) {
      state = rolled(state, [1, 2, 3, 4, 5]);
      state = gameReducer(state, { type: 'SELECT_CATEGORY', category: category.id });
      state = gameReducer(state, { type: 'SCORE' });
      // Bob's turn.
      state = rolled(state, [6, 6, 6, 6, 6]);
      state = gameReducer(state, {
        type: 'SELECT_CATEGORY',
        category: category.id
      });
      state = gameReducer(state, { type: 'SCORE' });
    }
    expect(activeColumn(state)).toBe('up');
  });

  it('requires announcement before rolling in the announcement column', () => {
    // Fabricate a late-game state by filling down/up/free for Alice
    // through the saved-game seam.
    const saved = JSON.parse(serializeGame(started()));
    for (const columnId of ['down', 'up', 'free']) {
      for (const category of YAMB_CATEGORIES) {
        saved.players[0].scorecard[columnId][category.id] = 0;
      }
    }
    const restored = /** @type {any} */ (parseSavedGame(JSON.stringify(saved)));
    expect(restored).not.toBeNull();
    expect(activeColumn(restored)).toBe('announcement');
    // Cannot roll until a category is announced.
    expect(canRoll(restored)).toBe(false);
    const announced = gameReducer(restored, {
      type: 'SELECT_CATEGORY',
      category: 'yamb'
    });
    expect(announced.turn.selectedCategory).toBe('yamb');
    expect(canRoll(announced)).toBe(true);

    // The announced category is locked: re-selecting is ignored.
    let settled = rolled(announced, [1, 2, 3, 4, 5]);
    settled = gameReducer(settled, { type: 'SELECT_CATEGORY', category: 'ones' });
    expect(settled.turn.selectedCategory).toBe('yamb');
    settled = gameReducer(settled, { type: 'SCORE' });
    // Yamb scores 0 for a non-yamb hand, with no fallback category.
    expect(settled.players[0].scorecard.announcement.yamb).toBe(0);
  });

  it('ends the game when every scorecard is complete', () => {
    const saved = JSON.parse(serializeGame(started()));
    for (const player of saved.players) {
      for (const column of YAMB_COLUMNS) {
        for (const category of YAMB_CATEGORIES) {
          player.scorecard[column.id][category.id] = 0;
        }
      }
    }
    // Leave exactly one cell open for the active player.
    saved.players[0].scorecard.announcement.yamb = null;
    saved.activePlayerIndex = 0;
    const restored = /** @type {any} */ (parseSavedGame(JSON.stringify(saved)));
    expect(restored.phase).toBe('idle');

    let state = gameReducer(restored, {
      type: 'SELECT_CATEGORY',
      category: 'yamb'
    });
    state = rolled(state, [3, 3, 3, 3, 3]);
    state = gameReducer(state, { type: 'SCORE' });
    expect(state.phase).toBe('game-over');
  });

  it('persists and restores a game with plain JSON data', () => {
    let state = rolled(started(), [6, 6, 6, 6, 6]);
    state = gameReducer(state, { type: 'SELECT_CATEGORY', category: 'sixes' });
    state = gameReducer(state, { type: 'SCORE' });

    const restored = parseSavedGame(serializeGame(state));
    expect(restored).not.toBeNull();
    expect(restored?.players[0].scorecard.down.sixes).toBe(30);
    // A restored mid-turn game restarts the active turn.
    expect(restored?.phase).toBe('idle');
    expect(restored?.turn.rollCount).toBe(0);

    expect(parseSavedGame(null)).toBeNull();
    expect(parseSavedGame('not json')).toBeNull();
    expect(parseSavedGame('{"version":999}')).toBeNull();
  });

  it('returns to setup on NEW_GAME', () => {
    const state = gameReducer(started(), { type: 'NEW_GAME' });
    expect(state.phase).toBe('setup');
    expect(state.players).toEqual([]);
  });
});
