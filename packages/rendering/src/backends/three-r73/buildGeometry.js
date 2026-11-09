import { validateDiceMeshData } from '../../geometry/meshData.js';

/**
 * @typedef {import('../../geometry/meshData.js').DiceMeshData} DiceMeshData
 */

/**
 * Build a Three r73 `THREE.Geometry` from pure dice mesh data.
 *
 * Every `THREE.Face3` keeps the source triangle's geometric `faceIndex` so
 * material slots can be reassigned on a face-mapping change without cloning
 * the geometry.
 *
 * @param {any} THREE Loaded Three r73 namespace.
 * @param {DiceMeshData} meshData
 * @returns {any} A `THREE.Geometry`.
 */
export function buildDiceGeometry(THREE, meshData) {
  validateDiceMeshData(meshData);

  const geometry = new THREE.Geometry();

  for (const vertex of meshData.vertices) {
    geometry.vertices.push(new THREE.Vector3(vertex.x, vertex.y, vertex.z));
  }

  for (const face of meshData.faces) {
    const [a, b, c] = face.indices;
    const normal = new THREE.Vector3(
      face.normal.x,
      face.normal.y,
      face.normal.z
    );

    const threeFace = new THREE.Face3(
      a,
      b,
      c,
      [normal.clone(), normal.clone(), normal.clone()],
      undefined,
      face.materialSlot
    );

    threeFace.faceIndex = face.faceIndex;
    geometry.faces.push(threeFace);

    geometry.faceVertexUvs[0].push(
      face.uvs.map((/** @type {import('../../geometry/meshData.js').UvLike} */ uv) =>
        new THREE.Vector2(uv.x, uv.y)
      )
    );
  }

  geometry.computeFaceNormals();
  geometry.boundingSphere = new THREE.Sphere(
    new THREE.Vector3(0, 0, 0),
    meshData.boundingRadius
  );

  return geometry;
}
