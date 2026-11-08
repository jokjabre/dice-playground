import { mergeConfig } from '@dice/core';

/**
 * @typedef {Object} Vec3
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */
/**
 * @typedef {Object} SettleConfig
 * @property {number} velocityThreshold
 * @property {number} settleFrames
 * @property {number} maxIterations
 * @property {number} fixedStep
 */

/**
 * @typedef {Object} WorldConfig
 * @property {number} diceCount
 * @property {string} diceDefinition
 * @property {string|any} diceStyle
 * @property {string} enclosure
 * @property {Vec3} gravity
 * @property {number} physicsIterations
 * @property {number} mass
 * @property {number} linearDamping
 * @property {number} angularDamping
 * @property {SettleConfig} settle
 * @property {Record<string, any>} render
 * @property {Record<string, any>} table
 * @property {Record<string, any>} camera
 * @property {Record<string, any>} enclosureOptions
 */

/**
 * @type {Readonly<WorldConfig>}
 */
export const DEFAULT_WORLD_CONFIG = Object.freeze({
  diceCount: 6,
  diceDefinition: 'd6',
  diceStyle: 'classic',
  enclosure: 'box',
  gravity: Object.freeze({ x: 0, y: 0, z: -2940 }),
  physicsIterations: 20,
  mass: 300,
  linearDamping: 0.1,
  angularDamping: 0.1,
  settle: Object.freeze({
    velocityThreshold: 6,
    settleFrames: 3,
    maxIterations: 1000,
    fixedStep: 1 / 60
  }),
  render: Object.freeze({}),
  table: Object.freeze({}),
  camera: Object.freeze({}),
  enclosureOptions: Object.freeze({})
});

/**
 * @type {Readonly<SettleConfig>}
 */
export const DEFAULT_SETTLE_CONFIG = DEFAULT_WORLD_CONFIG.settle;

/**
 * Merge overrides over the world defaults without mutating either layer.
 *
 * @param {Partial<WorldConfig>|Record<string, any>} [overrides]
 * @returns {WorldConfig}
 */
export function createWorldConfig(overrides = {}) {
  const merged = mergeConfig(
    /** @type {Record<string, any>} */ (DEFAULT_WORLD_CONFIG),
    /** @type {Record<string, any>} */ (overrides)
  );

  return /** @type {WorldConfig} */ ({
    diceCount: typeof merged.diceCount === 'number' ? merged.diceCount : 6,
    diceDefinition:
      typeof merged.diceDefinition === 'string' ? merged.diceDefinition : 'd6',
    diceStyle: merged.diceStyle ?? 'classic',
    enclosure: typeof merged.enclosure === 'string' ? merged.enclosure : 'box',
    gravity:
      merged.gravity && typeof merged.gravity === 'object'
        ? {
            x: merged.gravity.x ?? 0,
            y: merged.gravity.y ?? 0,
            z: merged.gravity.z ?? -2940
          }
        : { x: 0, y: 0, z: -2940 },
    physicsIterations:
      typeof merged.physicsIterations === 'number' ? merged.physicsIterations : 20,
    mass: typeof merged.mass === 'number' ? merged.mass : 300,
    linearDamping:
      typeof merged.linearDamping === 'number' ? merged.linearDamping : 0.1,
    angularDamping:
      typeof merged.angularDamping === 'number' ? merged.angularDamping : 0.1,
    settle: {
      velocityThreshold: merged.settle?.velocityThreshold ?? 6,
      settleFrames: merged.settle?.settleFrames ?? 3,
      maxIterations: merged.settle?.maxIterations ?? 1000,
      fixedStep: merged.settle?.fixedStep ?? 1 / 60
    },
    render: merged.render && typeof merged.render === 'object' ? merged.render : {},
    table: merged.table && typeof merged.table === 'object' ? merged.table : {},
    camera: merged.camera && typeof merged.camera === 'object' ? merged.camera : {},
    enclosureOptions:
      merged.enclosureOptions && typeof merged.enclosureOptions === 'object'
        ? merged.enclosureOptions
        : {}
  });
}

/**
 * Translate a serializable content pack into world-config overrides. The world
 * reads plain content data and never imports the content package.
 *
 * @param {Record<string, any>|null|undefined} [content]
 * @returns {Partial<WorldConfig>}
 */
export function configFromContent(content) {
  if (!content || typeof content !== 'object') return {};

  /** @type {Partial<WorldConfig>} */
  const overrides = {};

  const dice = content.dice;
  if (dice && typeof dice === 'object') {
    if (typeof dice.count === 'number') overrides.diceCount = dice.count;
    if (typeof dice.definition === 'string') overrides.diceDefinition = dice.definition;
    if (dice.style !== undefined) overrides.diceStyle = dice.style;
  }

  const enclosure = content.enclosure;
  if (enclosure && typeof enclosure === 'object') {
    if (typeof enclosure.type === 'string') overrides.enclosure = enclosure.type;
    /** @type {Record<string, any>} */
    const enclosureOptions = {};
    if (enclosure.margin !== undefined) enclosureOptions.margin = enclosure.margin;
    if (enclosure.ceiling !== undefined) enclosureOptions.ceiling = enclosure.ceiling;
    if (Object.keys(enclosureOptions).length > 0) overrides.enclosureOptions = enclosureOptions;
  }

  const physics = content.physics;
  if (physics && typeof physics === 'object') {
    if (physics.gravity && typeof physics.gravity === 'object') {
      overrides.gravity = {
        x: physics.gravity.x ?? 0,
        y: physics.gravity.y ?? 0,
        z: physics.gravity.z ?? -2940
      };
    }
  }

  const table = content.table;
  if (table && typeof table === 'object') {
    /** @type {Record<string, any>} */
    const tableConfig = {};
    if (table.floorColor !== undefined) tableConfig.floorColor = table.floorColor;
    if (table.background !== undefined) tableConfig.background = table.background;
    if (table.shadows !== undefined) tableConfig.shadows = table.shadows;
    if (Object.keys(tableConfig).length > 0) overrides.table = tableConfig;
  }

  const camera = content.camera;
  if (camera && typeof camera === 'object') {
    /** @type {Record<string, any>} */
    const cameraConfig = {};
    if (camera.distance !== undefined) cameraConfig.distance = camera.distance;
    if (camera.near !== undefined) cameraConfig.near = camera.near;
    if (camera.far !== undefined) cameraConfig.far = camera.far;
    if (Object.keys(cameraConfig).length > 0) overrides.camera = cameraConfig;
  }

  const rendering = content.rendering;
  if (rendering && typeof rendering === 'object') {
    overrides.render = { ...rendering };
  }

  return overrides;
}
