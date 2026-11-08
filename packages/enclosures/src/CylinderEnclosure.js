import { Enclosure } from './Enclosure.js';
import { computeCylinderSize, normalizeEnclosureScale } from './sizing.js';

/**
 * Open cylindrical enclosure: a bottom plane plus inward-facing polygonal wall
 * facets. The visual shell is an open glass-like cylinder.
 */
export class CylinderEnclosure extends Enclosure {
  /**
   * @param {Record<string, any>} [options]
   */
  constructor(options = {}) {
    super(options);
    this.type = 'cylinder';

    this.fixedRadius = typeof options.radius === 'number' ? options.radius : null;
    this.fixedHeight = typeof options.height === 'number' ? options.height : null;
    this.scale = normalizeEnclosureScale(options.scale);
    this.segments = Math.max(3, options.segments ?? 24);
    this.color = options.color ?? 0xffd9a0;
    this.opacity = options.opacity ?? 0.35;

    this.radius = this.fixedRadius ?? 0;
    this.height = this.fixedHeight ?? 0;

    /** @type {import('./Enclosure.js').PhysicsBodyHandle|null} */
    this.bottomBody = null;

    /** @type {import('./Enclosure.js').PhysicsBodyHandle[]} */
    this.wallBodies = [];
  }

  /**
   * @param {import('./Enclosure.js').PhysicsWorldLike} physicsWorld
   * @param {import('./Enclosure.js').ViewportMetrics} metrics
   */
  buildPhysics(physicsWorld, metrics) {
    this.#applyMetrics(metrics);

    this.bottomBody = this.createPlaneBody(physicsWorld, {
      id: 'bottom',
      normal: { x: 0, y: 0, z: 1 },
      position: { x: 0, y: 0, z: 0 },
      material: 'glass_boundary'
    });

    this.wallBodies = [];

    for (let index = 0; index < this.segments; index += 1) {
      const angle = (index / this.segments) * Math.PI * 2;
      const cosine = Math.cos(angle);
      const sine = Math.sin(angle);

      this.wallBodies.push(
        this.createPlaneBody(physicsWorld, {
          id: `wall-${index}`,
          normal: { x: -cosine, y: -sine, z: 0 },
          position: this.#wallPosition(cosine, sine),
          material: 'glass_boundary'
        })
      );
    }
  }

  /**
   * @param {import('./Enclosure.js').ViewportMetrics} metrics
   */
  updatePhysics(metrics) {
    this.#applyMetrics(metrics);

    this.bottomBody?.setTransform({
      position: { x: 0, y: 0, z: 0 }
    });

    this.wallBodies.forEach((body, index) => {
      const angle = (index / this.segments) * Math.PI * 2;
      body.setTransform({
        position: this.#wallPosition(Math.cos(angle), Math.sin(angle))
      });
    });
  }

  /**
   * @param {import('./Enclosure.js').RenderSceneLike} renderScene
   * @param {import('./Enclosure.js').ViewportMetrics} metrics
   */
  buildVisuals(renderScene, metrics) {
    this.#applyMetrics(metrics);

    this.createVisual(
      renderScene,
      {
        type: 'cylinder-shell',
        radius: this.radius,
        height: this.height,
        color: this.color,
        opacity: this.opacity
      },
      { x: 0, y: 0, z: this.height / 2 }
    );
  }

  /**
   * @param {import('./Enclosure.js').PhysicsWorldLike|null} [physicsWorld]
   * @param {import('./Enclosure.js').RenderSceneLike|null} [renderScene]
   */
  dispose(physicsWorld = this.physicsWorld, renderScene = this.renderScene) {
    super.dispose(physicsWorld, renderScene);
    this.bottomBody = null;
    this.wallBodies = [];
  }

  /**
   * @param {import('./Enclosure.js').ViewportMetrics} metrics
   */
  #applyMetrics(metrics) {
    const size = computeCylinderSize(metrics, { scale: this.scale });
    this.radius = this.fixedRadius ?? size.radius;
    this.height = this.fixedHeight ?? size.height;
  }

  /**
   * @param {number} cosine
   * @param {number} sine
   * @returns {import('./Enclosure.js').Vec3}
   */
  #wallPosition(cosine, sine) {
    return {
      x: cosine * this.radius,
      y: sine * this.radius,
      z: this.height / 2
    };
  }
}
