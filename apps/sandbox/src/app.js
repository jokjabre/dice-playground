import { EVENTS } from '@dice/core';
import { createDeterminismPlugin } from '@dice/determinism';
import { createDiceEngine } from '@dice/engine';
import { MotionInput, PointerInput } from '@dice/input';
import {
  ControlPanel,
  Panel,
  ResultBanner,
  Status,
  createElement
} from '@dice/ui';

import {
  SANDBOX_CAMERA,
  SANDBOX_DICE_COUNT,
  SANDBOX_ENCLOSURES,
  isSandboxEnclosure,
  sandboxContent
} from './content.js';
import {
  SANDBOX_MODES,
  engineModeFor,
  getSandboxMode,
  isSandboxMode,
  parseTargetValues,
  shouldShowMotion,
  shouldShowPredetermined
} from './modes.js';

/**
 * @typedef {Object} SandboxAppOptions
 * @property {HTMLElement} stage
 * @property {HTMLElement} panelHost
 * @property {HTMLElement} bannerHost
 * @property {string} [initialEnclosure]
 * @property {string} [initialMode]
 * @property {string} [seed]
 * @property {{ fixedStep?: number, maxSubSteps?: number, maxFrameGap?: number }} [loop]
 */

/**
 * @typedef {Object} SandboxAppHandle
 * @property {import('@dice/engine').DiceEngine} engine
 * @property {ResultBanner} banner
 * @property {ControlPanel} panel
 * @property {Panel} enginePanel
 * @property {Status} motionStatus
 * @property {() => void} resize
 * @property {(request?: Record<string, any>) => Promise<any>} throwDice
 * @property {() => void} destroy
 */

/**
 * Update the info member for one row. Text is assigned through
 * textContent only; the label and value are joined with a colon so the
 * panel reads as plain text for assistive tech and tests.
 *
 * @param {Record<string, { term: string, value: string }>} rows
 * @param {HTMLElement} infoHost
 * @returns {void}
 */
function renderInfo(infoHost, rows) {
  /** @type {HTMLElement[]} */
  const children = [];
  for (const [key, row] of Object.entries(rows)) {
    children.push(
      createElement('div', { className: 'sandbox-info-row', 'data-info': key }, [
        createElement('dt', { text: row.term }),
        ': ',
        createElement('dd', { text: row.value })
      ])
    );
  }
  const list = createElement('dl', { className: 'sandbox-info-list' }, children);
  infoHost.replaceChildren(list);
}

/**
 * Create the engine, banner, controls, and input wiring for the sandbox.
 * Only public package entries are used. This module never reaches into
 * package internals; the engine resolves content ids and owns the world.
 *
 * Intentional differences from the legacy demo (see README):
 *
 * - One fresh spawn per roll. The legacy continuous mode reused the live
 *   dice and blocked clearing while continuous; the sandbox instead cancels
 *   the live continuous run for clear/mode switches and spawns anew.
 * - Predetermined rolls set the dice count to the number of targets (like
 *   the legacy) while the standalone Throw button always rolls a normal
 *   set without targets.
 *
 * @param {SandboxAppOptions} options
 * @returns {Promise<SandboxAppHandle>}
 */
export async function createSandboxApp(options) {
  const { stage, panelHost, bannerHost } = options;
  const initialEnclosure =
    options.initialEnclosure && isSandboxEnclosure(options.initialEnclosure)
      ? options.initialEnclosure
      : 'box';
  const initialMode =
    options.initialMode && isSandboxMode(options.initialMode)
      ? options.initialMode
      : 'standard';

  const engine = await createDiceEngine({
    container: stage,
    content: sandboxContent,
    dice: { count: SANDBOX_DICE_COUNT, definition: 'd6', style: 'classic' },
    seed: options.seed,
    loop: options.loop
  });

  // Predetermined rolls need the optional determinism plugin; the engine
  // rejects requested values without it.
  engine.use(createDeterminismPlugin({ mode: 'predict-and-shift' }));

  const banner = new ResultBanner({
    events: engine.events,
    container: bannerHost,
    autoHide: 6000
  });

  // Collapsible engine options panel, matching the legacy "+" toggle.
  // It starts collapsed on small screens only; desktop shows it.
  const initiallyCollapsed =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(max-width: 860px)').matches;
  const enginePanel = new Panel({
    title: 'Engine options',
    collapsed: initiallyCollapsed,
    testId: 'engine-panel',
    toggleTestId: 'engine-panel-toggle'
  });
  panelHost.appendChild(enginePanel.element);

  const panel = new ControlPanel({
    title: 'Sandbox',
    testId: 'sandbox-controls',
    items: [
      {
        id: 'mode',
        type: 'select',
        label: 'Engine Mode',
        value: initialMode,
        options: SANDBOX_MODES.map((mode) => ({
          value: mode.id,
          label: mode.label
        })),
        testId: 'mode-select'
      },
      {
        id: 'enclosure',
        type: 'select',
        label: 'Enclosure',
        value: initialEnclosure,
        options: SANDBOX_ENCLOSURES.map((enclosure) => ({
          value: enclosure.id,
          label: enclosure.label
        })),
        testId: 'enclosure-select'
      },
      {
        id: 'camera-distance',
        type: 'range',
        label: 'Camera',
        value: SANDBOX_CAMERA.defaultDistance,
        min: SANDBOX_CAMERA.min,
        max: SANDBOX_CAMERA.max,
        step: SANDBOX_CAMERA.step,
        testId: 'camera-distance-slider'
      },
      {
        id: 'camera-near',
        type: 'number',
        label: 'Near',
        min: 0.1,
        step: 1,
        testId: 'camera-near-input'
      },
      {
        id: 'camera-far',
        type: 'number',
        label: 'Far',
        min: 0,
        step: 100,
        testId: 'camera-far-input'
      },
      {
        id: 'camera-reset',
        type: 'button',
        label: 'Reset',
        testId: 'camera-reset-button'
      },
      {
        id: 'throw',
        type: 'button',
        label: 'Throw',
        testId: 'throw-button'
      },
      {
        id: 'clear',
        type: 'button',
        label: 'Clear',
        testId: 'clear-button'
      }
    ]
  });
  enginePanel.append(panel.element);

  // Motion controls are shown only in continuous mode, matching the legacy
  // conditional groups. The Status component follows `motion:status`.
  const motionControls = createElement(
    'div',
    {
      className: 'sandbox-group',
      'data-testid': 'motion-controls',
      hidden: shouldShowMotion(initialMode) ? undefined : true
    },
    []
  );
  const motionStatus = new Status({
    events: engine.events,
    text: 'Motion sensors off',
    testId: 'motion-status'
  });
  const enableMotionButton = /** @type {HTMLButtonElement} */ (
    createElement('button', {
      type: 'button',
      className: 'dice-control-button',
      'data-testid': 'enable-motion-button',
      text: 'Enable Motion'
    })
  );
  motionControls.append(
    enableMotionButton,
    /** @type {HTMLElement} */ (motionStatus.element)
  );
  enginePanel.append(motionControls);

  // Predetermined controls are shown only in predetermined mode.
  const predeterminedControls = createElement(
    'div',
    {
      className: 'sandbox-group',
      'data-testid': 'predetermined-controls',
      hidden: shouldShowPredetermined(initialMode) ? undefined : true
    },
    []
  );
  const targetInput = /** @type {HTMLInputElement} */ (
    createElement('input', {
      type: 'text',
      id: 'sandbox-predetermined-inputs',
      className: 'dice-control-input',
      'data-testid': 'predetermined-inputs',
      value: '6, 6, 6',
      'aria-label': 'Target values'
    })
  );
  const rollTargetButton = /** @type {HTMLButtonElement} */ (
    createElement('button', {
      type: 'button',
      className: 'dice-control-button',
      'data-testid': 'predetermined-roll-button',
      text: 'Roll Target'
    })
  );
  const targetError = createElement('span', {
    className: 'sandbox-target-error',
    'data-testid': 'predetermined-error',
    role: 'alert',
    hidden: true
  });
  const targetLabel = createElement(
    'label',
    { className: 'dice-control-label', for: 'sandbox-predetermined-inputs' },
    ['Target:', ' ', targetInput]
  );
  predeterminedControls.append(
    targetLabel,
    rollTargetButton,
    /** @type {HTMLElement} */ (targetError)
  );
  enginePanel.append(predeterminedControls);

  // Read-only info panel: mirrors the legacy visibility into mode,
  // enclosure, and camera state without a debug DOM panel.
  const infoPanelHost = createElement(
    'section',
    {
      className: 'sandbox-info',
      'data-testid': 'info-panel',
      'aria-label': 'Sandbox information'
    },
    []
  );
  enginePanel.append(infoPanelHost);

  const pointerInput = new PointerInput({ container: stage });
  engine.use(pointerInput);

  const motionInput = new MotionInput();
  engine.use(motionInput);

  /** @type {{ values: number[], total: number, rollId: string }|null} */
  let lastResult = null;

  /**
   * Tracked so an enclosure selection is idempotent. ControlPanel emits on
   * both `input` and `change`, so a single user action can reach this
   * handler twice; re-applying the same enclosure would clear the dice
   * that the first handling just spawned.
   */
  let activeEnclosure = initialEnclosure;

  /** Tracked so repeated `input`/`change` pairs do not re-enter a mode. */
  let activeMode = initialMode;

  /** @type {number} */
  let currentDiceCount = SANDBOX_DICE_COUNT;

  /** @type {{ distance: number, near: number, far: number }} */
  const cameraSettings = {
    distance: SANDBOX_CAMERA.defaultDistance,
    near: SANDBOX_CAMERA.defaultNear,
    far: SANDBOX_CAMERA.defaultFar
  };

  const updateInfo = () => {
    const config = engine.world.getConfig();
    const camera = config.camera ?? {};
    renderInfo(infoPanelHost, {
      mode: { term: 'Mode', value: getSandboxMode(activeMode).label },
      enclosure: { term: 'Enclosure', value: config.enclosure ?? activeEnclosure },
      dice: { term: 'Dice', value: String(engine.getDiceIds().length) },
      physics: {
        term: 'Physics',
        value: engine.loop.running ? 'running' : 'idle'
      },
      camera: {
        term: 'Camera distance',
        value: `${Number(
          camera.distance ?? cameraSettings.distance
        ).toFixed(2)}×`
      },
      cameraNear: {
        term: 'Camera near',
        value: String(camera.near ?? cameraSettings.near)
      },
      cameraFar: {
        term: 'Camera far',
        value: String(camera.far ?? cameraSettings.far)
      },
      result: {
        term: 'Last result',
        value: lastResult
          ? `${lastResult.values.join(' + ')} = ${lastResult.total}`
          : '—'
      }
    });
  };

  /**
   * @param {string} text
   * @returns {void}
   */
  const showTargetError = (text) => {
    targetError.hidden = text.length === 0;
    targetError.textContent = text;
  };

  /**
   * Throw the dice. Cancellation and redundant throws are swallowed so
   * rapid clicks and drags do not surface as errors.
   *
   * @param {Record<string, any>} [request]
   * @returns {Promise<any>}
   */
  async function throwDice(request = { dice: currentDiceCount }) {
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
   * @returns {Promise<void>}
   */
  async function enableMotion() {
    try {
      const granted = await motionInput.enable();
      if (!granted) {
        // MotionInput already emitted `motion:status` with the reason.
        motionStatus.update(getMotionMessage());
      }
    } catch (error) {
      console.warn('Unable to enable motion sensors:', error);
      motionStatus.update('Motion sensor error');
    }
  }

  /**
   * Latest status message emitted by the motion input.
   *
   * @returns {string}
   */
  function getMotionMessage() {
    return motionStatus.text || 'Motion sensors off';
  }

  /**
   * Switch modes. Continuous entry starts a live continuous roll (and
   * enables motion, as the legacy did); leaving continuous cancels the
   * live run and disables motion. Returning to a settling mode does not
   * auto-roll; use Throw.
   *
   * @param {string} modeId
   * @returns {void}
   */
  function applyMode(modeId) {
    if (modeId === activeMode) return;
    activeMode = modeId;

    motionControls.hidden = !shouldShowMotion(modeId);
    predeterminedControls.hidden = !shouldShowPredetermined(modeId);
    if (!shouldShowPredetermined(modeId)) {
      showTargetError('');
    }

    // Cancel any pending roll so the loop stops cleanly before switching
    // strategies. In continuous mode the pending roll is the live run
    // itself, so leaving the mode ends it.
    engine.cancelRoll('mode-change');
    engine.setMode(engineModeFor(modeId));

    if (modeId !== 'continuous') {
      motionInput.disable();
      motionStatus.update('Motion sensors off');
      updateInfo();
      return;
    }

    void enableMotion();
    void throwDice({
      dice: currentDiceCount,
      mode: 'continuous',
      cancelActive: true
    });
    updateInfo();
  }

  /**
   * Roll requested target values. Invalid input shows an inline error and
   * starts no roll; a valid roll uses as many dice as there are targets.
   *
   * @returns {void}
   */
  function rollPredetermined() {
    const parsed = parseTargetValues(targetInput.value);
    if (parsed.error) {
      showTargetError(parsed.error);
      return;
    }
    showTargetError('');
    currentDiceCount = parsed.values.length;
    void throwDice({ dice: parsed.values.length, values: parsed.values });
  }

  /**
   * Read the near/far inputs and apply the camera settings. Empty or
   * invalid values fall back to the content defaults (near `1`, far `0`
   * for auto).
   *
   * @returns {void}
   */
  function applyCamera() {
    const distanceValue = Number(panel.getValue('camera-distance'));
    const distance =
      Number.isFinite(distanceValue) && distanceValue > 0
        ? distanceValue
        : SANDBOX_CAMERA.defaultDistance;
    const nearValue = Number(panel.getValue('camera-near'));
    const near =
      Number.isFinite(nearValue) && nearValue > 0
        ? nearValue
        : SANDBOX_CAMERA.defaultNear;
    const farValue = Number(panel.getValue('camera-far'));
    const far =
      Number.isFinite(farValue) && farValue > 0
        ? farValue
        : SANDBOX_CAMERA.defaultFar;
    cameraSettings.distance = distance;
    cameraSettings.near = near;
    cameraSettings.far = far;
    engine.setCamera({ distance, near, far });
    updateInfo();
  }

  panel.on((/** @type {{ id: string, value: unknown }} */ change) => {
    switch (change.id) {
      case 'mode': {
        const modeId = String(change.value ?? 'standard');
        if (isSandboxMode(modeId)) {
          applyMode(modeId);
        }
        break;
      }
      case 'enclosure': {
        const id = String(change.value ?? 'box');
        if (id === activeEnclosure) break;
        activeEnclosure = id;
        engine.setEnclosure(id);
        banner.clear();
        lastResult = null;
        updateInfo();
        if (activeMode === 'continuous') {
          void throwDice({
            dice: currentDiceCount,
            mode: 'continuous',
            cancelActive: true
          });
        } else {
          void throwDice({ dice: currentDiceCount });
        }
        break;
      }
      case 'camera-distance':
      case 'camera-near':
      case 'camera-far': {
        applyCamera();
        break;
      }
      case 'camera-reset': {
        panel.setValue('camera-distance', SANDBOX_CAMERA.defaultDistance);
        panel.setValue('camera-near', '');
        panel.setValue('camera-far', '');
        cameraSettings.distance = SANDBOX_CAMERA.defaultDistance;
        cameraSettings.near = SANDBOX_CAMERA.defaultNear;
        cameraSettings.far = SANDBOX_CAMERA.defaultFar;
        engine.resetCamera();
        updateInfo();
        break;
      }
      case 'throw': {
        if (activeMode === 'continuous') {
          // A continuous roll never settles on its own, so Throw replaces
          // the live run instead of queueing (RollInProgress).
          void throwDice({
            dice: currentDiceCount,
            mode: 'continuous',
            cancelActive: true
          });
        } else {
          void throwDice({ dice: currentDiceCount });
        }
        break;
      }
      case 'clear': {
        engine.clear();
        banner.clear();
        lastResult = null;
        updateInfo();
        break;
      }
      default:
        break;
    }
  });

  enableMotionButton.addEventListener('click', () => {
    void enableMotion();
  });

  rollTargetButton.addEventListener('click', () => {
    rollPredetermined();
  });

  engine.events.on(EVENTS.ROLL_START, () => {
    // Continuous rolls never settle, so the Throw button stays usable to
    // replace the live run. Settling rolls disable it until they finish.
    if (activeMode !== 'continuous') {
      panel.setDisabled('throw', true);
    }
  });
  engine.events.on(EVENTS.ROLL_SETTLE, (/** @type {any} */ payload) => {
    const result = payload?.result ?? payload ?? {};
    lastResult = {
      values: Array.isArray(result.values) ? result.values : [],
      total:
        typeof result.total === 'number'
          ? result.total
          : (Array.isArray(result.values) ? result.values : []).reduce(
              (/** @type {number} */ sum, /** @type {number} */ value) => sum + value,
              0
            ),
      rollId: String(payload?.rollId ?? result.id ?? '')
    };
    panel.setDisabled('throw', false);
    updateInfo();
  });
  engine.events.on(EVENTS.ROLL_CANCEL, () => {
    panel.setDisabled('throw', false);
    updateInfo();
  });
  engine.events.on(EVENTS.LOOP_START, () => {
    updateInfo();
  });
  engine.events.on(EVENTS.LOOP_STOP, () => {
    updateInfo();
  });
  engine.events.on(EVENTS.ENCLOSURE_CHANGE, () => {
    updateInfo();
  });

  if (initialEnclosure !== 'box') {
    engine.setEnclosure(initialEnclosure);
  }

  if (initialMode !== 'standard') {
    // Enter the requested mode before the first roll. `applyMode` guards
    // against re-entry, so seed the tracked mode first.
    activeMode = 'standard';
    applyMode(initialMode);
  }

  updateInfo();

  return {
    engine,
    banner,
    panel,
    enginePanel,
    motionStatus,
    resize: () => {
      engine.resize();
      updateInfo();
    },
    throwDice,
    destroy: () => {
      motionInput.disable();
      banner.destroy();
      panel.destroy();
      enginePanel.destroy();
      engine.destroy();
    }
  };
}
