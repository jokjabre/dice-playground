import { cloneSettingsValue, isPlainObject } from './patch.js';

/**
 * Adapters/mappers scaffolding: canonical ↔ layer/app/content/runtime state.
 */

/** @param {Record<string, any>} obj */
function pickDefined(obj) {
  /** @type {Record<string, any>} */
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

/** @param {Record<string, any>} [canonical] */
export function canonicalToEngineConfig(canonical = {}) {
  /** @type {Record<string, any>} */
  const cfg = {};
  const dice = canonical.diceVisuals || {};
  const solver = canonical.physicsSolver || {};
  const settle = solver.settle || {};
  const world = canonical.physicsWorld || {};
  const mats = canonical.physicsMaterials || {};

  const diceCfg = pickDefined({
    count: dice.count,
    definition: dice.definition,
    style: dice.style
  });
  if (Object.keys(diceCfg).length) cfg.dice = diceCfg;

  const loop = pickDefined({
    fixedStep: solver.fixedStep,
    maxSubSteps: solver.maxSubSteps,
    maxFrameGap: solver.maxFrameGap,
    maxFrames: solver.maxFrames
  });
  if (Object.keys(loop).length) cfg.loop = loop;

  if (isPlainObject(settle)) cfg.settle = cloneSettingsValue(settle);

  const physics = pickDefined({
    gravity: world.gravity,
    iterations: solver.iterations,
    mass: mats.mass
  });
  if (Object.keys(physics).length) cfg.physics = physics;

  const render = canonicalToRenderConfig(canonical);
  if (Object.keys(render).length) cfg.rendering = render;

  return cfg;
}

/** @param {Record<string, any>} [canonical] */
export function canonicalToWorldConfig(canonical = {}) {
  /** @type {Record<string, any>} */
  const cfg = {};
  const dice = canonical.diceVisuals || {};
  const enc = canonical.enclosure || {};
  const world = canonical.physicsWorld || {};
  const solver = canonical.physicsSolver || {};
  const mats = canonical.physicsMaterials || {};
  const cam = canonical.camera || {};
  const scene = canonical.scene || {};

  if (dice.count != null) cfg.diceCount = dice.count;
  if (dice.definition != null) cfg.diceDefinition = dice.definition;
  if (dice.style != null) cfg.diceStyle = dice.style;
  if (enc.type != null) cfg.enclosure = enc.type;
  if (world.gravity != null) cfg.gravity = cloneSettingsValue(world.gravity);
  if (solver.iterations != null) cfg.physicsIterations = solver.iterations;
  if (mats.mass != null) cfg.mass = mats.mass;
  if (mats.linearDamping != null) cfg.linearDamping = mats.linearDamping;
  if (mats.angularDamping != null) cfg.angularDamping = mats.angularDamping;
  if (isPlainObject(solver.settle)) cfg.settle = cloneSettingsValue(solver.settle);

  const enclosureOptions = pickDefined({
    scale: enc.scale,
    ...(isPlainObject(enc.options) ? enc.options : {})
  });
  if (Object.keys(enclosureOptions).length) cfg.enclosureOptions = enclosureOptions;

  const camera = pickDefined({ distance: cam.distance, near: cam.near, far: cam.far });
  if (Object.keys(camera).length) cfg.camera = camera;

  const table = pickDefined({
    floorColor: scene.deskColor,
    background: scene.background,
    shadows: scene.shadows
  });
  if (Object.keys(table).length) cfg.table = table;

  const render = canonicalToRenderConfig(canonical);
  if (Object.keys(render).length) cfg.render = render;

  return cfg;
}

/** @param {Record<string, any>} [canonical] */
export function canonicalToRenderConfig(canonical = {}) {
  const scene = canonical.scene || {};
  const lighting = canonical.lighting || {};
  const camera = canonical.camera || {};
  /** @type {Record<string, any>} */
  const colors = {};
  if (scene.deskColor != null) colors.desk = scene.deskColor;
  if (lighting.ambientColor != null) colors.ambient = lighting.ambientColor;
  if (lighting.spotlightColor != null) colors.spotlight = lighting.spotlightColor;

  return pickDefined({
    background: scene.background,
    shadows: scene.shadows,
    antialias: scene.antialias,
    spotlightIntensity: scene.spotlightIntensity ?? lighting?.primary?.intensity,
    castShadow: scene.castShadow ?? lighting?.primary?.castShadow,
    fov: camera.fov,
    near: camera.near,
    far: camera.far,
    cameraDistance: camera.distance,
    ...(Object.keys(colors).length ? { colors } : {})
  });
}

/** @param {Record<string, any>} [canonical] */
export function canonicalToPhysicsConfig(canonical = {}) {
  const world = canonical.physicsWorld || {};
  const solver = canonical.physicsSolver || {};
  const mats = canonical.physicsMaterials || {};
  return pickDefined({
    gravity: world.gravity,
    iterations: solver.iterations,
    mass: mats.mass,
    linearDamping: mats.linearDamping,
    angularDamping: mats.angularDamping,
    contactPairs: isPlainObject(mats.contactPairs) ? cloneSettingsValue(mats.contactPairs) : undefined
  });
}

/** @param {Record<string, any>} [canonical] @param {Record<string, any>} [base] */
export function canonicalToContentPack(canonical = {}, base = {}) {
  /** @type {Record<string, any>} */
  const content = cloneSettingsValue(base || {});
  const dice = canonical.diceVisuals || {};
  const enc = canonical.enclosure || {};
  const cam = canonical.camera || {};
  const scene = canonical.scene || {};
  const world = canonical.physicsWorld || {};

  content.dice = { ...(content.dice || {}), ...pickDefined({ count: dice.count, definition: dice.definition, style: dice.style }) };
  content.enclosure = { ...(content.enclosure || {}), ...pickDefined({ type: enc.type, scale: enc.scale, ...(isPlainObject(enc.options) ? enc.options : {}) }) };
  content.camera = { ...(content.camera || {}), ...pickDefined({ distance: cam.distance, near: cam.near, far: cam.far }) };
  content.table = { ...(content.table || {}), ...pickDefined({ floorColor: scene.deskColor, background: scene.background, shadows: scene.shadows }) };
  content.physics = { ...(content.physics || {}), ...pickDefined({ gravity: world.gravity }) };
  return content;
}

/** @param {Record<string, any>} [input] */
export function runtimeStateToCanonical(input = {}) {
  /** @type {Record<string, any>} */
  const out = {};
  const engine = input.engineConfig || input.engine || {};
  const world = input.worldConfig || input.world || {};
  const render = input.renderConfig || input.render || {};
  const physics = input.physicsConfig || input.physics || {};
  const content = input.content || {};

  const dice = engine.dice || world.dice || content.dice || {};
  const diceVisuals = pickDefined({
    count: dice.count ?? dice.dice ?? world.diceCount,
    definition: dice.definition ?? world.diceDefinition,
    style: dice.style ?? world.diceStyle
  });
  if (Object.keys(diceVisuals).length) out.diceVisuals = diceVisuals;

  const enclosure = pickDefined({
    type: world.enclosure ?? content.enclosure?.type,
    scale: world.enclosureOptions?.scale ?? content.enclosure?.scale,
    options: pickDefined({ margin: world.enclosureOptions?.margin, ceiling: world.enclosureOptions?.ceiling })
  });
  if (Object.keys(enclosure).length) out.enclosure = enclosure;

  const gravity = world.gravity ?? engine.physics?.gravity ?? content.physics?.gravity ?? physics.gravity;
  if (gravity) out.physicsWorld = { gravity: cloneSettingsValue(gravity) };

  const settle = world.settle ?? engine.settle;
  const physicsSolver = pickDefined({
    iterations: world.physicsIterations ?? engine.physics?.iterations ?? physics.iterations,
    fixedStep: engine.loop?.fixedStep,
    maxSubSteps: engine.loop?.maxSubSteps,
    maxFrameGap: engine.loop?.maxFrameGap,
    maxFrames: engine.loop?.maxFrames,
    settle: settle ? cloneSettingsValue(settle) : undefined
  });
  if (Object.keys(physicsSolver).length) out.physicsSolver = physicsSolver;

  const physicsMaterials = pickDefined({
    mass: world.mass ?? engine.physics?.mass ?? physics.mass,
    linearDamping: world.linearDamping ?? physics.linearDamping,
    angularDamping: world.angularDamping ?? physics.angularDamping,
    contactPairs: physics.contactPairs ? cloneSettingsValue(physics.contactPairs) : undefined
  });
  if (Object.keys(physicsMaterials).length) out.physicsMaterials = physicsMaterials;

  const cam = world.camera ?? content.camera ?? {};
  const camera = pickDefined({ distance: cam.distance ?? render.cameraDistance, near: cam.near ?? render.near, far: cam.far ?? render.far, fov: render.fov });
  if (Object.keys(camera).length) out.camera = camera;

  const scene = pickDefined({
    background: render.background ?? world.table?.background ?? content.table?.background,
    deskColor: render.colors?.desk ?? world.table?.floorColor ?? content.table?.floorColor,
    shadows: render.shadows ?? world.table?.shadows ?? content.table?.shadows,
    antialias: render.antialias,
    spotlightIntensity: render.spotlightIntensity,
    castShadow: render.castShadow
  });
  if (Object.keys(scene).length) out.scene = scene;

  const lighting = pickDefined({
    ambientColor: render.colors?.ambient,
    spotlightColor: render.colors?.spotlight,
    primary: pickDefined({ intensity: render.spotlightIntensity, castShadow: render.castShadow })
  });
  if (Object.keys(lighting).length) out.lighting = lighting;

  return out;
}

export { pickDefined };
