import { EVENTS } from '@dice/core';
import { createDiceRegistry } from '@dice/dice';
import { createDiceEngine } from '@dice/engine';
import { computeDieRadius } from '@dice/enclosures';
import { PointerInput } from '@dice/input';
import { ControlPanel, ResultBanner, createElement } from '@dice/ui';

import { classicTray } from '@dice/content';

import {
  MAPPING_PRESETS,
  VISUAL_CHAMFER,
  VISUAL_DICE_COUNT,
  VISUAL_RADIUS_SCALE,
  VISUAL_SHININESS,
  assertChamfer,
  buildStyleDescriptor,
  clampValue,
  createVisualDefinition,
  defaultVisualSettings,
  formatSpecularColor,
  mappingForPreset,
  parseSpecularColor,
  previewStats,
  scaleMetrics
} from './content.js';

export const VISUAL_CONTENT = classicTray;

/**
 * @typedef {Object} VisualAppOptions
 * @property {HTMLElement} stage
 * @property {HTMLElement} controlsHost
 * @property {HTMLElement} bannerHost
 * @property {HTMLElement} previewHost
 * @property {string} [seed]
 * @property {{ fixedStep?: number, maxSubSteps?: number, maxFrameGap?: number }} [loop]
 */

/**
 * @typedef {Object} VisualAppHandle
 * @property {import('@dice/engine').DiceEngine} engine
 * @property {ResultBanner} banner
 * @property {ControlPanel} panel
 * @property {() => void} resize
 * @property {(request?: Record<string, any>) => Promise<any>} throwDice
 * @property {() => void} destroy
 */

/**
 * Update the preview member for one row. Text only via textContent.
 *
 * @param {HTMLElement} previewHost
 * @param {Record<string, { term: string, value: string }>} rows
 * @returns {void}
 */
function renderPreview(previewHost, rows) {
  /** @type {HTMLElement[]} */
  const children = [];
  for (const [key, row] of Object.entries(rows)) {
    children.push(
      createElement('div', { className: 'visual-info-row', 'data-preview': key }, [
        createElement('dt', { text: row.term }),
        ': ',
        createElement('dd', { text: row.value })
      ])
    );
  }
  const list = createElement('dl', { className: 'visual-info-list' }, children);
  previewHost.replaceChildren(list);
}

/**
 * Create the engine, banner, controls, and input wiring for the dice
 * visual lab. Only public package entries are used.
 *
 * Live-dice mechanics:
 *
 * - Chamfer: mutates the lab-registered definition, clears the dice
 *   geometry cache through `engine.resize()`, and rerolls.
 * - Radius: rescales viewport metrics' `scale` through
 *   `engine.resize(metrics)` and rerolls.
 * - Colors/material: passes a style descriptor through
 *   `engine.setDiceConfig({ style })` and rerolls (styles resolve at die
 *   creation).
 * - Face mapping: rolls with `faceMappings` built from a preset and also
 *   applies the mapping to live dice immediately.
 *
 * The preview panel renders pure mesh/collision stats from
 * `createDiceMeshData`/`createDiceCollisionData` at the current chamfer
 * and live radius, so it cannot diverge from the live dice.
 *
 * @param {VisualAppOptions} options
 * @returns {Promise<VisualAppHandle>}
 */
export async function createVisualApp(options) {
  const { stage, controlsHost, bannerHost, previewHost } = options;

  const settings = defaultVisualSettings();
  const definition = createVisualDefinition();
  const diceRegistry = createDiceRegistry([definition]);

  const engine = await createDiceEngine({
    container: stage,
    content: VISUAL_CONTENT,
    dice: { count: VISUAL_DICE_COUNT, definition: 'd6', style: buildStyleDescriptor(settings) },
    seed: options.seed,
    loop: options.loop,
    diceRegistry
  });

  const banner = new ResultBanner({
    events: engine.events,
    container: bannerHost,
    autoHide: 6000
  });

  /** @type {string} */
  let activeMapping = 'identity';
  /** @type {number[]} */
  let lastMapping = mappingForPreset(activeMapping);

  const panel = new ControlPanel({
    title: 'Dice visual lab',
    testId: 'visual-controls',
    items: [
      {
        id: 'roll',
        type: 'button',
        label: 'Roll',
        testId: 'roll-button'
      },
      {
        id: 'chamfer',
        type: 'range',
        label: 'Chamfer factor',
        value: settings.chamfer,
        min: VISUAL_CHAMFER.min,
        max: VISUAL_CHAMFER.max,
        step: VISUAL_CHAMFER.step,
        testId: 'chamfer-slider'
      },
      {
        id: 'radius-scale',
        type: 'range',
        label: 'Die radius scale',
        value: settings.radiusScale,
        min: VISUAL_RADIUS_SCALE.min,
        max: VISUAL_RADIUS_SCALE.max,
        step: VISUAL_RADIUS_SCALE.step,
        testId: 'radius-scale-slider'
      },
      {
        id: 'body-color',
        type: 'text',
        label: 'Body color (#rrggbb)',
        value: settings.bodyColor,
        testId: 'body-color-input'
      },
      {
        id: 'label-color',
        type: 'text',
        label: 'Label color (#rrggbb)',
        value: settings.labelColor,
        testId: 'label-color-input'
      },
      {
        id: 'shininess',
        type: 'range',
        label: 'Material shininess',
        value: settings.shininess,
        min: VISUAL_SHININESS.min,
        max: VISUAL_SHININESS.max,
        step: VISUAL_SHININESS.step,
        testId: 'shininess-slider'
      },
      {
        id: 'specular',
        type: 'text',
        label: 'Material specular (#rrggbb)',
        value: formatSpecularColor(settings.specular),
        testId: 'specular-input'
      },
      {
        id: 'face-mapping',
        type: 'select',
        label: 'Face mapping preview',
        value: activeMapping,
        options: MAPPING_PRESETS.map((preset) => ({
          value: preset.id,
          label: preset.label
        })),
        testId: 'face-mapping-select'
      },
      {
        id: 'apply-style',
        type: 'button',
        label: 'Apply colors and roll',
        testId: 'apply-style-button'
      },
      {
        id: 'reset',
        type: 'button',
        label: 'Reset visuals',
        testId: 'reset-button'
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
   * Live die radius for the current (possibly scaled) metrics.
   *
   * @returns {number}
   */
  function liveRadius() {
    return computeDieRadius(engine.world.getMetrics());
  }

  /**
   * Update the pure-data preview panel.
   *
   * @returns {void}
   */
  function updatePreview() {
    const radius = liveRadius();
    const stats = previewStats(definition, radius);
    renderPreview(previewHost, {
      chamfer: { term: 'Chamfer', value: String(settings.chamfer) },
      radius: {
        term: 'Die radius',
        value: `${radius.toFixed(1)} (scale ${settings.radiusScale}×)`
      },
      vertices: { term: 'Mesh vertices', value: String(stats.vertices) },
      faces: {
        term: 'Mesh faces',
        value: `${stats.faces} (${stats.chamferFaces} chamfer)`
      },
      collision: {
        term: 'Collision vertices',
        value: String(stats.collisionVertices)
      },
      colors: {
        term: 'Colors',
        value: `body ${settings.bodyColor}, label ${settings.labelColor}`
      },
      material: {
        term: 'Material',
        value: `shininess ${settings.shininess}, specular ${formatSpecularColor(settings.specular)}`
      },
      mapping: {
        term: 'Face mapping',
        value: `[${lastMapping.join(', ')}]`
      }
    });
  }

  /**
   * Apply the style descriptor to the world for future spawns.
   *
   * @returns {void}
   */
  function applyStyle() {
    engine.setDiceConfig({ style: buildStyleDescriptor(settings) });
  }

  /**
   * Apply the active face mapping to live dice without rerolling.
   *
   * @returns {void}
   */
  function applyMappingToLiveDice() {
    for (const die of engine.world.getDice()) {
      die.setFaceMapping(lastMapping);
    }
  }

  /**
   * Throw the dice, always with the active face mapping so the preview is
   * what the roll shows.
   *
   * @param {Record<string, any>} [request]
   * @returns {Promise<any>}
   */
  async function throwDice(request = {}) {
    try {
      return await engine.roll({
        dice: VISUAL_DICE_COUNT,
        faceMappings: Array.from({ length: VISUAL_DICE_COUNT }, () => [
          ...lastMapping
        ]),
        ...request
      });
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
   * Re-apply the current radius scale after a plain container resize.
   *
   * @returns {void}
   */
  function applyRadiusScale() {
    const fresh = engine.resize();
    engine.resize(scaleMetrics(fresh, settings.radiusScale));
  }

  /**
   * Restore every visual setting and reroll.
   *
   * @returns {void}
   */
  function resetVisuals() {
    const defaults = defaultVisualSettings();
    Object.assign(settings, defaults);
    definition.chamfer = defaults.chamfer;
    activeMapping = 'identity';
    lastMapping = mappingForPreset(activeMapping);

    panel.setValue('chamfer', defaults.chamfer);
    panel.setValue('radius-scale', defaults.radiusScale);
    panel.setValue('body-color', defaults.bodyColor);
    panel.setValue('label-color', defaults.labelColor);
    panel.setValue('shininess', defaults.shininess);
    panel.setValue('specular', formatSpecularColor(defaults.specular));
    panel.setValue('face-mapping', activeMapping);

    applyStyle();
    applyRadiusScale();
    applyMappingToLiveDice();
    updatePreview();
    void throwDice();
  }

  panel.on((/** @type {{ id: string, value: unknown }} */ change) => {
    switch (change.id) {
      case 'roll': {
        void throwDice();
        break;
      }
      case 'chamfer': {
        settings.chamfer = clampValue(
          Number(change.value),
          VISUAL_CHAMFER.min,
          VISUAL_CHAMFER.max,
          settings.chamfer
        );
        assertChamfer(settings.chamfer);
        panel.setValue('chamfer', settings.chamfer);
        // Geometry is cached per definition/radius; a resize clears the
        // cache so the next spawn rebuilds with the new chamfer. Re-apply
        // the radius scale so the metrics stay scaled.
        definition.chamfer = settings.chamfer;
        applyRadiusScale();
        updatePreview();
        void throwDice();
        break;
      }
      case 'radius-scale': {
        settings.radiusScale = clampValue(
          Number(change.value),
          VISUAL_RADIUS_SCALE.min,
          VISUAL_RADIUS_SCALE.max,
          settings.radiusScale
        );
        panel.setValue('radius-scale', settings.radiusScale);
        applyRadiusScale();
        updatePreview();
        void throwDice();
        break;
      }
      case 'body-color': {
        settings.bodyColor = String(change.value ?? settings.bodyColor).trim();
        updatePreview();
        break;
      }
      case 'label-color': {
        settings.labelColor = String(change.value ?? settings.labelColor).trim();
        updatePreview();
        break;
      }
      case 'shininess': {
        settings.shininess = clampValue(
          Number(change.value),
          VISUAL_SHININESS.min,
          VISUAL_SHININESS.max,
          settings.shininess
        );
        panel.setValue('shininess', settings.shininess);
        updatePreview();
        break;
      }
      case 'specular': {
        // Specular is a hex color; invalid input keeps the current value.
        try {
          settings.specular = parseSpecularColor(
            String(change.value ?? '').trim()
          );
        } catch {
          // Keep the current specular; the preview shows the valid value.
        }
        panel.setValue('specular', formatSpecularColor(settings.specular));
        updatePreview();
        break;
      }
      case 'apply-style': {
        applyStyle();
        updatePreview();
        void throwDice();
        break;
      }
      case 'face-mapping': {
        activeMapping = String(change.value ?? 'identity');
        lastMapping = mappingForPreset(activeMapping);
        applyMappingToLiveDice();
        updatePreview();
        break;
      }
      case 'reset': {
        resetVisuals();
        break;
      }
      case 'clear': {
        engine.clear();
        updatePreview();
        break;
      }
      default:
        break;
    }
  });

  engine.events.on(EVENTS.ROLL_START, () => {
    panel.setDisabled('roll', true);
  });
  engine.events.on(EVENTS.ROLL_SETTLE, () => {
    panel.setDisabled('roll', false);
    updatePreview();
  });
  engine.events.on(EVENTS.ROLL_CANCEL, () => {
    panel.setDisabled('roll', false);
  });

  updatePreview();

  return {
    engine,
    banner,
    panel,
    resize: () => {
      applyRadiusScale();
      updatePreview();
    },
    throwDice,
    destroy: () => {
      banner.destroy();
      panel.destroy();
      engine.destroy();
    }
  };
}
