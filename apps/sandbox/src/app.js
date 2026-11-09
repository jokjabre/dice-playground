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
  SANDBOX_ENCLOSURE_SCALES,
  SANDBOX_ENCLOSURES,
  SANDBOX_LIGHT,
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
 * Layout: a collapsible options panel (hamburger toggle) holding an
 * always-visible icon action row (Reset / Throw / Clear) plus collapsible
 * groups — Enclosure, Engine, Camera, Light, Details. Every group has its
 * own reset; the action-row Reset restores transient state only (dice,
 * camera distance, light position) and keeps the mode and enclosure.
 *
 * Intentional differences from the legacy demo (see README):
 *
 * - One fresh spawn per roll. The legacy continuous mode reused the live
 *   dice and blocked clearing while continuous; the sandbox instead cancels
 *   the live continuous run for clear/mode switches and spawns anew.
 * - Predetermined rolls set the dice count to the number of targets (like
 *   the legacy) while the standalone Throw button always rolls a normal
 *   set without targets.
 * - The legacy near/far clipping fields were dropped (user decision): they
 *   only set clipping planes, which have no visible effect at sane values.
 * - No motion, roll-duration, or camera-angle options are exposed: the
 *   engine has no API for a max roll duration, a flick-interrupt policy,
 *   or camera yaw, so they are not faked here.
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

  // The whole options panel collapses through a hamburger toggle. Panel
  // renders its title as the toggle text, so the sandbox restyles the
  // public `toggle` handle with a hamburger glyph and keeps the accessible
  // name explicit. The panel starts collapsed on small screens only.
  const initiallyCollapsed =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(max-width: 860px)').matches;
  const enginePanel = new Panel({
    title: 'Engine options',
    collapsed: initiallyCollapsed,
    testId: 'engine-panel',
    toggleTestId: 'engine-panel-toggle'
  });
  enginePanel.toggle.textContent = '☰';
  enginePanel.toggle.setAttribute('aria-label', 'Engine options');
  enginePanel.toggle.title = 'Engine options';
  panelHost.appendChild(enginePanel.element);

  const panelRoot = enginePanel.region;

  /** @type {Panel[]} */
  const groups = [];

  /**
   * One collapsible option group. Groups form an accordion: opening one
   * closes the others (radio-like). The panel title itself is the toggle,
   * with a `›` chevron when closed and `⌄` when open.
   *
   * @param {string} title
   * @param {{ collapsed?: boolean }} [options]
   * @returns {Panel}
   */
  function createGroup(title, options = {}) {
    const id = title.toLowerCase();
    const group = new Panel({
      title,
      collapsed: options.collapsed ?? false,
      testId: `group-${id}`,
      toggleTestId: `group-${id}-toggle`
    });
    panelRoot.appendChild(group.element);
    groups.push(group);
    // The constructor's click listener runs first and updates `collapsed`,
    // so by the time this runs an opened group can collapse its siblings.
    group.toggle.addEventListener('click', () => {
      if (!group.collapsed) {
        for (const other of groups) {
          if (other !== group) other.setCollapsed(true);
        }
      }
    });
    return group;
  }

  // The Engine group starts open; the rest start collapsedAccordion-style.
  const enclosureGroup = createGroup('Enclosure', { collapsed: true });
  const engineGroup = createGroup('Engine');
  const cameraGroup = createGroup('Camera', { collapsed: true });
  const lightGroup = createGroup('Light', { collapsed: true });
  const detailsGroup = createGroup('Details', { collapsed: true });

  // -- Action row: reset / throw / clear, always visible, icon only. -----
  const resetButton = /** @type {HTMLButtonElement} */ (
    createElement('button', {
      type: 'button',
      className: 'dice-control-button sandbox-action-button',
      'data-testid': 'reset-button',
      'aria-label': 'Reset scene',
      title: 'Reset scene',
      text: '↺'
    })
  );
  const throwButton = /** @type {HTMLButtonElement} */ (
    createElement('button', {
      type: 'button',
      className: 'dice-control-button sandbox-action-button',
      'data-testid': 'throw-button',
      'aria-label': 'Throw the dice',
      title: 'Throw',
      text: '🎲'
    })
  );
  const clearButton = /** @type {HTMLButtonElement} */ (
    createElement('button', {
      type: 'button',
      className: 'dice-control-button sandbox-action-button',
      'data-testid': 'clear-button',
      'aria-label': 'Clear the dice',
      title: 'Clear',
      text: '🧹'
    })
  );
  const actions = createElement(
    'div',
    {
      className: 'sandbox-actions',
      role: 'toolbar',
      'aria-label': 'Dice actions',
      'data-testid': 'sandbox-actions'
    },
    [resetButton, throwButton, clearButton]
  );
  panelRoot.prepend(actions);

  // -- Enclosure group -----------------------------------------------------
  const enclosurePanel = new ControlPanel({
    testId: 'controls-enclosure',
    items: [
      {
        id: 'enclosure',
        type: 'select',
        label: 'Type',
        value: initialEnclosure,
        options: SANDBOX_ENCLOSURES.map((enclosure) => ({
          value: enclosure.id,
          label: enclosure.label
        })),
        testId: 'enclosure-select'
      },
      {
        id: 'enclosure-scale',
        type: 'select',
        label: 'Size',
        value: '1',
        options: SANDBOX_ENCLOSURE_SCALES.map((preset) => ({
          value: String(preset.value),
          label: preset.label
        })),
        testId: 'enclosure-scale-select'
      },
      {
        id: 'enclosure-reset',
        type: 'button',
        label: 'Reset enclosure',
        testId: 'enclosure-reset-button'
      }
    ]
  });
  enclosureGroup.append(enclosurePanel.element);

  // -- Engine group --------------------------------------------------------
  /**
   * Seconds the standard strategy allows a roll to run before settling by
   * force. The engine stores it as frames; this control works in seconds.
   * The default matches the engine's `maxFrames` (1000) safety cap.
   */
  const DEFAULT_MAX_ROLL_FRAMES = 1000;
  /** @type {(seconds: number) => number} */
  const secondsToFrames = (seconds) =>
    Math.max(1, Math.round(seconds / engine.loop.fixedStep));
  /** @type {(frames: number) => number} */
  const framesToSeconds = (frames) =>
    Number((frames * engine.loop.fixedStep).toFixed(2));
  const maxRollDurationSeconds = framesToSeconds(DEFAULT_MAX_ROLL_FRAMES);

  const engineControls = new ControlPanel({
    testId: 'controls-engine',
    items: [
      {
        id: 'mode',
        type: 'select',
        label: 'Mode',
        value: initialMode,
        options: SANDBOX_MODES.map((mode) => ({
          value: mode.id,
          label: mode.label
        })),
        testId: 'mode-select'
      },
      {
        id: 'flick-interrupt',
        type: 'toggle',
        label: 'Flick interrupts current roll',
        value: false,
        testId: 'flick-interrupt-toggle'
      },
      {
        id: 'max-roll-duration',
        type: 'number',
        label: 'Max roll duration (s)',
        value: maxRollDurationSeconds,
        min: 0.1,
        step: 1,
        testId: 'max-roll-duration-input'
      },
      {
        id: 'engine-reset',
        type: 'button',
        label: 'Reset engine options',
        testId: 'engine-reset-button'
      }
    ]
  });
  engineGroup.append(engineControls.element);

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
  engineGroup.append(motionControls);

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
  engineGroup.append(predeterminedControls);

  // -- Camera group --------------------------------------------------------
  const cameraPanel = new ControlPanel({
    testId: 'controls-camera',
    items: [
      {
        id: 'camera-distance',
        type: 'range',
        label: 'Distance',
        value: SANDBOX_CAMERA.defaultDistance,
        min: SANDBOX_CAMERA.min,
        max: SANDBOX_CAMERA.max,
        step: SANDBOX_CAMERA.step,
        testId: 'camera-distance-slider'
      },
      {
        id: 'camera-reset',
        type: 'button',
        label: 'Reset camera',
        testId: 'camera-reset-button'
      }
    ]
  });
  cameraGroup.append(cameraPanel.element);

  // -- Light group ---------------------------------------------------------
  const lightPanel = new ControlPanel({
    testId: 'controls-light',
    items: [
      {
        id: 'light-x',
        type: 'range',
        label: 'Light X',
        value: SANDBOX_LIGHT.defaultPosition.x,
        min: SANDBOX_LIGHT.min,
        max: SANDBOX_LIGHT.max,
        step: SANDBOX_LIGHT.step,
        testId: 'light-x-slider'
      },
      {
        id: 'light-y',
        type: 'range',
        label: 'Light Y',
        value: SANDBOX_LIGHT.defaultPosition.y,
        min: SANDBOX_LIGHT.min,
        max: SANDBOX_LIGHT.max,
        step: SANDBOX_LIGHT.step,
        testId: 'light-y-slider'
      },
      {
        id: 'light-z',
        type: 'range',
        label: 'Light Z',
        value: SANDBOX_LIGHT.defaultPosition.z,
        min: SANDBOX_LIGHT.min,
        max: SANDBOX_LIGHT.max,
        step: SANDBOX_LIGHT.step,
        testId: 'light-z-slider'
      },
      {
        id: 'light-reset',
        type: 'button',
        label: 'Reset light',
        testId: 'light-reset-button'
      }
    ]
  });
  lightGroup.append(lightPanel.element);

  // -- Details group -------------------------------------------------------
  const infoPanelHost = createElement(
    'section',
    {
      className: 'sandbox-info',
      'data-testid': 'info-panel',
      'aria-label': 'Sandbox information'
    },
    []
  );
  detailsGroup.append(infoPanelHost);

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

  /** Tracked so repeated `input`/`change` pairs do not rebuild twice. */
  let activeScale = 1;

  /** Tracked so repeated `input`/`change` pairs do not re-enter a mode. */
  let activeMode = initialMode;

  /** @type {number} */
  let currentDiceCount = SANDBOX_DICE_COUNT;

  /** @type {{ distance: number }} */
  const cameraSettings = { distance: SANDBOX_CAMERA.defaultDistance };

  /** Spotlight position in scene-relative units. */
  const lightPosition = { ...SANDBOX_LIGHT.defaultPosition };

  /**
   * Format a scene-relative component for the info panel.
   *
   * @param {number} value
   * @returns {string}
   */
  const formatComponent = (value) => String(Number(value.toFixed(2)));

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
      light: {
        term: 'Light position',
        value: `${formatComponent(lightPosition.x)}, ${formatComponent(
          lightPosition.y
        )}, ${formatComponent(lightPosition.z)}`
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
   * Roll after an enclosure rebuild (type or size change), keeping the
   * continuous live run alive in continuous mode.
   *
   * @returns {void}
   */
  function rollAfterEnclosureChange() {
    if (activeMode === 'continuous') {
      void throwDice({
        dice: currentDiceCount,
        mode: 'continuous',
        cancelActive: true
      });
    } else {
      void throwDice({ dice: currentDiceCount });
    }
  }

  /**
   * @returns {Promise<void>}
   */
  async function enableMotion() {
    try {
      await motionInput.enable();
    } catch (error) {
      console.warn('Unable to enable motion sensors:', error);
      motionStatus.update('Motion sensor error');
    }
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
    engineControls.setValue('mode', modeId);

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
   * Read the distance slider and apply the camera settings.
   *
   * @returns {void}
   */
  function applyCamera() {
    const distanceValue = Number(cameraPanel.getValue('camera-distance'));
    const distance =
      Number.isFinite(distanceValue) && distanceValue > 0
        ? distanceValue
        : SANDBOX_CAMERA.defaultDistance;
    cameraSettings.distance = distance;
    engine.setCamera({ distance });
    updateInfo();
  }

  /**
   * @returns {void}
   */
  function resetCamera() {
    cameraSettings.distance = SANDBOX_CAMERA.defaultDistance;
    cameraPanel.setValue('camera-distance', SANDBOX_CAMERA.defaultDistance);
    engine.resetCamera();
    updateInfo();
  }

  /**
   * @returns {void}
   */
  function resetLight() {
    Object.assign(lightPosition, SANDBOX_LIGHT.defaultPosition);
    engine.setLight({ position: lightPosition });
    // The render loop idles after a roll settles, so request a frame so
    // the lighting change is visible immediately.
    engine.world.render(0);
    for (const axis of /** @type {const} */ (['x', 'y', 'z'])) {
      lightPanel.setValue(`light-${axis}`, lightPosition[axis]);
    }
    updateInfo();
  }

  /**
   * Global reset (action row): clears the dice, restores the camera
   * distance and the light position, and keeps the mode and enclosure.
   *
   * @returns {void}
   */
  function resetScene() {
    engine.reset();
    currentDiceCount = SANDBOX_DICE_COUNT;
    banner.clear();
    lastResult = null;
    cameraSettings.distance = SANDBOX_CAMERA.defaultDistance;
    cameraPanel.setValue('camera-distance', SANDBOX_CAMERA.defaultDistance);
    engine.resetCamera();
    Object.assign(lightPosition, SANDBOX_LIGHT.defaultPosition);
    engine.setLight({ position: lightPosition });
    for (const axis of /** @type {const} */ (['x', 'y', 'z'])) {
      lightPanel.setValue(`light-${axis}`, lightPosition[axis]);
    }
    updateInfo();
  }

  /**
   * @returns {void}
   */
  function resetEnclosure() {
    if (activeEnclosure === 'box' && activeScale === 1) return;
    activeEnclosure = 'box';
    activeScale = 1;
    enclosurePanel.setValue('enclosure', 'box');
    enclosurePanel.setValue('enclosure-scale', '1');
    engine.setEnclosure('box');
    engine.setEnclosureScale(1);
    banner.clear();
    lastResult = null;
    updateInfo();
    rollAfterEnclosureChange();
  }

  /**
   * @returns {void}
   */
  function resetEngineOptions() {
    pointerInput.interruptRolls = false;
    engineControls.setValue('flick-interrupt', false);
    engine.setLoopConfig({ maxFrames: DEFAULT_MAX_ROLL_FRAMES });
    engineControls.setValue('max-roll-duration', maxRollDurationSeconds);
    motionInput.disable();
    motionStatus.update('Motion sensors off');
    targetInput.value = '6, 6, 6';
    showTargetError('');
    applyMode('standard');
    updateInfo();
  }

  enclosurePanel.on((/** @type {{ id: string, value: unknown }} */ change) => {
    switch (change.id) {
      case 'enclosure': {
        const id = String(change.value ?? 'box');
        if (id === activeEnclosure) break;
        activeEnclosure = id;
        engine.setEnclosure(id);
        banner.clear();
        lastResult = null;
        updateInfo();
        rollAfterEnclosureChange();
        break;
      }
      case 'enclosure-scale': {
        const scale = Number(change.value);
        if (!Number.isFinite(scale) || scale <= 0 || scale === activeScale) break;
        activeScale = scale;
        engine.setEnclosureScale(scale);
        banner.clear();
        lastResult = null;
        updateInfo();
        rollAfterEnclosureChange();
        break;
      }
      case 'enclosure-reset': {
        resetEnclosure();
        break;
      }
      default:
        break;
    }
  });

  engineControls.on((/** @type {{ id: string, value: unknown }} */ change) => {
    if (change.id === 'mode') {
      const modeId = String(change.value ?? 'standard');
      if (isSandboxMode(modeId)) {
        applyMode(modeId);
      }
    } else if (change.id === 'flick-interrupt') {
      pointerInput.interruptRolls = Boolean(change.value);
    } else if (change.id === 'max-roll-duration') {
      const seconds = Number(change.value);
      if (Number.isFinite(seconds) && seconds > 0) {
        engine.setLoopConfig({ maxFrames: secondsToFrames(seconds) });
      }
    } else if (change.id === 'engine-reset') {
      resetEngineOptions();
    }
  });

  cameraPanel.on((/** @type {{ id: string, value: unknown }} */ change) => {
    if (change.id === 'camera-distance') {
      applyCamera();
    } else if (change.id === 'camera-reset') {
      resetCamera();
    }
  });

  lightPanel.on((/** @type {{ id: string, value: unknown }} */ change) => {
    if (change.id === 'light-reset') {
      resetLight();
      return;
    }
    const axis = /** @type {'x'|'y'|'z'} */ (change.id.slice(-1));
    const value = Number(change.value);
    if (!Number.isFinite(value)) return;
    lightPosition[axis] = value;
    engine.setLight({ position: lightPosition });
    engine.world.render(0);
    updateInfo();
  });

  resetButton.addEventListener('click', resetScene);
  throwButton.addEventListener('click', () => {
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
  });
  clearButton.addEventListener('click', () => {
    engine.clear();
    banner.clear();
    lastResult = null;
    updateInfo();
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
      throwButton.disabled = true;
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
    throwButton.disabled = false;
    updateInfo();
  });
  engine.events.on(EVENTS.ROLL_CANCEL, () => {
    throwButton.disabled = false;
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
      enginePanel.destroy();
      engine.destroy();
    }
  };
}
