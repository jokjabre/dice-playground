import { describe, expect, it } from 'vitest';

import { mergeConfig } from '../src/index.js';

describe('mergeConfig', () => {
  it('applies later layers with higher precedence', () => {
    const merged = mergeConfig(
      { gravity: 1, count: 3, label: 'default' },
      { gravity: 2 },
      { label: 'app' }
    );

    expect(merged).toEqual({ gravity: 2, count: 3, label: 'app' });
  });

  it('merges nested objects deeply', () => {
    const merged = mergeConfig(
      {
        physics: {
          gravity: { x: 0, y: 0, z: -2940 },
          friction: 0.4
        }
      },
      {
        physics: {
          gravity: { z: -980 },
          restitution: 0.2
        }
      }
    );

    expect(merged).toEqual({
      physics: {
        gravity: { x: 0, y: 0, z: -980 },
        friction: 0.4,
        restitution: 0.2
      }
    });
  });

  it('replaces arrays instead of concatenating them', () => {
    const merged = mergeConfig(
      { values: [1, 2, 3], keep: ['a'] },
      { values: [4], keep: ['b', 'c'] }
    );

    expect(merged.values).toEqual([4]);
    expect(merged.keep).toEqual(['b', 'c']);
  });

  it('does not mutate input layers', () => {
    const defaults = { nested: { value: 1 }, list: [1, 2] };
    const overrides = { nested: { value: 2 }, list: [3] };

    const merged = mergeConfig(defaults, overrides);
    merged.nested.value = 3;
    merged.list.push(4);

    expect(defaults).toEqual({ nested: { value: 1 }, list: [1, 2] });
    expect(overrides).toEqual({ nested: { value: 2 }, list: [3] });
  });

  it('ignores nullish and non-object layers', () => {
    const merged = mergeConfig(null, undefined, { value: 1 });

    expect(merged).toEqual({ value: 1 });
  });
});
