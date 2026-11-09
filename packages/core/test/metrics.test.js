import { describe, expect, it } from 'vitest';

import { computeViewportMetrics } from '../src/index.js';

describe('computeViewportMetrics', () => {
  it('computes scale, aspect, wall height, and pixel ratio', () => {
    const metrics = computeViewportMetrics({
      containerWidth: 1000,
      containerHeight: 500,
      sceneWidth: 500,
      sceneHeight: 250,
      devicePixelRatio: 2
    });

    expect(metrics.containerWidth).toBe(1000);
    expect(metrics.containerHeight).toBe(500);
    expect(metrics.sceneWidth).toBe(500);
    expect(metrics.sceneHeight).toBe(250);
    expect(metrics.aspect).toBe(2);
    expect(metrics.scale).toBeCloseTo(Math.sqrt(312500) / 13, 10);
    expect(metrics.wallHeight).toBeCloseTo(
      250 / Math.tan((10 * Math.PI) / 180),
      10
    );
    expect(metrics.pixelRatio).toBe(2);
    expect(Object.keys(metrics).sort()).toEqual([
      'aspect',
      'containerHeight',
      'containerWidth',
      'pixelRatio',
      'scale',
      'sceneHeight',
      'sceneWidth',
      'wallHeight'
    ]);
  });

  it('defaults scene dimensions to the container and pixel ratio to one', () => {
    const metrics = computeViewportMetrics({
      containerWidth: 800,
      containerHeight: 400
    });

    expect(metrics.sceneWidth).toBe(800);
    expect(metrics.sceneHeight).toBe(400);
    expect(metrics.aspect).toBe(1);
    expect(metrics.pixelRatio).toBe(1);
  });

  it('uses the limiting aspect ratio when the scene is not proportional', () => {
    const wide = computeViewportMetrics({
      containerWidth: 1000,
      containerHeight: 500,
      sceneWidth: 1000,
      sceneHeight: 1000
    });
    const tall = computeViewportMetrics({
      containerWidth: 1000,
      containerHeight: 500,
      sceneWidth: 500,
      sceneHeight: 1000
    });

    expect(wide.aspect).toBeCloseTo(0.5);
    expect(tall.aspect).toBeCloseTo(0.5);
  });

  it('rejects non-positive dimensions', () => {
    expect(() =>
      computeViewportMetrics({ containerWidth: 0, containerHeight: 100 })
    ).toThrow(RangeError);
    expect(() =>
      computeViewportMetrics({
        containerWidth: 100,
        containerHeight: 100,
        sceneWidth: -1
      })
    ).toThrow(RangeError);
  });
});
