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
 * @property {number} [containerWidth]
 * @property {number} [container_width]
 * @property {number} [containerHeight]
 * @property {number} [container_height]
 * @property {number} [scale]
 * @property {number} [dieRadius]
 * @property {any} [origin]
 * @property {any} [spawnOrigin]
 * @property {number} [spawnHeight]
 * @property {number} [zSpawn]
 * @property {number} [spawnZ]
 * @property {number} [height]
 * @property {number} [ceilingHeight]
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
 * @property {number} [dieRadius]
 * @property {{ x: number, y: number, z?: number }} [origin]
 * @property {{ x: number, y: number, z?: number }} [spawnOrigin]
 * @property {Pointer2D} [start]
 * @property {Pointer2D} [center]
 * @property {number} [originX]
 * @property {number} [originY]
 * @property {number} [scale]
 * @property {number} [spawnHeight]
 * @property {number} [zSpawn]
 * @property {number} [spawnZ]
 * @property {number} [throwHeight]
 * @property {number} [height]
 * @property {number} [collisionDistance]
 * @property {number} [minSeparation]
 * @property {number} [minSpawnDistance]
 * @property {number} [collisionMargin]
 */

/** Maximum horizontal deviation of one die from the throw direction (10°). */
export const MAX_THROW_ANGLE_DEVIATION = Math.PI / 18;

/** Alias for {@link MAX_THROW_ANGLE_DEVIATION}. */
export const THROW_ANGLE_SPREAD = MAX_THROW_ANGLE_DEVIATION;

/** Maximum per-die speed jitter around the throw boost (±15%). */
export const THROW_SPEED_JITTER = 0.15;

/** Upward velocity as a fraction of the jittered horizontal speed. */
export const UPWARD_VELOCITY_RATIO = 0.5;

/**
 * Unified throw strength: multiplier on the throw boost for the horizontal
 * velocity change. This is the one strength setting for every flick throw
 * — standard-mode throw vectors (`buildThrowVectors`) and continuous-mode
 * impulses (`buildContinuousImpulses`) both use it, so a flick always
 * launches with the same power regardless of mode. It must stay well above
 * 1: at strength 1 a resting die barely skids along the floor instead of
 * being thrown. Kept in sync with the mirrored constant in the world
 * package's SpawnProfile (the packages cannot import each other).
 */
export const THROW_STRENGTH = 3;

/**
 * Continuous-mode upward velocity as a fraction of the jittered horizontal
 * speed (launch angle ~56° above horizontal). Much steeper than
 * {@link UPWARD_VELOCITY_RATIO}: at this ratio a typical flick (boost
 * ~380) gives Vz ~1700, lifting the dice ~500 units off the floor before
 * gravity curves them down, instead of ~6 units at the throw ratio.
 */
export const CONTINUOUS_UPWARD_VELOCITY_RATIO = 1.5;

/** Margin added to the die diameter for the spawn collision distance. */
export const SPAWN_COLLISION_MARGIN = 10;

/** Die radius assumed when metrics carry no scale (the default `scale: 45`). */
export const DEFAULT_SPAWN_DIE_RADIUS = 40.5;

/**
 * Die mass assumed for continuous-mode impulses. Parity with the physics
 * `DEFAULT_MASS` / world default mass (this package cannot import them):
 * `applyImpulse` divides by mass, so an impulse must be scaled by the mass
 * for the resulting velocity change to equal the intended throw velocity.
 */
export const DEFAULT_DIE_MASS = 300;

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
 * @param {any} value
 * @returns {number|null}
 */
function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * @param {any[]} values
 * @returns {number|null}
 */
function firstFinitePositive(values) {
  for (const value of values) {
    const number = finiteNumber(value);
    if (number !== null && number > 0) return number;
  }
  return null;
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
 * Normalize an origin candidate supplied as `{ x, y, z? }` or `[x, y, z?]`.
 *
 * @param {any} value
 * @returns {{ x: number, y: number, z?: number }|null}
 */
function normalizeOriginCandidate(value) {
  if (Array.isArray(value)) {
    const x = finiteNumber(value[0]);
    const y = finiteNumber(value[1]);
    const z = finiteNumber(value[2]);
    if (x === null && y === null && z === null) return null;
    /** @type {{ x: number, y: number, z?: number }} */
    const origin = { x: x ?? 0, y: y ?? 0 };
    if (z !== null) origin.z = z;
    return origin;
  }
  if (value && typeof value === 'object') {
    const x = finiteNumber(value.x);
    const y = finiteNumber(value.y);
    const z = finiteNumber(value.z);
    if (x === null && y === null && z === null) return null;
    /** @type {{ x: number, y: number, z?: number }} */
    const origin = { x: x ?? 0, y: y ?? 0 };
    if (z !== null) origin.z = z;
    return origin;
  }
  return null;
}

/**
 * Resolve the die vertex radius from explicit overrides, the profile, or the
 * viewport scale (`max(10, scale * 0.9)`, matching `computeDieRadius`).
 *
 * @param {MetricsLike|Record<string, any>|null|undefined} metrics
 * @param {SpawnProfileLike|Record<string, any>|null|undefined} profile
 * @param {Record<string, any>|null|undefined} [options]
 * @returns {number}
 */
export function resolveDieRadius(metrics, profile, options) {
  const explicit = firstFinitePositive([
    options?.dieRadius,
    profile?.dieRadius,
    metrics?.dieRadius
  ]);
  if (explicit !== null) return explicit;

  const scale = firstFinitePositive([
    metrics?.scale,
    options?.scale,
    profile?.scale
  ]);
  if (scale !== null) return Math.max(10, scale * 0.9);

  return DEFAULT_SPAWN_DIE_RADIUS;
}

/**
 * Resolve the minimum centre-to-centre distance between two spawned dice:
 * the die diameter plus a margin, unless an explicit distance is supplied.
 *
 * @param {MetricsLike|Record<string, any>|null|undefined} metrics
 * @param {SpawnProfileLike|Record<string, any>|null|undefined} profile
 * @param {Record<string, any>|null|undefined} [options]
 * @returns {number}
 */
export function resolveCollisionDistance(metrics, profile, options) {
  const explicit = firstFinitePositive([
    options?.collisionDistance,
    options?.minSeparation,
    options?.minSpawnDistance,
    profile?.collisionDistance,
    profile?.minSeparation,
    profile?.minSpawnDistance
  ]);
  if (explicit !== null) return explicit;

  const margin =
    finiteNumber(options?.collisionMargin) ??
    finiteNumber(profile?.collisionMargin) ??
    SPAWN_COLLISION_MARGIN;
  return resolveDieRadius(metrics, profile, options) * 2 + Math.max(0, margin);
}

/**
 * Resolve the world-space spawn origin. This is the unprojected throw start
 * point (`P_start`); dice are scattered around it. Callers project the 2D
 * gesture start into this 3D point with {@link clientToSpawnOrigin} and
 * pass it in here; when nothing is supplied the origin defaults to the
 * centre of the table.
 *
 * @param {MetricsLike|Record<string, any>|null|undefined} metrics
 * @param {SpawnProfileLike|Record<string, any>|null|undefined} profile
 * @param {Record<string, any>|null|undefined} [options]
 * @returns {{ x: number, y: number, z?: number }}
 */
export function resolveSpawnOrigin(metrics, profile, options) {
  const normalized = normalizeOriginCandidate(
    options?.origin ??
      options?.spawnOrigin ??
      options?.start ??
      options?.center ??
      options?.originPosition ??
      profile?.origin ??
      profile?.spawnOrigin ??
      profile?.start ??
      profile?.center ??
      metrics?.origin ??
      metrics?.spawnOrigin
  );
  if (normalized) return normalized;

  const originX = finiteNumber(options?.originX) ?? finiteNumber(profile?.originX);
  const originY = finiteNumber(options?.originY) ?? finiteNumber(profile?.originY);
  if (originX !== null || originY !== null) {
    return { x: originX ?? 0, y: originY ?? 0 };
  }

  return { x: 0, y: 0 };
}

/**
 * Resolve the shared throw height `Z_spawn` for a batch of dice. An explicit
 * origin height or spawn height wins; otherwise the legacy per-enclosure
 * heights are used (box: 300, sphere: upper-inner `1.35 * radius`,
 * cylinder: `0.5 * radius`).
 *
 * @param {MetricsLike|Record<string, any>|null|undefined} metrics
 * @param {SpawnProfileLike|Record<string, any>|null|undefined} profile
 * @param {Record<string, any>|null|undefined} [options]
 * @returns {number}
 */
export function resolveSpawnHeight(metrics, profile, options) {
  const origin = resolveSpawnOrigin(metrics, profile, options);
  if (typeof origin.z === 'number' && Number.isFinite(origin.z)) return origin.z;

  const explicit = firstFinitePositive([
    options?.spawnHeight,
    options?.zSpawn,
    options?.spawnZ,
    options?.throwHeight,
    profile?.spawnHeight,
    profile?.zSpawn,
    profile?.spawnZ,
    profile?.throwHeight,
    metrics?.spawnHeight,
    metrics?.zSpawn,
    metrics?.spawnZ
  ]);
  if (explicit !== null) return explicit;

  const mode = typeof profile?.mode === 'string' ? profile.mode : 'box';
  const radius = firstFinitePositive([profile?.radius]) ?? 700;
  if (mode === 'sphere') return radius * 1.35;
  if (mode === 'cylinder') return radius * 0.5;
  if (mode === 'box') return 300;
  return firstFinitePositive([profile?.radius]) !== null ? radius * 0.5 : 300;
}

/**
 * @param {MetricsLike|Record<string, any>|null|undefined} metrics
 * @param {SpawnProfileLike|Record<string, any>|null|undefined} profile
 * @param {number} dieRadius
 * @returns {{ mode: string, dieRadius: number, halfWidth?: number, halfHeight?: number, ceilingHeight?: number, radius?: number, allowedRadius?: number, height?: number|null, center?: { x: number, y: number, z: number } }}
 */
function resolveEnclosureBounds(metrics, profile, dieRadius) {
  const { sceneWidth, sceneHeight } = sceneSize(metrics ?? null);
  const mode = typeof profile?.mode === 'string' ? profile.mode : 'box';
  const radius = firstFinitePositive([profile?.radius]) ?? 700;

  if (mode === 'sphere') {
    return {
      mode,
      dieRadius,
      radius,
      center: { x: 0, y: 0, z: radius },
      allowedRadius: Math.max(10, radius - dieRadius)
    };
  }

  if (mode === 'cylinder') {
    return {
      mode,
      dieRadius,
      radius,
      allowedRadius: Math.max(10, radius - dieRadius),
      height: firstFinitePositive([profile?.height, metrics?.height])
    };
  }

  if (mode !== 'box' && firstFinitePositive([profile?.radius]) !== null) {
    // Custom enclosures with an explicit radius are treated as radial.
    return {
      mode: 'cylinder',
      dieRadius,
      radius,
      allowedRadius: Math.max(10, radius - dieRadius),
      height: firstFinitePositive([profile?.height, metrics?.height])
    };
  }

  return {
    mode: 'box',
    dieRadius,
    halfWidth: sceneWidth * 0.93,
    halfHeight: sceneHeight * 0.93,
    ceilingHeight: firstFinitePositive([metrics?.ceilingHeight]) ?? 2700
  };
}

/**
 * @param {{ x: number, y: number, z: number }} pos
 * @param {ReturnType<typeof resolveEnclosureBounds>} bounds
 * @returns {boolean}
 */
function isInsideBounds(pos, bounds) {
  const epsilon = 1e-9;
  if (bounds.mode === 'sphere' && bounds.center && bounds.allowedRadius !== undefined) {
    return (
      Math.hypot(pos.x - bounds.center.x, pos.y - bounds.center.y, pos.z - bounds.center.z) <=
      bounds.allowedRadius + epsilon
    );
  }
  if (bounds.mode === 'box') {
    const maxX = Math.max(0, (bounds.halfWidth ?? 0) - bounds.dieRadius);
    const maxY = Math.max(0, (bounds.halfHeight ?? 0) - bounds.dieRadius);
    return (
      Math.abs(pos.x) <= maxX + epsilon &&
      Math.abs(pos.y) <= maxY + epsilon &&
      pos.z >= bounds.dieRadius - epsilon &&
      pos.z <= (bounds.ceilingHeight ?? 2700) + epsilon
    );
  }
  return (
    Math.hypot(pos.x, pos.y) <= (bounds.allowedRadius ?? 0) + epsilon &&
    pos.z >= bounds.dieRadius - epsilon &&
    (bounds.height == null || pos.z <= bounds.height + epsilon)
  );
}

/**
 * @param {{ x: number, y: number, z: number }} a
 * @param {{ x: number, y: number, z: number }} b
 * @returns {number}
 */
export function spawnDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/**
 * @param {{ x: number, y: number, z: number }} pos
 * @param {Array<{ x: number, y: number, z: number }>} placed
 * @param {number} collisionDistance
 * @returns {boolean}
 */
function isSeparated(pos, placed, collisionDistance) {
  for (const other of placed) {
    if (spawnDistance(pos, other) < collisionDistance - 1e-9) return false;
  }
  return true;
}

/**
 * Clamp a spawn position inside the active enclosure, keeping the die centre
 * at least one die radius from every wall. Sphere positions are projected
 * back onto the inner sphere; box positions are clipped per axis; radial
 * (cylinder/custom) positions are pulled onto the inner cylinder.
 *
 * @param {{ x: number, y: number, z: number }} position
 * @param {MetricsLike|Record<string, any>|null|undefined} metrics
 * @param {SpawnProfileLike|Record<string, any>|null|undefined} profile
 * @param {number|Record<string, any>|null|undefined} [dieRadiusOrOptions]
 * @returns {{ x: number, y: number, z: number }}
 */
export function clampSpawnPosition(position, metrics, profile, dieRadiusOrOptions) {
  const options =
    typeof dieRadiusOrOptions === 'number'
      ? { dieRadius: dieRadiusOrOptions }
      : dieRadiusOrOptions;
  const dieRadius = resolveDieRadius(metrics, profile, options);
  const bounds = resolveEnclosureBounds(metrics, profile, dieRadius);

  const pos = {
    x: finiteNumber(position?.x) ?? 0,
    y: finiteNumber(position?.y) ?? 0,
    z: finiteNumber(position?.z) ?? dieRadius
  };

  if (bounds.mode === 'sphere' && bounds.center && bounds.allowedRadius !== undefined) {
    const offset = {
      x: pos.x - bounds.center.x,
      y: pos.y - bounds.center.y,
      z: pos.z - bounds.center.z
    };
    const distance = Math.hypot(offset.x, offset.y, offset.z);
    if (distance > bounds.allowedRadius && distance > 0) {
      const scale = bounds.allowedRadius / distance;
      return {
        x: bounds.center.x + offset.x * scale,
        y: bounds.center.y + offset.y * scale,
        z: bounds.center.z + offset.z * scale
      };
    }
    return pos;
  }

  if (bounds.mode === 'box') {
    const maxX = Math.max(0, (bounds.halfWidth ?? 0) - dieRadius);
    const maxY = Math.max(0, (bounds.halfHeight ?? 0) - dieRadius);
    return {
      x: Math.max(-maxX, Math.min(maxX, pos.x)),
      y: Math.max(-maxY, Math.min(maxY, pos.y)),
      z: Math.max(dieRadius, Math.min(bounds.ceilingHeight ?? 2700, pos.z))
    };
  }

  const allowed = bounds.allowedRadius ?? 0;
  const radial = Math.hypot(pos.x, pos.y);
  let { x, y } = pos;
  if (radial > allowed && radial > 0) {
    const scale = allowed / radial;
    x *= scale;
    y *= scale;
  }
  return {
    x,
    y,
    z:
      bounds.height == null
        ? Math.max(dieRadius, pos.z)
        : Math.max(dieRadius, Math.min(bounds.height, pos.z))
  };
}

/**
 * Whether a spawn position sits inside the active enclosure with the die
 * fully clear of its walls.
 *
 * @param {{ x: number, y: number, z: number }} position
 * @param {MetricsLike|Record<string, any>|null|undefined} metrics
 * @param {SpawnProfileLike|Record<string, any>|null|undefined} profile
 * @param {number|Record<string, any>|null|undefined} [dieRadiusOrOptions]
 * @returns {boolean}
 */
export function isSpawnPositionInside(position, metrics, profile, dieRadiusOrOptions) {
  if (
    !position ||
    finiteNumber(position.x) === null ||
    finiteNumber(position.y) === null ||
    finiteNumber(position.z) === null
  ) {
    return false;
  }
  const options =
    typeof dieRadiusOrOptions === 'number'
      ? { dieRadius: dieRadiusOrOptions }
      : dieRadiusOrOptions;
  const dieRadius = resolveDieRadius(metrics, profile, options);
  return isInsideBounds(
    { x: position.x, y: position.y, z: position.z },
    resolveEnclosureBounds(metrics, profile, dieRadius)
  );
}

/** Alias for {@link isSpawnPositionInside}. */
export const isInsideEnclosure = isSpawnPositionInside;

/** Alias for {@link clampSpawnPosition}. */
export const clampToEnclosure = clampSpawnPosition;

/**
 * Normalize a throw direction to unit length, falling back to +X for a
 * missing or zero direction.
 *
 * @param {{ x: number, y: number }|null|undefined} direction
 * @returns {{ x: number, y: number }}
 */
function normalizeThrowDirection(direction) {
  const x = finiteNumber(direction?.x) ?? 0;
  const y = finiteNumber(direction?.y) ?? 0;
  const length = Math.hypot(x, y);
  if (!Number.isFinite(length) || length === 0) return { x: 1, y: 0 };
  return { x: x / length, y: y / length };
}

/**
 * Rotate a direction by a small random angle within the throw cone
 * (±10°), so each die deviates from the swipe direction by a bounded,
 * varied amount.
 *
 * @param {Pointer2D} direction
 * @param {any} rng
 * @returns {Pointer2D}
 */
export function randomizeDirection(direction, rng) {
  const source = {
    x: finiteNumber(direction?.x) ?? 0,
    y: finiteNumber(direction?.y) ?? 0
  };
  const randomAngle = (nextRandom(rng) * 2 - 1) * MAX_THROW_ANGLE_DEVIATION;
  const vector = {
    x: source.x * Math.cos(randomAngle) - source.y * Math.sin(randomAngle),
    y: source.x * Math.sin(randomAngle) + source.y * Math.cos(randomAngle)
  };
  if (vector.x === 0) vector.x = 0.01;
  if (vector.y === 0) vector.y = 0.01;
  return vector;
}

/**
 * @param {any} entry
 * @returns {{ x: number, y: number, z: number }|null}
 */
function normalizePlacedPosition(entry) {
  const source = entry?.pos ?? entry?.position ?? entry;
  if (!source || typeof source !== 'object') return null;
  const x = finiteNumber(source.x);
  const y = finiteNumber(source.y);
  const z = finiteNumber(source.z);
  if (x === null || y === null || z === null) return null;
  return { x, y, z };
}

/**
 * Sample `count` non-overlapping spawn positions scattered around the spawn
 * origin. Candidates are rejection-sampled from an expanding disc around the
 * origin; a deterministic origin-aligned grid search (ordered by distance
 * from the origin) is the fallback when rejection sampling is exhausted, so
 * a seeded source always produces the same batch. Every returned position
 * sits inside the active enclosure with its die clear of the walls, and no
 * two positions are closer than the collision distance (die diameter plus
 * margin) in 3D — all dice in a batch share `Z_spawn`, so the XY separation
 * equals the 3D separation.
 *
 * @param {{ count?: number, dice?: number, rng?: any, metrics?: MetricsLike|Record<string, any>|null, spawnProfile?: SpawnProfileLike|Record<string, any>|null, profile?: SpawnProfileLike|Record<string, any>|null, origin?: any, spawnOrigin?: any, start?: any, center?: any, dieRadius?: number, collisionDistance?: number, minSeparation?: number, spawnHeight?: number, zSpawn?: number, spawnZ?: number, existing?: any[], placed?: any[], positions?: any[] }} [input]
 * @returns {Array<{ x: number, y: number, z: number }>}
 */
export function sampleSpawnPositions(input = {}) {
  const count = Math.max(0, Math.floor(input.count ?? input.dice ?? 0));
  const rng = input.rng;
  const metrics = input.metrics ?? null;
  const profile = input.spawnProfile ?? input.profile ?? null;

  const origin = resolveSpawnOrigin(metrics, profile, input);
  const dieRadius = resolveDieRadius(metrics, profile, input);
  const collisionDistance = resolveCollisionDistance(metrics, profile, input);
  const spawnZ = resolveSpawnHeight(metrics, profile, { ...input, origin });
  const bounds = resolveEnclosureBounds(metrics, profile, dieRadius);

  /** @type {Array<{ x: number, y: number, z: number }>} */
  const placed = [];
  for (const entry of input.existing ?? input.placed ?? input.positions ?? []) {
    const normalized = normalizePlacedPosition(entry);
    if (normalized) placed.push(normalized);
  }

  /** @type {Array<{ x: number, y: number, z: number }>} */
  const positions = [];

  for (let index = 0; index < count; index += 1) {
    /** @type {{ x: number, y: number, z: number }|null} */
    let accepted = null;
    let scatterRadius = collisionDistance * (0.55 + 0.5 * Math.sqrt(index + 1));

    for (let attempt = 0; attempt < 120 && accepted === null; attempt += 1) {
      const angle = nextRandom(rng) * Math.PI * 2;
      const radius = scatterRadius * Math.sqrt(nextRandom(rng));
      const candidate = {
        x: origin.x + Math.cos(angle) * radius,
        y: origin.y + Math.sin(angle) * radius,
        z: spawnZ
      };
      if (isInsideBounds(candidate, bounds) && isSeparated(candidate, placed, collisionDistance)) {
        accepted = candidate;
      }
      if (attempt > 0 && attempt % 25 === 0) scatterRadius *= 1.3;
    }

    if (accepted === null) {
      // Deterministic fallback: an origin-aligned grid over the enclosure
      // footprint, nearest-to-origin first.
      let xMin = -10;
      let xMax = 10;
      let yMin = -10;
      let yMax = 10;
      if (bounds.mode === 'box') {
        xMin = -Math.max(0, (bounds.halfWidth ?? 0) - dieRadius);
        xMax = -xMin;
        yMin = -Math.max(0, (bounds.halfHeight ?? 0) - dieRadius);
        yMax = -yMin;
      } else {
        xMin = -(bounds.allowedRadius ?? 0);
        xMax = bounds.allowedRadius ?? 0;
        yMin = xMin;
        yMax = xMax;
      }

      const step = Math.max(10, collisionDistance * 0.5);
      /** @type {Array<{ x: number, y: number, z: number }>} */
      const candidates = [];
      const startX = Math.ceil((xMin - origin.x) / step) * step;
      const startY = Math.ceil((yMin - origin.y) / step) * step;
      for (let offsetX = startX; offsetX <= xMax - origin.x + 1e-9; offsetX += step) {
        for (let offsetY = startY; offsetY <= yMax - origin.y + 1e-9; offsetY += step) {
          candidates.push({ x: origin.x + offsetX, y: origin.y + offsetY, z: spawnZ });
        }
      }
      candidates.sort(
        (a, b) => Math.hypot(a.x - origin.x, a.y - origin.y) - Math.hypot(b.x - origin.x, b.y - origin.y)
      );

      /** @type {{ x: number, y: number, z: number }|null} */
      let best = null;
      let bestDistance = -1;
      for (const candidate of candidates) {
        if (!isInsideBounds(candidate, bounds)) continue;
        if (isSeparated(candidate, placed, collisionDistance)) {
          accepted = candidate;
          break;
        }
        let minimum = Number.POSITIVE_INFINITY;
        for (const other of placed) {
          minimum = Math.min(minimum, spawnDistance(candidate, other));
        }
        if (minimum > bestDistance) {
          bestDistance = minimum;
          best = candidate;
        }
      }
      if (accepted === null) accepted = best;
    }

    if (accepted === null) {
      accepted = clampSpawnPosition(
        { x: origin.x, y: origin.y, z: spawnZ },
        metrics,
        profile,
        dieRadius
      );
    }

    placed.push(accepted);
    positions.push({ ...accepted });
  }

  return positions;
}

/**
 * Compute a spawn position near the spawn origin inside the active
 * enclosure. The `direction` argument is retained for backwards
 * compatibility; positions are origin-anchored and scattered around the
 * origin rather than placed at the tray edges, so the direction does not
 * influence the result. Pass `options.placed` (or `existing`/`positions`)
 * to keep the result clear of already-placed dice.
 *
 * @param {Pointer2D} direction
 * @param {any} rng
 * @param {MetricsLike | null | undefined} metrics
 * @param {SpawnProfileLike | null | undefined} spawnProfile
 * @param {Record<string, any>|number|any[]|null|undefined} [options]
 * @returns {{ x: number, y: number, z: number }}
 */
export function spawnPosition(direction, rng, metrics, spawnProfile, options) {
  void direction;
  const normalizedOptions = Array.isArray(options)
    ? { placed: options }
    : typeof options === 'number'
      ? { dieRadius: options }
      : { ...(options ?? {}) };
  const positions = sampleSpawnPositions({
    count: 1,
    rng,
    metrics: metrics ?? null,
    spawnProfile: spawnProfile ?? null,
    ...normalizedOptions
  });
  return positions[0];
}

/**
 * Build one throw vector per die for a normalized swipe direction.
 *
 * Dice spawn scattered around the spawn origin (see
 * {@link sampleSpawnPositions}) at the shared throw height, with no two
 * dice closer than the collision distance. Each die then gets a horizontal
 * velocity along the throw direction, rotated within the ±10° cone and
 * jittered by up to ±15% in speed, plus an upward `Vz` (half the jittered
 * horizontal speed) so dice lob upward before gravity curves them down.
 * The horizontal speed is `boost × strength` (default
 * {@link THROW_STRENGTH}, the unified flick strength shared with
 * continuous mode). Angular spin on all three axes scales with the throw
 * power, and the initial orientation axis is randomized per die.
 *
 * @param {{ direction: Pointer2D, boost: number, count?: number, dice?: number, rng?: any, metrics?: MetricsLike | null, spawnProfile?: SpawnProfileLike | null, profile?: SpawnProfileLike | null, dieInertia?: number, strength?: number, throwStrength?: number, origin?: any, spawnOrigin?: any, start?: any, center?: any, dieRadius?: number, collisionDistance?: number, minSeparation?: number, spawnHeight?: number, zSpawn?: number, spawnZ?: number, existing?: any[], placed?: any[] }} input
 * @returns {Array<{ pos: { x: number, y: number, z: number }, velocity: { x: number, y: number, z: number }, angle: { x: number, y: number, z: number }, axis: { x: number, y: number, z: number, a: number } }>}
 */
export function buildThrowVectors(input) {
  const count = Math.max(0, Math.floor(input.count ?? input.dice ?? 0));
  const metrics = input.metrics ?? null;
  const profile = input.spawnProfile ?? input.profile ?? null;
  const rng = input.rng;
  const boost = finiteNumber(input.boost) ?? 0;
  const magnitude = Math.abs(boost);
  const strength =
    firstFinitePositive([input.throwStrength, input.strength]) ?? THROW_STRENGTH;
  const direction = normalizeThrowDirection(input.direction);
  const dieInertia =
    finiteNumber(input.dieInertia) !== null && (finiteNumber(input.dieInertia) ?? 0) > 0
      ? (finiteNumber(input.dieInertia) ?? 13)
      : 13;

  const positions = sampleSpawnPositions({
    ...input,
    count,
    rng,
    metrics,
    spawnProfile: profile
  });

  const vectors = [];
  const spinScale = dieInertia + magnitude * strength * 0.02;

  for (let i = 0; i < count; i += 1) {
    const vec = randomizeDirection(direction, rng);
    const speedFactor = 1 + (nextRandom(rng) * 2 - 1) * THROW_SPEED_JITTER;
    const horizontalSpeed = magnitude * speedFactor * strength;
    vectors.push({
      pos: positions[i],
      velocity: {
        x: vec.x * horizontalSpeed,
        y: vec.y * horizontalSpeed,
        z: horizontalSpeed * UPWARD_VELOCITY_RATIO
      },
      angle: {
        x: -(vec.y * spinScale) + (nextRandom(rng) * 2 - 1) * spinScale * 0.35,
        y: vec.x * spinScale + (nextRandom(rng) * 2 - 1) * spinScale * 0.35,
        z: (nextRandom(rng) * 2 - 1) * spinScale * 0.65
      },
      axis: {
        x: nextRandom(rng),
        y: nextRandom(rng),
        z: nextRandom(rng),
        a: nextRandom(rng)
      }
    });
  }
  return vectors;
}

/**
 * Build one impulse per active die for a continuous-mode flick.
 *
 * Continuous mode never clears or respawns dice, so — unlike
 * {@link buildThrowVectors} — this returns no spawn positions, velocities
 * to assign, or spin state. It derives one impulse per die from the throw
 * vector instead: the horizontal component follows the throw direction
 * rotated within the same ±10° cone and jittered by up to ±15% in speed
 * (see {@link randomizeDirection} and {@link THROW_SPEED_JITTER}), and the
 * upward component is a fixed fraction of the jittered horizontal speed
 * ({@link CONTINUOUS_UPWARD_VELOCITY_RATIO}), so every die pops upward
 * (`+Z`) before gravity curves it down. The per-die cone deviation and
 * speed jitter also vary each impulse in direction and magnitude, which is
 * how the dice tumble differently when the impulses are applied.
 *
 * The horizontal velocity change is `boost × strength` (default strength
 * {@link THROW_STRENGTH}, the unified flick strength shared with
 * {@link buildThrowVectors}). Each impulse is then scaled by the die mass
 * (`dieMass`, default {@link DEFAULT_DIE_MASS}): physics divides an
 * impulse by mass, so `mass × Δv` is required for the resulting velocity
 * change to equal the intended Δv. An unscaled impulse would change the
 * velocity by only `boost / mass` (a few units at the default mass) and a
 * flick would be imperceptible. An explicit `scale`/`impulseScale`
 * overrides the mass scaling (the strength multiplier still applies).
 *
 * The optional `worldPoint` is passed through unchanged (as a fresh
 * `{ x, y, z }`) to every entry so a caller can apply the impulses at a
 * shared application point through `host.applyImpulse(ids, impulse,
 * worldPoint)`; when it is not supplied the entries carry no `worldPoint`
 * and the impulses are applied at each die's centre of mass.
 *
 * @param {{ direction?: Pointer2D, boost?: number, count?: number, dice?: number, ids?: string[], diceIds?: string[], rng?: any, scale?: number, impulseScale?: number, dieMass?: number, mass?: number, strength?: number, throwStrength?: number, upwardRatio?: number, worldPoint?: any, origin?: any }} [input]
 * @returns {Array<{ id: string|undefined, impulse: { x: number, y: number, z: number }, worldPoint?: { x: number, y: number, z: number } }>}
 */
export function buildContinuousImpulses(input = {}) {
  const ids = Array.isArray(input.ids)
    ? input.ids
    : Array.isArray(input.diceIds)
      ? input.diceIds
      : null;
  const count = ids
    ? ids.length
    : Math.max(0, Math.floor(input.count ?? input.dice ?? 0));
  const rng = input.rng;
  const boost = finiteNumber(input.boost) ?? 0;
  const magnitude = Math.abs(boost);
  const scale =
    firstFinitePositive([
      input.impulseScale,
      input.scale,
      input.dieMass,
      input.mass
    ]) ?? DEFAULT_DIE_MASS;
  const strength =
    firstFinitePositive([input.throwStrength, input.strength]) ?? THROW_STRENGTH;
  const upwardRatio =
    finiteNumber(input.upwardRatio) ?? CONTINUOUS_UPWARD_VELOCITY_RATIO;
  const direction = normalizeThrowDirection(input.direction);
  const normalizedPoint =
    normalizeOriginCandidate(input.worldPoint ?? input.origin) ?? undefined;
  const worldPoint = normalizedPoint
    ? { x: normalizedPoint.x, y: normalizedPoint.y, z: normalizedPoint.z ?? 0 }
    : undefined;

  /** @type {Array<{ id: string|undefined, impulse: { x: number, y: number, z: number }, worldPoint?: { x: number, y: number, z: number } }>} */
  const impulses = [];
  for (let i = 0; i < count; i += 1) {
    const vec = randomizeDirection(direction, rng);
    const speedFactor = 1 + (nextRandom(rng) * 2 - 1) * THROW_SPEED_JITTER;
    const horizontalSpeed = magnitude * speedFactor * scale * strength;
    /** @type {{ id: string|undefined, impulse: { x: number, y: number, z: number }, worldPoint?: { x: number, y: number, z: number } }} */
    const entry = {
      id: ids ? ids[i] : undefined,
      impulse: {
        x: vec.x * horizontalSpeed,
        y: vec.y * horizontalSpeed,
        z: horizontalSpeed * upwardRatio
      }
    };
    if (worldPoint) entry.worldPoint = { ...worldPoint };
    impulses.push(entry);
  }
  return impulses;
}

/** Alias for {@link buildContinuousImpulses}. */
export const buildImpulseVectors = buildContinuousImpulses;

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

/**
 * Project a client-space pointer point (`P_start`, as returned by
 * {@link getPointerCoords}) into the world-space spawn origin
 * (`X`, `Y`, `Z_spawn`). This is the screen-to-scene mapping used by the
 * pointer input: the full scene spans the container (the engine reports
 * `sceneWidth`/`sceneHeight` equal to the container size), screen X maps
 * directly to scene X, and screen Y is flipped so upward screen movement is
 * positive scene Y (matching {@link vectorFromDelta}). The height is
 * `Z_spawn` resolved for the active enclosure (see
 * {@link resolveSpawnHeight}); pass a `null` profile when the enclosure is
 * not consulted and the default box height is used.
 *
 * When a usable container rect is supplied the mapping goes through
 * {@link clientToNdc}. Without one, the point is treated as container-local
 * pixels from the top-left corner and centred with the container size from
 * the metrics (falling back to the scene size).
 *
 * @param {Pointer2D} point Client coordinates of the pointer-down point.
 * @param {RectLike | null | undefined} rect Container bounding rect.
 * @param {MetricsLike | Record<string, any> | null | undefined} metrics
 * @param {SpawnProfileLike | Record<string, any> | null | undefined} spawnProfile
 * @returns {{ x: number, y: number, z: number }}
 */
export function clientToSpawnOrigin(point, rect, metrics, spawnProfile) {
  const { sceneWidth, sceneHeight } = sceneSize(metrics ?? null);
  const cursor = {
    x: finiteNumber(point?.x) ?? 0,
    y: finiteNumber(point?.y) ?? 0
  };

  /** @type {{ x: number, y: number }|null} */
  let ndc = null;
  if (rect && rect.width > 0 && rect.height > 0) {
    try {
      ndc = clientToNdc(cursor.x, cursor.y, rect);
    } catch {
      ndc = null;
    }
  }

  /** @type {{ x: number, y: number }} */
  let projected;
  if (ndc) {
    projected = { x: ndc.x * (sceneWidth / 2), y: ndc.y * (sceneHeight / 2) };
  } else {
    const containerWidth = firstFinitePositive([
      metrics?.containerWidth,
      metrics?.container_width
    ]) ?? sceneWidth;
    const containerHeight = firstFinitePositive([
      metrics?.containerHeight,
      metrics?.container_height
    ]) ?? sceneHeight;
    projected = {
      x: cursor.x - containerWidth / 2,
      y: containerHeight / 2 - cursor.y
    };
  }

  const z = resolveSpawnHeight(metrics ?? null, spawnProfile ?? null, {
    origin: { x: projected.x, y: projected.y }
  });
  return { x: projected.x, y: projected.y, z };
}
