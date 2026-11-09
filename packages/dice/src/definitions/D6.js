/**
 * @typedef {Object} Vec3
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */

/**
 * One geometric face of a die. `indices` points at the definition's base
 * polyhedron vertices and must wind counter-clockwise when viewed from outside
 * the die. `defaultLabel` is the label displayed on this face before any face
 * mapping is applied.
 *
 * @typedef {Object} DieFaceDefinition
 * @property {number} index Stable geometric face index.
 * @property {number[]} indices Base polyhedron vertex indices.
 * @property {Vec3} normal Outward unit normal in the die's local frame.
 * @property {number} defaultLabel Default displayed label.
 */

/**
 * Backend-neutral die definition. Renderers consume `createDiceMeshData` and
 * physics consumes `createDiceCollisionData`; neither package needs to know how
 * the definition was authored.
 *
 * @typedef {Object} DieDefinition
 * @property {string} id
 * @property {number} faceCount
 * @property {number} chamfer Chamfer factor in `(0, 1]`.
 * @property {Vec3[]} vertices Base polyhedron vertices.
 * @property {DieFaceDefinition[]} faces
 * @property {[number, number]} labelRange Inclusive range of valid labels.
 * @property {() => number[]} createFaceMapping Returns the default label permutation.
 */

/**
 * The built-in D6 definition.
 *
 * Vertex and face ordering is the same as the legacy chamfered cube so face
 * labels remain stable across the reorganization. Opposite faces sum to seven.
 *
 * @type {DieDefinition}
 */
export const D6 = {
  id: 'd6',
  faceCount: 6,
  chamfer: 0.96,
  vertices: [
    { x: -1, y: -1, z: -1 },
    { x: 1, y: -1, z: -1 },
    { x: 1, y: 1, z: -1 },
    { x: -1, y: 1, z: -1 },
    { x: -1, y: -1, z: 1 },
    { x: 1, y: -1, z: 1 },
    { x: 1, y: 1, z: 1 },
    { x: -1, y: 1, z: 1 }
  ],
  faces: [
    { index: 0, indices: [0, 3, 2, 1], normal: { x: 0, y: 0, z: -1 }, defaultLabel: 1 },
    { index: 1, indices: [1, 2, 6, 5], normal: { x: 1, y: 0, z: 0 }, defaultLabel: 2 },
    { index: 2, indices: [0, 1, 5, 4], normal: { x: 0, y: -1, z: 0 }, defaultLabel: 3 },
    { index: 3, indices: [3, 7, 6, 2], normal: { x: 0, y: 1, z: 0 }, defaultLabel: 4 },
    { index: 4, indices: [0, 4, 7, 3], normal: { x: -1, y: 0, z: 0 }, defaultLabel: 5 },
    { index: 5, indices: [4, 5, 6, 7], normal: { x: 0, y: 0, z: 1 }, defaultLabel: 6 }
  ],
  labelRange: [1, 6],
  createFaceMapping() {
    return D6.faces.map((face) => face.defaultLabel);
  }
};
