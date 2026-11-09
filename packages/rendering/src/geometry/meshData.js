/**
 * Structural validation helpers for the pure `DiceMeshData` emitted by
 * `@dice/dice`. Rendering intentionally defines its own shaped typedefs so the
 * package depends only on `@dice/core`.
 *
 * @typedef {Object} Vec3Like
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */

/**
 * @typedef {Object} UvLike
 * @property {number} x
 * @property {number} y
 */

/**
 * @typedef {Object} MeshFaceLike
 * @property {number} faceIndex
 * @property {number[]} indices
 * @property {number} materialSlot
 * @property {Vec3Like} normal
 * @property {UvLike[]} uvs
 */

/**
 * @typedef {Object} DiceMeshData
 * @property {Vec3Like[]} vertices
 * @property {MeshFaceLike[]} faces
 * @property {number} boundingRadius
 */

/**
 * @param {unknown} value
 * @param {string} label
 * @returns {number}
 */
function finiteNumber(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number.`);
  }
  return value;
}

/**
 * Validate the shape of renderer-agnostic dice mesh data.
 *
 * @param {DiceMeshData} meshData
 * @returns {DiceMeshData}
 */
export function validateDiceMeshData(meshData) {
  if (!meshData || typeof meshData !== 'object') {
    throw new TypeError('DiceMeshData must be an object.');
  }
  if (!Array.isArray(meshData.vertices) || meshData.vertices.length < 3) {
    throw new RangeError('DiceMeshData.vertices must contain at least three vertices.');
  }
  if (!Array.isArray(meshData.faces) || meshData.faces.length === 0) {
    throw new RangeError('DiceMeshData.faces must contain at least one triangle.');
  }

  meshData.vertices.forEach((vertex, index) => {
    finiteNumber(vertex?.x, `vertices[${index}].x`);
    finiteNumber(vertex?.y, `vertices[${index}].y`);
    finiteNumber(vertex?.z, `vertices[${index}].z`);
  });

  meshData.faces.forEach((face, faceOffset) => {
    if (!Number.isInteger(face.faceIndex)) {
      throw new TypeError(`faces[${faceOffset}].faceIndex must be an integer.`);
    }
    if (!Array.isArray(face.indices) || face.indices.length !== 3) {
      throw new RangeError(`faces[${faceOffset}].indices must contain three vertex indices.`);
    }
    face.indices.forEach((vertexIndex, index) => {
      if (
        !Number.isInteger(vertexIndex) ||
        vertexIndex < 0 ||
        vertexIndex >= meshData.vertices.length
      ) {
        throw new RangeError(
          `faces[${faceOffset}].indices[${index}] is not a valid vertex index.`
        );
      }
    });
    if (!Number.isInteger(face.materialSlot) || face.materialSlot < 0) {
      throw new TypeError(`faces[${faceOffset}].materialSlot must be a non-negative integer.`);
    }
    if (!Array.isArray(face.uvs) || face.uvs.length !== 3) {
      throw new RangeError(`faces[${faceOffset}].uvs must contain three UV pairs.`);
    }
  });

  finiteNumber(meshData.boundingRadius, 'boundingRadius');
  return meshData;
}

/**
 * Count triangles per geometric face. Chamfer triangles (`faceIndex: -1`) are
 * included under the `-1` key so callers can assert coverage.
 *
 * @param {DiceMeshData} meshData
 * @returns {Map<number, number>}
 */
export function countFaceTriangles(meshData) {
  /** @type {Map<number, number>} */
  const counts = new Map();

  for (const face of meshData.faces) {
    counts.set(face.faceIndex, (counts.get(face.faceIndex) ?? 0) + 1);
  }

  return counts;
}

/**
 * List the distinct geometric face indices in mesh order.
 *
 * @param {DiceMeshData} meshData
 * @returns {number[]}
 */
export function listFaceIndices(meshData) {
  return [...new Set(meshData.faces.map((face) => face.faceIndex))];
}
