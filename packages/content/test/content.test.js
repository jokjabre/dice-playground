// @ts-nocheck
import { describe, expect, it } from 'vitest';

import {
  BUILTIN_CONTENT_PACKS,
  DICE_STYLE_IDS,
  ENCLOSURE_PRESET_IDS,
  SCENARIOS,
  TABLE_PRESET_IDS,
  classicTray,
  createIdRegistry,
  defineContentPack,
  resolveContent,
  validateContentPack
} from '../src/index.js';

const registries = {
  diceRegistry: createIdRegistry({ ids: ['d6'] }),
  enclosureRegistry: createIdRegistry({ ids: ENCLOSURE_PRESET_IDS }),
  styleRegistry: createIdRegistry({ ids: DICE_STYLE_IDS })
};

describe('defineContentPack', () => {
  it('freezes a normalised copy without mutating the input', () => {
    const input = {
      id: 'my-pack',
      version: 1,
      dice: { definition: 'd6', count: 3 }
    };
    const pack = defineContentPack(input);

    expect(pack.id).toBe('my-pack');
    expect(pack).not.toBe(input);
    expect(Object.isFrozen(pack)).toBe(true);
    expect(Object.isFrozen(pack.dice)).toBe(true);
    expect(input.dice.count).toBe(3);
    expect(() => {
      pack.dice.count = 9;
    }).toThrow();
  });

  it('rejects packs without a usable id or version', () => {
    expect(() => defineContentPack({})).toThrow();
    expect(() => defineContentPack({ id: '' })).toThrow();
    expect(() => defineContentPack({ id: 'x', version: 0 })).toThrow();
    expect(() => defineContentPack(null)).toThrow();
  });
});

describe('validateContentPack', () => {
  it('accepts the built-in classic tray pack', () => {
    const result = validateContentPack(classicTray, registries);
    expect(result).toEqual({ ok: true, errors: [] });
  });

  it('rejects a missing id with its path', () => {
    const result = validateContentPack({ dice: { definition: 'd6' } }, registries);
    expect(result.ok).toBe(false);
    expect(result.errors.map((error) => error.path)).toContain('id');
  });

  it('rejects bad enclosure types', () => {
    const result = validateContentPack(
      { id: 'x', enclosure: { type: 'pyramid' } },
      registries
    );
    expect(result.ok).toBe(false);
    expect(result.errors[0].path).toBe('enclosure.type');
    expect(result.errors[0].message).toContain('pyramid');
  });

  it('rejects unknown dice definitions and styles', () => {
    const diceResult = validateContentPack(
      { id: 'x', dice: { definition: 'd20', count: 2 } },
      registries
    );
    expect(diceResult.errors.map((error) => error.path)).toContain(
      'dice.definition'
    );

    const styleResult = validateContentPack(
      { id: 'x', dice: { definition: 'd6', style: 'gold' } },
      registries
    );
    expect(styleResult.errors.map((error) => error.path)).toContain('dice.style');
  });

  it('rejects invalid dice counts with the documented message shape', () => {
    for (const count of [0, -1, 1.5, 'six']) {
      const result = validateContentPack(
        { id: 'x', dice: { definition: 'd6', count } },
        registries
      );
      expect(result.ok).toBe(false);
      expect(result.errors[0]).toEqual({
        path: 'dice.count',
        message: 'dice.count must be >= 1.'
      });
    }
  });

  it('rejects bad gravity, camera, and scenario values', () => {
    const gravity = validateContentPack(
      { id: 'x', physics: { gravity: { x: 0, y: 0 } } },
      registries
    );
    expect(gravity.errors[0].path).toBe('physics.gravity');

    const camera = validateContentPack(
      { id: 'x', camera: { distance: -1 } },
      registries
    );
    expect(camera.errors[0].path).toBe('camera.distance');

    const scenario = validateContentPack(
      { id: 'x', scenarios: { wild: { dice: 0, values: [] } } },
      registries
    );
    expect(scenario.errors.map((error) => error.path)).toContain(
      'scenarios.wild.dice'
    );
    expect(scenario.errors.map((error) => error.path)).toContain(
      'scenarios.wild.values'
    );
  });

  it('skips registry checks when no registries are supplied', () => {
    const result = validateContentPack({
      id: 'x',
      enclosure: { type: 'anything' },
      dice: { definition: 'anything', count: 2 }
    });
    expect(result.ok).toBe(true);
  });
});

describe('resolveContent', () => {
  it('merges defaults < pack < app overrides', () => {
    const resolved = resolveContent(
      {
        id: 'layered',
        dice: { definition: 'd6', count: 4 },
        enclosure: { type: 'sphere' }
      },
      {
        ...registries,
        appOverrides: { dice: { count: 2 }, camera: { distance: 2 } }
      }
    );

    expect(resolved.id).toBe('layered');
    expect(resolved.dice.count).toBe(2);
    expect(resolved.dice.definition).toBe('d6');
    expect(resolved.dice.style).toBe('classic');
    expect(resolved.enclosure).toEqual({ type: 'sphere', id: 'sphere' });
    expect(resolved.camera.distance).toBe(2);
    expect(resolved.physics.gravity).toEqual({ x: 0, y: 0, z: -2940 });
  });

  it('fills defaults for a minimal pack', () => {
    const resolved = resolveContent({ id: 'minimal' }, registries);
    expect(resolved.dice).toEqual({
      definition: 'd6',
      count: 6,
      style: 'classic'
    });
    expect(resolved.enclosure.type).toBe('box');
  });

  it('throws a path-bearing error for unknown ids', () => {
    expect(() =>
      resolveContent({ id: 'x', dice: { definition: 'd20' } }, registries)
    ).toThrow(/dice\.definition/);
    expect(() =>
      resolveContent({ id: 'x', enclosure: { type: 'pyramid' } }, registries)
    ).toThrow(/enclosure\.type/);
  });

  it('accepts array-shaped registries', () => {
    const resolved = resolveContent(
      { id: 'arrays', enclosure: { type: 'cylinder' } },
      {
        diceRegistry: ['d6'],
        enclosureRegistry: ['box', 'sphere', 'cylinder'],
        styleRegistry: DICE_STYLE_IDS
      }
    );
    expect(resolved.enclosure.id).toBe('cylinder');
  });
});

describe('presets', () => {
  it('are JSON-serializable and frozen', () => {
    for (const pack of Object.values(BUILTIN_CONTENT_PACKS)) {
      expect(JSON.parse(JSON.stringify(pack))).toEqual(pack);
      expect(Object.isFrozen(pack)).toBe(true);
    }
    expect(Object.isFrozen(SCENARIOS)).toBe(true);
    expect(Object.isFrozen(TABLE_PRESET_IDS)).toBe(true);
  });

  it('covers box, sphere, and cylinder and classic and dark styles', () => {
    expect(ENCLOSURE_PRESET_IDS).toEqual(['box', 'sphere', 'cylinder']);
    expect(DICE_STYLE_IDS).toContain('classic');
    expect(DICE_STYLE_IDS).toContain('dark');
    expect(classicTray.enclosure.type).toBe('box');
    expect(classicTray.dice).toEqual({
      definition: 'd6',
      count: 6,
      style: 'classic'
    });
    expect(classicTray.scenarios.predeterminedSix.values).toEqual([6, 6, 6, 6, 6, 6]);
  });
});
