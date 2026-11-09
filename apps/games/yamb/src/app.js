import { EVENTS } from '@dice/core';
import { createDiceEngine } from '@dice/engine';
import { ResultBanner, createElement } from '@dice/ui';

import { classicTray } from '@dice/content';

import {
  SAVE_KEY,
  YAMB_DICE_COUNT,
  YAMB_MAX_PLAYERS,
  YAMB_MIN_PLAYERS
} from './game/variant.js';
import {
  activeColumn,
  activePlayer,
  canRoll,
  canScore,
  gameReducer,
  initialGameState,
  isAnnouncementTurn,
  parseSavedGame,
  serializeGame
} from './game/gameState.js';
import { scoreCategory, winningPlayers } from './game/scoring.js';
import { renderPlayerBar, renderScorecard } from './ui/scorecard.js';
import { renderDiceTray } from './ui/diceTray.js';

export const YAMB_CONTENT = classicTray;

/**
 * @typedef {Object} YambAppOptions
 * @property {HTMLElement} stage
 * @property {HTMLElement} setupHost
 * @property {HTMLElement} trayHost
 * @property {HTMLElement} controlsHost
 * @property {HTMLElement} scorecardHost
 * @property {HTMLElement} statusHost
 * @property {HTMLElement} bannerHost
 * @property {string} [seed]
 * @property {{ fixedStep?: number, maxSubSteps?: number, maxFrameGap?: number }} [loop]
 */

/**
 * @typedef {Object} YambAppHandle
 * @property {import('@dice/engine').DiceEngine} engine
 * @property {import('@dice/ui').ResultBanner} banner
 * @property {() => void} resize
 * @property {() => import('./game/gameState.js').GameState} getState
 * @property {(action: Record<string, any>) => void} dispatch
 * @property {() => void} destroy
 */

/**
 * Create the engine and game wiring for Yamb. Only public package entries
 * are used. Game rules live entirely in `src/game/`; this module only
 * translates engine settle results and UI clicks into reducer actions.
 *
 * Dice order contract: the engine returns dice with kept dice first,
 * followed by newly spawned dice. Tray indices therefore always align
 * with `engine.getDiceIds()` order, which the reroll converts back into
 * the world's `keep` id list.
 *
 * @param {YambAppOptions} options
 * @returns {Promise<YambAppHandle>}
 */
export async function createYambApp(options) {
  const {
    stage,
    setupHost,
    trayHost,
    controlsHost,
    scorecardHost,
    statusHost,
    bannerHost
  } = options;

  const engine = await createDiceEngine({
    container: stage,
    content: YAMB_CONTENT,
    dice: { count: YAMB_DICE_COUNT, definition: 'd6', style: 'classic' },
    seed: options.seed,
    loop: options.loop
  });

  /** @type {import('./game/gameState.js').GameState} */
  let state = initialGameState();

  const banner = new ResultBanner({
    events: engine.events,
    container: bannerHost,
    autoHide: 6000
  });

  /**
   * @param {Record<string, any>} action
   * @returns {void}
   */
  function dispatch(action) {
    state = gameReducer(state, action);
    if (state.phase !== 'setup') {
      try {
        window.localStorage.setItem(SAVE_KEY, serializeGame(state));
      } catch {
        // Persistence is best-effort; private-mode storage must not break play.
      }
    } else {
      try {
        window.localStorage.removeItem(SAVE_KEY);
      } catch {
        // Ignore.
      }
    }
    render();
  }

  /**
   * Status line describing the current turn for the header caption.
   *
   * @returns {string}
   */
  function statusText() {
    if (state.phase === 'setup') return 'Set up a game to play.';
    if (state.phase === 'game-over') return 'Game over. See the final totals.';
    const player = activePlayer(state);
    const column = activeColumn(state);
    const name = player ? player.name : 'Player';
    if (state.phase === 'rolling') return `${name} is rolling…`;
    if (state.phase === 'selecting') {
      const category = state.turn.selectedCategory;
      return `${name} — roll ${state.turn.rollCount} of 3. ${
        category ? `Scoring into ${category}.` : 'Select a category to score.'
      }`;
    }
    if (isAnnouncementTurn(state) && !state.turn.selectedCategory) {
      return `${name} — announcement column: select a category to announce, then roll.`;
    }
    return `${name} — your roll. Column: ${column ?? '—'}.`;
  }

  /**
   * Roll through the engine, then settle into the reducer.
   *
   * @returns {Promise<void>}
   */
  async function roll() {
    if (!canRoll(state)) return;
    const isReroll = state.phase === 'selecting';
    /** @type {string[]} */
    let keep = [];
    if (isReroll) {
      const ids = engine.getDiceIds();
      keep = ids.filter((_, index) => state.turn.kept[index]);
      if (keep.length === 0 || keep.length >= YAMB_DICE_COUNT) return;
    }
    dispatch({ type: 'ROLL_START' });
    try {
      const result = isReroll
        ? await engine.roll({ dice: YAMB_DICE_COUNT, keep })
        : await engine.roll({ dice: YAMB_DICE_COUNT });
      const values = Array.isArray(result.values) ? result.values : [];
      dispatch({ type: 'ROLL_SETTLE', values });
    } catch (error) {
      const name =
        error && typeof error === 'object' && 'name' in error
          ? String(/** @type {{ name?: unknown }} */ (error).name)
          : undefined;
      if (name === 'RollCancelledError' || name === 'RollInProgressError') {
        // Roll in flight (or cancelled): leave the reducer in `rolling`.
        // A cancellation surfaces as no settle; resync to idle.
        if (state.phase === 'rolling') {
          state = { ...state, phase: 'idle' };
          render();
        }
        return;
      }
      throw error;
    }
  }

  /**
   * Score the selected category, then roll for the next player unless
   * the next turn needs an announcement first.
   *
   * @returns {void}
   */
  function score() {
    if (!canScore(state)) return;
    dispatch({ type: 'SCORE' });
    if (state.phase === 'idle' && canRoll(state)) {
      void roll();
    }
  }

  /**
   * Start a fresh game with the setup names and roll.
   *
   * @param {string[]} names
   * @returns {void}
   */
  function startGame(names) {
    dispatch({ type: 'START', players: names });
    if (state.phase === 'idle' && canRoll(state)) {
      void roll();
    }
  }

  /**
   * Restore a saved game at the start of the active turn.
   *
   * @param {import('./game/gameState.js').GameState} saved
   * @returns {void}
   */
  function continueGame(saved) {
    state = saved;
    render();
    if (state.phase === 'idle' && canRoll(state)) {
      void roll();
    }
  }

  // -- Static controls (built once; disabled states rendered per frame) ---

  const rollButton = /** @type {HTMLButtonElement} */ (
    createElement('button', {
      type: 'button',
      className: 'dice-control-button',
      'data-testid': 'roll-button',
      text: 'Roll'
    })
  );
  const scoreButton = /** @type {HTMLButtonElement} */ (
    createElement('button', {
      type: 'button',
      className: 'dice-control-button',
      'data-testid': 'score-button',
      text: 'Score'
    })
  );
  const clearKeepButton = /** @type {HTMLButtonElement} */ (
    createElement('button', {
      type: 'button',
      className: 'dice-control-button',
      'data-testid': 'clear-keep-button',
      text: 'Clear holds'
    })
  );
  const newGameButton = /** @type {HTMLButtonElement} */ (
    createElement('button', {
      type: 'button',
      className: 'dice-control-button',
      'data-testid': 'new-game-button',
      text: 'New game'
    })
  );

  rollButton.addEventListener('click', () => {
    void roll();
  });
  scoreButton.addEventListener('click', score);
  clearKeepButton.addEventListener('click', () => {
    dispatch({ type: 'CLEAR_KEEP' });
  });
  newGameButton.addEventListener('click', () => {
    engine.clear();
    dispatch({ type: 'NEW_GAME' });
  });

  controlsHost.replaceChildren(
    createElement(
      'div',
      {
        className: 'yamb-controls-row',
        role: 'toolbar',
        'aria-label': 'Game controls',
        'data-testid': 'game-controls'
      },
      [rollButton, scoreButton, clearKeepButton, newGameButton]
    )
  );

  // -- Setup panel (rebuilt when returning to setup) ----------------------

  /**
   * Build the setup panel: player-count select, name inputs, and start /
   * continue actions. Only shown in `setup` phase.
   *
   * @returns {HTMLElement|null}
   */
  function buildSetup() {
    if (state.phase !== 'setup') return null;

    /** @type {string|null} */
    let savedJson = null;
    try {
      savedJson = window.localStorage.getItem(SAVE_KEY);
    } catch {
      savedJson = null;
    }
    const saved = parseSavedGame(savedJson);

    const countSelect = /** @type {HTMLSelectElement} */ (
      createElement(
        'select',
        {
          className: 'dice-control-input',
          'data-testid': 'player-count-select',
          'aria-label': 'Number of players'
        },
        [2, 3, 4].map((count) =>
          createElement('option', {
            value: String(count),
            text: `${count} players`
          })
        )
      )
    );

    /** @type {HTMLInputElement[]} */
    const nameInputs = [];
    const namesHost = createElement('div', { className: 'yamb-name-inputs' }, []);

    /**
     * @param {number} count
     * @returns {void}
     */
    function buildNames(count) {
      nameInputs.length = 0;
      namesHost.replaceChildren();
      for (let index = 0; index < count; index += 1) {
        const input = /** @type {HTMLInputElement} */ (
          createElement('input', {
            type: 'text',
            className: 'dice-control-input yamb-name-input',
            'data-testid': `player-name-${index + 1}`,
            'aria-label': `Player ${index + 1} name`,
            value: `Player ${index + 1}`,
            maxlength: '24'
          })
        );
        nameInputs.push(input);
        namesHost.appendChild(
          createElement(
            'label',
            { className: 'dice-control-label yamb-name-row' },
            [`Player ${index + 1}:`, ' ', input]
          )
        );
      }
    }
    buildNames(2);
    countSelect.addEventListener('change', () => {
      buildNames(Number.parseInt(countSelect.value, 10));
    });

    const startButton = /** @type {HTMLButtonElement} */ (
      createElement('button', {
        type: 'button',
        className: 'dice-control-button',
        'data-testid': 'start-game-button',
        text: 'Start game'
      })
    );
    startButton.addEventListener('click', () => {
      startGame(nameInputs.map((input) => input.value));
    });

    /** @type {HTMLElement[]} */
    const parts = [
      createElement(
        'label',
        { className: 'dice-control-label yamb-name-row' },
        ['Players:', ' ', countSelect]
      ),
      namesHost,
      startButton
    ];

    if (saved) {
      const continueButton = /** @type {HTMLButtonElement} */ (
        createElement('button', {
          type: 'button',
          className: 'dice-control-button',
          'data-testid': 'continue-game-button',
          text: 'Continue saved game'
        })
      );
      continueButton.addEventListener('click', () => {
        continueGame(saved);
      });
      parts.push(
        createElement('p', {
          className: 'yamb-save-note',
          text: `Saved game found (${saved.players.map((player) => player.name).join(', ')}). Continuing restarts the active turn.`
        }),
        continueButton
      );
    }

    return createElement('div', { className: 'yamb-setup-inner' }, parts);
  }

  // -- Rendering ------------------------------------------------------------

  /** @type {HTMLElement|null} */
  let setupElement = null;

  /**
   * Re-render tray, scorecard, status, and control states from state.
   *
   * @returns {void}
   */
  function render() {
    statusHost.textContent = statusText();
    const caption = document.querySelector('.yamb-caption');
    if (caption) caption.textContent = statusText();

    if (state.phase === 'setup') {
      setupElement = buildSetup();
      if (setupElement) {
        setupHost.replaceChildren(setupElement);
      }
    } else {
      setupHost.replaceChildren();
      setupElement = null;
    }

    trayHost.replaceChildren(
      renderDiceTray(state, (index) => {
        dispatch({ type: 'TOGGLE_KEEP', index });
      })
    );

    scorecardHost.replaceChildren(
      renderPlayerBar(state),
      renderScorecard(state, (categoryId) => {
        dispatch({ type: 'SELECT_CATEGORY', category: categoryId });
      })
    );

    rollButton.disabled = !canRoll(state);
    scoreButton.disabled = !canScore(state);
    clearKeepButton.disabled = state.phase !== 'selecting';
    newGameButton.disabled = state.phase === 'setup';

    if (state.phase === 'game-over') {
      const winners = winningPlayers(state.players);
      const names = winners
        .map((index) => state.players[index].name)
        .join(' and ');
      const tied = winners.length > 1;
      statusHost.textContent = tied
        ? `Game over — tie between ${names}.`
        : `Game over — ${names} wins.`;
    }
  }

  engine.events.on(EVENTS.ROLL_START, () => {
    render();
  });
  engine.events.on(EVENTS.ROLL_SETTLE, (/** @type {any} */ payload) => {
    const result = payload?.result ?? payload ?? {};
    // The roll promise path already dispatches ROLL_SETTLE; this handler
    // keeps the UI in sync for any engine-driven settle.
    if (state.phase === 'rolling' && Array.isArray(result.values)) {
      dispatch({ type: 'ROLL_SETTLE', values: result.values });
    }
  });

  render();

  return {
    engine,
    banner,
    resize: () => {
      engine.resize();
    },
    getState: () => JSON.parse(JSON.stringify(state)),
    dispatch: (action) => {
      dispatch(action);
    },
    destroy: () => {
      banner.destroy();
      engine.destroy();
    }
  };
}
