// @ts-nocheck
/**
 * Fake world and prediction session for determinism tests. The session owns
 * an independent values array; the live world tracks its own dice and fails
 * the test if prediction mutates them.
 */

/**
 * @param {{ values?: number[], onStep?: Function }} [options]
 * @returns {any}
 */
export function createFakePredictionSession(options = {}) {
  const values = options.values ? [...options.values] : [3, 2, 5];
  const session = {
    values,
    steps: [],
    disposed: false,
    stepUntilSettled(settle) {
      session.steps.push(settle ?? {});
      options.onStep?.(settle);
    },
    getValues() {
      return [...values];
    },
    dispose() {
      session.disposed = true;
    }
  };
  return session;
}

/**
 * @param {{ naturalValues?: number[] }} [options]
 * @returns {any}
 */
export function createFakeWorld(options = {}) {
  const naturalValues = options.naturalValues ?? [3, 2, 5];
  const liveDice = [
    { id: 'die-live-1', position: { x: 1, y: 2, z: 3 } },
    { id: 'die-live-2', position: { x: 4, y: 5, z: 6 } }
  ];
  const world = {
    liveDice,
    sessions: [],
    createPredictionSession(args) {
      const session = createFakePredictionSession({ values: naturalValues });
      session.request = args;
      world.sessions.push(session);
      return session;
    }
  };
  return world;
}

/**
 * @param {any} world
 * @returns {any}
 */
export function createFakeEngine(world) {
  return { world };
}
