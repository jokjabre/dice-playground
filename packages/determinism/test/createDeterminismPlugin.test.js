// @ts-nocheck
import { D6, FaceReader, createFaceMapping, isValidFaceMapping } from '@dice/dice';
import { quat } from '@dice/core';
import { describe, expect, it } from 'vitest';

import { createDeterminismPlugin } from '../src/index.js';
import { createFakeEngine, createFakeWorld } from './fakes.js';

describe('createDeterminismPlugin', () => {
  it('predicts and shifts for requested values', async () => {
    const world = createFakeWorld({ naturalValues: [6, 6] });
    const engine = createFakeEngine(world);
    const plugin = createDeterminismPlugin({ mode: 'predict-and-shift' });
    plugin.attach(engine);

    const result = await plugin.prepareRoll({
      dice: 2,
      values: [1, 2],
      seed: 'seed-1',
      vectors: [{ pos: { x: 0, y: 0, z: 200 } }]
    });

    expect(result.faceMappings).toHaveLength(2);
    expect(result.diagnostics.naturalValues).toEqual([6, 6]);
    expect(result.diagnostics.targetValues).toEqual([1, 2]);
    for (const mapping of result.faceMappings) {
      expect(isValidFaceMapping(D6, mapping)).toBe(true);
    }
    expect(FaceReader.getValue(D6, quat.identity(), result.faceMappings[0])).toBe(1);
    expect(FaceReader.getValue(D6, quat.identity(), result.faceMappings[1])).toBe(2);

    // The session received the throw plan inputs and was disposed.
    expect(world.sessions).toHaveLength(1);
    expect(world.sessions[0].request.seed).toBe('seed-1');
    expect(world.sessions[0].disposed).toBe(true);
    plugin.detach();
  });

  it('leaves the live world unchanged after prediction', async () => {
    const world = createFakeWorld({ naturalValues: [3, 3] });
    const before = JSON.stringify(world.liveDice);
    const plugin = createDeterminismPlugin({ mode: 'predict-and-shift' });
    plugin.attach(createFakeEngine(world));

    await plugin.prepareRoll({ dice: 2, values: [4, 5], seed: 'keep-me' });

    expect(JSON.stringify(world.liveDice)).toBe(before);
    expect(world.sessions).toHaveLength(1);
    expect(world.sessions[0].disposed).toBe(true);
    plugin.detach();
  });

  it('predict-only reports natural values without shifting', async () => {
    const world = createFakeWorld({ naturalValues: [2, 5] });
    const plugin = createDeterminismPlugin({ mode: 'predict-only' });
    plugin.attach(createFakeEngine(world));

    const result = await plugin.prepareRoll({ dice: 2, values: [6, 6] });

    expect(result.faceMappings).toEqual([]);
    expect(result.diagnostics.naturalValues).toEqual([2, 5]);
    expect(result.diagnostics.mode).toBe('predict-only');
    expect(result.diagnostics.targetValues).toEqual([6, 6]);
    expect(world.sessions[0].disposed).toBe(true);
    plugin.detach();
  });

  it('returns no mappings when no values are requested', async () => {
    const world = createFakeWorld({ naturalValues: [4, 4] });
    const plugin = createDeterminismPlugin({ mode: 'predict-and-shift' });
    plugin.attach(createFakeEngine(world));

    const result = await plugin.prepareRoll({ dice: 2 });

    expect(result.faceMappings).toEqual([]);
    expect(result.diagnostics.naturalValues).toEqual([4, 4]);
    expect(world.sessions[0].disposed).toBe(true);
    plugin.detach();
  });

  it('rejects invalid targets with a descriptive error', async () => {
    const world = createFakeWorld({ naturalValues: [6] });
    const plugin = createDeterminismPlugin({ mode: 'predict-and-shift' });
    plugin.attach(createFakeEngine(world));

    await expect(
      plugin.prepareRoll({ dice: 1, values: [9] })
    ).rejects.toThrow(/outside the die label range/);
    expect(world.sessions[0].disposed).toBe(true);
    plugin.detach();
  });

  it('uses the default identity mapping as the shift base', async () => {
    const world = createFakeWorld({ naturalValues: [6] });
    const plugin = createDeterminismPlugin({ mode: 'predict-and-shift' });
    plugin.attach(createFakeEngine(world));

    const result = await plugin.prepareRoll({ dice: 1, values: [6] });

    // Shifting 6 -> 6 keeps the identity mapping.
    expect(result.faceMappings[0]).toEqual(createFaceMapping(D6));
    plugin.detach();
  });
});
