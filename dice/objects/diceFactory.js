const dice_geometry = {

  make_geom: function (vertices, faces, radius, tab, af) {
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
  },

  chamfer_geom: function (vectors, faces, chamfer) {
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
  },

  create_geom: function (vertices, faces, radius, tab, af, chamfer) {
    var vectors = new Array(vertices.length);
    for (var i = 0; i < vertices.length; ++i) {
      vectors[i] = new THREE.Vector3().fromArray(vertices[i]).normalize();
    }
    var cg = this.chamfer_geom(vectors, faces, chamfer);
    var geom = this.make_geom(cg.vectors, cg.faces, radius, tab, af);
    //var geom = this.make_geom(vectors, faces, radius, tab, af); // Without chamfer
    geom.cannon_shape = this.create_shape(vectors, faces, radius);
    return geom;
  },
  
  create_shape: function (vertices, faces, radius) {
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
  },

  create_d6_geometry: function (radius) {
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
}

const diceFactory = {
  dices: [],

  createDice: function (that, pos, velocity, angle, axis) {
    var d6_geometry = dice_geometry.create_d6_geometry(playingField.dimensions.scale * 0.9);
    if (!that.die_material)
      that.die_material = new THREE.MeshFaceMaterial(
        create_die_materials(
          [" ", "0", "1", "2", "3", "4", "5", "6"],
          playingField.dimensions.scale / 2,
          1.0
        )
      );
      var dice = new THREE.Mesh(d6_geometry, that.die_material);
      dice.castShadow = true;
        dice.body = new CANNON.RigidBody(physics.die_mass,
                dice.geometry.cannon_shape, world.objects.dice_body_material);
        dice.body.position.set(pos.x, pos.y, pos.z);
        dice.body.quaternion.setFromAxisAngle(new CANNON.Vec3(axis.x, axis.y, axis.z), axis.a * Math.PI * 2);
        dice.body.angularVelocity.set(angle.x, angle.y, angle.z);
        dice.body.velocity.set(velocity.x, velocity.y, velocity.z);
        dice.body.linearDamping = 0.1;
        dice.body.angularDamping = 0.1;
        scene.add(dice);
        this.dices.push(dice);
        world.add(dice.body);
    return dice;

    function calc_texture_size(approx) {
      return Math.pow(2, Math.floor(Math.log(approx) / Math.log(2)));
    };

    function create_die_materials(face_labels, size, margin) {
      
      function create_text_texture(text, color, back_color) {
        if (text == undefined) return null;
        var canvas = document.createElement("canvas");
        var context = canvas.getContext("2d");
        var ts = calc_texture_size(size + size * 2 * margin) * 2;
        canvas.width = canvas.height = ts;
        context.font = ts / (1 + 2 * margin) + "pt Arial";
        context.fillStyle = back_color;
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillStyle = color;
        context.fillText(text, canvas.width / 2, canvas.height / 2);
        if (text == "6" || text == "9") {
          context.fillText("  .", canvas.width / 2, canvas.height / 2);
        }
        var texture = new THREE.Texture(canvas);
        texture.needsUpdate = true;
        return texture;
      }
      var materials = [];
      for (var i = 0; i < face_labels.length; ++i) {
      //options.colors.dice_body = `#${Math.floor(Math.random() * 16777215).toString(16)}`;
       
        materials.push(
          new THREE.MeshPhongMaterial(
            $t.copyto(options.material_options, {
              map: create_text_texture(
                face_labels[i],
                options.colors.dice_label,
                options.colors.dice_body
              ),
            })
          )
        );
      }
      return materials;
    }

    
  },
};
