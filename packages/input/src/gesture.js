/**
 * @typedef {import('@dice/core').RandomSource} RandomSourceLike
 */

/**
 * @typedef {Object} Pointer2D
 * @property {number} x
 * @property {number} y
 */

/**
 * @typedef {Object} MetricsLike
 * @property {number} [sceneWidth]
 * @property {number} [sceneHeight]
 * @property {number} [scene_width]
 * @property {number} [scene_height]
 */

/**
 * @typedef {Object} RectLike
 * @property {number} left
 * @property {number} top
 * @property {number} width
 * @property {number} height
 */

/**
 * @typedef {Object} SpawnProfileLike
 * @property {string} [mode]
 * @property {number} [radius]
 */

/**
 * Read one random value from a {@link RandomSource} or a legacy-style
 * `rnd()` generator.
 *
 * @param {any} rng
 * @returns {number}
 */
function nextRandom(rng) {
  if (!rng) return Math.random();
  if (typeof rng.next === 'function') return rng.next();
  if (typeof rng.rnd === 'function') return rng.rnd();
  return Math.random();
}

/**
 * Extract client coordinates from a mouse or touch event.
 *
 * @param {any} event
 * @returns {Pointer2D}
 */
export function getPointerCoords(event) {
  if (event && event.changedTouches && event.changedTouches.length > 0) {
    const touch = event.changedTouches[0];
    return { x: touch.clientX, y: touch.clientY };
  }
  if (event && typeof event.clientX === 'number' && typeof event.clientY === 'number') {
    return { x: event.clientX, y: event.clientY };
  }
  return { x: 0, y: 0 };
}

/**
 * Compute the swipe vector from a start/end pair. Y is flipped so upward
 * screen movement is a positive scene Y, matching the legacy input mapping.
 *
 * @param {Pointer2D} start
 * @param {Pointer2D} end
 * @returns {Pointer2D}
 */
export function vectorFromDelta(start, end) {
  return {
    x: end.x - start.x,
    y: -(end.y - start.y)
  };
}

/**
 * Euclidean distance of a swipe vector.
 *
 * @param {Pointer2D} vector
 * @returns {number}
 */
export function gestureDistance(vector) {
  return Math.sqrt(vector.x * vector.x + vector.y * vector.y);
}

/**
 * @param {MetricsLike | null | undefined} metrics
 * @returns {{ sceneWidth: number, sceneHeight: number }}
 */
function sceneSize(metrics) {
  const fallback = { sceneWidth: 1000, sceneHeight: 600 };
  if (!metrics) return fallback;
  const sceneWidth = Number(
    metrics.sceneWidth ?? metrics.scene_width ?? fallback.sceneWidth
  );
  const sceneHeight = Number(
    metrics.sceneHeight ?? metrics.scene_height ?? fallback.sceneHeight
  );
  return {
    sceneWidth: Number.isFinite(sceneWidth) && sceneWidth > 0 ? sceneWidth : fallback.sceneWidth,
    sceneHeight: Number.isFinite(sceneHeight) && sceneHeight > 0 ? sceneHeight : fallback.sceneHeight
  };
}

/**
 * Minimum swipe distance that counts as a throw, matching the legacy
 * `sqrt(sceneWidth * sceneHeight * 0.01)` rule.
 *
 * @param {MetricsLike | null | undefined} metrics
 * @returns {number}
 */
export function minSwipeThreshold(metrics) {
  const { sceneWidth, sceneHeight } = sceneSize(metrics);
  return Math.sqrt(sceneWidth * sceneHeight * 0.01);
}

/**
 * Boost factor for a swipe. Matches the legacy curve: the interval is clamped
 * to 2000 ms and the boost grows with distance.
 *
 * @param {number} distance
 * @param {number} durationMs
 * @returns {number}
 */
export function gestureBoost(distance, durationMs) {
  const clamped = Math.max(0, Math.min(2000, durationMs));
  return Math.sqrt((2500 - clamped) / 2500) * distance * 2;
}

/**
 * Normalize a swipe vector. Returns `{ x: 0, y: 0 }` for a zero vector.
 *
 * @param {Pointer2D} vector
 * @returns {Pointer2D}
 */
export function normalizeVector(vector) {
  const distance = gestureDistance(vector);
  if (distance === 0) return { x: 0, y: 0 };
  return { x: vector.x / distance, y: vector.y / distance };
}

/**
 * Evaluate one pointer gesture without touching the DOM.
 *
 * @param {{ start: Pointer2D, end: Pointer2D, durationMs: number, metrics?: MetricsLike | null }} input
 * @returns {{ vector: Pointer2D, normalized: Pointer2D, distance: number, boost: number, isSwipe: boolean }}
 */
export function evaluateGesture(input) {
  const vector = vectorFromDelta(input.start, input.end);
  const distance = gestureDistance(vector);
  return {
    vector,
    normalized: normalizeVector(vector),
    distance,
    boost: gestureBoost(distance, input.durationMs),
    isSwipe: distance >= minSwipeThreshold(input.metrics ?? null)
  };
}

/**
 * Rotate a direction by a small random angle, matching the legacy random
 * vector jitter.
 *
 * @param {Pointer2D} direction
 * @param {any} rng
 * @returns {Pointer2D}
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
 * Compute a spawn position inside the active enclosure. Mirrors the legacy
 * spawn profile: box spawns near the tray edges, enclosed modes spawn near
 * the upper-inner region.
 *
 * @param {Pointer2D} direction
 * @param {any} rng
 * @param {MetricsLike | null | undefined} metrics
 * @param {SpawnProfileLike | null | undefined} spawnProfile
 * @returns {{ x: number, y: number, z: number }}
 */
export function spawnPosition(direction, rng, metrics, spawnProfile) {
  const { sceneWidth, sceneHeight } = sceneSize(metrics);
  if (!spawnProfile || spawnProfile.mode === 'box') {
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
  const radius = spawnProfile.radius || 700;
  return {
    x: (nextRandom(rng) * 2 - 1) * radius * 0.28,
    y: (nextRandom(rng) * 2 - 1) * radius * 0.28,
    z: radius * 0.4 + nextRandom(rng) * radius * 0.25
  };
}

/**
 * Build one throw vector per die for a normalized swipe direction.
 *
 * @param {{ direction: Pointer2D, boost: number, count: number, rng?: any, metrics?: MetricsLike | null, spawnProfile?: SpawnProfileLike | null, dieInertia?: number }} input
 * @returns {Array<{ pos: { x: number, y: number, z: number }, velocity: { x: number, y: number, z: number }, angle: { x: number, y: number, z: number }, axis: { x: number, y: number, z: number, a: number } }>}
 */
export function buildThrowVectors(input) {
  const count = Math.max(0, Math.floor(input.count));
  const dieInertia = input.dieInertia ?? 13;
  const vectors = [];
  for (let i = 0; i < count; i += 1) {
    const vec = randomizeDirection(input.direction, input.rng);
    const pos = spawnPosition(vec, input.rng, input.metrics ?? null, input.spawnProfile ?? null);
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

/**
 * Map client coordinates to normalized device coordinates.
 *
 * @param {number} clientX
 * @param {number} clientY
 * @param {RectLike} rect
 * @returns {{ x: number, y: number }}
 */
export function clientToNdc(clientX, clientY, rect) {
  if (!rect || !(rect.width > 0) || !(rect.height > 0)) {
    throw new TypeError('clientToNdc requires a rect with positive width and height.');
  }
  return {
    x: ((clientX - rect.left) / rect.width) * 2 - 1,
    y: -((clientY - rect.top) / rect.height) * 2 + 1
  };
}

/**
 * Map a pointer event to normalized device coordinates.
 *
 * @param {any} event
 * @param {RectLike} rect
 * @returns {{ x: number, y: number }}
 */
export function pointerToNdc(event, rect) {
  const point = getPointerCoords(event);
  return clientToNdc(point.x, point.y, rect);
}
