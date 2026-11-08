import { describe, expect, it } from 'vitest';

import {
  GALLERY_CAMERA,
  GALLERY_ENCLOSURE_SCALES,
  GALLERY_ENCLOSURES,
  GALLERY_LIGHT,
  GRAVITY_PRESETS,
  galleryContent,
  getGalleryEnclosure,
  getGravityPreset,
  isGalleryEnclosure
} from '../src/content.js';

describe('gallery content', () => {
  it('lists box, sphere, and cylinder enclosures', () => {
    expect(GALLERY_ENCLOSURES.map((entry) => entry.id)).toEqual([
      'box',
      'sphere',
      'cylinder'
    ]);
    expect(isGalleryEnclosure('sphere')).toBe(true);
    expect(isGalleryEnclosure('unknown')).toBe(false);
    expect(getGalleryEnclosure('cylinder').label).toBe('Cylinder');
  });

  it('provides gravity presets around the world default', () => {
    expect(GRAVITY_PRESETS.map((preset) => preset.id)).toEqual([
      'down',
      'tilt-left',
      'tilt-right',
      'zero-g'
    ]);
    expect(getGravityPreset('down').gravity).toEqual({ x: 0, y: 0, z: -2940 });
    expect(() => getGravityPreset('sideways')).toThrow(/Unknown gravity preset/);
  });

  it('reuses the shared classic tray content pack', () => {
    expect(galleryContent.id).toBe('classic-tray');
    expect(galleryContent.enclosure.type).toBe('box');
    expect(galleryContent.physics.gravity).toEqual({ x: 0, y: 0, z: -2940 });
  });

  it('keeps camera slider limits sane', () => {
    expect(GALLERY_CAMERA.min).toBeLessThan(GALLERY_CAMERA.defaultDistance);
    expect(GALLERY_CAMERA.defaultDistance).toBeLessThan(GALLERY_CAMERA.max);
    expect(GALLERY_CAMERA.step).toBeGreaterThan(0);
  });

  it('keeps light slider limits sane around the default position', () => {
    const { x, y, z } = GALLERY_LIGHT.defaultPosition;
    for (const value of [x, y, z]) {
      expect(value).toBeGreaterThanOrEqual(GALLERY_LIGHT.min);
      expect(value).toBeLessThanOrEqual(GALLERY_LIGHT.max);
    }
    expect(GALLERY_LIGHT.step).toBeGreaterThan(0);
  });

  it('offers enclosure size presets relative to the default', () => {
    expect(GALLERY_ENCLOSURE_SCALES.map((preset) => preset.value)).toEqual([
      0.75,
      1,
      1.25,
      1.5,
      2
    ]);
    expect(
      GALLERY_ENCLOSURE_SCALES.some((preset) => preset.value === 1)
    ).toBe(true);
  });
});
