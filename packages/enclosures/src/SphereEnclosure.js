import { vec3 } from '@dice/core';

import { Enclosure } from './Enclosure.js';
import { computeDieRadius, computeSphereRadius } from './sizing.js';

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/**
 * Evenly distribute unit directions over a sphere using a Fibonacci lattice.
 *
 * @param {number} count
 * @returns {import('./Enclosure.js').Vec3[]}
 */
function sphereDirections(count) {
  /** @type {import('./Enclosure.js').Vec3[]} */
  const directions = [];

  for (let index = 0; index < count; index += 1) {
    const y = 1 - (2 * (index + 0.5)) / count;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = GOLDEN_ANGLE * index;

    directions.push({
      x: Math.cos(theta) * radius,
      y: Math.sin(theta) * radius,
      z: y
    });
  }

  return directions;
}

/**
 * Measure how tightly a plane lattice covers the sphere. The result is the
 * smallest cosine between any surface direction and its closest plane normal,
 * with a small safety margin so the polyhedron stays inside the visual sphere.
 *
 * @param {import('./Enclosure.js').Vec3[]} directions
 * @returns {number}
 */
function measureCoverage(directions) {
  const samples = sphereDirections(1200);
  let minimumCosine = 1;

  for (const sample of samples) {
    let best = -1;

    for (const direction of directions) {
      const cosine = vec3.dot(sample, direction);
      if (cosine > best) best = cosine;
    }

    if (best < minimumCosine) minimumCosine = best;
  }

  return Math.max(0.8, Math.min(0.999, minimumCosine));
}

/**
 * Hollow spherical enclosure approximated by inward-facing tangent planes.
 *
 * The planes are the primary bounce surface. A post-step containment clamp is a
 * backstop for very high speeds: it pulls escaped dice back inside the sphere
 * and reflects their outward radial velocity.
 */
export class SphereEnclosure extends Enclosure {
  /**
   * @param {Record<string, any>} [options]
   */
  constructor(options = {}) {
    super(options);
    this.type = 'sphere';

    this.fixedRadius = typeof options.radius === 'number' ? options.radius : null;
    this.fixedDieRadius =
      typeof options.dieRadius === 'number' ? options.dieRadius : null;
    this.segments = Math.max(20, options.segments ?? 128);
    this.center = {
      x: options.center?.x ?? 0,
      y: options.center?.y ?? 0,
      z: options.center?.z ?? 0
    };
    this.showMesh = options.showMesh !== false;
    this.meshOpacity = options.meshOpacity ?? 0.1;
    this.color = options.color ?? 0x88ccff;

    this.radius = this.fixedRadius ?? 0;
    this.dieRadius = this.fixedDieRadius ?? 0;
    this.planeDistance = 0;
    this.containmentRadius = 0;

    /** @type {import('./Enclosure.js').Vec3[]|null} */
    this.directions = null;

    this.coverage = 1;

    /** @type {import('./Enclosure.js').PhysicsBodyHandle[]} */
    this.wallBodies = [];

    /** @type {((world: import('./Enclosure.js').PhysicsWorldLike, dt: number) => void)|null} */
    this.containmentCallback = null;
  }

  /**
   * @param {import('./Enclosure.js').PhysicsWorldLike} physicsWorld
   * @param {import('./Enclosure.js').ViewportMetrics} metrics
   */
  buildPhysics(physicsWorld, metrics) {
    this.#applyMetrics(metrics);

    const callback = (
      /** @type {import('./Enclosure.js').PhysicsWorldLike} */ world
    ) => this.#contain(world);

    this.containmentCallback = callback;
    const unsubscribe = physicsWorld.addPostStep(callback);
    this.postStepUnsubscribers.push(
      typeof unsubscribe === 'function'
        ? unsubscribe
        : () => physicsWorld.removePostStep(callback)
    );

    this.wallBodies = (this.directions ?? []).map((direction, index) =>
      this.createPlaneBody(physicsWorld, {
        id: `wall-${index}`,
        normal: vec3.negate(direction),
        position: vec3.add(
          this.center,
          vec3.scale(direction, this.planeDistance)
        ),
        material: 'sphere_boundary'
      })
    );
  }

  /**
   * @param {import('./Enclosure.js').ViewportMetrics} metrics
   */
  updatePhysics(metrics) {
    this.#applyMetrics(metrics);

    this.wallBodies.forEach((body, index) => {
      const direction = this.directions?.[index];
      if (!direction) return;

      body.setTransform({
        position: vec3.add(
          this.center,
          vec3.scale(direction, this.planeDistance)
        )
      });
    });
  }

  /**
   * @param {import('./Enclosure.js').RenderSceneLike} renderScene
   * @param {import('./Enclosure.js').ViewportMetrics} metrics
   */
  buildVisuals(renderScene, metrics) {
    if (!this.showMesh) return;

    this.#applyMetrics(metrics);

    this.createVisual(
      renderScene,
      {
        type: 'sphere-shell',
        radius: this.radius,
        color: this.color,
        opacity: this.meshOpacity
      },
      { ...this.center }
    );
  }

  /**
   * @param {import('./Enclosure.js').PhysicsWorldLike|null} [physicsWorld]
   * @param {import('./Enclosure.js').RenderSceneLike|null} [renderScene]
   */
  dispose(physicsWorld = this.physicsWorld, renderScene = this.renderScene) {
    super.dispose(physicsWorld, renderScene);
    this.wallBodies = [];
    this.containmentCallback = null;
  }

  /**
   * @param {import('./Enclosure.js').ViewportMetrics} metrics
   */
  #applyMetrics(metrics) {
    this.radius = this.fixedRadius ?? computeSphereRadius(metrics);
    this.dieRadius = this.fixedDieRadius ?? computeDieRadius(metrics);

    if (!this.directions) {
      this.directions = sphereDirections(this.segments);
      this.coverage = measureCoverage(this.directions);
    }

    const innerRadius = Math.max(10, this.radius - this.dieRadius);
    this.planeDistance = innerRadius * this.coverage;
    this.containmentRadius = Math.max(10, this.radius - this.dieRadius - 2);
  }

  /**
   * @param {import('./Enclosure.js').PhysicsWorldLike} physicsWorld
   */
  #contain(physicsWorld) {
    const bodies = physicsWorld.getBodies();
    const maxRadius = this.containmentRadius;
    const maxRadiusSquared = maxRadius * maxRadius;

    for (const body of bodies) {
      if (!body || body.mass === 0) continue;

      const position = body.getPosition();
      const offset = vec3.subtract(position, this.center);
      const distanceSquared = vec3.lengthSquared(offset);

      if (distanceSquared <= maxRadiusSquared || distanceSquared === 0) {
        continue;
      }

      const distance = Math.sqrt(distanceSquared);
      const normal = vec3.scale(offset, 1 / distance);

      body.setTransform({
        position: vec3.add(this.center, vec3.scale(normal, maxRadius))
      });

      const velocity = body.getVelocity();
      const radialVelocity = vec3.dot(velocity, normal);

      if (radialVelocity > 0) {
        const restitution = 0.6;
        body.setVelocity(
          vec3.subtract(
            velocity,
            vec3.scale(normal, (1 + restitution) * radialVelocity)
          )
        );
      }
    }
  }
}
