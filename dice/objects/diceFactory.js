import { $t } from "../../teal.js";
import { Geometry } from "./geometry.js";


export const diceFactory = {
  dices: [],

  createDice: function (that, pos, velocity, angle, axis) {
    var d6_geometry = Geometry.create_d6_geometry(playingField.dimensions.scale * 0.9);
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

    function create_die_materials(face_labels, size, margin) {
      
      function create_text_texture(text, color, back_color) {
        if (text == undefined) return null;
        var canvas = document.createElement("canvas");
        var context = canvas.getContext("2d");
        var ts = Geometry.calc_texture_size(size + size * 2 * margin) * 2;
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
