import { describe, expect, it } from 'vitest';

import {
  CANONICAL_BASE_DEFAULTS,
  applyPatch,
  applyPatchWithFallback,
  buildEffectiveMinusBase,
  buildOverridesOnly,
  createDefaultCanonicalSettings,
  createEnvelope,
  deserializeEnvelope,
  diffOverrides,
  extractApplicableSections,
  extractSection,
  loadDefaultSettings,
  mergeSettingsPatch,
  resolveLayers,
  saveDefaultSettings,
  clearDefaultSettings,
  serializeEnvelope,
  storageKeyForApp,
  getCanonicalBaseDefaults
} from '../src/index.js';

class MemoryStorage {
  constructor() { /** @type {Map<string,string>} */ (this.map = new Map()); }
  /** @param {string} k */ getItem(k) { return this.map.has(k) ? (this.map.get(k) ?? null) : null; }
  /** @param {string} k @param {string} v */ setItem(k, v) { this.map.set(String(k), String(v)); }
  /** @param {string} k */ removeItem(k) { this.map.delete(String(k)); }
  clear() { this.map.clear(); }
  /** @param {number} index */ key(index) { return Array.from(this.map.keys())[index] ?? null; }
  get length() { return this.map.size; }
}

describe('Phase 1 canonical schema/defaults', () => {
  it('provides non-exported-in-files base defaults catalog and clone factory', () => {
    const a = createDefaultCanonicalSettings();
    const b = getCanonicalBaseDefaults();
    expect(a.physicsWorld.gravity.z).toBe(-2940);
    expect(b.physicsWorld.gravity.z).toBe(-2940);
    a.physicsWorld.gravity.z = -1;
    expect(CANONICAL_BASE_DEFAULTS.physicsWorld.gravity.z).toBe(-2940);
    expect(createDefaultCanonicalSettings().physicsWorld.gravity.z).toBe(-2940);
  });
});

describe('merge/reset/layering', () => {
  it('omit means no change', () => {
    const base = { camera: { distance: 1, fov: 20 }, lighting: { x: 1 } };
    const patch = { camera: { distance: 2 } };
    const merged = mergeSettingsPatch(base, patch);
    expect(merged).toEqual({ camera: { distance: 2, fov: 20 }, lighting: { x: 1 } });
  });

  it('explicit reset marker clears override at path', () => {
    const base = { camera: { distance: 1, near: 1 }, light: { x: 1 } };
    const patch = { camera: { near: { $reset: true } }, light: { $reset: true } };
    expect(mergeSettingsPatch(base, patch)).toEqual({ camera: { distance: 1 } });
  });

  it('reset with fallback restores lower-layer/base value at path', () => {
    const fallback = { camera: { distance: 1, near: 5 }, scene: { shadows: true } };
    const patch = { camera: { near: { $reset: true }, distance: 2 }, scene: { $reset: true } };
    const resolved = applyPatchWithFallback(fallback, patch);
    expect(resolved.camera).toEqual({ distance: 2, near: 5 });
    expect(resolved.scene).toEqual({ shadows: true });
  });

  it('arrays replace-at-node by default', () => {
    const base = { determinism: { requestedValues: [1, 2, 3] } };
    const patch = { determinism: { requestedValues: [6] } };
    expect(applyPatch(base, patch)).toEqual({ determinism: { requestedValues: [6] } });
  });

  it('resolves layered precedence low->high', () => {
    const base = { a: { x: 1, y: 1 }, b: 1 };
    const bundled = { a: { y: 2 } };
    const perApp = { b: 2 };
    const live = { a: { x: 3 } };
    expect(resolveLayers(base, bundled, perApp, live)).toEqual({ a: { x: 3, y: 2 }, b: 2 });
  });
});

describe('diff and export modes', () => {
  it('builds overrides-only relative to resolved-below state', () => {
    const below = { camera: { distance: 1, fov: 20 }, scene: { shadows: true } };
    const live = { camera: { distance: 2, fov: 20 }, scene: { shadows: true }, lighting: { x: 1 } };
    expect(buildOverridesOnly(below, live)).toEqual({ camera: { distance: 2 }, lighting: { x: 1 } });
  });

  it('builds effective minus engine base (excludes engine base)', () => {
    const engineBase = createDefaultCanonicalSettings();
    const effective = createDefaultCanonicalSettings();
    effective.camera.distance = 1.5;
    effective.physicsWorld.gravity.z = -2940;
    effective.scene.background = 0x000000;
    const snapshot = buildEffectiveMinusBase(effective, engineBase);
    expect(snapshot.camera).toEqual({ distance: 1.5 });
    expect(snapshot.scene).toEqual({ background: 0x000000 });
    expect(snapshot.physicsWorld).toBeUndefined();
  });

  it('diff emits reset when key removed relative to base', () => {
    const base = { a: { x: 1, y: 1 } };
    const target = { a: { x: 1 } };
    expect(diffOverrides(base, target)).toEqual({ a: { y: { $reset: true } } });
  });
});

describe('section extraction', () => {
  it('extracts one or many sections', () => {
    const settings = { camera: { distance: 1 }, lighting: { x: 2 }, unknown: 1 };
    expect(extractSection(settings, 'camera')).toEqual({ camera: { distance: 1 } });
    expect(extractSection(settings, ['camera', 'lighting'])).toEqual({ camera: { distance: 1 }, lighting: { x: 2 } });
  });

  it('extracts applicable sections and reports ignored keys', () => {
    const result = extractApplicableSections({ camera: { d: 1 }, nope: true }, { sectionIds: ['camera', 'lighting'] });
    expect(result.extracted).toEqual({ camera: { d: 1 } });
    expect(result.ignoredKeys).toEqual(['nope']);
  });
});

describe('serialization/deserialization and envelope', () => {
  it('round-trips envelope JSON', () => {
    const env = createEnvelope({ camera: { distance: 2 } }, { kind: 'section', appId: 'sandbox', sectionId: 'camera', meta: { name: 'cam' } });
    const json = serializeEnvelope(env, { pretty: 2 });
    const parsed = deserializeEnvelope(json);
    expect(parsed.ok).toBe(true);
    expect(parsed.envelope?.settings.camera.distance).toBe(2);
    expect(parsed.envelope?.appId).toBe('sandbox');
  });

  it('rejects invalid format/version', () => {
    expect(deserializeEnvelope({ format: 'nope', schemaVersion: 1, settings: {} }).ok).toBe(false);
    expect(deserializeEnvelope({ format: 'dice-settings', schemaVersion: 99, settings: {} }).ok).toBe(false);
  });
});

describe('per-app default persistence in browser storage', () => {
  it('save/load/clear via storage API', () => {
    const storage = /** @type {any} */ (new MemoryStorage());
    const key = storageKeyForApp('sandbox');
    expect(loadDefaultSettings('sandbox', { storage })).toBeNull();

    const env = createEnvelope({ camera: { distance: 3 } }, { appId: 'sandbox', kind: 'full' });
    const saveRes = saveDefaultSettings('sandbox', env, { storage });
    expect(saveRes.ok).toBe(true);
    expect(storage.getItem(key)).toContain('distance');

    const raw = loadDefaultSettings('sandbox', { storage });
    expect(typeof raw).toBe('string');
    const parsed = /** @type {any} */ (loadDefaultSettings('sandbox', { storage, deserialize: true }));
    expect(parsed.ok).toBe(true);
    expect(parsed.envelope.settings.camera.distance).toBe(3);

    const clearRes = clearDefaultSettings('sandbox', { storage });
    expect(clearRes.ok).toBe(true);
    expect(loadDefaultSettings('sandbox', { storage })).toBeNull();
  });

  it('handles unavailable storage gracefully', () => {
    expect(saveDefaultSettings('x', {}, { storage: null }).ok).toBe(false);
    expect(clearDefaultSettings('x', { storage: null }).ok).toBe(false);
    expect(loadDefaultSettings('x', { storage: null })).toBeNull();
  });
});
