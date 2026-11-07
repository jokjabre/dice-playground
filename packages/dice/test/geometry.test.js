import { describe, expect, it } from 'vitest';

import {
  D6,
  chamferGeometry,
  createDiceCollisionData,
  createDiceMeshData
} from '../src/index.js';

describe('D6 definition', () => {
  it('declares eight vertices, six faces, and stable labels', () => {
    expect(D6.id).toBe('d6');
    expect(D6.faceCount).toBe(6);
    expect(D6.vertices).toHaveLength(8);
    expect(D6.faces).toHaveLength(6);
    expect(D6.labelRange).toEqual([1, 6]);

    for (const [index, face] of D6.faces.entries()) {
      expect(face.index).toBe(index);
      expect(face.indices).toHaveLength(4);
      expect(face.defaultLabel).toBe(index + 1);
      expect(face.normal.x ** 2 + face.normal.y ** 2 + face.normal.z ** 2).toBeCloseTo(1);
    }
  });

  it('creates a complete default face mapping', () => {
    expect(D6.createFaceMapping()).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('chamferGeometry', () => {
  it('produces six base faces, twelve edge faces, and eight corner faces', () => {
    const chamfered = chamferGeometry(D6);

    expect(chamfered.vertices).toHaveLength(24);
    expect(chamfered.faces).toHaveLength(26);

    const baseFaces = chamfered.faces.filter((face) => face.faceIndex >= 0);
    const chamferFaces = chamfered.faces.filter((face) => face.faceIndex < 0);

    expect(baseFaces.map((face) => face.faceIndex)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(baseFaces.every((face) => face.indices.length === 4)).toBe(true);

    const edgeFaces = chamferFaces.filter((face) => face.indices.length === 4);
    const cornerFaces = chamferFaces.filter((face) => face.indices.length === 3);
    expect(edgeFaces).toHaveLength(12);
    expect(cornerFaces).toHaveLength(8);
  });
});

describe('createDiceMeshData', () => {
  const mesh = createDiceMeshData(D6, { radius: 100 });

  it('chamfers the cube into 24 vertices and 44 triangles', () => {
    expect(mesh.vertices).toHaveLength(24);
    expect(mesh.faces).toHaveLength(44);
    expect(mesh.boundingRadius).toBe(100);
  });

  it('assigns continuous face indices to base triangles and -1 to chamfers', () => {
    const baseFaces = mesh.faces.filter((face) => face.faceIndex >= 0);
    const chamferFaces = mesh.faces.filter((face) => face.faceIndex < 0);

    expect(baseFaces).toHaveLength(12);
    expect(chamferFaces).toHaveLength(32);

    for (let faceIndex = 0; faceIndex < 6; faceIndex++) {
      const triangles = baseFaces.filter((face) => face.faceIndex === faceIndex);
      expect(triangles).toHaveLength(2);
      for (const triangle of triangles) {
        expect(triangle.materialSlot).toBe(faceIndex + 1);
      }
    }

    for (const triangle of chamferFaces) {
      expect(triangle.faceIndex).toBe(-1);
      expect(triangle.materialSlot).toBe(0);
    }
  });

  it('produces outward unit normals and three UVs per triangle', () => {
    for (const face of mesh.faces) {
      expect(face.indices).toHaveLength(3);
      expect(face.uvs).toHaveLength(3);
      expect(face.normal.x ** 2 + face.normal.y ** 2 + face.normal.z ** 2).toBeCloseTo(1);

      const [a, b, c] = face.indices.map((index) => mesh.vertices[index]);
      const centroid = {
        x: (a.x + b.x + c.x) / 3,
        y: (a.y + b.y + c.y) / 3,
        z: (a.z + b.z + c.z) / 3
      };
      const outward =
        face.normal.x * centroid.x +
        face.normal.y * centroid.y +
        face.normal.z * centroid.z;

      expect(outward).toBeGreaterThan(0);

      for (const uv of face.uvs) {
        expect(uv.x).toBeGreaterThanOrEqual(0);
        expect(uv.x).toBeLessThanOrEqual(1);
        expect(uv.y).toBeGreaterThanOrEqual(0);
        expect(uv.y).toBeLessThanOrEqual(1);
      }
    }
  });

  it('scales with the requested radius and rejects invalid radii', () => {
    const scaled = createDiceMeshData(D6, { radius: 50 });
    expect(scaled.boundingRadius).toBe(50);
    expect(scaled.vertices[0].x).not.toBeCloseTo(mesh.vertices[0].x);

    expect(() => createDiceMeshData(D6, { radius: 0 })).toThrow(/greater than zero/);
    expect(() => createDiceMeshData(D6, { radius: Number.NaN })).toThrow(/greater than zero/);
  });
});

describe('createDiceCollisionData', () => {
  it('returns the un-chamfered convex base polyhedron', () => {
    const collision = createDiceCollisionData(D6, { radius: 100 });

    expect(collision.type).toBe('convex');
    expect(collision.vertices).toHaveLength(8);
    expect(collision.faces).toHaveLength(6);
    expect(collision.faceIndices).toEqual([0, 1, 2, 3, 4, 5]);
    expect(collision.boundingRadius).toBe(100);

    for (const face of collision.faces) {
      expect(face).toHaveLength(4);
    }

    // Normalized cube corners are unit vectors before scaling by the radius.
    const corner = collision.vertices[0];
    expect(
      Math.sqrt(corner.x ** 2 + corner.y ** 2 + corner.z ** 2)
    ).toBeCloseTo(100);
  });

  it('rejects invalid radii', () => {
    expect(() => createDiceCollisionData(D6, { radius: -1 })).toThrow(
      /greater than zero/
    );
  });
});
