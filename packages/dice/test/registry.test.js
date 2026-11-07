import { describe, expect, it } from 'vitest';

import { D6, DiceRegistry, createDiceRegistry } from '../src/index.js';

describe('DiceRegistry', () => {
  it('registers the built-in d6 definition', () => {
    const registry = createDiceRegistry();

    expect(registry.has('d6')).toBe(true);
    expect(registry.get('d6')).toBe(D6);
    expect(registry.list()).toEqual(['d6']);
  });

  it('registers custom definitions and rejects duplicates', () => {
    const registry = new DiceRegistry();
    const custom = {
      ...D6,
      id: 'd6-custom'
    };

    expect(registry.register(custom)).toBe(custom);
    expect(registry.list()).toEqual(['d6-custom']);
    expect(registry.has('d6')).toBe(false);

    expect(() => registry.register(custom)).toThrow(/already registered/);
  });

  it('rejects unknown ids', () => {
    const registry = createDiceRegistry();

    expect(() => registry.get('d20')).toThrow(/Unknown die definition: d20/);
    expect(registry.has('d20')).toBe(false);
  });

  it('validates definitions before registering them', () => {
    const registry = new DiceRegistry();

    expect(() => registry.register(/** @type {any} */ ({}))).toThrow(
      /id must be a non-empty string/
    );
    expect(() =>
      registry.register(/** @type {any} */ ({ ...D6, faceCount: 0 }))
    ).toThrow(/faceCount >= 1/);
    expect(() =>
      registry.register(/** @type {any} */ ({ ...D6, faces: [] }))
    ).toThrow(/exactly faceCount faces/);
    expect(() =>
      registry.register(/** @type {any} */ ({ ...D6, labelRange: [6, 1] }))
    ).toThrow(/invalid labelRange/);
  });
});
