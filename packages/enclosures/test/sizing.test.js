import { describe, expect, it } from 'vitest';

import {
  computeBoxBounds,
  computeCylinderSize,
  computeDieRadius,
  computeSphereRadius
} from '../src/index.js';

const metrics = {
  containerWidth: 1000,
  containerHeight: 600,
  sceneWidth: 500,
  sceneHeight: 300,
  scale: 45,
  aspect: 1,
  wallHeight: 1000,
  pixelRatio: 1
};

describe('enclosure sizing', () => {
  it('derives the die radius from the shared viewport scale', () => {
    expect(computeDieRadius(metrics)).toBeCloseTo(40.5, 10);
    expect(computeDieRadius({ scale: 1 })).toBe(10);
    expect(computeDieRadius()).toBeCloseTo(40.5, 10);
  });

  it('computes box half extents and ceiling height', () => {
    expect(computeBoxBounds(metrics)).toEqual({
      halfWidth: 465,
      halfHeight: 279,
      ceilingHeight: 2700,
      margin: 0.93
    });

    expect(
      computeBoxBounds(metrics, { margin: 0.5, ceilingHeight: 1200 })
    ).toEqual({
      halfWidth: 250,
      halfHeight: 150,
      ceilingHeight: 1200,
      margin: 0.5
    });
  });

  it('clamps the sphere radius to a sensible range', () => {
    expect(computeSphereRadius(metrics)).toBeCloseTo(405, 10);
    expect(
      computeSphereRadius({ sceneWidth: 2000, sceneHeight: 2000 })
    ).toBe(1800);
    expect(
      computeSphereRadius({ sceneWidth: 100, sceneHeight: 100 })
    ).toBe(400);
  });

  it('clamps the cylinder radius and height to a sensible range', () => {
    expect(computeCylinderSize(metrics)).toEqual({
      radius: 200,
      height: 600
    });

    expect(
      computeCylinderSize({ sceneWidth: 800, sceneHeight: 500 })
    ).toEqual({
      radius: 225,
      height: 700
    });

    expect(
      computeCylinderSize({ sceneWidth: 2000, sceneHeight: 2000 })
    ).toEqual({
      radius: 900,
      height: 1600
    });

    expect(
      computeCylinderSize({ sceneWidth: 100, sceneHeight: 100 })
    ).toEqual({
      radius: 200,
      height: 600
    });
  });
});
