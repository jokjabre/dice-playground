/**
 * @typedef {Object} SpawnProfile
 * @property {string} mode 'box' | 'sphere' | 'cylinder' or a custom enclosure id.
 * @property {number} radius Current enclosure radius used by enclosed spawns.
 * @property {number} dieInertia Rotational inertia used for throw angles.
 */

/**
 * @type {Readonly<SpawnProfile>}
 */
export const DEFAULT_SPAWN_PROFILE = Object.freeze({
  mode: 'box',
  radius: 700,
  dieInertia: 13
});

/**
 * @type {Readonly<SpawnProfile>}
 */
export const spawnProfile = DEFAULT_SPAWN_PROFILE;

/**
 * Create a spawn profile for the active enclosure.
 *
 * @param {Partial<SpawnProfile>|null|undefined} [overrides]
 * @returns {SpawnProfile}
 */
export function createSpawnProfile(overrides = {}) {
  return {
    mode: typeof overrides?.mode === 'string' ? overrides.mode : 'box',
    radius:
      typeof overrides?.radius === 'number' && overrides.radius > 0
        ? overrides.radius
        : 700,
    dieInertia:
      typeof overrides?.dieInertia === 'number' && overrides.dieInertia > 0
        ? overrides.dieInertia
        : 13
  };
}

/**
 * @param {any} rng A RandomSource-like object with next(), or a legacy-style rnd source.
 * @returns {number}
 */
function nextRandom(rng) {
  if (!rng) return Math.random();
  if (typeof rng.next === 'function') return rng.next();
  if (typeof rng.rnd === 'function') return rng.rnd();
  return Math.random();
}

/**
 * @param {Record<string, any>|null} metrics
 * @returns {{ sceneWidth: number, sceneHeight: number }}
 */
function sceneSize(metrics) {
  const sceneWidth = metrics?.sceneWidth ?? metrics?.scene_width;
  const sceneHeight = metrics?.sceneHeight ?? metrics?.scene_height;
  return {
    sceneWidth:
      typeof sceneWidth === 'number' && sceneWidth > 0 ? sceneWidth : 500,
    sceneHeight:
      typeof sceneHeight === 'number' && sceneHeight > 0 ? sceneHeight : 300
  };
}

/**
 * Rotate a direction by a small random angle, matching the legacy random
 * vector jitter.
 *
 * @param {{ x: number, y: number }} direction
 * @param {any} rng
 * @returns {{ x: number, y: number }}
 */
export function randomizeDirection(direction, rng) {
  const randomAngle = (nextRandom(rng) * Math.PI) / 5 - Math.PI / 5 / 2;
  const vector = {
    x: direction.x * Math.cos(randomAngle) - direction.y * Math.sin(randomAngle),
    y: direction.x * Math.sin(randomAngle) + direction.y * Math.cos(randomAngle)
  };
  if (vector.x === 0) vector.x = 0.01;
  if (vector.y === 0) vector.y = 0.01;
  return vector;
}

/**
 * Compute a spawn position inside the active enclosure. Box keeps the legacy
 * tray behaviour (edges, above the desk); sphere/cylinder spawn near the
 * upper-inner region so dice drop in cleanly.
 *
 * @param {{ x: number, y: number }} direction
 * @param {any} rng
 * @param {Record<string, any>|null|undefined} metrics
 * @param {Partial<SpawnProfile>|null|undefined} profile
 * @returns {{ x: number, y: number, z: number }}
 */
export function spawnPosition(direction, rng, metrics, profile) {
  const { sceneWidth, sceneHeight } = sceneSize(metrics ?? null);
  const mode = profile?.mode ?? 'box';

  if (mode === 'box') {
    const pos = {
      x: sceneWidth * (direction.x > 0 ? -1 : 1) * 0.9,
      y: sceneHeight * (direction.y > 0 ? -1 : 1) * 0.9,
      z: nextRandom(rng) * 200 + 200
    };
    const projector = Math.abs(direction.x / direction.y);
    if (projector > 1) {
      pos.y /= projector;
    } else {
      pos.x *= projector;
    }
    return pos;
  }

  const radius = profile?.radius || 700;
  return {
    x: (nextRandom(rng) * 2 - 1) * radius * 0.28,
    y: (nextRandom(rng) * 2 - 1) * radius * 0.28,
    z: radius * 0.4 + nextRandom(rng) * radius * 0.25
  };
}

/**
 * Build one throw vector per die for a normalized swipe direction.
 *
 * @param {{ direction: { x: number, y: number }, boost: number, count: number, rng?: any, metrics?: Record<string, any>|null, spawnProfile?: Partial<SpawnProfile>|null, dieInertia?: number }} input
 * @returns {Array<{ pos: { x: number, y: number, z: number }, velocity: { x: number, y: number, z: number }, angle: { x: number, y: number, z: number }, axis: { x: number, y: number, z: number, a: number } }>}
 */
export function buildThrowVectors(input) {
  const count = Math.max(0, Math.floor(input.count));
  const dieInertia = input.dieInertia ?? 13;
  /** @type {ReturnType<typeof buildThrowVectors>} */
  const vectors = [];

  for (let i = 0; i < count; i += 1) {
    const vec = randomizeDirection(input.direction, input.rng);
    const pos = spawnPosition(
      vec,
      input.rng,
      input.metrics ?? null,
      input.spawnProfile ?? null
    );
    const velVec = randomizeDirection(input.direction, input.rng);
    vectors.push({
      pos,
      velocity: { x: velVec.x * input.boost, y: velVec.y * input.boost, z: -10 },
      angle: {
        x: -(nextRandom(input.rng) * vec.y * 5 + dieInertia * vec.y),
        y: nextRandom(input.rng) * vec.x * 5 + dieInertia * vec.x,
        z: 0
      },
      axis: {
        x: nextRandom(input.rng),
        y: nextRandom(input.rng),
        z: nextRandom(input.rng),
        a: nextRandom(input.rng)
      }
    });
  }

  return vectors;
}
