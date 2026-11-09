import {
  SAVE_VERSION,
  YAMB_CATEGORIES,
  YAMB_COLUMNS,
  YAMB_DICE_COUNT,
  YAMB_MAX_PLAYERS,
  YAMB_MAX_ROLLS,
  YAMB_MIN_PLAYERS,
  YAMB_VARIANT_ID,
  emptyScorecard,
  isCategory,
  isColumn
} from './variant.js';
import { isScorecardComplete, scoreCategory } from './scoring.js';

/**
 * Yamb game state and pure turn reducer.
 *
 * The reducer is the single source of truth for turn transitions; the
 * app shell only translates engine settle results and UI clicks into
 * actions. Invalid actions are ignored (state returned unchanged).
 *
 * Phases:
 *
 * - `setup` — no game started yet.
 * - `idle` — awaiting a roll. In the announcement column a category must
 *   be announced (selected) before rolling.
 * - `rolling` — an engine roll is in flight.
 * - `selecting` — rolled; the player may keep/reroll or score.
 * - `game-over` — every scorecard is complete.
 */

/**
 * @typedef {Object} PlayerState
 * @property {string} id
 * @property {string} name
 * @property {Record<string, Record<string, number|null>>} scorecard
 */

/**
 * @typedef {Object} TurnState
 * @property {number} rollCount Rolls taken this turn (0..3).
 * @property {number[]} values Current dice values (empty before roll 1).
 * @property {boolean[]} kept Hold flags, aligned with `values`.
 * @property {string|null} selectedCategory Chosen category (announcement
 *   before roll 1 in the announcement column; scoring choice afterwards).
 */

/**
 * @typedef {Object} GameState
 * @property {number} version
 * @property {string} variantId
 * @property {PlayerState[]} players
 * @property {number} activePlayerIndex
 * @property {'setup'|'idle'|'rolling'|'selecting'|'game-over'} phase
 * @property {TurnState} turn
 */

/**
 * @returns {TurnState}
 */
function emptyTurn() {
  return {
    rollCount: 0,
    values: [],
    kept: Array.from({ length: YAMB_DICE_COUNT }, () => false),
    selectedCategory: null
  };
}

/**
 * @returns {GameState}
 */
export function initialGameState() {
  return {
    version: SAVE_VERSION,
    variantId: YAMB_VARIANT_ID,
    players: [],
    activePlayerIndex: 0,
    phase: 'setup',
    turn: emptyTurn()
  };
}

/**
 * @param {GameState} state
 * @returns {PlayerState|null}
 */
export function activePlayer(state) {
  return state.players[state.activePlayerIndex] ?? null;
}

/**
 * The active column for a player: the first column in fill order that is
 * not complete, or `null` when the scorecard is complete.
 *
 * @param {PlayerState} player
 * @returns {string|null}
 */
export function activeColumnFor(player) {
  for (const column of YAMB_COLUMNS) {
    const cells = player.scorecard[column.id];
    const complete = Object.values(cells).every(
      (value) => value !== null && value !== undefined
    );
    if (!complete) return column.id;
  }
  return null;
}

/**
 * @param {GameState} state
 * @returns {string|null}
 */
export function activeColumn(state) {
  const player = activePlayer(state);
  return player ? activeColumnFor(player) : null;
}

/**
 * Whether the active turn is in the announcement column.
 *
 * @param {GameState} state
 * @returns {boolean}
 */
export function isAnnouncementTurn(state) {
  return activeColumn(state) === 'announcement';
}

/**
 * Whether a roll may start right now.
 *
 * @param {GameState} state
 * @returns {boolean}
 */
export function canRoll(state) {
  if (state.phase === 'idle') {
    // Announcement turns must announce a category before the first roll.
    if (isAnnouncementTurn(state) && !state.turn.selectedCategory) return false;
    return true;
  }
  if (state.phase === 'selecting') {
    if (state.turn.rollCount >= YAMB_MAX_ROLLS) return false;
    // Rerolling with all dice kept is not allowed.
    if (state.turn.kept.every(Boolean)) return false;
    return true;
  }
  return false;
}

/**
 * Whether the current hand may be scored right now.
 *
 * @param {GameState} state
 * @returns {boolean}
 */
export function canScore(state) {
  if (state.phase !== 'selecting') return false;
  if (state.turn.values.length !== YAMB_DICE_COUNT) return false;
  const category = state.turn.selectedCategory;
  if (!category || !isCategory(category)) return false;
  const player = activePlayer(state);
  if (!player) return false;
  const column = activeColumn(state);
  if (!column) return false;
  return player.scorecard[column][category] === null;
}

/**
 * @param {string[]} names
 * @returns {GameState}
 */
function startGame(names) {
  const clean = names
    .map((name, index) => String(name ?? '').trim() || `Player ${index + 1}`)
    .slice(0, YAMB_MAX_PLAYERS);
  const players = clean.map((name, index) => ({
    id: `p${index + 1}`,
    name,
    scorecard: emptyScorecard()
  }));
  return {
    version: SAVE_VERSION,
    variantId: YAMB_VARIANT_ID,
    players,
    activePlayerIndex: 0,
    phase: 'idle',
    turn: emptyTurn()
  };
}

/**
 * @param {GameState} state
 * @param {Record<string, any>} action
 * @returns {GameState}
 */
export function gameReducer(state, action) {
  if (!action || typeof action.type !== 'string') return state;

  switch (action.type) {
    case 'START': {
      if (state.phase !== 'setup') return state;
      const names = Array.isArray(action.players) ? action.players : [];
      if (
        names.length < YAMB_MIN_PLAYERS ||
        names.length > YAMB_MAX_PLAYERS
      ) {
        return state;
      }
      return startGame(names);
    }

    case 'ROLL_START': {
      if (!canRoll(state)) return state;
      return { ...state, phase: 'rolling' };
    }

    case 'ROLL_SETTLE': {
      if (state.phase !== 'rolling') return state;
      const values = Array.isArray(action.values) ? action.values : [];
      if (values.length !== YAMB_DICE_COUNT) return state;
      return {
        ...state,
        phase: 'selecting',
        turn: {
          ...state.turn,
          rollCount: state.turn.rollCount + 1,
          values: values.slice(),
          kept: Array.from({ length: YAMB_DICE_COUNT }, () => false)
        }
      };
    }

    case 'TOGGLE_KEEP': {
      if (state.phase !== 'selecting') return state;
      const index = action.index;
      if (!Number.isInteger(index) || index < 0 || index >= YAMB_DICE_COUNT) {
        return state;
      }
      const kept = state.turn.kept.slice();
      kept[index] = !kept[index];
      return { ...state, turn: { ...state.turn, kept } };
    }

    case 'CLEAR_KEEP': {
      if (state.phase !== 'selecting') return state;
      return {
        ...state,
        turn: {
          ...state.turn,
          kept: Array.from({ length: YAMB_DICE_COUNT }, () => false)
        }
      };
    }

    case 'SELECT_CATEGORY': {
      const category = action.category;
      if (!isCategory(category)) return state;
      const player = activePlayer(state);
      if (!player) return state;
      const column = activeColumn(state);
      if (!column) return state;
      if (player.scorecard[column][category] !== null) return state;

      if (state.phase === 'selecting') {
        // The announced category is locked for the turn in the
        // announcement column (ADR-015).
        if (
          column === 'announcement' &&
          state.turn.rollCount > 0 &&
          state.turn.selectedCategory !== null
        ) {
          return state;
        }
        return { ...state, turn: { ...state.turn, selectedCategory: category } };
      }
      // Pre-roll announcement is allowed only in the announcement column.
      if (state.phase === 'idle' && column === 'announcement') {
        return { ...state, turn: { ...state.turn, selectedCategory: category } };
      }
      return state;
    }

    case 'SCORE': {
      if (!canScore(state)) return state;
      const player = activePlayer(state);
      if (!player) return state;
      const category = /** @type {string} */ (state.turn.selectedCategory);
      const column = /** @type {string} */ (activeColumn(state));
      const score = scoreCategory(state.turn.values, category);

      const players = state.players.map((entry) =>
        entry.id === player.id
          ? {
              ...entry,
              scorecard: {
                ...entry.scorecard,
                [column]: {
                  ...entry.scorecard[column],
                  [category]: score
                }
              }
            }
          : entry
      );

      const allComplete = players.every((entry) =>
        isScorecardComplete(entry.scorecard)
      );

      if (allComplete) {
        return {
          ...state,
          players,
          phase: 'game-over',
          turn: emptyTurn()
        };
      }

      return {
        ...state,
        players,
        activePlayerIndex: (state.activePlayerIndex + 1) % players.length,
        phase: 'idle',
        turn: emptyTurn()
      };
    }

    case 'NEW_GAME': {
      return initialGameState();
    }

    default:
      return state;
  }
}

/**
 * Serialize the game for persistence. Engine instances, bodies, and
 * meshes are never part of the state, so the result is plain JSON.
 *
 * @param {GameState} state
 * @returns {string}
 */
export function serializeGame(state) {
  return JSON.stringify(state);
}

/**
 * Parse a saved game. Returns `null` for missing, incompatible, or
 * malformed data. A saved mid-turn game restarts the active turn at
 * `idle` (saved dice are not restored).
 *
 * @param {string|null|undefined} json
 * @returns {GameState|null}
 */
export function parseSavedGame(json) {
  if (typeof json !== 'string' || json.length === 0) return null;
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  if (parsed.version !== SAVE_VERSION) return null;
  if (parsed.variantId !== YAMB_VARIANT_ID) return null;
  if (!Array.isArray(parsed.players) || parsed.players.length < YAMB_MIN_PLAYERS) {
    return null;
  }
  if (parsed.players.length > YAMB_MAX_PLAYERS) return null;

  const players = [];
  for (const player of parsed.players) {
    if (!player || typeof player.name !== 'string' || !player.scorecard) {
      return null;
    }
    const scorecard = emptyScorecard();
    for (const column of YAMB_COLUMNS) {
      if (!isColumn(column.id)) continue;
      const savedColumn = player.scorecard[column.id];
      if (!savedColumn || typeof savedColumn !== 'object') return null;
      for (const category of YAMB_CATEGORIES) {
        const value = savedColumn[category.id];
        if (value === null || value === undefined) {
          scorecard[column.id][category.id] = null;
        } else if (typeof value === 'number' && Number.isFinite(value)) {
          scorecard[column.id][category.id] = value;
        } else {
          return null;
        }
      }
    }
    players.push({
      id: typeof player.id === 'string' ? player.id : `p${players.length + 1}`,
      name: player.name,
      scorecard
    });
  }

  const activePlayerIndex =
    Number.isInteger(parsed.activePlayerIndex) &&
    parsed.activePlayerIndex >= 0 &&
    parsed.activePlayerIndex < players.length
      ? parsed.activePlayerIndex
      : 0;

  return {
    version: SAVE_VERSION,
    variantId: YAMB_VARIANT_ID,
    players,
    activePlayerIndex,
    phase: 'idle',
    turn: emptyTurn()
  };
}
