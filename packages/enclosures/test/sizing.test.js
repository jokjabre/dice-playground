import { describe, expect, it } from 'vitest';

import {
  computeBoxBounds,
  computeCylinderSize,
  computeDieRadius,
  computeSphereRadius,
  normalizeEnclosureScale
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
    expect(computeSphereRadius(metrics)).toBeCloseTo(450, 10);
    expect(
      computeSphereRadius({ sceneWidth: 2000, sceneHeight: 2000 })
    ).toBe(1800);
    expect(
      computeSphereRadius({ sceneWidth: 100, sceneHeight: 100 })
    ).toBe(400);
  });

  it('clamps the cylinder radius and height to a sensible range', () => {
    expect(computeCylinderSize(metrics)).toEqual({
      radius: 270,
      height: 600
    });

    expect(
      computeCylinderSize({ sceneWidth: 800, sceneHeight: 500 })
    ).toEqual({
      radius: 450,
      height: 900
    });

    expect(
      computeCylinderSize({ sceneWidth: 2000, sceneHeight: 2000 })
    ).toEqual({
      radius: 1800,
      height: 3200
    });

    expect(
      computeCylinderSize({ sceneWidth: 100, sceneHeight: 100 })
    ).toEqual({
      radius: 200,
      height: 600
    });
  });

  it('scales enclosure dimensions relative to their defaults', () => {
    expect(
      computeBoxBounds(metrics, { scale: 2 })
    ).toEqual({
      halfWidth: 930,
      halfHeight: 558,
      ceilingHeight: 5400,
      margin: 0.93
    });
    expect(computeSphereRadius(metrics, { scale: 1.5 })).toBeCloseTo(675, 10);
    expect(computeCylinderSize(metrics, { scale: 0.75 })).toEqual({
      radius: 202.5,
      height: 450
    });
  });

  it('normalizes invalid enclosure scale values to 1', () => {
    expect(normalizeEnclosureScale(2)).toBe(2);
    expect(normalizeEnclosureScale(0)).toBe(1);
    expect(normalizeEnclosureScale(-1)).toBe(1);
    expect(normalizeEnclosureScale(Number.NaN)).toBe(1);
    expect(normalizeEnclosureScale(undefined)).toBe(1);
    expect(normalizeEnclosureScale('2')).toBe(1);
  });
});
