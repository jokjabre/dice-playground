import { physics } from "./physics.js";
export class Geometry {

    static lastKnownVectors = [];

    static amplifyVector(vector, aplification) {
      let max = Math.max(Math.abs(vector.x), Math.abs(vector.y), Math.abs(vector.z));
      // if(vector.x === max) vector.x *= aplification;
      // if(vector.y === max) vector.y *= aplification;
      // if(vector.z === max) vector.z *= aplification;
      vector.divideScalar(max);
      vector.multiplyScalar(aplification);
    }

    static calculate_quadrant(num, step) {
      let breakpoint = 0;
      let quadrant = 0;
      while(breakpoint < 360) {
        if(num >= breakpoint && num <= breakpoint + step) {
           console.log("Quadrant: " + quadrant)
           return quadrant%2 ? -1 : 1; 
        }
        breakpoint += step;
        quadrant++;
      }
    }

    static generate_vectors(vector, boost) {
       Geometry.lastKnownVectors = [];
        
        for (let i = 0; i < options.diceCount; i++) {
                var vec = rndGen.make_random_vector(vector);
                var pos = {
                    x: playingField.dimensions.scene_width* (vec.x > 0 ? -1 : 1) * 0.9,
                y: playingField.dimensions.scene_height* (vec.y > 0 ? -1 : 1) * 0.9,
                z: rndGen.rnd() * 200 + 200
            };
            var projector = Math.abs(vec.x / vec.y);
            if (projector > 1.0) pos.y /= projector; else pos.x *= projector;
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
        var geom = new THREE.Geometry();
        for (var i = 0; i < vertices.length; ++i) {
          var vertex = vertices[i].multiplyScalar(radius);
          vertex.index = geom.vertices.push(vertex) - 1;
        }
        for (var i = 0; i < faces.length; ++i) {
          var ii = faces[i],
            fl = ii.length - 1;
          var aa = (Math.PI * 2) / fl;
          for (var j = 0; j < fl - 2; ++j) {
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
    
      static chamfer_geom(vectors, faces, chamfer) {
        var chamfer_vectors = [],
          chamfer_faces = [],
          corner_faces = new Array(vectors.length);
        for (var i = 0; i < vectors.length; ++i) corner_faces[i] = [];
        for (var i = 0; i < faces.length; ++i) {
          var ii = faces[i],
            fl = ii.length - 1;
          var center_point = new THREE.Vector3();
          var face = new Array(fl);
          for (var j = 0; j < fl; ++j) {
            var vv = vectors[ii[j]].clone();
            center_point.add(vv);
            corner_faces[ii[j]].push((face[j] = chamfer_vectors.push(vv) - 1));
          }
          center_point.divideScalar(fl);
          for (var j = 0; j < fl; ++j) {
            var vv = chamfer_vectors[face[j]];
            vv.subVectors(vv, center_point)
              .multiplyScalar(chamfer)
              .addVectors(vv, center_point);
          }
          face.push(ii[fl]);
          chamfer_faces.push(face);
        }
        for (var i = 0; i < faces.length - 1; ++i) {
          for (var j = i + 1; j < faces.length; ++j) {
            var pairs = [],
              lastm = -1;
            for (var m = 0; m < faces[i].length - 1; ++m) {
              var n = faces[j].indexOf(faces[i][m]);
              if (n >= 0 && n < faces[j].length - 1) {
                if (lastm >= 0 && m != lastm + 1) pairs.unshift([i, m], [j, n]);
                else pairs.push([i, m], [j, n]);
                lastm = m;
              }
            }
            if (pairs.length != 4) continue;
            chamfer_faces.push([
              chamfer_faces[pairs[0][0]][pairs[0][1]],
              chamfer_faces[pairs[1][0]][pairs[1][1]],
              chamfer_faces[pairs[3][0]][pairs[3][1]],
              chamfer_faces[pairs[2][0]][pairs[2][1]],
              -1,
            ]);
          }
        }
        for (var i = 0; i < corner_faces.length; ++i) {
          var cf = corner_faces[i],
            face = [cf[0]],
            count = cf.length - 1;
          while (count) {
            for (var m = faces.length; m < chamfer_faces.length; ++m) {
              var index = chamfer_faces[m].indexOf(face[face.length - 1]);
              if (index >= 0 && index < 4) {
                if (--index == -1) index = 3;
                var next_vertex = chamfer_faces[m][index];
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
    
      static create_geom(vertices, faces, radius, tab, af, chamfer) {
        var vectors = new Array(vertices.length);
        for (var i = 0; i < vertices.length; ++i) {
          vectors[i] = new THREE.Vector3().fromArray(vertices[i]).normalize();
        }
        var cg = this.chamfer_geom(vectors, faces, chamfer);
        var geom = this.make_geom(cg.vectors, cg.faces, radius, tab, af);
        //var geom = this.make_geom(vectors, faces, radius, tab, af); // Without chamfer
        geom.cannon_shape = this.create_shape(vectors, faces, radius);
        return geom;
      }
      
      static create_shape(vertices, faces, radius) {
        var cv = new Array(vertices.length),
          cf = new Array(faces.length);
        for (var i = 0; i < vertices.length; ++i) {
          var v = vertices[i];
          cv[i] = new CANNON.Vec3(v.x * radius, v.y * radius, v.z * radius);
        }
        for (var i = 0; i < faces.length; ++i) {
          cf[i] = faces[i].slice(0, faces[i].length - 1);
        }
        return new CANNON.ConvexPolyhedron(cv, cf);
      }
    
      static create_d6_geometry(radius) {
        var vertices = [
          [-1, -1, -1],
          [1, -1, -1],
          [1, 1, -1],
          [-1, 1, -1],
          [-1, -1, 1],
          [1, -1, 1],
          [1, 1, 1],
          [-1, 1, 1],
        ];
        var faces = [
          [0, 3, 2, 1, 1],
          [1, 2, 6, 5, 2],
          [0, 1, 5, 4, 3],
          [3, 7, 6, 2, 4],
          [0, 4, 7, 3, 5],
          [4, 5, 6, 7, 6],
        ];
        return this.create_geom(vertices, faces, radius, 0.1, Math.PI / 4, 0.96);
      }

      static calc_texture_size(approx) {
        return Math.pow(2, Math.floor(Math.log(approx) / Math.log(2)));
      }
}