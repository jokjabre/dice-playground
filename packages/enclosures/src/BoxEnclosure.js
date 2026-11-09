import { Enclosure } from './Enclosure.js';
import { computeBoxBounds, normalizeEnclosureScale } from './sizing.js';

/**
 * Rectangular tray: a floor plane, four inward-facing walls, an optional
 * ceiling, and an optional tray outline visual.
 */
export class BoxEnclosure extends Enclosure {
  /**
   * @param {Record<string, any>} [options]
   */
  constructor(options = {}) {
    super(options);
    this.type = 'box';

    this.margin = options.margin ?? 0.93;
    this.ceilingHeight = options.ceilingHeight ?? 2700;
    this.scale = normalizeEnclosureScale(options.scale);
    this.hasCeiling = options.ceiling ?? options.hasCeiling ?? true;
    this.showOutline = options.outline ?? options.showOutline ?? true;
    this.color = options.color ?? 0xffffff;
    this.opacity = options.opacity ?? 0.35;

    /** @type {import('./sizing.js').BoxBounds|null} */
    this.bounds = null;

    /** @type {Record<string, import('./Enclosure.js').PhysicsBodyHandle|null>} */
    this.bodies = {};
  }

  /**
   * @param {import('./Enclosure.js').PhysicsWorldLike} physicsWorld
   * @param {import('./Enclosure.js').ViewportMetrics} metrics
   */
  buildPhysics(physicsWorld, metrics) {
    const bounds = computeBoxBounds(metrics, {
      margin: this.margin,
      ceilingHeight: this.ceilingHeight,
      scale: this.scale
    });
    this.bounds = bounds;

    this.bodies = {
      desk: this.createPlaneBody(physicsWorld, {
        id: 'desk',
        normal: { x: 0, y: 0, z: 1 },
        position: { x: 0, y: 0, z: 0 },
        material: 'desk'
      }),
      barrier_top: this.createPlaneBody(physicsWorld, {
        id: 'barrier-top',
        normal: { x: 0, y: -1, z: 0 },
        position: { x: 0, y: bounds.halfHeight, z: 0 },
        material: 'barrier_top'
      }),
      barrier_bottom: this.createPlaneBody(physicsWorld, {
        id: 'barrier-bottom',
        normal: { x: 0, y: 1, z: 0 },
        position: { x: 0, y: -bounds.halfHeight, z: 0 },
        material: 'barrier_bottom'
      }),
      barrier_right: this.createPlaneBody(physicsWorld, {
        id: 'barrier-right',
        normal: { x: -1, y: 0, z: 0 },
        position: { x: bounds.halfWidth, y: 0, z: 0 },
        material: 'barrier_right'
      }),
      barrier_left: this.createPlaneBody(physicsWorld, {
        id: 'barrier-left',
        normal: { x: 1, y: 0, z: 0 },
        position: { x: -bounds.halfWidth, y: 0, z: 0 },
        material: 'barrier_left'
      }),
      screen: this.hasCeiling
        ? this.createPlaneBody(physicsWorld, {
            id: 'screen',
            normal: { x: 0, y: 0, z: -1 },
            position: { x: 0, y: 0, z: bounds.ceilingHeight },
            material: 'screen'
          })
        : null
    };
  }

  /**
   * @param {import('./Enclosure.js').ViewportMetrics} metrics
   */
  updatePhysics(metrics) {
    const bounds = computeBoxBounds(metrics, {
      margin: this.margin,
      ceilingHeight: this.ceilingHeight,
      scale: this.scale
    });
    this.bounds = bounds;

    this.bodies.barrier_top?.setTransform({
      position: { x: 0, y: bounds.halfHeight, z: 0 }
    });
    this.bodies.barrier_bottom?.setTransform({
      position: { x: 0, y: -bounds.halfHeight, z: 0 }
    });
    this.bodies.barrier_right?.setTransform({
      position: { x: bounds.halfWidth, y: 0, z: 0 }
    });
    this.bodies.barrier_left?.setTransform({
      position: { x: -bounds.halfWidth, y: 0, z: 0 }
    });
    this.bodies.screen?.setTransform({
      position: { x: 0, y: 0, z: bounds.ceilingHeight }
    });
  }

  /**
   * @param {import('./Enclosure.js').RenderSceneLike} renderScene
   * @param {import('./Enclosure.js').ViewportMetrics} metrics
   */
  buildVisuals(renderScene, metrics) {
    if (!this.showOutline) return;

    const bounds = computeBoxBounds(metrics, {
      margin: this.margin,
      ceilingHeight: this.ceilingHeight,
      scale: this.scale
    });
    this.bounds = bounds;

    this.createVisual(
      renderScene,
      {
        type: 'box-outline',
        width: bounds.halfWidth * 2,
        height: bounds.halfHeight * 2,
        depth: bounds.ceilingHeight,
        color: this.color,
        opacity: this.opacity
      },
      { x: 0, y: 0, z: bounds.ceilingHeight / 2 }
    );
  }
}
