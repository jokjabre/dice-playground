/**
 * Yamb variant data (Dice Playground Yamb variant v1).
 *
 * This module is the executable mirror of
 * `docs/adr/ADR-015-yamb-variant.md`. If the ADR changes, this file and
 * the scoring fixtures must change with it. All Yamb-specific rules live
 * here and in `scoring.js` — never in engine packages.
 */

export const YAMB_VARIANT_ID = 'yamb-v1';
export const YAMB_DICE_COUNT = 5;
export const YAMB_MAX_ROLLS = 3;
export const YAMB_MIN_PLAYERS = 2;
export const YAMB_MAX_PLAYERS = 4;
export const SAVE_VERSION = 1;
export const SAVE_KEY = 'dice-playground.yamb.save.v1';

/**
 * @typedef {Object} CategoryDef
 * @property {string} id
 * @property {string} label
 */

/**
 * Scorecard categories in display order.
 *
 * @type {ReadonlyArray<CategoryDef>}
 */
export const YAMB_CATEGORIES = Object.freeze([
  { id: 'ones', label: 'Ones' },
  { id: 'twos', label: 'Twos' },
  { id: 'threes', label: 'Threes' },
  { id: 'fours', label: 'Fours' },
  { id: 'fives', label: 'Fives' },
  { id: 'sixes', label: 'Sixes' },
  { id: 'total', label: 'Total' },
  { id: 'min', label: 'Min' },
  { id: 'max', label: 'Max' },
  { id: 'straight', label: 'Straight' },
  { id: 'fullHouse', label: 'Full house' },
  { id: 'poker', label: 'Poker' },
  { id: 'yamb', label: 'Yamb' }
]);

/**
 * Upper-section categories that count toward the bonus threshold.
 *
 * @type {ReadonlyArray<string>}
 */
export const UPPER_CATEGORIES = Object.freeze([
  'ones',
  'twos',
  'threes',
  'fours',
  'fives',
  'sixes'
]);

export const UPPER_BONUS_THRESHOLD = 60;
export const UPPER_BONUS_POINTS = 20;
export const STRAIGHT_POINTS = 30;
export const FULL_HOUSE_POINTS = 25;
export const POKER_POINTS = 30;
export const YAMB_POINTS = 50;

/**
 * @typedef {Object} ColumnDef
 * @property {string} id
 * @property {string} label
 */

/**
 * Scorecard columns in mandatory fill order.
 *
 * @type {ReadonlyArray<ColumnDef>}
 */
export const YAMB_COLUMNS = Object.freeze([
  { id: 'down', label: 'Down' },
  { id: 'up', label: 'Up' },
  { id: 'free', label: 'Free' },
  { id: 'announcement', label: 'Announcement' }
]);

/**
 * @param {string} id
 * @returns {boolean}
 */
export function isCategory(id) {
  return YAMB_CATEGORIES.some((entry) => entry.id === id);
}

/**
 * @param {string} id
 * @returns {CategoryDef}
 */
export function getCategory(id) {
  const category = YAMB_CATEGORIES.find((entry) => entry.id === id);
  if (!category) {
    throw new Error(`Unknown Yamb category: ${id}`);
  }
  return category;
}

/**
 * @param {string} id
 * @returns {boolean}
 */
export function isColumn(id) {
  return YAMB_COLUMNS.some((entry) => entry.id === id);
}

/**
 * @param {string} id
 * @returns {ColumnDef}
 */
export function getColumn(id) {
  const column = YAMB_COLUMNS.find((entry) => entry.id === id);
  if (!column) {
    throw new Error(`Unknown Yamb column: ${id}`);
  }
  return column;
}

/**
 * Build an empty scorecard column: every category unfilled (`null`).
 *
 * @returns {Record<string, number|null>}
 */
export function emptyColumn() {
  /** @type {Record<string, number|null>} */
  const column = {};
  for (const category of YAMB_CATEGORIES) {
    column[category.id] = null;
  }
  return column;
}

/**
 * Build an empty scorecard: every column with every category unfilled.
 *
 * @returns {Record<string, Record<string, number|null>>}
 */
export function emptyScorecard() {
  /** @type {Record<string, Record<string, number|null>>} */
  const scorecard = {};
  for (const column of YAMB_COLUMNS) {
    scorecard[column.id] = emptyColumn();
  }
  return scorecard;
}
