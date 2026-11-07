// @ts-nocheck
import { D6, FaceReader, createFaceMapping, isValidFaceMapping } from '@dice/dice';
import { quat } from '@dice/core';
import { describe, expect, it } from 'vitest';

import { OutcomePredictor } from '../src/index.js';
import { createFakePredictionSession } from './fakes.js';

describe('OutcomePredictor', () => {
  it('predicts the settled values for a fixed step and settle config', () => {
    const session = createFakePredictionSession({ values: [4, 1, 6] });
    const predictor = new OutcomePredictor({ fixedStep: 1 / 60 });

    const natural = predictor.predictNaturalValues(session);

    expect(natural).toEqual([4, 1, 6]);
    expect(session.steps).toHaveLength(1);
    expect(session.steps[0].fixedStep).toBe(1 / 60);
    expect(session.disposed).toBe(false);
  });

  it('is repeatable for the same fixed seed and timestep', () => {
    const seedToValues = (seed) => {
      // Deterministic stand-in for a seeded simulation.
      let sum = 0;
      for (const char of String(seed)) sum += char.charCodeAt(0);
      const values = [];
      for (let i = 0; i < 3; i += 1) {
        values.push(((sum + i * 3) % 6) + 1);
      }
      return values;
    };

    const run = (seed) => {
      const session = createFakePredictionSession({
        values: seedToValues(seed)
      });
      return new OutcomePredictor({ fixedStep: 1 / 60 }).predictNaturalValues(session);
    };

    expect(run('fixed-seed')).toEqual(run('fixed-seed'));
    expect(run('fixed-seed')).toEqual(seedToValues('fixed-seed'));
  });

  it('disposes the session when asked and builds shifted mappings', () => {
    const session = createFakePredictionSession({ values: [6, 6, 6] });
    const predictor = new OutcomePredictor();

    const { naturalValues, faceMappings } = predictor.predictAndShift({
      session,
      definition: D6,
      targetValues: [1, 2, 3]
    });

    expect(naturalValues).toEqual([6, 6, 6]);
    expect(session.disposed).toBe(true);
    expect(faceMappings).toHaveLength(3);
    for (const mapping of faceMappings) {
      expect(isValidFaceMapping(D6, mapping)).toBe(true);
    }
    // Identity quaternion shows natural 6; first mapping targets 1.
    expect(
      FaceReader.getValue(D6, quat.identity(), faceMappings[0])
    ).toBe(1);
    expect(
      FaceReader.getValue(D6, quat.identity(), faceMappings[2])
    ).toBe(3);
  });
});
