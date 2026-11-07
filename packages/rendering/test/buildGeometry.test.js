import { describe, expect, it } from 'vitest';

import { buildDiceGeometry } from '../src/backends/three-r73/buildGeometry.js';
import {
  countFaceTriangles,
  listFaceIndices,
  validateDiceMeshData
} from '../src/geometry/meshData.js';
import { D6_MESH_DATA } from './fixtures/d6-mesh.js';

class FakeVector3 {
  /**
   * @param {number} [x]
   * @param {number} [y]
   * @param {number} [z]
   */
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  clone() {
    return new FakeVector3(this.x, this.y, this.z);
  }
}

class FakeVector2 {
  /**
   * @param {number} [x]
   * @param {number} [y]
   */
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
}

class FakeFace3 {
  /**
   * @param {number} a
   * @param {number} b
   * @param {number} c
   * @param {any} normals
   * @param {any} color
   * @param {number} materialIndex
   */
  constructor(a, b, c, normals, color, materialIndex) {
    this.a = a;
    this.b = b;
    this.c = c;
    this.normals = normals;
    this.color = color;
    this.materialIndex = materialIndex;
  }
}

class FakeGeometry {
  constructor() {
    this.vertices = [];
    this.faces = [];
    this.faceVertexUvs = [[]];
  }

  computeFaceNormals() {
    this.normalsComputed = true;
  }
}

class FakeSphere {
  /**
   * @param {any} center
   * @param {number} radius
   */
  constructor(center, radius) {
    this.center = center;
    this.radius = radius;
  }
}

const fakeTHREE = {
  Vector3: FakeVector3,
  Vector2: FakeVector2,
  Face3: FakeFace3,
  Geometry: FakeGeometry,
  Sphere: FakeSphere
};

describe('buildDiceGeometry', () => {
  it('builds the expected vertex and triangle counts for a D6', () => {
    const geometry = buildDiceGeometry(fakeTHREE, D6_MESH_DATA);

    expect(geometry.vertices).toHaveLength(24);
    expect(geometry.faces).toHaveLength(44);
    expect(geometry.faceVertexUvs[0]).toHaveLength(44);
    expect(geometry.boundingSphere.radius).toBe(100);
    expect(geometry.normalsComputed).toBe(true);
  });

  it('preserves geometric faceIndex groups and chamfer material slots', () => {
    const geometry = buildDiceGeometry(fakeTHREE, D6_MESH_DATA);
    const counts = countFaceTriangles(D6_MESH_DATA);

    expect(listFaceIndices(D6_MESH_DATA)).toEqual([0, 1, 2, 3, 4, 5, -1]);
    expect(counts.get(0)).toBe(2);
    expect(counts.get(5)).toBe(2);
    expect(counts.get(-1)).toBe(32);

    for (const face of geometry.faces) {
      expect(Number.isInteger(face.faceIndex)).toBe(true);
      expect(face.materialIndex).toBe(face.faceIndex < 0 ? 0 : face.faceIndex + 1);
    }
  });

  it('rejects malformed mesh data', () => {
    expect(() =>
      validateDiceMeshData({
        vertices: [{ x: 0, y: 0, z: 0 }],
        faces: [],
        boundingRadius: 1
      })
    ).toThrow(/at least three vertices/i);

    expect(() =>
      validateDiceMeshData({
        vertices: [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
          { x: 0, y: 1, z: 0 }
        ],
        faces: [{ faceIndex: 0, indices: [0, 1, 9], materialSlot: 1, normal: { x: 0, y: 0, z: 1 }, uvs: [] }],
        boundingRadius: 1
      })
    ).toThrow(/not a valid vertex index/i);
  });
});
