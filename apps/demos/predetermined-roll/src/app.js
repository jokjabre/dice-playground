import { EVENTS } from '@dice/core';
import { createDeterminismPlugin } from '@dice/determinism';
import { createDiceEngine } from '@dice/engine';
import { PointerInput } from '@dice/input';
import { ControlPanel, ResultBanner, createElement, mountAppSettings } from '@dice/ui';
import { getVisibleSectionIdsForApp } from '@dice/settings';

import { classicTray } from '@dice/content';

import {
  DETERMINISM_MODES,
  PRED_DICE_COUNT,
  compareTargets,
  defaultTargetsFor,
  formatValues,
  isDeterminismMode,
  validateTargets
} from './content.js';

export const PRED_CONTENT = classicTray;

/**
 * @typedef {Object} PredAppOptions
 * @property {HTMLElement} stage
 * @property {HTMLElement} controlsHost
 * @property {HTMLElement} bannerHost
 * @property {HTMLElement} targetsHost
 * @property {HTMLElement} explanationHost
 * @property {string} [seed]
 * @property {{ fixedStep?: number, maxSubSteps?: number, maxFrameGap?: number }} [loop]
 */

/**
 * @typedef {Object} PredAppHandle
 * @property {import('@dice/engine').DiceEngine} engine
 * @property {ResultBanner} banner
 * @property {ControlPanel} panel
 * @property {any} [settings]
 * @property {() => void} resize
 * @property {(request?: Record<string, any>) => Promise<any>} throwDice
 * @property {() => void} destroy
 */

/**
 * Create the engine, banner, controls, and input wiring for the
 * predetermined-roll showcase. Only public package entries are used.
 *
 * The determinism plugin is attached with the selected mode and swapped
 * when the mode changes (`unuse`/`use`). `Predict` runs an isolated
 * headless `engine.simulate()` so natural values are shown without moving
 * the live dice. `Roll` with predict-and-shift passes the requested
 * `values` through the plugin; `Roll` with predict-only rolls unforced
 * dice and compares the result against the last prediction.
 *
 * @param {PredAppOptions} options
 * @returns {Promise<PredAppHandle>}
 */
export async function createPredApp(options) {
  const { stage, controlsHost, bannerHost, targetsHost, explanationHost } = options;

  const engine = await createDiceEngine({
    container: stage,
    content: PRED_CONTENT,
    dice: { count: PRED_DICE_COUNT, definition: 'd6', style: 'classic' },
    seed: options.seed,
    loop: options.loop
  });

  /** @type {'predict-and-shift'|'predict-only'} */
  let activeMode = 'predict-and-shift';
  engine.use(createDeterminismPlugin({ mode: activeMode }));

  const banner = new ResultBanner({
    events: engine.events,
    container: bannerHost,
    autoHide: 6000
  });

  /** @type {number} */
  let diceCount = PRED_DICE_COUNT;
  /** @type {string[]} */
  let targetInputs = defaultTargetsFor(diceCount).map(String);
  /** @type {number[]|null} */
  let lastPrediction = null;
  /** @type {{ values: number[], targets: number[], matched: boolean }|null} */
  let lastComparison = null;
  /** @type {string|null} */
  let lastMappingNote = null;

  const panel = new ControlPanel({
    title: 'Predetermined roll',
    testId: 'pred-controls',
    items: [
      {
        id: 'mode',
        type: 'select',
        label: 'Determinism mode',
        value: activeMode,
        options: DETERMINISM_MODES.map((mode) => ({
          value: mode.id,
          label: mode.label
        })),
        testId: 'mode-select'
      },
      {
        id: 'dice-count',
        type: 'select',
        label: 'Dice count',
        value: String(diceCount),
        options: [1, 2, 3, 4, 5, 6].map((count) => ({
          value: String(count),
          label: String(count)
        })),
        testId: 'dice-count-select'
      },
      {
        id: 'predict',
        type: 'button',
        label: 'Predict (no live roll)',
        testId: 'predict-button'
      },
      {
        id: 'roll',
        type: 'button',
        label: 'Roll',
        testId: 'roll-button'
      },
      {
        id: 'clear',
        type: 'button',
        label: 'Clear dice',
        testId: 'clear-button'
      }
    ]
  });

  controlsHost.appendChild(panel.element);
  const settingsHost = createElement('div', { className: 'app-settings-host', 'data-testid': 'settings-host' }, []);
  controlsHost.appendChild(settingsHost);

  // Per-die target inputs, rebuilt when the dice count changes.
  /** @type {HTMLInputElement[]} */
  let targetElements = [];
  const targetError = createElement('span', {
    className: 'pred-target-error',
    'data-testid': 'targets-error',
    role: 'alert',
    hidden: true
  });

  /**
   * Rebuild the per-die target inputs for the current dice count.
   *
   * @returns {void}
   */
  function rebuildTargets() {
    targetElements = [];
    const rows = [];
    for (let index = 0; index < diceCount; index += 1) {
      const input = /** @type {HTMLInputElement} */ (
        createElement('input', {
          type: 'number',
          className: 'dice-control-input pred-target-input',
          'data-testid': `target-input-${index + 1}`,
          'aria-label': `Target for die ${index + 1}`,
          value: targetInputs[index] ?? '6',
          min: '1',
          max: '6',
          step: '1'
        })
      );
      targetElements.push(input);
      rows.push(
        createElement(
          'label',
          { className: 'dice-control-label pred-target-row' },
          [`Die ${index + 1}:`, ' ', input]
        )
      );
    }
    targetsHost.replaceChildren(...rows, targetError);
  }

  /**
   * Read the current target inputs.
   *
   * @returns {string[]}
   */
  function readTargets() {
    return targetElements.map((input) => input.value);
  }

  /**
   * Show or clear the inline target error.
   *
   * @param {string|null} message
   * @returns {void}
   */
  function showTargetError(message) {
    targetError.hidden = !message;
    targetError.textContent = message ?? '';
  }

  /**
   * Render the explanation panel: mode description, last prediction,
   * last comparison, and mapping notes. Text only via textContent.
   *
   * @returns {void}
   */
  function updateExplanation() {
    const mode = DETERMINISM_MODES.find((entry) => entry.id === activeMode);
    /** @type {string[]} */
    const lines = [];
    lines.push(`Mode: ${mode ? mode.label : activeMode}`);
    lines.push(
      activeMode === 'predict-and-shift'
        ? 'Predict and shift: a headless prediction runs first, then face mappings are shifted so the visible roll shows the requested targets.'
        : 'Predict only: a headless prediction runs first and is shown for comparison, but nothing is shifted. The visible roll shows natural results.'
    );
    lines.push('What is predicted: the natural top-face values for this throw plan, in an isolated session that never touches the live dice.');
    lines.push('What is shifted: only the displayed labels (face mappings) in predict-and-shift mode. Physics motion is unchanged.');
    lines.push('What is not promised: cross-device reproducibility. Seeded vectors repeat on the same build; physics is not bitwise identical everywhere.');
    if (lastPrediction) {
      lines.push(`Last prediction (natural): ${formatValues(lastPrediction)}`);
    }
    if (lastComparison) {
      lines.push(
        `Last roll: ${formatValues(lastComparison.values)} vs targets ${formatValues(lastComparison.targets)} — ${
          lastComparison.matched ? 'all matched' : 'did not match'
        }`
      );
    }
    if (lastMappingNote) {
      lines.push(lastMappingNote);
    }

    const children = lines.map((line, index) =>
      createElement('p', {
        className: 'pred-info-line',
        'data-testid': index === 0 ? 'explanation-mode' : undefined,
        text: line
      })
    );
    explanationHost.replaceChildren(...children);
  }

  /**
   * Throw the dice. Cancellation and redundant throws are swallowed.
   *
   * @param {Record<string, any>} [request]
   * @returns {Promise<any>}
   */
  async function throwDice(request = { dice: diceCount }) {
    try {
      return await engine.roll(request);
    } catch (error) {
      const name =
        error && typeof error === 'object' && 'name' in error
          ? String(/** @type {{ name?: unknown }} */ (error).name)
          : undefined;
      if (name === 'RollCancelledError' || name === 'RollInProgressError') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Run an isolated headless prediction and display the natural values.
   * The live dice are not moved.
   *
   * @returns {Promise<void>}
   */
  async function predict() {
    const validated = validateTargets(readTargets(), diceCount);
    if (validated.error) {
      showTargetError(validated.error);
      return;
    }
    showTargetError(null);
    panel.setDisabled('predict', true);
    try {
      const result = await engine.simulate({ dice: diceCount, seed: options.seed });
      lastPrediction = Array.isArray(result.values) ? result.values : [];
      lastMappingNote =
        activeMode === 'predict-and-shift'
          ? 'The next predict-and-shift roll will shift face mappings so these natural values display as the requested targets.'
          : 'Predict-only: the next roll is unforced and should land near these natural values for the same seed.';
      updateExplanation();
    } finally {
      panel.setDisabled('predict', false);
    }
  }

  /**
   * Roll. Predict-and-shift passes the validated targets as `values`;
   * predict-only rolls unforced and compares against the last prediction.
   *
   * @returns {void}
   */
  function roll() {
    const validated = validateTargets(readTargets(), diceCount);
    if (validated.error) {
      showTargetError(validated.error);
      return;
    }
    showTargetError(null);
    targetInputs = validated.values.map(String);

    if (activeMode === 'predict-and-shift') {
      void throwDice({ dice: diceCount, values: validated.values }).then(
        (result) => {
          if (!result) return;
          const values = Array.isArray(result.values) ? result.values : [];
          const comparison = compareTargets(values, validated.values);
          lastComparison = {
            values,
            targets: validated.values,
            matched: comparison.matched
          };
          lastMappingNote = comparison.matched
            ? 'Face mappings were applied: every die shows its requested target.'
            : 'Face mappings were applied, but the settled values did not match the targets.';
          updateExplanation();
        },
        () => {}
      );
    } else {
      void throwDice({ dice: diceCount }).then(
        (result) => {
          if (!result) return;
          const values = Array.isArray(result.values) ? result.values : [];
          const comparison = compareTargets(values, validated.values);
          lastComparison = {
            values,
            targets: validated.values,
            matched: comparison.matched
          };
          lastMappingNote = lastPrediction
            ? `Predict-only: natural prediction was ${formatValues(lastPrediction)}; the visible roll is unforced.`
            : 'Predict-only: the visible roll is unforced. Use Predict to see the natural values first.';
          updateExplanation();
        },
        () => {}
      );
    }
  }

  panel.on((/** @type {{ id: string, value: unknown }} */ change) => {
    switch (change.id) {
      case 'mode': {
        const id = String(change.value ?? 'predict-and-shift');
        if (!isDeterminismMode(id) || id === activeMode) break;
        activeMode = /** @type {'predict-and-shift'|'predict-only'} */ (id);
        engine.unuse('determinism');
        engine.use(createDeterminismPlugin({ mode: activeMode }));
        lastPrediction = null;
        lastComparison = null;
        lastMappingNote = null;
        updateExplanation();
        break;
      }
      case 'dice-count': {
        const count = Number.parseInt(String(change.value ?? ''), 10);
        if (!Number.isInteger(count)) break;
        const next = Math.min(6, Math.max(1, count));
        if (next === diceCount) break;
        diceCount = next;
        targetInputs = defaultTargetsFor(diceCount).map(String);
        rebuildTargets();
        lastPrediction = null;
        lastComparison = null;
        updateExplanation();
        break;
      }
      case 'predict': {
        void predict();
        break;
      }
      case 'roll': {
        roll();
        break;
      }
      case 'clear': {
        engine.clear();
        lastComparison = null;
        updateExplanation();
        break;
      }
      default:
        break;
    }
  });

  const pointerInput = new PointerInput({ container: stage });
  engine.use(pointerInput);

  engine.events.on(EVENTS.ROLL_START, () => {
    panel.setDisabled('roll', true);
  });
  engine.events.on(EVENTS.ROLL_SETTLE, () => {
    panel.setDisabled('roll', false);
  });
  engine.events.on(EVENTS.ROLL_CANCEL, () => {
    panel.setDisabled('roll', false);
  });

  /** @param {any} effective */
  function applyCanonicalToApp(effective) {
    const det = effective?.determinism || {};
    if (det.mode && isDeterminismMode(det.mode) && det.mode !== activeMode) {
      activeMode = det.mode;
      try { panel.setValue('mode', activeMode); engine.unuse('determinism'); engine.use(createDeterminismPlugin({ mode: activeMode })); } catch {}
    }
    if (typeof det.requestedValuesText === 'string' && det.requestedValuesText.trim()) {
      // keep UI targets in sync best-effort
      const parts = det.requestedValuesText.split(',').map((/** @type {string} */ s) => s.trim()).filter(Boolean);
      if (parts.length) {
        targetInputs = parts.slice(0, diceCount);
        rebuildTargets();
      }
    }
    updateExplanation();
  }

  const settingsIntegration = mountAppSettings({
    appId: 'predetermined-roll',
    container: settingsHost,
    engine,
    visibleSectionIds: getVisibleSectionIdsForApp('predetermined-roll'),
    title: 'Settings',
    onApplied: (info) => { try { applyCanonicalToApp(info?.effective || settingsIntegration.getEffective()); } catch {} }
  });

  rebuildTargets();
  try { applyCanonicalToApp(settingsIntegration.getEffective()); } catch {}
  updateExplanation();

  return {
    engine,
    banner,
    panel,
    settings: settingsIntegration,
    resize: () => {
      engine.resize();
    },
    throwDice,
    destroy: () => {
      try { settingsIntegration.destroy(); } catch {}
      banner.destroy();
      panel.destroy();
      engine.destroy();
    }
  };
}
