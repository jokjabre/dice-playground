// @ts-nocheck
import { createSeededRandom } from '@dice/core';
import { describe, expect, it } from 'vitest';

import { World } from '../src/index.js';
import { createFakeContainer, createFakeRenderer, metrics, wideMetrics } from './fakes.js';

/**
 * @param {any} [overrides]
 * @returns {Promise<World>}
 */
async function createHeadlessWorld(overrides = {}) {
  const world = new World({
    rng: createSeededRandom('world-test'),
    headless: true,
    container: null,
    ...overrides
  });
  await world.init({ ...metrics });
  return world;
}

/**
 * @param {number} count
 * @returns {any[]}
 */
function dropVectors(count) {
  const vectors = [];
  for (let i = 0; i < count; i += 1) {
    vectors.push({
      pos: { x: (i - count / 2) * 80, y: (i % 2 === 0 ? -60 : 60), z: 200 },
      velocity: { x: 120, y: 80, z: 0 },
      angle: { x: 0.2, y: -0.3, z: 0 },
      axis: { x: 0, y: 0, z: 1, a: 0.1 * i }
    });
  }
  return vectors;
}

describe('World headless rolls', () => {
  it('spawns one die, steps to settle, and reads values', async () => {
    const world = await createHeadlessWorld();

    world.spawnDice({ dice: 1, vectors: dropVectors(1) });
    expect(world.getDiceIds()).toHaveLength(1);

    let settled = false;
    for (let step = 0; step < 1200; step += 1) {
      world.step(1 / 60);
      if (world.areDiceSettled()) {
        settled = true;
        break;
      }
    }

    expect(settled).toBe(true);
    const values = world.getValues();
    expect(values).toHaveLength(1);
    expect(values[0]).toBeGreaterThanOrEqual(1);
    expect(values[0]).toBeLessThanOrEqual(6);
    expect(world.getDice()[0].value).toBe(values[0]);

    world.dispose();
  });

  it('spawns six dice and settles all of them', async () => {
    const world = await createHeadlessWorld();

    world.spawnDice({ dice: 6, vectors: dropVectors(6) });

    let steps = 0;
    while (!world.areDiceSettled() && steps < 1500) {
      world.step(1 / 60);
      steps += 1;
    }

    expect(world.areDiceSettled()).toBe(true);
    expect(world.getValues()).toHaveLength(6);
    for (const value of world.getValues()) {
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(6);
    }

    world.dispose();
  });

  it('exposes DiceEntity objects, not legacy meshes', async () => {
    const world = await createHeadlessWorld();

    world.spawnDice({ dice: 2, vectors: dropVectors(2) });
    const dice = world.getDice();

    expect(dice).toHaveLength(2);
    for (const die of dice) {
      expect(die.id).toMatch(/^die-\d+-\d+$/);
      expect(die.definition.id).toBe('d6');
      expect(die.body).not.toBeNull();
      expect(die.visual).toBeNull();
      expect(typeof die.value).toBe('number');
      expect('mesh' in die).toBe(false);
    }

    world.dispose();
  });

  it('produces repeatable throw plans for a fixed seed and records the seed', async () => {
    const world = await createHeadlessWorld();

    const first = world.createThrowPlan({ dice: 6, seed: 'fixed-seed' });
    const second = world.createThrowPlan({ dice: 6, seed: 'fixed-seed' });

    expect(first.seed).toBe('fixed-seed');
    expect(second.seed).toBe('fixed-seed');
    expect(first.dice).toBe(6);
    expect(first.vectors).toHaveLength(6);
    expect(first.vectors).toEqual(second.vectors);
    expect(first.spawnProfile.mode).toBe('box');

    // Explicit vectors bypass generation but stay in the plan.
    const explicit = world.createThrowPlan({
      dice: 1,
      vectors: dropVectors(1),
      seed: 'explicit'
    });
    expect(explicit.seed).toBe('explicit');
    expect(explicit.vectors).toHaveLength(1);

    world.dispose();
  });

  it('supports partial reroll keeping selected dice and stable ids', async () => {
    const world = await createHeadlessWorld();

    world.spawnDice({ dice: 5, vectors: dropVectors(5) });
    const initialIds = world.getDiceIds();
    expect(initialIds).toHaveLength(5);

    const kept = initialIds.slice(0, 2);
    world.setSelection(kept);
    expect(world.getSelection()).toEqual(kept);

    const keptDice = world.getDice().filter((die) => kept.includes(die.id));
    const keptValues = keptDice.map((die) => die.body.getPosition());

    world.spawnDice({
      dice: 5,
      keep: kept,
      vectors: dropVectors(3)
    });

    const nextIds = world.getDiceIds();
    expect(nextIds).toHaveLength(5);
    // Kept ids survive, removed ids are gone, replacements are new.
    for (const id of kept) {
      expect(nextIds).toContain(id);
    }
    for (const id of initialIds.slice(2)) {
      expect(nextIds).not.toContain(id);
    }
    const replacements = nextIds.filter((id) => !kept.includes(id));
    expect(replacements).toHaveLength(3);
    for (const id of replacements) {
      expect(initialIds).not.toContain(id);
    }

    // Kept dice retain their positions (they were not respawned).
    const stillKept = world.getDice().filter((die) => kept.includes(die.id));
    expect(stillKept).toHaveLength(2);
    stillKept.forEach((die, index) => {
      expect(die.body.getPosition()).toEqual(keptValues[index]);
    });

    world.dispose();
  });

  it('assigns unique stable ids that are never reused', async () => {
    const world = await createHeadlessWorld();
    const seen = new Set();

    for (let round = 0; round < 3; round += 1) {
      world.spawnDice({ dice: 2, vectors: dropVectors(2) });
      for (const id of world.getDiceIds()) {
        expect(seen.has(id)).toBe(false);
        seen.add(id);
      }
      world.clearDice();
    }

    world.dispose();
  });

  it('applies face mappings before a roll', async () => {
    const world = await createHeadlessWorld();

    world.spawnDice({
      dice: 1,
      vectors: dropVectors(1),
      faceMappings: [[6, 5, 4, 3, 2, 1]]
    });

    const die = world.getDice()[0];
    expect(die.faceMapping).toEqual([6, 5, 4, 3, 2, 1]);

    world.dispose();
  });
});

describe('World enclosure, resize, and disposal', () => {
  it('clears dice and rebuilds boundaries on enclosure switch', async () => {
    const world = await createHeadlessWorld();

    world.spawnDice({ dice: 2, vectors: dropVectors(2) });
    expect(world.getDiceIds()).toHaveLength(2);

    world.setEnclosure('cylinder');
    expect(world.getDiceIds()).toHaveLength(0);
    expect(world.enclosureId).toBe('cylinder');
    expect(world.getSpawnProfile().mode).toBe('cylinder');

    // The new enclosure actually contains dice.
    world.spawnDice({ dice: 1, vectors: dropVectors(1) });
    for (let step = 0; step < 240; step += 1) {
      world.step(1 / 60);
    }
    const position = world.getDice()[0].body.getPosition();
    expect(Math.hypot(position.x, position.y)).toBeLessThanOrEqual(300);

    world.setEnclosure('box');
    expect(world.getDiceIds()).toHaveLength(0);

    world.dispose();
  });

  it('updates metrics and enclosure on resize', async () => {
    const world = await createHeadlessWorld();

    const boxBodies =
      world.physicsWorld?.getBodies?.() ??
      // Fallback: the live enclosure tracks its own bodies.
      world.enclosure.physicsBodies;
    const wallBefore = boxBodies.find((body) => body.id.endsWith('barrier-right'));
    const wallXBefore = wallBefore ? wallBefore.getPosition().x : 465;

    const before = world.getMetrics();
    world.resize({ ...wideMetrics });

    const after = world.getMetrics();
    expect(after.sceneWidth).toBe(wideMetrics.sceneWidth);
    expect(after.scale).toBe(wideMetrics.scale);
    expect(after).not.toEqual(before);

    const wallAfter = world.enclosure.physicsBodies.find((body) =>
      body.id.endsWith('barrier-right')
    );
    expect(wallAfter.getPosition().x).toBeGreaterThan(wallXBefore);

    // Mutating a returned metrics object does not corrupt the world.
    after.sceneWidth = 9999;
    expect(world.getMetrics().sceneWidth).toBe(wideMetrics.sceneWidth);

    world.dispose();
  });

  it('removes bodies, visuals, and listeners on dispose, idempotently', async () => {
    const renderer = createFakeRenderer();
    const container = createFakeContainer();
    const world = new World({
      rng: createSeededRandom('dispose'),
      container,
      rendererFactory: async () => renderer
    });
    await world.init({ ...metrics });

    world.spawnDice({ dice: 3, vectors: dropVectors(3) });
    expect(world.getDiceIds()).toHaveLength(3);
    expect(renderer.calls.createDiceVisual).toHaveLength(3);
    expect(renderer.calls.createTableVisual).toHaveLength(1);

    world.dispose();

    expect(world.getDice()).toHaveLength(0);
    expect(renderer.calls.disposed).toBe(true);
    expect(() => world.dispose()).not.toThrow();
    expect(renderer.visuals).toHaveLength(0);
  });

  it('supports setGravity, applyImpulse, and jostle through the physics world', async () => {
    const world = await createHeadlessWorld();

    world.spawnDice({ dice: 2, vectors: dropVectors(2) });

    world.setGravity(0, 0, -1000);
    expect(world.getGravity()).toEqual({ x: 0, y: 0, z: -1000 });

    world.applyImpulse(world.getDiceIds(), { x: 600, y: 0, z: 0 });
    const first = world.getDice()[0].body.getVelocity();
    // Something must have moved; the impulse divides by mass in the backend.
    expect(Math.abs(first.x) > 0 || Math.abs(first.y) > 0).toBe(true);

    expect(() => world.jostle(500)).not.toThrow();
    expect(() => world.jostle(0)).toThrow(/positive/);

    world.dispose();
  });

  it('supports setDiceConfig, setSettleConfig, and camera passthrough', async () => {
    const renderer = createFakeRenderer();
    const container = createFakeContainer();
    const world = new World({
      rng: createSeededRandom('config'),
      container,
      rendererFactory: async () => renderer
    });
    await world.init({ ...metrics });

    world.setDiceConfig({ count: 4, definition: 'd6' });
    expect(world.getConfig().diceCount).toBe(4);
    expect(() => world.setDiceConfig({ definition: 'unknown-d20' })).toThrow(
      /Unknown die definition/
    );

    const settle = world.setSettleConfig({ velocityThreshold: 10, settleFrames: 2 });
    expect(settle.velocityThreshold).toBe(10);
    expect(world.getSettleConfig().settleFrames).toBe(2);

    world.setCamera({ distance: 2, near: 5, far: 2000 });
    expect(renderer.calls.camera.distance).toBe(2);
    world.resetCamera();
    expect(renderer.calls.cameraReset).toBe(true);

    world.dispose();
  });
});

describe('World custom enclosures, picking, and reset', () => {
  it('supports registerEnclosure and resetDice', async () => {
    const world = await createHeadlessWorld();
    const fakeEnclosure = {
      id: 'custom',
      type: 'custom',
      physicsBodies: [],
      createPhysics(physics) {
        this.physicsBodies = [];
      },
      createVisuals() {},
      update() {},
      dispose() {
        this.physicsBodies = [];
      }
    };
    world.registerEnclosure('custom', () => fakeEnclosure);
    world.setEnclosure('custom');
    expect(world.enclosureId).toBe('custom');
    world.setEnclosure('box');
    expect(world.enclosureId).toBe('box');

    world.spawnDice({ dice: 1, vectors: dropVectors(1) });
    world.getDice()[0].body.applyImpulse({ x: 1000, y: 0, z: 0 });
    world.resetDice();
    expect(world.getDice()[0].body.getVelocity()).toEqual({ x: 0, y: 0, z: 0 });
    world.dispose();
  });

  it('delegates pick to the renderer and returns null headlessly', async () => {
    const renderer = createFakeRenderer();
    const container = createFakeContainer();
    const world = new World({
      rng: createSeededRandom('pick'),
      container,
      rendererFactory: async () => renderer
    });
    await world.init({ ...metrics });
    world.spawnDice({ dice: 1, vectors: dropVectors(1) });
    expect(world.pick({ x: 0.5, y: -0.5 })).toBeNull();
    expect(renderer.calls.picked).toHaveLength(1);
    expect(renderer.calls.picked[0].candidates).toEqual(world.getDiceIds());
    world.dispose();

    const headless = await createHeadlessWorld();
    headless.spawnDice({ dice: 1, vectors: dropVectors(1) });
    expect(headless.pick({ x: 0, y: 0 })).toBeNull();
    headless.dispose();
  });
});

describe('World with a fake renderer', () => {
  it('records expected visual creation and removal', async () => {
    const renderer = createFakeRenderer();
    const container = createFakeContainer();
    const world = new World({
      rng: createSeededRandom('visuals'),
      container,
      rendererFactory: async () => renderer
    });
    await world.init({ ...metrics });

    world.spawnDice({
      dice: 2,
      vectors: dropVectors(2),
      faceMappings: [
        [1, 2, 3, 4, 5, 6],
        [6, 5, 4, 3, 2, 1]
      ]
    });

    expect(renderer.calls.createDiceVisual).toHaveLength(2);
    expect(renderer.calls.createDiceVisual[0].faceMapping).toEqual([1, 2, 3, 4, 5, 6]);
    expect(renderer.calls.createDiceVisual[1].faceMapping).toEqual([6, 5, 4, 3, 2, 1]);

    // Stepping syncs bodies to visuals.
    world.step(1 / 60);
    const dice = world.getDice();
    for (const die of dice) {
      expect(die.visual).not.toBeNull();
    }

    world.render();
    expect(renderer.calls.rendered).toBeGreaterThan(0);

    const idsBefore = world.getDiceIds();
    world.removeDice(idsBefore);
    expect(world.getDiceIds()).toHaveLength(0);
    expect(renderer.visuals.filter((v) => v.kind === 'dice')).toHaveLength(0);

    // Replacing factories with fakes keeps the world headless-friendly when
    // the renderer factory returns null.
    world.dispose();

    const headless = new World({
      rng: createSeededRandom('visuals-2'),
      headless: true,
      container: null,
      rendererFactory: async () => null
    });
    await headless.init({ ...metrics });
    expect(headless.renderer).toBeNull();
    headless.spawnDice({ dice: 1, vectors: dropVectors(1) });
    expect(headless.getDice()[0].visual).toBeNull();
    headless.dispose();
  });

  it('routes selection through the dice set and emits events', async () => {
    const { EventBus, EVENTS } = await import('@dice/core');
    const events = new EventBus();
    /** @type {any[]} */
    const selected = [];
    events.on(EVENTS.DIE_SELECT, (payload) => selected.push(payload));

    const world = await createHeadlessWorld({ events });
    world.spawnDice({ dice: 2, vectors: dropVectors(2) });
    const ids = world.getDiceIds();

    world.toggleSelection(ids[0]);
    expect(world.getSelection()).toEqual([ids[0]]);
    world.toggleSelection(ids[0]);
    expect(world.getSelection()).toEqual([]);

    world.setSelection([ids[1]]);
    expect(world.getSelection()).toEqual([ids[1]]);
    expect(selected.length).toBeGreaterThanOrEqual(3);

    world.dispose();
  });
});

describe('World prediction sessions', () => {
  it('is isolated and does not affect live dice', async () => {
    const world = await createHeadlessWorld();

    world.spawnDice({ dice: 2, vectors: dropVectors(2) });
    const liveBefore = world.getDice().map((die) => ({
      id: die.id,
      position: die.body.getPosition(),
      quaternion: die.body.getQuaternion()
    }));

    const session = world.createPredictionSession({
      vectors: dropVectors(2),
      seed: 'predict'
    });

    const result = session.stepUntilSettled({
      velocityThreshold: 6,
      settleFrames: 3,
      maxIterations: 1200,
      fixedStep: 1 / 60
    });

    expect(result.values).toHaveLength(2);
    expect(session.getValues()).toEqual(result.values);
    expect(session.dice).toHaveLength(2);

    session.dispose();
    expect(session.getValues()).toHaveLength(0);

    // Live dice are untouched by the session.
    const liveAfter = world.getDice().map((die) => ({
      id: die.id,
      position: die.body.getPosition()
    }));
    expect(liveAfter).toEqual(
      liveBefore.map(({ id, position }) => ({ id, position }))
    );

    world.dispose();
  });

  it('accepts diceStates for kept dice', async () => {
    const world = await createHeadlessWorld();

    world.spawnDice({ dice: 1, vectors: dropVectors(1) });
    const die = world.getDice()[0];

    const session = world.createPredictionSession({
      diceStates: [
        {
          position: die.body.getPosition(),
          quaternion: die.body.getQuaternion(),
          velocity: { x: 0, y: 0, z: 0 }
        }
      ]
    });

    expect(session.dice).toHaveLength(1);
    session.dispose();
    world.dispose();
  });
});

describe('World selection, roll, and imports', () => {
  it('supports world.roll for spawning with a plan and exposed result', async () => {
    const world = await createHeadlessWorld();

    const roll = world.roll({ dice: 3, seed: 'roll-seed' });
    expect(roll.seed).toBe('roll-seed');
    expect(roll.diceIds).toHaveLength(3);
    expect(world.getDiceIds()).toHaveLength(3);

    let steps = 0;
    while (!world.areDiceSettled() && steps < 1500) {
      world.step(1 / 60);
      steps += 1;
    }

    const result = world.getRollResult(roll.seed);
    expect(result.values).toHaveLength(3);
    expect(result.total).toBe(result.values.reduce((sum, v) => sum + v, 0));
    expect(result.seed).toBe('roll-seed');
    expect(result.dice).toHaveLength(3);

    world.reset();
    expect(world.getDiceIds()).toHaveLength(0);

    world.dispose();
  });

  it('is import-safe in Node without a DOM', async () => {
    const entry = await import('../src/index.js');
    expect(typeof entry.World).toBe('function');
    expect(typeof entry.DiceFactory).toBe('function');
    expect(typeof entry.DiceSet).toBe('function');
    expect(typeof entry.PredictionSession).toBe('function');
    expect(typeof globalThis.document).toBe('undefined');
  });
});
