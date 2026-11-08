import { describe, expect, it } from 'vitest';

import {
  MAPPING_PRESETS,
  VISUAL_CHAMFER,
  assertChamfer,
  assertColor,
  buildStyleDescriptor,
  createVisualDefinition,
  defaultVisualSettings,
  getMappingPreset,
  mappingForPreset,
  previewStats,
  scaleMetrics
} from '../src/content.js';

describe('dice visual lab content', () => {
  it('lists mapping presets in a stable order', () => {
    expect(MAPPING_PRESETS.map((preset) => preset.id)).toEqual([
      'identity',
      'shift-1',
      'shift-2',
      'shift-3'
    ]);
    expect(getMappingPreset('shift-1').offset).toBe(1);
    expect(() => getMappingPreset('nope')).toThrow(/Unknown mapping preset/);
  });

  it('builds complete permutation mappings for every preset', () => {
    expect(mappingForPreset('identity')).toEqual([1, 2, 3, 4, 5, 6]);
    expect(mappingForPreset('shift-1')).toEqual([2, 3, 4, 5, 6, 1]);
    for (const preset of MAPPING_PRESETS) {
      expect([...mappingForPreset(preset.id)].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    }
  });

  it('validates chamfer and colors', () => {
    expect(assertChamfer(0.96)).toBe(0.96);
    expect(() => assertChamfer(0.1)).toThrow(RangeError);
    expect(() => assertChamfer(2)).toThrow(RangeError);
    expect(() => assertChamfer(Number.NaN)).toThrow(RangeError);
    expect(assertColor('#202020')).toBe('#202020');
    expect(() => assertColor('red')).toThrow(RangeError);
  });

  it('builds a style descriptor from settings', () => {
    const style = buildStyleDescriptor(defaultVisualSettings());
    expect(style.bodyColor).toBe('#202020');
    expect(style.labelColor).toBe('#aaaaaa');
    expect(style.material).toEqual({ shininess: 30, specular: 0x172022 });
    expect(style.textureSize).toBe(256);
  });

  it('clones the definition so chamfer tuning never mutates shared D6', () => {
    const definition = createVisualDefinition();
    expect(definition.id).toBe('d6');
    expect(definition.chamfer).toBe(VISUAL_CHAMFER.default);
    definition.chamfer = 0.5;
    expect(definition.chamfer).toBe(0.5);
  });

  it('computes preview stats from pure mesh data', () => {
    const definition = createVisualDefinition();
    const stats = previewStats(definition, 40);
    expect(stats.vertices).toBeGreaterThan(0);
    expect(stats.faces).toBeGreaterThan(0);
    expect(stats.chamferFaces).toBeGreaterThan(0);
    expect(stats.boundingRadius).toBe(40);
    expect(stats.collisionVertices).toBe(8);
  });

  it('scales metrics scale for radius changes only', () => {
    const scaled = scaleMetrics({ scale: 45, sceneWidth: 500 }, 2);
    expect(scaled.scale).toBe(90);
    expect(scaled.sceneWidth).toBe(500);
  });
});
