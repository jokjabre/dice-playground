import { describe, expect, it } from 'vitest';

import {
  DEFAULT_DICE_STYLE,
  DICE_STYLES,
  getDiceStyle
} from '../src/index.js';

describe('dice styles', () => {
  it('exposes serializable classic and dark descriptors', () => {
    expect(Object.keys(DICE_STYLES)).toEqual(['classic', 'dark']);

    for (const style of Object.values(DICE_STYLES)) {
      expect(typeof style.bodyColor).toBe('string');
      expect(typeof style.labelColor).toBe('string');
      expect(typeof style.fontFamily).toBe('string');
      expect(typeof style.material.shininess).toBe('number');
      expect(typeof style.material.specular).toBe('number');
      expect(typeof style.textureSize).toBe('number');
      expect(structuredClone(style)).toEqual(style);
    }
  });

  it('resolves styles by id and defaults to classic', () => {
    expect(getDiceStyle()).toBe(DEFAULT_DICE_STYLE);
    expect(getDiceStyle('classic')).toBe(DICE_STYLES.classic);
    expect(getDiceStyle('dark')).toBe(DICE_STYLES.dark);
  });

  it('rejects unknown style ids', () => {
    expect(() => getDiceStyle('neon')).toThrow(/Unknown dice style: neon/);
  });
});
