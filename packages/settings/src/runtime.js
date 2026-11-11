import { SECTION_IDS } from './constants.js';
import { CANONICAL_BASE_DEFAULTS, createDefaultCanonicalSettings } from './defaults.js';
import {
  applyPatch,
  buildEffectiveMinusBase,
  buildOverridesOnly,
  cloneSettingsValue,
  deepEqualValue,
  extractApplicableSections,
  mergeSettingsPatch,
  resolveLayers
} from './merge.js';
import { isPlainObject } from './patch.js';
import { getSectionDescriptor } from './registry.js';
import { loadDefaultSettings, saveDefaultSettings, clearDefaultSettings } from './storage.js';
import { deserializeEnvelope, createEnvelope } from './envelope.js';
import { normalizeSettings, validateSettings } from './schema.js';
import { runtimeStateToCanonical } from './adapters.js';

/**
 * @typedef {'hot'|'partial-rebuild'|'full-reload'} ApplyAction
 */

/** @param {any} env */
function extractSettingsFromMaybeEnvelope(env) {
  if (env == null) return {};
  if (typeof env === 'string') {
    const parsed = deserializeEnvelope(env);
    return parsed.ok ? (parsed.envelope?.settings || {}) : {};
  }
  if (isPlainObject(env) && env.format === 'dice-settings' && isPlainObject(env.settings)) {
    return env.settings;
  }
  if (isPlainObject(env) && isPlainObject(env.settings) && env.schemaVersion != null) {
    return env.settings;
  }
  return isPlainObject(env) ? env : {};
}

/** @param {Record<string, any>} patch @returns {string[]} */
function changedSections(patch) {
  if (!isPlainObject(patch)) return [];
  return Object.keys(patch).filter((k) => SECTION_IDS.includes(/** @type {any} */ (k)));
}

/**
 * Classify a canonical patch (or changed sections) into the required apply action.
 * Conservative: structural/unknown -> rebuild/reload, per-field heuristics for key hot paths.
 *
 * @param {Record<string, any>} patch
 * @param {{ registry?: Record<string, any>, previousEffective?: Record<string, any>, nextEffective?: Record<string, any> }} [options]
 * @returns {{ action: ApplyAction, sections: string[], reasons: Record<string, ApplyAction> }}
 */
export function classifySettingsPatch(patch, options = {}) {
  /** @type {Record<string, ApplyAction>} */
  const reasons = {};
  const sections = changedSections(patch);
  let action = /** @type {ApplyAction} */ ('hot');

  const bump = (/** @type {ApplyAction} */ a) => {
    const rank = { hot: 0, 'partial-rebuild': 1, 'full-reload': 2 };
    if (rank[a] > rank[action]) action = a;
  };

  for (const id of sections) {
    const desc = options.registry?.[id] || getSectionDescriptor(id);
    let sectionAction = /** @type {ApplyAction} */ (desc?.defaultApplyMode || 'partial-rebuild');
    const value = /** @type {any} */ (patch)[id];

    // Refine by known hot-capable fields when only those change.
    if (id === 'camera') sectionAction = 'hot';
    if (id === 'lighting') sectionAction = 'hot';
    if (id === 'physicsWorld') sectionAction = 'hot';
    if (id === 'determinism') sectionAction = 'hot';
    if (id === 'appMode') sectionAction = 'hot';

    if (id === 'diceVisuals' && isPlainObject(value)) {
      const keys = Object.keys(value);
      const structuralKeys = new Set(['definition', 'count', 'geometry', 'radius', 'radiusScale', 'styleDescriptor']);
      const hotKeys = new Set(['faceMapping', 'faceLabels', 'colors', 'material', 'style']);
      const hasStructural = keys.some((k) => structuralKeys.has(k));
      const onlyHotish = keys.length > 0 && keys.every((k) => hotKeys.has(k) || k === 'bodyColor' || k === 'labelColor');
      if (hasStructural) sectionAction = 'full-reload';
      else if (onlyHotish) sectionAction = 'hot';
      else sectionAction = desc?.defaultApplyMode || 'partial-rebuild';
    }

    if (id === 'enclosure') sectionAction = 'full-reload';

    if (id === 'physicsMaterials' && isPlainObject(value)) {
      // Live updates possible for mass/damping/contact pairs; treat as hot by default.
      sectionAction = 'hot';
    }

    if (id === 'physicsSolver' && isPlainObject(value)) {
      const keys = Object.keys(value);
      const hotish = keys.every((k) => ['iterations', 'settle'].includes(k));
      sectionAction = hotish ? 'hot' : (desc?.defaultApplyMode || 'partial-rebuild');
    }

    if (id === 'scene' && isPlainObject(value)) {
      // Conservative: render flag/background changes may need rebuild; treat as partial-rebuild unless empty.
      const keys = Object.keys(value);
      const hotish = keys.every((k) => ['deskColor', 'background', 'spotlightIntensity', 'castShadow'].includes(k));
      sectionAction = hotish ? 'hot' : (desc?.defaultApplyMode || 'partial-rebuild');
    }

    if (id === 'throwSpawn') sectionAction = 'hot';

    reasons[id] = sectionAction;
    bump(sectionAction);
  }

  if (sections.length === 0) return { action: 'hot', sections, reasons };
  return { action, sections, reasons };
}

/**
 * Resolve runtime layers to effective canonical settings.
 * @param {{ baseDefaults?: Record<string, any>, appBundled?: Record<string, any>, perAppDefault?: any, liveOverrides?: Record<string, any> }} layers
 */
export function resolveCanonicalLayers(layers = {}) {
  const base = layers.baseDefaults || createDefaultCanonicalSettings();
  const bundled = extractSettingsFromMaybeEnvelope(layers.appBundled);
  const perApp = extractSettingsFromMaybeEnvelope(layers.perAppDefault);
  const live = isPlainObject(layers.liveOverrides) ? layers.liveOverrides : {};
  const effective = resolveLayers(base, bundled, perApp, live);
  const belowLive = resolveLayers(base, bundled, perApp);
  return { base, bundled, perApp, live, belowLive, effective };
}

/** @param {any} engine */
function getEngineWorld(engine) {
  return engine?.world ?? engine;
}

/** @param {any} engine @param {Record<string, any>} effective */
function applyCameraHot(engine, effective) {
  const camera = effective.camera || {};
  const world = getEngineWorld(engine);
  const payload = {};
  if (camera.distance != null) payload.distance = camera.distance;
  if (camera.near != null) payload.near = camera.near;
  if (camera.far != null) payload.far = camera.far;
  if (Object.keys(payload).length) {
    if (typeof engine?.setCamera === 'function') engine.setCamera(payload);
    else if (typeof world?.setCamera === 'function') world.setCamera(payload);
  }
  // fov is not exposed as live setter on current world/engine; structural/rebuild path may be needed.
}

/** @param {any} engine @param {Record<string, any>} effective */
function applyLightingHot(engine, effective) {
  const lighting = effective.lighting || {};
  const primary = lighting.primary || lighting;
  const world = getEngineWorld(engine);
  if (primary?.position) {
    const pos = primary.position;
    const payload = { position: { x: pos.x ?? 0, y: pos.y ?? 0, z: pos.z ?? 0 } };
    if (typeof engine?.setLight === 'function') engine.setLight(payload);
    else if (typeof world?.setLight === 'function') world.setLight(payload);
  }
}

/** @param {any} engine @param {Record<string, any>} effective */
function applyGravityHot(engine, effective) {
  const g = effective.physicsWorld?.gravity;
  if (!g) return;
  const x = g.x ?? 0, y = g.y ?? 0, z = g.z ?? -2940;
  if (typeof engine?.setGravity === 'function') engine.setGravity(x, y, z);
  else if (typeof getEngineWorld(engine)?.setGravity === 'function') getEngineWorld(engine).setGravity(x, y, z);
}

/** @param {any} engine @param {Record<string, any>} effective */
function applySolverHot(engine, effective) {
  const solver = effective.physicsSolver || {};
  if (typeof engine?.setLoopConfig === 'function') {
    const loop = {};
    if (solver.fixedStep != null) loop.fixedStep = solver.fixedStep;
    if (solver.maxSubSteps != null) loop.maxSubSteps = solver.maxSubSteps;
    if (solver.maxFrameGap != null) loop.maxFrameGap = solver.maxFrameGap;
    if (solver.maxFrames != null) loop.maxFrames = solver.maxFrames;
    if (Object.keys(loop).length) {
      try { engine.setLoopConfig(loop); } catch (_) { /* ignore invalid */ }
    }
  }
  if (typeof engine?.setSettleConfig === 'function' && isPlainObject(solver.settle)) {
    try { engine.setSettleConfig(solver.settle); } catch (_) { /* ignore */ }
  } else if (typeof getEngineWorld(engine)?.setSettleConfig === 'function' && isPlainObject(solver.settle)) {
    try { getEngineWorld(engine).setSettleConfig(solver.settle); } catch (_) { /* ignore */ }
  }
  const world = getEngineWorld(engine);
  const pw = world?.physicsWorld ?? world?._physics ?? null;
  if (solver.iterations != null && pw && typeof pw.setSolverIterations === 'function') {
    try { pw.setSolverIterations(solver.iterations); } catch (_) { /* ignore */ }
  }
}

/** @param {any} engine @param {Record<string, any>} effective */
function applyMaterialsHot(engine, effective) {
  const mats = effective.physicsMaterials || {};
  const world = getEngineWorld(engine);
  const dice = typeof world?.getDice === 'function' ? world.getDice() : [];
  for (const die of dice) {
    const body = die?.body;
    if (!body) continue;
    try {
      if (mats.mass != null && typeof body.setMass === 'function') body.setMass(mats.mass);
      if (mats.linearDamping != null && typeof body.setLinearDamping === 'function') body.setLinearDamping(mats.linearDamping);
      if (mats.angularDamping != null && typeof body.setAngularDamping === 'function') body.setAngularDamping(mats.angularDamping);
    } catch (_) { /* ignore */ }
  }
  const pw = world?.physicsWorld ?? null;
  if (pw && isPlainObject(mats.contactPairs)) {
    for (const [pair, settings] of Object.entries(mats.contactPairs)) {
      if (!isPlainObject(settings)) continue;
      const [a, b] = String(pair).split(':');
      if (!a || !b) continue;
      try {
        if (typeof pw.setContactMaterial === 'function') pw.setContactMaterial(a, b, settings);
        else {
          if (settings.friction != null && typeof pw.setFriction === 'function') pw.setFriction(a, b, settings.friction);
          if (settings.restitution != null && typeof pw.setRestitution === 'function') pw.setRestitution(a, b, settings.restitution);
        }
      } catch (_) { /* ignore */ }
    }
  }
}

/** @param {any} engine @param {Record<string, any>} effective */
function applySceneHot(engine, effective) {
  const world = getEngineWorld(engine);
  const renderer = world?.renderer ?? null;
  const scene = effective.scene || {};
  if (!renderer) return;
  try {
    if (scene.background != null && typeof renderer.setBackground === 'function') renderer.setBackground(scene.background);
    if (scene.deskColor != null && typeof renderer.setDeskColor === 'function') renderer.setDeskColor(scene.deskColor);
    if ((scene.spotlightIntensity != null || scene.castShadow != null) && typeof renderer.setLight === 'function') {
      renderer.setLight({
        intensity: scene.spotlightIntensity,
        castShadow: scene.castShadow
      });
    }
  } catch (_) { /* renderer may not support live updates */ }
}

/**
 * Apply hot/live-updatable changes to an existing engine/world.
 * @param {any} engine
 * @param {Record<string, any>} effective
 * @param {string[]} [sections]
 */
export function applyHotSettings(engine, effective, sections = SECTION_IDS.slice()) {
  const set = new Set(sections);
  if (set.has('camera')) applyCameraHot(engine, effective);
  if (set.has('lighting') || set.has('scene')) applyLightingHot(engine, effective);
  if (set.has('physicsWorld')) applyGravityHot(engine, effective);
  if (set.has('physicsSolver')) applySolverHot(engine, effective);
  if (set.has('physicsMaterials')) applyMaterialsHot(engine, effective);
  if (set.has('scene')) applySceneHot(engine, effective);
  // throwSpawn/determinism/appMode are consumed by app/engine request-time flows; no-op here.
}

/**
 * Attempt structural application via engine/world APIs. Returns { rebuilt, preserved }.
 * Rebuilds may clear dice depending on operation (engine/world semantics).
 *
 * @param {any} engine
 * @param {Record<string, any>} prevEffective
 * @param {Record<string, any>} nextEffective
 * @param {string[]} [sections]
 */
export function applyStructuralSettings(engine, prevEffective, nextEffective, sections = []) {
  const set = new Set(sections);
  let rebuilt = false;
  /** @type {string[]} */
  const preserved = ['settings'];
  const world = getEngineWorld(engine);

  if (set.has('enclosure')) {
    const prev = prevEffective.enclosure || {};
    const next = nextEffective.enclosure || {};
    if (next.type != null && next.type !== prev.type && typeof engine?.setEnclosure === 'function') {
      engine.setEnclosure(next.type);
      rebuilt = true;
    }
    if (next.scale != null && next.scale !== prev.scale && typeof engine?.setEnclosureScale === 'function') {
      engine.setEnclosureScale(next.scale);
      rebuilt = true;
    }
  }

  if (set.has('diceVisuals')) {
    const next = nextEffective.diceVisuals || {};
    const diceCfg = {};
    if (next.definition != null) diceCfg.definition = next.definition;
    if (next.count != null) diceCfg.count = next.count;
    if (next.style != null) diceCfg.style = next.style;
    if (Object.keys(diceCfg).length && typeof engine?.setDiceConfig === 'function') {
      // Count/definition/style updates are applied; geometry changes may require app-level respawn.
      try { engine.setDiceConfig(diceCfg); rebuilt = true; } catch (_) { /* ignore */ }
    }
  }

  if (set.has('physicsSolver') && !rebuilt) {
    // Loop/settle structural aspects already attempted as hot; no extra rebuild hook.
  }

  // State preservation: camera/light are typically preserved by renderer; dice may be cleared by enclosure changes.
  if (rebuilt) {
    try { applyCameraHot(engine, nextEffective); preserved.push('camera'); } catch (_) {}
    try { applyLightingHot(engine, nextEffective); preserved.push('lighting'); } catch (_) {}
  }

  return { rebuilt, preserved };
}

/**
 * Create a unified apply controller for a scene app.
 *
 * @param {{
 *   appId: string,
 *   engine?: any,
 *   getEngine?: () => any,
 *   appBundledSettings?: Record<string, any>|string|null,
 *   storage?: any,
 *   onApplied?: (info: any) => void,
 *   onRebuildRequired?: (info: any) => void|Promise<void>,
 * }} options
 */
export function createApplyController(options) {
  const appId = options.appId || 'default';
  const storage = options.storage ?? (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
  let appBundled = extractSettingsFromMaybeEnvelope(options.appBundledSettings || {});
  /** @type {Record<string, any>} */
  let perAppDefault = {};
  const loadedDefault = loadDefaultSettings(appId, { storage, deserialize: true });
  if (loadedDefault && typeof loadedDefault === 'object' && /** @type {any} */ (loadedDefault).ok) {
    perAppDefault = extractSettingsFromMaybeEnvelope(/** @type {any} */ (loadedDefault).envelope || {});
  } else {
    perAppDefault = extractSettingsFromMaybeEnvelope(loadedDefault);
  }
  /** @type {Record<string, any>} */
  let liveOverrides = {};
  let effective = resolveCanonicalLayers({ appBundled, perAppDefault, liveOverrides }).effective;

  const getEngine = () => (typeof options.getEngine === 'function' ? options.getEngine() : options.engine);

  function recompute() {
    const resolved = resolveCanonicalLayers({ appBundled, perAppDefault, liveOverrides });
    effective = resolved.effective;
    return resolved;
  }

  /** @param {Record<string, any>} patch @param {any} [meta] */
  async function applyPatchToLive(patch, meta = {}) {
    const normalized = normalizeSettings(patch || {});
    const validation = validateSettings(normalized, { allowUnknownSections: true });
    if (!validation.ok) {
      return { ok: false, errors: validation.errors, warnings: validation.warnings, action: 'none' };
    }

    const prev = cloneSettingsValue(effective);
    liveOverrides = mergeSettingsPatch(liveOverrides, normalized);
    const resolved = recompute();
    const classification = classifySettingsPatch(normalized, { previousEffective: prev, nextEffective: resolved.effective });
    const engine = getEngine();

    if (!engine) {
      const info = { ok: true, action: classification.action, sections: classification.sections, reasons: classification.reasons, effective: cloneSettingsValue(resolved.effective), rebuilt: false, noEngine: true };
      options.onApplied?.(info);
      return info;
    }

    if (classification.action === 'hot') {
      applyHotSettings(engine, resolved.effective, classification.sections.length ? classification.sections : SECTION_IDS.slice());
      const info = { ok: true, action: 'hot', sections: classification.sections, reasons: classification.reasons, effective: cloneSettingsValue(resolved.effective), rebuilt: false };
      options.onApplied?.(info);
      return info;
    }

    // Structural: try in-place structural ops, else require rebuild/reload callback.
    const structural = applyStructuralSettings(engine, prev, resolved.effective, classification.sections);
    if (!structural.rebuilt && typeof options.onRebuildRequired === 'function') {
      await options.onRebuildRequired({
        action: classification.action,
        sections: classification.sections,
        reasons: classification.reasons,
        effective: cloneSettingsValue(resolved.effective)
      });
      // After rebuild, caller should rebind engine; apply hot to be safe.
      const eng2 = getEngine();
      if (eng2) applyHotSettings(eng2, resolved.effective, SECTION_IDS.slice());
      const info = { ok: true, action: classification.action, sections: classification.sections, reasons: classification.reasons, effective: cloneSettingsValue(resolved.effective), rebuilt: true, delegated: true };
      options.onApplied?.(info);
      return info;
    }

    // Apply hot follow-ups for mixed changes.
    applyHotSettings(engine, resolved.effective, classification.sections.length ? classification.sections : SECTION_IDS.slice());
    const info = { ok: true, action: classification.action, sections: classification.sections, reasons: classification.reasons, effective: cloneSettingsValue(resolved.effective), rebuilt: structural.rebuilt, preserved: structural.preserved };
    options.onApplied?.(info);
    return info;
  }

  /** @param {any} settingsOrEnvelope */
  function setPerAppDefault(settingsOrEnvelope) {
    const settings = extractSettingsFromMaybeEnvelope(settingsOrEnvelope);
    perAppDefault = isPlainObject(settings) ? cloneSettingsValue(settings) : {};
    try { saveDefaultSettings(appId, /** @type {any} */ (createEnvelope(perAppDefault, { appId, kind: 'full' })), { storage }); } catch (_) {}
    return recompute();
  }

  function clearPerAppDefault() {
    perAppDefault = {};
    try { clearDefaultSettings(appId, { storage }); } catch (_) {}
    return recompute();
  }

  function reloadPerAppDefault() {
    const loaded = loadDefaultSettings(appId, { storage, deserialize: true });
    if (loaded && typeof loaded === 'object' && /** @type {any} */ (loaded).ok) {
      perAppDefault = extractSettingsFromMaybeEnvelope(/** @type {any} */ (loaded).envelope || {});
    } else {
      perAppDefault = {};
    }
    return recompute();
  }

  /** @param {any} next */
  function setAppBundledSettings(next) {
    appBundled = extractSettingsFromMaybeEnvelope(next);
    return recompute();
  }

  function init() {
    // Ensure §5.3 resolution on init: base -> bundled -> per-app default -> live overrides.
    reloadPerAppDefault();
    return recompute();
  }

  return {
    appId,
    init,
    recompute,
    getState: () => ({
      base: CANONICAL_BASE_DEFAULTS,
      appBundled: cloneSettingsValue(appBundled),
      perAppDefault: cloneSettingsValue(perAppDefault),
      liveOverrides: cloneSettingsValue(liveOverrides),
      belowLive: cloneSettingsValue(resolveCanonicalLayers({ appBundled, perAppDefault, liveOverrides }).belowLive),
      effective: cloneSettingsValue(effective)
    }),
    getEffective: () => cloneSettingsValue(effective),
    getLiveOverrides: () => cloneSettingsValue(liveOverrides),
    /** @param {Record<string, any>} next */
    setLiveOverrides: (next) => { liveOverrides = isPlainObject(next) ? cloneSettingsValue(next) : {}; return recompute(); },
    setAppBundledSettings,
    setPerAppDefault,
    clearPerAppDefault,
    reloadPerAppDefault,
    applyPatch: applyPatchToLive,
    /** @param {Record<string, any>} nextEffective @param {any} [meta] */
    applyEffective: async (nextEffective, meta = {}) => {
      const resolved = recompute();
      const patch = buildOverridesOnly(resolved.belowLive, nextEffective) || {};
      return applyPatchToLive(patch, meta);
    },
    exportOverridesOnly: () => buildOverridesOnly(recompute().belowLive, effective),
    exportEffectiveMinusBase: () => buildEffectiveMinusBase(effective, createDefaultCanonicalSettings()),
    /** @param {string[]} [sections] */
    applyHot: (sections) => applyHotSettings(getEngine(), recompute().effective, sections),
    /** @param {string[]} [sections] */
    applyStructural: (sections) => applyStructuralSettings(getEngine(), effective, recompute().effective, sections),
    /** @param {Record<string, any>} patch */
    classifyPatch: (patch) => classifySettingsPatch(patch)
  };
}

export default { createApplyController, classifySettingsPatch, resolveCanonicalLayers, applyHotSettings, applyStructuralSettings };
