import { EVENTS } from '@dice/core';
import { createDiceEngine } from '@dice/engine';
import { PointerInput } from '@dice/input';
import { ControlPanel, ResultBanner, createElement } from '@dice/ui';

import { classicTray } from '@dice/content';

import {
  LAB_CONTACT_LIMITS,
  LAB_DICE_COUNT,
  LAB_SURFACES,
  clampControlValue,
  defaultLabSettings,
  getLabSurface,
  isLabSurface
} from './content.js';

export const LAB_CONTENT = classicTray;

/**
 * @typedef {Object} LabAppOptions
 * @property {HTMLElement} stage
 * @property {HTMLElement} controlsHost
 * @property {HTMLElement} bannerHost
 * @property {HTMLElement} statsHost
 * @property {string} [seed]
 * @property {{ fixedStep?: number, maxSubSteps?: number, maxFrameGap?: number }} [loop]
 */

/**
 * @typedef {Object} LabAppHandle
 * @property {import('@dice/engine').DiceEngine} engine
 * @property {ResultBanner} banner
 * @property {ControlPanel} panel
 * @property {() => void} resize
 * @property {(request?: Record<string, any>) => Promise<any>} throwDice
 * @property {() => void} destroy
 */

/**
 * Update the stats member for one row. Text is assigned through
 * textContent only.
 *
 * @param {HTMLElement} statsHost
 * @param {Record<string, { term: string, value: string }>} rows
 * @returns {void}
 */
function renderStats(statsHost, rows) {
  /** @type {HTMLElement[]} */
  const children = [];
  for (const [key, row] of Object.entries(rows)) {
    children.push(
      createElement('div', { className: 'lab-info-row', 'data-stats': key }, [
        createElement('dt', { text: row.term }),
        ': ',
        createElement('dd', { text: row.value })
      ])
    );
  }
  const list = createElement('dl', { className: 'lab-info-list' }, children);
  statsHost.replaceChildren(list);
}

/**
 * Format a number for the stats panel without trailing noise.
 *
 * @param {number} value
 * @param {number} [digits]
 * @returns {string}
 */
function formatNumber(value, digits = 2) {
  return String(Number(value.toFixed(digits)));
}

/**
 * Create the engine, banner, controls, and input wiring for the physics
 * lab. Only public package entries are used. Contact materials, solver
 * tuning, and live body stats are reached through the world's public
 * `physicsWorld` handle; no backend (`cannon-es`) is imported here.
 *
 * Mass and damping are not engine-level settings: the app stores them and
 * applies them to every spawned die (via `die:spawn`) and to live dice
 * immediately, so controls take effect from the next spawn onward.
 *
 * @param {LabAppOptions} options
 * @returns {Promise<LabAppHandle>}
 */
export async function createLabApp(options) {
  const { stage, controlsHost, bannerHost, statsHost } = options;

  const engine = await createDiceEngine({
    container: stage,
    content: LAB_CONTENT,
    dice: { count: LAB_DICE_COUNT, definition: 'd6', style: 'classic' },
    seed: options.seed,
    loop: options.loop
  });

  const banner = new ResultBanner({
    events: engine.events,
    container: bannerHost,
    autoHide: 6000
  });

  const settings = defaultLabSettings();
  /** @type {string} */
  let activeSurface = LAB_SURFACES[0].id;
  /** @type {{ values: number[], total: number, durationMs: number|undefined }|null} */
  let lastResult = null;
  /** @type {number} */
  let rollCount = 0;
  /** @type {number|null} */
  let rollStartedAt = null;

  const panel = new ControlPanel({
    title: 'Physics lab',
    testId: 'lab-controls',
    items: [
      {
        id: 'throw',
        type: 'button',
        label: 'Throw',
        testId: 'throw-button'
      },
      {
        id: 'enclosure',
        type: 'select',
        label: 'Enclosure',
        value: 'box',
        options: [
          { value: 'box', label: 'Box' },
          { value: 'sphere', label: 'Sphere' },
          { value: 'cylinder', label: 'Cylinder' }
        ],
        testId: 'enclosure-select'
      },
      {
        id: 'gravity-x',
        type: 'range',
        label: 'Gravity X',
        value: settings.gravity.x,
        min: -3000,
        max: 3000,
        step: 100,
        testId: 'gravity-x-slider'
      },
      {
        id: 'gravity-y',
        type: 'range',
        label: 'Gravity Y',
        value: settings.gravity.y,
        min: -3000,
        max: 3000,
        step: 100,
        testId: 'gravity-y-slider'
      },
      {
        id: 'gravity-z',
        type: 'range',
        label: 'Gravity Z',
        value: settings.gravity.z,
        min: -5000,
        max: 1000,
        step: 100,
        testId: 'gravity-z-slider'
      },
      {
        id: 'surface',
        type: 'select',
        label: 'Surface pair',
        value: activeSurface,
        options: LAB_SURFACES.map((surface) => ({
          value: surface.id,
          label: surface.label
        })),
        testId: 'surface-select'
      },
      {
        id: 'friction',
        type: 'range',
        label: 'Friction',
        value: settings.friction,
        min: LAB_CONTACT_LIMITS.friction.min,
        max: LAB_CONTACT_LIMITS.friction.max,
        step: LAB_CONTACT_LIMITS.friction.step,
        testId: 'friction-slider'
      },
      {
        id: 'restitution',
        type: 'range',
        label: 'Restitution',
        value: settings.restitution,
        min: LAB_CONTACT_LIMITS.restitution.min,
        max: LAB_CONTACT_LIMITS.restitution.max,
        step: LAB_CONTACT_LIMITS.restitution.step,
        testId: 'restitution-slider'
      },
      {
        id: 'linear-damping',
        type: 'range',
        label: 'Linear damping',
        value: settings.linearDamping,
        min: 0,
        max: 1,
        step: 0.01,
        testId: 'linear-damping-slider'
      },
      {
        id: 'angular-damping',
        type: 'range',
        label: 'Angular damping',
        value: settings.angularDamping,
        min: 0,
        max: 1,
        step: 0.01,
        testId: 'angular-damping-slider'
      },
      {
        id: 'mass',
        type: 'range',
        label: 'Die mass',
        value: settings.mass,
        min: 50,
        max: 1000,
        step: 25,
        testId: 'mass-slider'
      },
      {
        id: 'solver-iterations',
        type: 'range',
        label: 'Solver iterations',
        value: settings.solverIterations,
        min: 1,
        max: 50,
        step: 1,
        testId: 'solver-iterations-slider'
      },
      {
        id: 'fixed-step',
        type: 'range',
        label: 'Fixed timestep (s)',
        value: settings.fixedStep,
        min: 0.001,
        max: 0.05,
        step: 0.001,
        testId: 'fixed-step-slider'
      },
      {
        id: 'velocity-threshold',
        type: 'range',
        label: 'Settle threshold',
        value: settings.velocityThreshold,
        min: 1,
        max: 50,
        step: 1,
        testId: 'velocity-threshold-slider'
      },
      {
        id: 'settle-frames',
        type: 'range',
        label: 'Settle frames',
        value: settings.settleFrames,
        min: 1,
        max: 30,
        step: 1,
        testId: 'settle-frames-slider'
      },
      {
        id: 'reset-defaults',
        type: 'button',
        label: 'Reset to defaults',
        testId: 'reset-defaults-button'
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

  const pointerInput = new PointerInput({ container: stage });
  engine.use(pointerInput);

  /**
   * Apply stored mass/damping to every live die.
   *
   * @returns {void}
   */
  function applyBodySettings() {
    for (const die of engine.world.getDice()) {
      if (!die.body) continue;
      die.body.setMass(settings.mass);
      die.body.setDamping(settings.linearDamping, settings.angularDamping);
    }
  }

  /**
   * Apply the selected surface pair's friction/restitution to the world.
   *
   * @returns {{ friction: number, restitution: number }}
   */
  function applyContact() {
    const surface = getLabSurface(activeSurface);
    const applied = engine.world.physicsWorld.setContactMaterial(
      surface.materialA,
      surface.materialB,
      { friction: settings.friction, restitution: settings.restitution }
    );
    settings.friction = applied.friction;
    settings.restitution = applied.restitution;
    return applied;
  }

  /**
   * Read the selected surface's live contact settings into the sliders.
   *
   * @returns {void}
   */
  function syncContactControls() {
    const surface = getLabSurface(activeSurface);
    const current = engine.world.physicsWorld.getContactMaterial(
      surface.materialA,
      surface.materialB
    );
    if (current) {
      settings.friction = current.friction;
      settings.restitution = current.restitution;
    }
    panel.setValue('friction', settings.friction);
    panel.setValue('restitution', settings.restitution);
  }

  /**
   * Update the live stats panel.
   *
   * @returns {void}
   */
  function updateStats() {
    let bodyCount = 0;
    /** @type {string[]} */
    let materialNames = [];
    try {
      bodyCount = engine.world.physicsWorld.getBodies().length;
      materialNames = engine.world.physicsWorld.getMaterialNames();
    } catch {
      bodyCount = 0;
    }
    const settle = engine.world.getSettleConfig();
    renderStats(statsHost, {
      bodies: { term: 'Bodies', value: String(bodyCount) },
      dice: { term: 'Dice', value: String(engine.getDiceIds().length) },
      gravity: {
        term: 'Gravity',
        value: `${settings.gravity.x}, ${settings.gravity.y}, ${settings.gravity.z}`
      },
      surface: {
        term: 'Surface',
        value: `${getLabSurface(activeSurface).label}: friction ${formatNumber(settings.friction)}, restitution ${formatNumber(settings.restitution)}`
      },
      mass: { term: 'Die mass', value: String(settings.mass) },
      damping: {
        term: 'Damping',
        value: `${formatNumber(settings.linearDamping)} / ${formatNumber(settings.angularDamping)}`
      },
      solver: { term: 'Solver iterations', value: String(settings.solverIterations) },
      timestep: {
        term: 'Fixed timestep',
        value: `${formatNumber(engine.loop.fixedStep, 3)} s`
      },
      settle: {
        term: 'Settle threshold',
        value: `${settle.velocityThreshold} / ${settle.settleFrames} frames`
      },
      materials: {
        term: 'Materials',
        value: materialNames.length > 0 ? materialNames.join(', ') : '—'
      },
      performance: {
        term: 'Performance',
        value: engine.loop.running
          ? `running (${rollCount} rolls)`
          : lastResult && lastResult.durationMs !== undefined
            ? `idle, last roll ${Math.round(lastResult.durationMs)} ms`
            : 'idle'
      },
      result: {
        term: 'Last result',
        value: lastResult
          ? `${lastResult.values.join(' + ')} = ${lastResult.total}`
          : '—'
      }
    });
  }

  /**
   * Throw the dice. Cancellation and redundant throws are swallowed.
   *
   * @param {Record<string, any>} [request]
   * @returns {Promise<any>}
   */
  async function throwDice(request = { dice: LAB_DICE_COUNT }) {
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
   * Restore every control and the running world to lab defaults, then roll.
   *
   * @returns {void}
   */
  function resetDefaults() {
    const defaults = defaultLabSettings();
    Object.assign(settings, defaults);
    settings.gravity = { ...defaults.gravity };

    engine.setGravity(defaults.gravity.x, defaults.gravity.y, defaults.gravity.z);
    engine.world.physicsWorld.setSolverIterations(defaults.solverIterations);
    engine.setLoopConfig({ fixedStep: defaults.fixedStep });
    engine.setSettleConfig({
      velocityThreshold: defaults.velocityThreshold,
      settleFrames: defaults.settleFrames
    });

    activeSurface = LAB_SURFACES[0].id;
    panel.setValue('surface', activeSurface);
    panel.setValue('gravity-x', defaults.gravity.x);
    panel.setValue('gravity-y', defaults.gravity.y);
    panel.setValue('gravity-z', defaults.gravity.z);
    panel.setValue('linear-damping', defaults.linearDamping);
    panel.setValue('angular-damping', defaults.angularDamping);
    panel.setValue('mass', defaults.mass);
    panel.setValue('solver-iterations', defaults.solverIterations);
    panel.setValue('fixed-step', defaults.fixedStep);
    panel.setValue('velocity-threshold', defaults.velocityThreshold);
    panel.setValue('settle-frames', defaults.settleFrames);

    // Re-assert every default contact pair so "reset" is total, then show
    // the first surface's values in the sliders.
    for (const surface of LAB_SURFACES) {
      engine.world.physicsWorld.setContactMaterial(
        surface.materialA,
        surface.materialB,
        { friction: surface.friction, restitution: surface.restitution }
      );
    }
    syncContactControls();
    applyBodySettings();
    updateStats();
    void throwDice();
  }

  panel.on((/** @type {{ id: string, value: unknown }} */ change) => {
    switch (change.id) {
      case 'throw': {
        void throwDice();
        break;
      }
      case 'enclosure': {
        const id = String(change.value ?? 'box');
        engine.setEnclosure(id);
        updateStats();
        void throwDice();
        break;
      }
      case 'gravity-x':
      case 'gravity-y':
      case 'gravity-z': {
        const axis = /** @type {'x'|'y'|'z'} */ (change.id.slice(-1));
        settings.gravity[axis] = Number(change.value);
        engine.setGravity(
          settings.gravity.x,
          settings.gravity.y,
          settings.gravity.z
        );
        panel.setValue(change.id, settings.gravity[axis]);
        updateStats();
        break;
      }
      case 'surface': {
        const id = String(change.value ?? LAB_SURFACES[0].id);
        if (!isLabSurface(id)) break;
        activeSurface = id;
        syncContactControls();
        updateStats();
        break;
      }
      case 'friction': {
        settings.friction = clampControlValue(
          Number(change.value),
          LAB_CONTACT_LIMITS.friction.min,
          LAB_CONTACT_LIMITS.friction.max,
          settings.friction
        );
        panel.setValue('friction', settings.friction);
        applyContact();
        updateStats();
        break;
      }
      case 'restitution': {
        settings.restitution = clampControlValue(
          Number(change.value),
          LAB_CONTACT_LIMITS.restitution.min,
          LAB_CONTACT_LIMITS.restitution.max,
          settings.restitution
        );
        panel.setValue('restitution', settings.restitution);
        applyContact();
        updateStats();
        break;
      }
      case 'linear-damping': {
        settings.linearDamping = clampControlValue(
          Number(change.value),
          0,
          1,
          settings.linearDamping
        );
        panel.setValue('linear-damping', settings.linearDamping);
        applyBodySettings();
        updateStats();
        break;
      }
      case 'angular-damping': {
        settings.angularDamping = clampControlValue(
          Number(change.value),
          0,
          1,
          settings.angularDamping
        );
        panel.setValue('angular-damping', settings.angularDamping);
        applyBodySettings();
        updateStats();
        break;
      }
      case 'mass': {
        settings.mass = clampControlValue(Number(change.value), 50, 1000, settings.mass);
        panel.setValue('mass', settings.mass);
        applyBodySettings();
        updateStats();
        break;
      }
      case 'solver-iterations': {
        settings.solverIterations = clampControlValue(
          Math.round(Number(change.value)),
          1,
          50,
          settings.solverIterations
        );
        panel.setValue('solver-iterations', settings.solverIterations);
        engine.world.physicsWorld.setSolverIterations(settings.solverIterations);
        updateStats();
        break;
      }
      case 'fixed-step': {
        settings.fixedStep = clampControlValue(
          Number(change.value),
          0.001,
          0.05,
          settings.fixedStep
        );
        panel.setValue('fixed-step', settings.fixedStep);
        engine.setLoopConfig({ fixedStep: settings.fixedStep });
        updateStats();
        break;
      }
      case 'velocity-threshold': {
        settings.velocityThreshold = clampControlValue(
          Number(change.value),
          1,
          50,
          settings.velocityThreshold
        );
        panel.setValue('velocity-threshold', settings.velocityThreshold);
        engine.setSettleConfig({ velocityThreshold: settings.velocityThreshold });
        updateStats();
        break;
      }
      case 'settle-frames': {
        settings.settleFrames = clampControlValue(
          Math.round(Number(change.value)),
          1,
          30,
          settings.settleFrames
        );
        panel.setValue('settle-frames', settings.settleFrames);
        engine.setSettleConfig({ settleFrames: settings.settleFrames });
        updateStats();
        break;
      }
      case 'reset-defaults': {
        resetDefaults();
        break;
      }
      case 'clear': {
        engine.clear();
        lastResult = null;
        updateStats();
        break;
      }
      default:
        break;
    }
  });

  engine.events.on(EVENTS.ROLL_START, () => {
    rollCount += 1;
    rollStartedAt = Date.now();
    panel.setDisabled('throw', true);
    updateStats();
  });
  engine.events.on(EVENTS.ROLL_SETTLE, (/** @type {any} */ payload) => {
    const result = payload?.result ?? payload ?? {};
    /** @type {number[]} */
    const values = Array.isArray(result.values) ? result.values : [];
    lastResult = {
      values,
      total:
        typeof result.total === 'number'
          ? result.total
          : values.reduce((/** @type {number} */ sum, /** @type {number} */ v) => sum + v, 0),
      durationMs:
        typeof result.durationMs === 'number'
          ? result.durationMs
          : rollStartedAt !== null
            ? Date.now() - rollStartedAt
            : undefined
    };
    rollStartedAt = null;
    panel.setDisabled('throw', false);
    updateStats();
  });
  engine.events.on(EVENTS.ROLL_CANCEL, () => {
    rollStartedAt = null;
    panel.setDisabled('throw', false);
    updateStats();
  });
  engine.events.on(EVENTS.DIE_SPAWN, () => {
    // New dice spawn with world-default mass/damping; re-apply the lab's.
    applyBodySettings();
    updateStats();
  });
  engine.events.on(EVENTS.PHYSICS_GRAVITY, () => {
    updateStats();
  });

  syncContactControls();
  updateStats();

  return {
    engine,
    banner,
    panel,
    resize: () => {
      engine.resize();
      updateStats();
    },
    throwDice,
    destroy: () => {
      banner.destroy();
      panel.destroy();
      engine.destroy();
    }
  };
}
