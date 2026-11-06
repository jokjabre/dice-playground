/**
 * Geometry
 * Backwards compatibility adapter forwarding to src/dice/GeometryBuilder.js
 * and retaining vector impulse generator logic.
 */

import { GeometryBuilder } from "../../src/dice/GeometryBuilder.js";
import { physics } from "./physics.js";
import { options } from "../../src/config/options.js";
import { dimensions, playingField } from "../../src/config/dimensions.js";
import { rndGen } from "../../src/utils/rndGen.js";
import { makeSpawnPosition } from "../../src/config/spawnProfile.js";

export class Geometry {
    static lastKnownVectors = [];

    static amplifyVector(vector, aplification) {
        let max = Math.max(Math.abs(vector.x), Math.abs(vector.y), Math.abs(vector.z));
        vector.divideScalar(max);
        vector.multiplyScalar(aplification);
    }

    static calculate_quadrant(num, step) {
        let breakpoint = 0;
        let quadrant = 0;
        while (breakpoint < 360) {
            if (num >= breakpoint && num <= breakpoint + step) {
                return quadrant % 2 ? -1 : 1;
            }
            breakpoint += step;
            quadrant++;
        }
    }

    static generate_vectors(vector, boost) {
        Geometry.lastKnownVectors = [];
        for (let i = 0; i < options.diceCount; i++) {
            var vec = rndGen.make_random_vector(vector);
            var pos = makeSpawnPosition(rndGen, vec, playingField.dimensions);
            var velvec = rndGen.make_random_vector(vector);
            var velocity = { x: velvec.x * boost, y: velvec.y * boost, z: -10 };
            var angle = {
                x: -(rndGen.rnd() * vec.y * 5 + physics.die_inertia * vec.y),
                y: rndGen.rnd() * vec.x * 5 + physics.die_inertia * vec.x,
                z: 0
            };
            var axis = { x: rndGen.rnd(), y: rndGen.rnd(), z: rndGen.rnd(), a: rndGen.rnd() };
            Geometry.lastKnownVectors.push({ pos: pos, velocity: velocity, angle: angle, axis: axis });
        }
        return Geometry.lastKnownVectors;
    }

    static make_geom(vertices, faces, radius, tab, af) {
        return GeometryBuilder.makeGeometry(vertices, faces, radius, tab, af);
    }

    static chamfer_geom(vectors, faces, chamfer) {
        return GeometryBuilder.chamferGeometry(vectors, faces, chamfer);
    }

    static create_geom(vertices, faces, radius, tab, af, chamfer) {
        return GeometryBuilder.createGeometry(vertices, faces, radius, tab, af, chamfer);
    }

    static create_shape(vertices, faces, radius) {
        return GeometryBuilder.createConvexPolyhedron(vertices, faces, radius);
    }

    static create_d6_geometry(radius) {
        return GeometryBuilder.createD6Geometry(radius);
    }

    static calc_texture_size(approx) {
        return GeometryBuilder.calcTextureSize(approx);
    }
}
