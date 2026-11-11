import { EVENTS } from '@dice/core';
import { createDiceEngine } from '@dice/engine';
import { PointerInput } from '@dice/input';
import { ControlPanel, ResultBanner, createElement, mountAppSettings } from '@dice/ui';
import { getVisibleSectionIdsForApp } from '@dice/settings';

import {
  GALLERY_CAMERA,
  GALLERY_ENCLOSURE_SCALES,
  GALLERY_ENCLOSURES,
  GALLERY_LIGHT,
  GRAVITY_PRESETS,
  galleryContent,
  getGravityPreset,
  isGalleryEnclosure
} from './content.js';

export const GALLERY_DICE_COUNT = 6;

/**
 * @typedef {Object} GalleryAppOptions
 * @property {HTMLElement} stage
 * @property {HTMLElement} controlsHost
 * @property {HTMLElement} bannerHost
 * @property {HTMLElement} infoHost
 * @property {string} [initialEnclosure]
 * @property {string} [seed]
 * @property {{ fixedStep?: number, maxSubSteps?: number, maxFrameGap?: number }} [loop]
 */

/**
 * @typedef {Object} GalleryAppHandle
 * @property {import('@dice/engine').DiceEngine} engine
 * @property {ResultBanner} banner
 * @property {ControlPanel} panel
 * @property {any} [settings]
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
      createElement('div', { className: 'gallery-info-row', 'data-info': key }, [
        createElement('dt', { text: row.term }),
        ': ',
        createElement('dd', { text: row.value })
      ])
    );
  }
  const list = createElement('dl', { className: 'gallery-info-list' }, children);
  infoHost.replaceChildren(list);
}

/**
 * Create the engine, banner, controls, and input wiring for the gallery.
 * Only public package entries are used.
 *
 * @param {GalleryAppOptions} options
 * @returns {Promise<GalleryAppHandle>}
 */
export async function createGalleryApp(options) {
  const { stage, controlsHost, bannerHost, infoHost } = options;
  const initialEnclosure =
    options.initialEnclosure && isGalleryEnclosure(options.initialEnclosure)
      ? options.initialEnclosure
      : 'box';

  const engine = await createDiceEngine({
    container: stage,
    content: galleryContent,
    dice: { count: GALLERY_DICE_COUNT, definition: 'd6', style: 'classic' },
    seed: options.seed,
    loop: options.loop
  });

  const banner = new ResultBanner({
    events: engine.events,
    container: bannerHost,
    autoHide: 6000
  });

  const panel = new ControlPanel({
    title: 'Enclosure gallery',
    testId: 'gallery-controls',
    items: [
      {
        id: 'enclosure',
        type: 'select',
        label: 'Enclosure',
        value: initialEnclosure,
        options: GALLERY_ENCLOSURES.map((enclosure) => ({
          value: enclosure.id,
          label: enclosure.label
        })),
        testId: 'enclosure-select'
      },
      {
        id: 'enclosure-scale',
        type: 'select',
        label: 'Enclosure size',
        value: '1',
        options: GALLERY_ENCLOSURE_SCALES.map((preset) => ({
          value: String(preset.value),
          label: preset.label
        })),
        testId: 'enclosure-scale-select'
      },
      {
        id: 'throw',
        type: 'button',
        label: 'Throw',
        testId: 'throw-button'
      },
      {
        id: 'gravity-preset',
        type: 'select',
        label: 'Gravity preset',
        value: 'down',
        options: GRAVITY_PRESETS.map((preset) => ({
          value: preset.id,
          label: preset.label
        })),
        testId: 'gravity-preset-select'
      },
      {
        id: 'gravity-z',
        type: 'range',
        label: 'Gravity (z)',
        value: -2940,
        min: -5000,
        max: 0,
        step: 20,
        testId: 'gravity-z-slider'
      },
      {
        id: 'camera-distance',
        type: 'range',
        label: 'Camera distance',
        value: GALLERY_CAMERA.defaultDistance,
        min: GALLERY_CAMERA.min,
        max: GALLERY_CAMERA.max,
        step: GALLERY_CAMERA.step,
        testId: 'camera-distance-slider'
      },
      {
        id: 'camera-reset',
        type: 'button',
        label: 'Reset camera',
        testId: 'camera-reset-button'
      },
      {
        id: 'light-x',
        type: 'range',
        label: 'Light X',
        value: GALLERY_LIGHT.defaultPosition.x,
        min: GALLERY_LIGHT.min,
        max: GALLERY_LIGHT.max,
        step: GALLERY_LIGHT.step,
        testId: 'light-x-slider'
      },
      {
        id: 'light-y',
        type: 'range',
        label: 'Light Y',
        value: GALLERY_LIGHT.defaultPosition.y,
        min: GALLERY_LIGHT.min,
        max: GALLERY_LIGHT.max,
        step: GALLERY_LIGHT.step,
        testId: 'light-y-slider'
      },
      {
        id: 'light-z',
        type: 'range',
        label: 'Light Z',
        value: GALLERY_LIGHT.defaultPosition.z,
        min: GALLERY_LIGHT.min,
        max: GALLERY_LIGHT.max,
        step: GALLERY_LIGHT.step,
        testId: 'light-z-slider'
      },
      {
        id: 'light-reset',
        type: 'button',
        label: 'Reset light',
        testId: 'light-reset-button'
      },
      {
        id: 'clear',
        type: 'button',
        label: 'Clear dice',
        testId: 'clear-button'
      },
      {
        id: 'reset',
        type: 'button',
        label: 'Reset scene',
        testId: 'reset-button'
      }
    ]
  });

  controlsHost.appendChild(panel.element);
  const settingsHost = createElement('div', { className: 'app-settings-host', 'data-testid': 'settings-host' }, []);
  controlsHost.appendChild(settingsHost);

  const pointerInput = new PointerInput({ container: stage });
  engine.use(pointerInput);

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

  /** Spotlight position in scene-relative units. */
  const lightPosition = { ...GALLERY_LIGHT.defaultPosition };

  /**
   * Format a scene-relative component for the info panel.
   *
   * @param {number} value
   * @returns {string}
   */
  const formatComponent = (value) => String(Number(value.toFixed(2)));

  const updateInfo = () => {
    const config = engine.world.getConfig();
    const gravity =
      config.gravity ?? galleryContent.physics?.gravity ?? { x: 0, y: 0, z: -2940 };
    const camera = config.camera ?? { distance: GALLERY_CAMERA.defaultDistance };
    renderInfo(infoHost, {
      enclosure: { term: 'Enclosure', value: config.enclosure ?? initialEnclosure },
      enclosureSize: {
        term: 'Enclosure size',
        value: `${Math.round(activeScale * 100)}%`
      },
      dice: { term: 'Dice', value: String(engine.getDiceIds().length) },
      gravity: {
        term: 'Gravity',
        value: `${gravity.x}, ${gravity.y}, ${gravity.z}`
      },
      camera: {
        term: 'Camera distance',
        value: String(camera.distance ?? GALLERY_CAMERA.defaultDistance)
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
   * Throw the dice. Cancellation and redundant throws are swallowed so
   * rapid clicks and drags do not surface as errors.
   *
   * @param {Record<string, any>} [request]
   * @returns {Promise<any>}
   */
  async function throwDice(request = { dice: GALLERY_DICE_COUNT }) {
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

  panel.on((/** @type {{ id: string, value: unknown }} */ change) => {
    switch (change.id) {
      case 'enclosure': {
        const id = String(change.value ?? 'box');
        if (id === activeEnclosure) break;
        activeEnclosure = id;
        engine.setEnclosure(id);
        updateInfo();
        void throwDice();
        break;
      }
      case 'enclosure-scale': {
        const scale = Number(change.value);
        if (!Number.isFinite(scale) || scale <= 0 || scale === activeScale) break;
        activeScale = scale;
        engine.setEnclosureScale(scale);
        updateInfo();
        void throwDice();
        break;
      }
      case 'throw': {
        void throwDice();
        break;
      }
      case 'gravity-preset': {
        const preset = getGravityPreset(String(change.value ?? 'down'));
        engine.setGravity(preset.gravity.x, preset.gravity.y, preset.gravity.z);
        panel.setValue('gravity-z', preset.gravity.z);
        updateInfo();
        break;
      }
      case 'gravity-z': {
        const z = Number(change.value);
        if (Number.isFinite(z)) {
          engine.setGravity(0, 0, z);
          updateInfo();
        }
        break;
      }
      case 'camera-distance': {
        const distance = Number(change.value);
        if (Number.isFinite(distance)) {
          engine.setCamera({ distance });
          updateInfo();
        }
        break;
      }
      case 'camera-reset': {
        engine.resetCamera();
        panel.setValue('camera-distance', GALLERY_CAMERA.defaultDistance);
        updateInfo();
        break;
      }
      case 'light-x':
      case 'light-y':
      case 'light-z': {
        const axis = /** @type {'x'|'y'|'z'} */ (change.id.slice(-1));
        const value = Number(change.value);
        if (!Number.isFinite(value)) break;
        lightPosition[axis] = value;
        engine.setLight({ position: lightPosition });
        // The render loop idles after a roll settles, so request a frame so
        // the lighting change is visible immediately.
        engine.world.render(0);
        updateInfo();
        break;
      }
      case 'light-reset': {
        Object.assign(lightPosition, GALLERY_LIGHT.defaultPosition);
        engine.setLight({ position: lightPosition });
        engine.world.render(0);
        for (const axis of /** @type {const} */ (['x', 'y', 'z'])) {
          panel.setValue(`light-${axis}`, lightPosition[axis]);
        }
        updateInfo();
        break;
      }
      case 'clear': {
        engine.clear();
        lastResult = null;
        updateInfo();
        break;
      }
      case 'reset': {
        engine.reset();
        lastResult = null;
        updateInfo();
        break;
      }
      default:
        break;
    }
  });

  engine.events.on(EVENTS.ROLL_START, () => {
    panel.setDisabled('throw', true);
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
  engine.events.on(EVENTS.ENCLOSURE_CHANGE, () => {
    updateInfo();
  });
  engine.events.on(EVENTS.PHYSICS_GRAVITY, () => {
    updateInfo();
  });

  /** @param {any} effective */
  function applyCanonicalToApp(effective) {
    const enc = effective?.enclosure || {};
    if (enc.type && enc.type !== activeEnclosure) {
      activeEnclosure = String(enc.type);
      try { panel.setValue('enclosure', activeEnclosure); } catch {}
      try { engine.setEnclosure(activeEnclosure); } catch {}
    }
    if (enc.scale != null && Number(enc.scale) !== activeScale) {
      activeScale = Number(enc.scale);
      try { panel.setValue('enclosure-scale', String(activeScale)); } catch {}
      try { engine.setEnclosureScale(activeScale); } catch {}
    }
    const cam = effective?.camera || {};
    if (cam.distance != null) {
      try { panel.setValue('camera-distance', Number(cam.distance)); } catch {}
      try { engine.setCamera({ distance: Number(cam.distance) }); } catch {}
    }
    const light = effective?.lighting?.primary?.position || {};
    if (light.x != null) { lightPosition.x = Number(light.x); try { panel.setValue('light-x', lightPosition.x); } catch {} }
    if (light.y != null) { lightPosition.y = Number(light.y); try { panel.setValue('light-y', lightPosition.y); } catch {} }
    if (light.z != null) { lightPosition.z = Number(light.z); try { panel.setValue('light-z', lightPosition.z); } catch {} }
    try { engine.setLight({ position: lightPosition }); engine.world.render(0); } catch {}
    const g = effective?.physicsWorld?.gravity;
    if (g) {
      try { engine.setGravity(Number(g.x ?? 0), Number(g.y ?? 0), Number(g.z ?? -2940)); panel.setValue('gravity-z', Number(g.z ?? -2940)); } catch {}
    }
    updateInfo();
  }

  const settingsIntegration = mountAppSettings({
    appId: 'enclosure-gallery',
    container: settingsHost,
    engine,
    visibleSectionIds: getVisibleSectionIdsForApp('enclosure-gallery'),
    title: 'Settings',
    onApplied: (info) => { try { applyCanonicalToApp(info?.effective || settingsIntegration.getEffective()); } catch {} },
    onRebuildRequired: async () => { try { await throwDice(); } catch {} }
  });

  if (initialEnclosure !== 'box') {
    engine.setEnclosure(initialEnclosure);
  }
  try { applyCanonicalToApp(settingsIntegration.getEffective()); } catch {}
  updateInfo();

  return {
    engine,
    banner,
    panel,
    settings: settingsIntegration,
    resize: () => {
      engine.resize();
      updateInfo();
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
