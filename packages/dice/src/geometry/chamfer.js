import { vec3 } from '@dice/core';

/**
 * @typedef {import('../definitions/D6.js').DieDefinition} DieDefinition
 * @typedef {import('../definitions/D6.js').Vec3} Vec3
 */

/**
 * @typedef {Object} ChamferedFace
 * @property {number[]} indices Vertex indices into the chamfered vertex list.
 * @property {number} faceIndex Geometric face index, or `-1` for chamfer faces.
 */

/**
 * @typedef {Object} ChamferedPolyhedron
 * @property {Vec3[]} vertices
 * @property {ChamferedFace[]} faces
 */

/**
 * Build the chamfered topology for a die definition.
 *
 * The base polyhedron faces keep their original face index; edge and corner
 * chamfer faces receive `faceIndex: -1`. The result is pure data and does not
 * depend on a renderer or physics backend.
 *
 * @param {DieDefinition} definition
 * @param {number} [chamfer]
 * @returns {ChamferedPolyhedron}
 */
export function chamferGeometry(definition, chamfer = definition.chamfer) {
  return chamferPolyhedron(
    definition.vertices,
    definition.faces.map((face) => face.indices),
    chamfer
  );
}

/**
 * Chamfer a convex polyhedron by trimming its corners and edges.
 *
 * `faces` must contain vertex index loops that wind counter-clockwise when
 * viewed from outside the polyhedron. The output preserves the base face order
 * first, followed by edge faces and then corner faces.
 *
 * @param {Vec3[]} vertices
 * @param {number[][]} faces
 * @param {number} [chamfer]
 * @returns {ChamferedPolyhedron}
 */
export function chamferPolyhedron(vertices, faces, chamfer = 0.96) {
  if (!Array.isArray(vertices) || vertices.length === 0) {
    throw new TypeError('chamferPolyhedron requires at least one vertex.');
  }
  if (!Array.isArray(faces) || faces.length === 0) {
    throw new TypeError('chamferPolyhedron requires at least one face.');
  }
  if (
    typeof chamfer !== 'number' ||
    !Number.isFinite(chamfer) ||
    chamfer <= 0 ||
    chamfer > 1
  ) {
    throw new RangeError('chamfer must be a finite number in the range (0, 1].');
  }

  const baseVectors = vertices.map((vertex, index) => {
    const normalized = vec3.normalize(vertex);
    if (vec3.isZero(normalized)) {
      throw new RangeError(`vertices[${index}] must not be the zero vector.`);
    }
    return normalized;
  });

  /** @type {Vec3[]} */
  const chamferVertices = [];
  /** @type {ChamferedFace[]} */
  const chamferFaces = [];
  /** @type {number[][]} */
  const cornerFaces = baseVectors.map(() => []);

  for (let i = 0; i < faces.length; i++) {
    const faceIndices = faces[i];
    if (!Array.isArray(faceIndices) || faceIndices.length < 3) {
      throw new RangeError(`faces[${i}] must contain at least three vertex indices.`);
    }

    const length = faceIndices.length;
    let center = vec3.create();
    const face = new Array(length);

    for (let j = 0; j < length; j++) {
      const index = faceIndices[j];
      const vertex = baseVectors[index];
      if (!vertex) {
        throw new RangeError(`faces[${i}][${j}] is not a valid vertex index.`);
      }

      const copy = vec3.clone(vertex);
      center = vec3.add(center, copy);
      face[j] = chamferVertices.push(copy) - 1;
      cornerFaces[index].push(face[j]);
    }

    center = vec3.scale(center, 1 / length);

    for (let j = 0; j < length; j++) {
      const vertex = chamferVertices[face[j]];
      chamferVertices[face[j]] = vec3.add(
        center,
        vec3.scale(vec3.subtract(vertex, center), chamfer)
      );
    }

    chamferFaces.push({ indices: face, faceIndex: i });
  }

  for (let i = 0; i < faces.length - 1; i++) {
    for (let j = i + 1; j < faces.length; j++) {
      /** @type {number[][]} */
      const pairs = [];
      let lastMatch = -1;

      for (let m = 0; m < faces[i].length; m++) {
        const n = faces[j].indexOf(faces[i][m]);
        if (n >= 0 && n < faces[j].length) {
          if (lastMatch >= 0 && m !== lastMatch + 1) {
            pairs.unshift([i, m], [j, n]);
          } else {
            pairs.push([i, m], [j, n]);
          }
          lastMatch = m;
        }
      }

      if (pairs.length !== 4) continue;

      chamferFaces.push({
        indices: [
          chamferFaces[pairs[0][0]].indices[pairs[0][1]],
          chamferFaces[pairs[1][0]].indices[pairs[1][1]],
          chamferFaces[pairs[3][0]].indices[pairs[3][1]],
          chamferFaces[pairs[2][0]].indices[pairs[2][1]]
        ],
        faceIndex: -1
      });
    }
  }

  // Corner faces are assembled from the edge faces created above.
  const edgeFaces = chamferFaces.slice(faces.length);

  for (let i = 0; i < cornerFaces.length; i++) {
    const corner = cornerFaces[i];
    if (corner.length === 0) continue;

    const face = [corner[0]];
    let remaining = corner.length - 1;

    while (remaining > 0) {
      let added = false;

      for (const edgeFace of edgeFaces) {
        let index = edgeFace.indices.indexOf(face[face.length - 1]);
        if (index < 0 || index >= 4) continue;

        index -= 1;
        if (index === -1) index = 3;

        const next = edgeFace.indices[index];
        if (corner.includes(next)) {
          face.push(next);
          added = true;
          break;
        }
      }

      if (!added) {
        throw new Error(`Unable to assemble chamfer corner face at vertex ${i}.`);
      }

      remaining -= 1;
    }

    chamferFaces.push({ indices: face, faceIndex: -1 });
  }

  return { vertices: chamferVertices, faces: chamferFaces };
}
