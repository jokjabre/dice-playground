import { createElement } from '@dice/ui';

import { YAMB_CATEGORIES, YAMB_COLUMNS } from '../game/variant.js';
import {
  activeColumnFor,
  activeColumn
} from '../game/gameState.js';
import {
  columnSubtotal,
  grandTotal,
  scoreCategory
} from '../game/scoring.js';

/**
 * Scorecard rendering for Yamb.
 *
 * One table for the active player: rows are categories, columns are the
 * four scorecard columns. The active column (derived from fill order) is
 * highlighted; only unfilled cells in the active column are selectable.
 * Filled cells are locked. Text is assigned through textContent only.
 */

/**
 * @param {string} tag
 * @param {Record<string, string|undefined>} attrs
 * @param {Array<string|HTMLElement>} [children]
 * @returns {HTMLElement}
 */
function el(tag, attrs = {}, children = []) {
  return createElement(tag, attrs, children);
}

/**
 * Render the scorecard for the active player.
 *
 * @param {import('../game/gameState.js').GameState} state
 * @param {(categoryId: string) => void} onSelectCategory
 * @returns {HTMLElement}
 */
export function renderScorecard(state, onSelectCategory) {
  const player = state.players[state.activePlayerIndex];
  if (!player) {
    return el('p', { className: 'yamb-scorecard-empty', text: 'No game in progress.' });
  }

  const activeCol = activeColumn(state);
  const selected = state.turn.selectedCategory;
  const values = state.turn.values;
  const canPreview = values.length === 5 && state.phase === 'selecting';

  const headerCells = YAMB_COLUMNS.map((column) => {
    const isActive = column.id === activeCol;
    return el('th', {
      className: isActive ? 'yamb-col-active' : undefined,
      'data-testid': `scorecol-${column.id}`,
      text: `${column.label}${isActive ? ' (active)' : ''}`
    });
  });

  const bodyRows = YAMB_CATEGORIES.map((category) => {
    const cells = YAMB_COLUMNS.map((column) => {
      const score = player.scorecard[column.id][category.id];
      const isActiveColumn = column.id === activeCol;
      const isFilled = score !== null && score !== undefined;
      const isSelected =
        selected === category.id && isActiveColumn;

      if (isFilled) {
        return el('td', {
          className: 'yamb-cell-locked',
          'data-testid': `score-cell-${column.id}-${category.id}`,
          text: String(score)
        });
      }

      const preview = canPreview && isActiveColumn
        ? scoreCategory(values, category.id)
        : null;
      const button = /** @type {HTMLButtonElement} */ (
        createElement('button', {
          type: 'button',
          className: isSelected
            ? 'yamb-cell-button yamb-cell-selected'
            : 'yamb-cell-button',
          'data-testid': `score-cell-${column.id}-${category.id}`,
          'aria-label': `${category.label} in ${column.label} column${
            preview !== null ? `, preview ${preview}` : ''
          }`,
          'aria-pressed': isSelected ? 'true' : 'false',
          disabled: isActiveColumn ? undefined : 'disabled',
          text: preview !== null ? String(preview) : '—'
        })
      );
      button.addEventListener('click', () => onSelectCategory(category.id));
      return el('td', {}, [button]);
    });

    return el('tr', {}, [
      el('th', { className: 'yamb-row-label', text: category.label }),
      ...cells
    ]);
  });

  const subtotalCells = YAMB_COLUMNS.map((column) =>
    el('td', {
      className: 'yamb-subtotal',
      'data-testid': `subtotal-${column.id}`,
      text: String(columnSubtotal(player.scorecard[column.id]))
    })
  );

  const table = el('table', { className: 'yamb-table' }, [
    el('thead', {}, [
      el('tr', {}, [
        el('th', { className: 'yamb-row-label', text: `${player.name}` }),
        ...headerCells
      ])
    ]),
    el('tbody', {}, [
      ...bodyRows,
      el('tr', {}, [
        el('th', { className: 'yamb-row-label', text: 'Subtotal' }),
        ...subtotalCells
      ])
    ])
  ]);

  const total = el('p', {
    className: 'yamb-grand-total',
    'data-testid': 'grand-total',
    text: `Total: ${grandTotal(player)}`
  });

  return el('div', { className: 'yamb-scorecard-inner' }, [table, total]);
}

/**
 * Render the player bar: one chip per player with name and grand total.
 *
 * @param {import('../game/gameState.js').GameState} state
 * @returns {HTMLElement}
 */
export function renderPlayerBar(state) {
  if (state.players.length === 0) {
    return el('p', { className: 'yamb-players-empty', text: 'No players yet.' });
  }
  const chips = state.players.map((player, index) => {
    const isActive = index === state.activePlayerIndex && state.phase !== 'game-over';
    const column = activeColumnFor(player);
    return el(
      'span',
      {
        className: isActive ? 'yamb-player-chip yamb-player-active' : 'yamb-player-chip',
        'data-testid': `player-${index}`,
        text: `${player.name}: ${grandTotal(player)}${
          column ? ` (${column})` : ' (done)'
        }${isActive ? ' — turn' : ''}`
      }
    );
  });
  return el('div', { className: 'yamb-players', 'data-testid': 'player-bar' }, chips);
}
