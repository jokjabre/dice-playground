// @ts-nocheck
import { describe, expect, it, vi } from 'vitest';

import {
  CANONICAL_BASE_DEFAULTS,
  buildOverridesOnly,
  classifySettingsPatch,
  createApplyController,
  createDefaultCanonicalSettings,
  createEnvelope,
  mergeSettingsPatch,
  resolveCanonicalLayers,
  saveDefaultSettings
} from '../src/index.js';

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(String(k), String(v)); }
  removeItem(k) { this.map.delete(String(k)); }
  clear() { this.map.clear(); }
  key(i) { return Array.from(this.map.keys())[i] ?? null; }
  get length() { return this.map.size; }
}

function createMockEngine() {
  const body = {
    setMass: vi.fn(),
    setLinearDamping: vi.fn(),
    setAngularDamping: vi.fn()
  };
  const physicsWorld = {
    setSolverIterations: vi.fn(),
    setContactMaterial: vi.fn(),
    setFriction: vi.fn(),
    setRestitution: vi.fn()
  };
  const world = {
    renderer: { setLight: vi.fn(), setBackground: vi.fn(), setDeskColor: vi.fn() },
    physicsWorld,
    getDice: () => [{ body }, { body }],
    setCamera: vi.fn(),
    setLight: vi.fn(),
    setGravity: vi.fn(),
    setSettleConfig: vi.fn(),
    setDiceConfig: vi.fn()
  };
  return {
    world,
    setCamera: vi.fn(),
    resetCamera: vi.fn(),
    setLight: vi.fn(),
    setGravity: vi.fn(),
    setEnclosure: vi.fn(),
    setEnclosureScale: vi.fn(),
    setDiceConfig: vi.fn(),
    setSettleConfig: vi.fn(),
    setLoopConfig: vi.fn(),
    __body: body,
    __physicsWorld: physicsWorld
  };
}

describe('Phase 3 classification', () => {
  it('classifies camera/light/gravity as hot', () => {
    expect(classifySettingsPatch({ camera: { distance: 1.2 } }).action).toBe('hot');
    expect(classifySettingsPatch({ lighting: { primary: { position: { x: 1 } } } }).action).toBe('hot');
    expect(classifySettingsPatch({ physicsWorld: { gravity: { x: 0, y: 0, z: -1000 } } }).action).toBe('hot');
  });

  it('classifies enclosure and structural dice changes as rebuild/reload', () => {
    expect(classifySettingsPatch({ enclosure: { type: 'sphere' } }).action).toBe('full-reload');
    expect(classifySettingsPatch({ diceVisuals: { definition: 'd8' } }).action).toBe('full-reload');
    expect(classifySettingsPatch({ diceVisuals: { count: 3 } }).action).toBe('full-reload');
  });

  it('classifies live dice visual tweaks as hot', () => {
    expect(classifySettingsPatch({ diceVisuals: { faceMapping: [1, 2, 3, 4, 5, 6] } }).action).toBe('hot');
  });

  it('escalates to most severe action in mixed patch', () => {
    expect(classifySettingsPatch({ camera: { distance: 2 }, enclosure: { scale: 1.5 } }).action).toBe('full-reload');
  });
});

describe('layer resolution (§5.3)', () => {
  it('resolves base -> app-bundled -> per-app default -> live overrides', () => {
    const storage = new MemoryStorage();
    const perApp = createEnvelope({ camera: { distance: 2 } }, { appId: 'demo' });
    saveDefaultSettings('demo', perApp, { storage });
    const resolved = resolveCanonicalLayers({
      baseDefaults: createDefaultCanonicalSettings(),
      appBundled: { camera: { distance: 1.5 }, scene: { shadows: false } },
      perAppDefault: perApp,
      liveOverrides: { camera: { fov: 30 } }
    });
    expect(resolved.effective.camera.distance).toBe(2);
    expect(resolved.effective.camera.fov).toBe(30);
    expect(resolved.effective.scene.shadows).toBe(false);
  });
});

describe('createApplyController hot apply and layering', () => {
  it('applies stored per-app default on init and hot-updates live changes immediately', async () => {
    const storage = new MemoryStorage();
    saveDefaultSettings('sandbox', createEnvelope({ camera: { distance: 1.7 } }, { appId: 'sandbox' }), { storage });
    const engine = createMockEngine();
    const controller = createApplyController({
      appId: 'sandbox',
      engine,
      storage,
      appBundledSettings: { camera: { distance: 1.0 }, physicsWorld: { gravity: { x: 0, y: 0, z: -2940 } } }
    });
    const initState = controller.init();
    expect(initState.effective.camera.distance).toBe(1.7);

    const result = await controller.applyPatch({ camera: { distance: 2.2 }, physicsWorld: { gravity: { x: 0, y: 0, z: -100 } } });
    expect(result.ok).toBe(true);
    expect(result.action).toBe('hot');
    expect(engine.setCamera).toHaveBeenCalled();
    expect(engine.setGravity).toHaveBeenCalledWith(0, 0, -100);
    expect(controller.getEffective().camera.distance).toBe(2.2);
  });

  it('applies live material/contact hot paths to world/physics where available', async () => {
    const engine = createMockEngine();
    const controller = createApplyController({ appId: 'lab', engine });
    controller.init();
    const result = await controller.applyPatch({
      physicsMaterials: {
        mass: 500,
        linearDamping: 0.2,
        contactPairs: { 'die:desk': { friction: 0.4, restitution: 0.2 } }
      }
    });
    expect(result.ok).toBe(true);
    expect(result.action).toBe('hot');
    expect(engine.__body.setMass).toHaveBeenCalledWith(500);
    expect(engine.__body.setLinearDamping).toHaveBeenCalledWith(0.2);
    expect(engine.__physicsWorld.setContactMaterial).toHaveBeenCalled();
  });

  it('handles structural enclosure changes via engine APIs (rebuild behavior)', async () => {
    const engine = createMockEngine();
    const controller = createApplyController({ appId: 'gallery', engine });
    controller.init();
    const result = await controller.applyPatch({ enclosure: { type: 'sphere', scale: 1.25 } });
    expect(result.ok).toBe(true);
    expect(['partial-rebuild', 'full-reload']).toContain(result.action);
    expect(engine.setEnclosure).toHaveBeenCalledWith('sphere');
    expect(engine.setEnclosureScale).toHaveBeenCalledWith(1.25);
  });

  it('delegates rebuild when structural apply cannot be completed in-place', async () => {
    const onRebuildRequired = vi.fn(async () => {});
    const controller = createApplyController({
      appId: 'demo',
      getEngine: () => null, // force delegated path for structural classification? engine missing -> no-engine path
      onRebuildRequired
    });
    // With no engine, apply returns ok/noEngine and does not delegate; use engine present but no structural ops for a fake section? easier: simulate full-reload by unknown structural patch through controller API by stubbing engine without methods
    const engine = {};
    const c2 = createApplyController({ appId: 'demo2', engine, onRebuildRequired });
    c2.init();
    const res = await c2.applyPatch({ enclosure: { type: 'cylinder' } });
    expect(res.action).toBe('full-reload');
    // applyStructuralSettings won't mark rebuilt because engine lacks setEnclosure, so controller should delegate
    expect(onRebuildRequired).toHaveBeenCalled();
    expect(res.delegated).toBe(true);
  });

  it('export modes exclude engine base and can produce overrides-only', async () => {
    const engine = createMockEngine();
    const controller = createApplyController({ appId: 'sandbox', engine, appBundledSettings: { camera: { distance: 1 } } });
    controller.init();
    await controller.applyPatch({ camera: { distance: 2 } });
    const overrides = controller.exportOverridesOnly();
    expect(overrides.camera.distance).toBe(2);
    const baked = controller.exportEffectiveMinusBase();
    expect(baked.camera?.distance).toBe(2);
    // engine base gravity remains default and should not be forced into export when unchanged from base except effective-minus-base diff logic
    expect(JSON.stringify(baked)).not.toContain('"engineBase"');
  });

  it('preserves layering when live override is reset', async () => {
    const storage = new MemoryStorage();
    saveDefaultSettings('x', createEnvelope({ camera: { distance: 3 } }, { appId: 'x' }), { storage });
    const engine = createMockEngine();
    const controller = createApplyController({ appId: 'x', engine, storage, appBundledSettings: { camera: { distance: 1 } } });
    controller.init();
    await controller.applyPatch({ camera: { distance: 5 } });
    expect(controller.getEffective().camera.distance).toBe(5);
    await controller.applyPatch({ camera: { distance: { $reset: true } } });
    expect(controller.getEffective().camera.distance).toBe(3); // falls back to per-app default
  });
});
