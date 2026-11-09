import * as CANNON from 'cannon-es';

import { normalizeShape } from '../../shapes.js';
import { toCannonVec } from './toPlain.js';

/**
 * @typedef {import('../../shapes.js').ShapeDescriptor} ShapeDescriptor
 */

/**
 * @param {CANNON.Vec3} from
 * @param {CANNON.Vec3} to
 * @returns {CANNON.Quaternion}
 */
function quaternionFromUnitVectors(from, to) {
  const quaternion = new CANNON.Quaternion();
  const dot = from.dot(to);

  if (dot > 1 - 1e-9) {
    return quaternion;
  }

  if (dot < -1 + 1e-9) {
    // Antiparallel: any perpendicular axis is valid. Prefer X unless from is
    // already aligned with it.
    const axis = Math.abs(from.x) < 0.9
      ? new CANNON.Vec3(1, 0, 0)
      : new CANNON.Vec3(0, 1, 0);
    axis.cross(from, axis);
    axis.normalize();
    quaternion.setFromAxisAngle(axis, Math.PI);
    return quaternion;
  }

  const axis = new CANNON.Vec3();
  from.cross(to, axis);
  axis.normalize();
  quaternion.setFromAxisAngle(axis, Math.acos(Math.max(-1, Math.min(1, dot))));
  return quaternion;
}

/**
 * Convert a validated shape descriptor into a cannon-es shape plus the local
 * shape orientation required by the Z-up engine convention.
 *
 * @param {ShapeDescriptor} descriptor
 * @returns {{ shape: CANNON.Shape, orientation: CANNON.Quaternion }}
 */
export function createShape(descriptor) {
  const shape = normalizeShape(descriptor);

  switch (shape.type) {
    case 'plane': {
      const normal = toCannonVec(shape.normal);
      return {
        shape: new CANNON.Plane(),
        orientation: quaternionFromUnitVectors(new CANNON.Vec3(0, 0, 1), normal)
      };
    }
    case 'box': {
      return {
        shape: new CANNON.Box(toCannonVec(shape.halfExtents)),
        orientation: new CANNON.Quaternion()
      };
    }
    case 'sphere': {
      return {
        shape: new CANNON.Sphere(shape.radius),
        orientation: new CANNON.Quaternion()
      };
    }
    case 'convex': {
      return {
        shape: new CANNON.ConvexPolyhedron({
          vertices: shape.vertices.map((vertex) => toCannonVec(vertex)),
          faces: shape.faces.map((face) => face.slice())
        }),
        orientation: new CANNON.Quaternion()
      };
    }
    case 'cylinder': {
      // cannon-es cylinders are built along their local Y axis. The engine is
      // Z-up, so rotate the local shape into the requested world axis.
      const orientation = new CANNON.Quaternion();
      if (shape.axis === 'z') {
        orientation.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);
      } else if (shape.axis === 'x') {
        orientation.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), -Math.PI / 2);
      }

      return {
        shape: new CANNON.Cylinder(
          shape.radius,
          shape.radius,
          shape.height,
          shape.segments
        ),
        orientation
      };
    }
    default:
      throw new RangeError(`Unsupported physics shape descriptor: ${String(shape)}`);
  }
}
