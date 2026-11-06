/**
 * GeometryBuilder
 * Pure mathematical utility for generating chamfered polyhedra geometries
 * and Cannon.js ConvexPolyhedron collision shapes.
 */

export class GeometryBuilder {
    /**
     * Creates a chamfered D6 geometry with Cannon.js ConvexPolyhedron shape.
     * @param {number} radius - Half-size scale radius of the die.
     * @param {number} [chamfer=0.96] - Chamfer factor.
     * @returns {THREE.Geometry} Three.js geometry with .cannon_shape property attached.
     */
    static createD6Geometry(radius, chamfer = 0.96) {
        const vertices = [
            [-1, -1, -1],
            [1, -1, -1],
            [1, 1, -1],
            [-1, 1, -1],
            [-1, -1, 1],
            [1, -1, 1],
            [1, 1, 1],
            [-1, 1, 1],
        ];
        const faces = [
            [0, 3, 2, 1, 1],
            [1, 2, 6, 5, 2],
            [0, 1, 5, 4, 3],
            [3, 7, 6, 2, 4],
            [0, 4, 7, 3, 5],
            [4, 5, 6, 7, 6],
        ];
        return this.createGeometry(vertices, faces, radius, 0.1, Math.PI / 4, chamfer);
    }

    /**
     * Builds a THREE.Geometry with chamfering and attaches a CANNON.ConvexPolyhedron.
     * @param {Array<Array<number>>} vertices - Raw 3D coordinates.
     * @param {Array<Array<number>>} faces - Face vertex indices (last element is face material ID).
     * @param {number} radius - Scale radius.
     * @param {number} tab - Texture coordinate margin tab.
     * @param {number} af - Angle offset for UV coordinate generation.
     * @param {number} chamfer - Chamfer scaling factor.
     * @returns {THREE.Geometry}
     */
    static createGeometry(vertices, faces, radius, tab, af, chamfer) {
        const vectors = new Array(vertices.length);
        for (let i = 0; i < vertices.length; ++i) {
            vectors[i] = new THREE.Vector3().fromArray(vertices[i]).normalize();
        }

        const cg = this.chamferGeometry(vectors, faces, chamfer);
        const geom = this.makeGeometry(cg.vectors, cg.faces, radius, tab, af);
        geom.cannon_shape = this.createConvexPolyhedron(vectors, faces, radius);
        return geom;
    }

    /**
     * Computes chamfered vectors and faces by trimming corners and edges.
     * @param {Array<THREE.Vector3>} vectors - Base normalized vectors.
     * @param {Array<Array<number>>} faces - Base faces.
     * @param {number} chamfer - Chamfer factor (e.g. 0.96).
     * @returns {{ vectors: Array<THREE.Vector3>, faces: Array<Array<number>> }}
     */
    static chamferGeometry(vectors, faces, chamfer) {
        const chamfer_vectors = [];
        const chamfer_faces = [];
        const corner_faces = new Array(vectors.length);

        for (let i = 0; i < vectors.length; ++i) {
            corner_faces[i] = [];
        }

        for (let i = 0; i < faces.length; ++i) {
            const ii = faces[i];
            const fl = ii.length - 1;
            const center_point = new THREE.Vector3();
            const face = new Array(fl);

            for (let j = 0; j < fl; ++j) {
                const vv = vectors[ii[j]].clone();
                center_point.add(vv);
                corner_faces[ii[j]].push((face[j] = chamfer_vectors.push(vv) - 1));
            }
            center_point.divideScalar(fl);

            for (let j = 0; j < fl; ++j) {
                const vv = chamfer_vectors[face[j]];
                vv.subVectors(vv, center_point)
                    .multiplyScalar(chamfer)
                    .addVectors(vv, center_point);
            }
            face.push(ii[fl]);
            chamfer_faces.push(face);
        }

        for (let i = 0; i < faces.length - 1; ++i) {
            for (let j = i + 1; j < faces.length; ++j) {
                const pairs = [];
                let lastm = -1;
                for (let m = 0; m < faces[i].length - 1; ++m) {
                    const n = faces[j].indexOf(faces[i][m]);
                    if (n >= 0 && n < faces[j].length - 1) {
                        if (lastm >= 0 && m !== lastm + 1) {
                            pairs.unshift([i, m], [j, n]);
                        } else {
                            pairs.push([i, m], [j, n]);
                        }
                        lastm = m;
                    }
                }
                if (pairs.length !== 4) continue;
                chamfer_faces.push([
                    chamfer_faces[pairs[0][0]][pairs[0][1]],
                    chamfer_faces[pairs[1][0]][pairs[1][1]],
                    chamfer_faces[pairs[3][0]][pairs[3][1]],
                    chamfer_faces[pairs[2][0]][pairs[2][1]],
                    -1,
                ]);
            }
        }

        for (let i = 0; i < corner_faces.length; ++i) {
            const cf = corner_faces[i];
            const face = [cf[0]];
            let count = cf.length - 1;

            while (count) {
                for (let m = faces.length; m < chamfer_faces.length; ++m) {
                    let index = chamfer_faces[m].indexOf(face[face.length - 1]);
                    if (index >= 0 && index < 4) {
                        if (--index === -1) index = 3;
                        const next_vertex = chamfer_faces[m][index];
                        if (cf.indexOf(next_vertex) >= 0) {
                            face.push(next_vertex);
                            break;
                        }
                    }
                }
                --count;
            }
            face.push(-1);
            chamfer_faces.push(face);
        }

        return { vectors: chamfer_vectors, faces: chamfer_faces };
    }

    /**
     * Assembles a THREE.Geometry from vertex points and face indices, generating UVs.
     * @param {Array<THREE.Vector3>} vertices
     * @param {Array<Array<number>>} faces
     * @param {number} radius
     * @param {number} tab
     * @param {number} af
     * @returns {THREE.Geometry}
     */
    static makeGeometry(vertices, faces, radius, tab, af) {
        const geom = new THREE.Geometry();
        for (let i = 0; i < vertices.length; ++i) {
            const vertex = vertices[i].clone().multiplyScalar(radius);
            vertex.index = geom.vertices.push(vertex) - 1;
        }

        for (let i = 0; i < faces.length; ++i) {
            const ii = faces[i];
            const fl = ii.length - 1;
            const aa = (Math.PI * 2) / fl;

            for (let j = 0; j < fl - 2; ++j) {
                geom.faces.push(
                    new THREE.Face3(
                        ii[0],
                        ii[j + 1],
                        ii[j + 2],
                        [
                            geom.vertices[ii[0]],
                            geom.vertices[ii[j + 1]],
                            geom.vertices[ii[j + 2]],
                        ],
                        0,
                        ii[fl] + 1
                    )
                );
                geom.faceVertexUvs[0].push([
                    new THREE.Vector2(
                        (Math.cos(af) + 1 + tab) / 2 / (1 + tab),
                        (Math.sin(af) + 1 + tab) / 2 / (1 + tab)
                    ),
                    new THREE.Vector2(
                        (Math.cos(aa * (j + 1) + af) + 1 + tab) / 2 / (1 + tab),
                        (Math.sin(aa * (j + 1) + af) + 1 + tab) / 2 / (1 + tab)
                    ),
                    new THREE.Vector2(
                        (Math.cos(aa * (j + 2) + af) + 1 + tab) / 2 / (1 + tab),
                        (Math.sin(aa * (j + 2) + af) + 1 + tab) / 2 / (1 + tab)
                    ),
                ]);
            }
        }

        geom.computeFaceNormals();
        geom.boundingSphere = new THREE.Sphere(new THREE.Vector3(), radius);
        return geom;
    }

    /**
     * Builds a CANNON.ConvexPolyhedron for physics collisions.
     * @param {Array<THREE.Vector3>} vertices
     * @param {Array<Array<number>>} faces
     * @param {number} radius
     * @returns {CANNON.ConvexPolyhedron}
     */
    static createConvexPolyhedron(vertices, faces, radius) {
        const cv = new Array(vertices.length);
        const cf = new Array(faces.length);

        for (let i = 0; i < vertices.length; ++i) {
            const v = vertices[i];
            cv[i] = new CANNON.Vec3(v.x * radius, v.y * radius, v.z * radius);
        }

        for (let i = 0; i < faces.length; ++i) {
            cf[i] = faces[i].slice(0, faces[i].length - 1);
        }

        return new CANNON.ConvexPolyhedron(cv, cf);
    }

    /**
     * Helper to compute power-of-2 texture size for standard mipmapping.
     * @param {number} approx
     * @returns {number}
     */
    static calcTextureSize(approx) {
        return Math.pow(2, Math.floor(Math.log(approx) / Math.log(2)));
    }
}

