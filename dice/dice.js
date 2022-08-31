"use strict";

import { Geometry } from "./objects/geometry.js";
import { $t } from "../teal.js";
import { diceFactory } from "./objects/diceFactory.js";
import { physics } from "./objects/physics.js";
import { world } from "./objects/world.js";
import { scene } from "./objects/scene.js";

export class DiceBox {

   constructor(container) {

        this.dices = [];
        container.appendChild(scene.renderer.domElement);
        
        this.reinit(container);

        world.initiate();

        this.last_time = 0;
        this.running = false;
        
        scene.renderer.render(scene.instance, scene.camera);
    }

    reinit(container) {
        playingField.dimensions.re_init(container);
        scene.rerender(); 
    }

    check_if_throw_finished () {
        if(options.continuous_rolling) return false;
        
        var res = true;
        var e = 6;
        if (this.iteration < 10 / options.frame_rate) {
            for (var i = 0; i < diceFactory.dices.length; ++i) {
                var dice = diceFactory.dices[i];
                if (dice.dice_stopped === true) continue;
                var a = dice.body.angularVelocity, v = dice.body.velocity;
                if (Math.abs(a.x) < e && Math.abs(a.y) < e && Math.abs(a.z) < e &&
                        Math.abs(v.x) < e && Math.abs(v.y) < e && Math.abs(v.z) < e) {
                    if (dice.dice_stopped) {
                        if (this.iteration - dice.dice_stopped > 3) {
                            dice.dice_stopped = true;
                            continue;
                        }
                    }
                    else dice.dice_stopped = this.iteration;
                    res = false;
                }
                else {
                    dice.dice_stopped = undefined;
                    res = false;
                }
            }
        }
        return res;
    }

    get_dice_value(dice) {
        var vector = new THREE.Vector3(0, 0, 1);
        var closest_face, closest_angle = Math.PI * 2;
        for (var i = 0, l = dice.geometry.faces.length; i < l; ++i) {
            var face = dice.geometry.faces[i];
            if (face.materialIndex == 0) continue;
            var angle = face.normal.clone().applyQuaternion(dice.body.quaternion).angleTo(vector);
            if (angle < closest_angle) {
                closest_angle = angle;
                closest_face = face;
            }
        }
        var matindex = closest_face.materialIndex - 1;

        return matindex;
    }

    get_dice_values(dices) {
        var values = [];
        for (var i = 0, l = dices.length; i < l; ++i) {
            values.push(this.get_dice_value(dices[i]));
        }
        return values;
    }

    emulate_throw () {
        while (!this.check_if_throw_finished()) {
            ++this.iteration;
            world.instance.step(options.frame_rate);
        }
        return this.get_dice_values(diceFactory.dices);
    }

    __animate (threadid) {
        var time = (new Date()).getTime();
        var time_diff = (time - this.last_time) / 1000;
        if (time_diff > 3) time_diff = options.frame_rate;
        ++this.iteration;
        if (options.use_adaptive_timestep) {
            while (time_diff > options.frame_rate * 1.1) {
                world.instance.step(options.frame_rate);
                time_diff -= options.frame_rate;
            }
            world.instance.step(time_diff);
        }
        else {
            world.instance.step(options.frame_rate);
        }

        for (var i in scene.instance.children) {
            var interact = scene.instance.children[i];
            if (interact.body != undefined) {
                interact.position.copy(interact.body.position);
                interact.quaternion.copy(interact.body.quaternion);
            }
        }
        scene.renderer.render(scene.instance, scene.camera);
        this.last_time = this.last_time ? time : (new Date()).getTime();
        if (this.running == threadid && this.check_if_throw_finished()) {
            this.running = false;
            if (this.callback) this.callback.call(this, this.get_dice_values(diceFactory.dices));
        }
        if (this.running == threadid) {
            (function(t, tid, uat) {
                if (!uat && time_diff < options.frame_rate) {
                    setTimeout(function() { requestAnimationFrame(function() { t.__animate(tid); }); },
                        (options.frame_rate - time_diff) * 1000);
                }
                else requestAnimationFrame(function() { t.__animate(tid); });
            })(this, threadid, options.use_adaptive_timestep);
        }
    }

    clear () {
        if(options.continuous_rolling) return;

        this.running = false;
        var dice;
        while (dice = diceFactory.dices.pop()) {
            scene.instance.remove(dice); 
            if (dice.body) world.remove(dice.body);
        }
        if (this.pane) scene.instance.remove(this.pane);
        scene.renderer.render(scene.instance, scene.camera);

        setTimeout(function() { scene.renderer.render(scene.instance, scene.camera); }, 100);
    }

    prepare_dices_for_roll (vectors) {
        
        this.clear();
        this.iteration = 0;
        for (var i in vectors) {
            if(diceFactory.dices.length > i && options.continuous_rolling) {

                let vector = vectors[i];
                diceFactory.dices[i].body.quaternion.setFromAxisAngle(new CANNON.Vec3(vector.axis.x, vector.axis.y, vector.axis.z), vector.axis.a * Math.PI * 2);
                diceFactory.dices[i].body.angularVelocity.set(vector.angle.x *2, vector.angle.y *2, vector.angle.z *2);
                diceFactory.dices[i].body.velocity.set(vector.velocity.x *2, vector.velocity.y *2, vector.velocity.z *2);
                diceFactory.dices[i].dice_stopped = 0;
                continue;
            }

            diceFactory.createDice(this, vectors[i].pos, vectors[i].velocity,
                    vectors[i].angle, vectors[i].axis);
        }
    }

    shift_dice_faces(dice, value, res) {
        var r =  [1, 6];
        if (!(value >= r[0] && value <= r[1])) return;
        var num = value - res;
        var geom = dice.geometry.clone();
        for (var i = 0, l = geom.faces.length; i < l; ++i) {
            var matindex = geom.faces[i].materialIndex;
            if (matindex == 0) continue;
            matindex += num - 1;
            while (matindex > r[1]) matindex -= r[1];
            while (matindex < r[0]) matindex += r[1];
            geom.faces[i].materialIndex = matindex + 1;
        }
        dice.geometry = geom;
    }

    roll (vectors, values, callback) {

        this.prepare_dices_for_roll(vectors);
        if (values != undefined && values.length) {
            options.use_adaptive_timestep = false;
            var res = this.emulate_throw();
            this.prepare_dices_for_roll(vectors);
            for (var i in res)
                shift_dice_faces(diceFactory.dices[i], values[i], res[i]);
        }
        this.callback = callback;
        this.running = (new Date()).getTime();
        this.last_time = 0;
        this.__animate(this.running);
    }

    search_dice_by_mouse (ev) {
        var m = $t.get_mouse_coords(ev);
        var intersects = (new THREE.Raycaster(scene.camera.position, 
                    (new THREE.Vector3((m.x - this.cw) / playingField.dimensions.aspect,
                                       1 - (m.y - playingField.dimensions.scene_height) / playingField.dimensions.aspect, playingField.dimensions.scene_width/ 9))
                    .sub(scene.camera.position).normalize())).intersectObjects(diceFactory.dices);
        if (intersects.length) return intersects[0].object;
    }

    throw_dices(box, vector, boost, dist, before_roll, after_roll) {
        var uat = options.use_adaptive_timestep;
        function roll(request_results) {
            if (after_roll) {
                box.clear();
                box.roll(vectors, request_results, function(result) {
                    if (after_roll) after_roll.call(box, result);
                    box.rolling = false;
                    options.use_adaptive_timestep = uat;
                });
            }
        }
        vector.x /= dist; vector.y /= dist;
        if (options.diceCount == 0) return;
        var vectors = Geometry.generate_vectors(vector, boost);
        box.rolling = true;
        if (before_roll) before_roll.call(box, vectors, roll);
        else roll();
    }

    bind_mouse (container, before_roll, after_roll) {
        var box = this;
        $t.bind(container, ['mousedown', 'touchstart'], function(ev) {
            //ev.preventDefault();
            box.mouse_time = (new Date()).getTime();
            box.mouse_start = $t.get_mouse_coords(ev);
        });
        $t.bind(container, ['mouseup', 'touchend'], function(ev) {
            if (box.rolling) {
                //return;

            }
            if (box.mouse_start == undefined) return;
            ev.stopPropagation();
            var m = $t.get_mouse_coords(ev);
            var vector = { x: m.x - box.mouse_start.x, y: -(m.y - box.mouse_start.y) };
            box.mouse_start = undefined;
            var dist = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
            if (dist < Math.sqrt(playingField.dimensions.scene_width* playingField.dimensions.scene_height* 0.01)) return;
            var time_int = (new Date()).getTime() - box.mouse_time;
            if (time_int > 2000) time_int = 2000;
            var boost = Math.sqrt((2500 - time_int) / 2500) * dist * 2;
                box.throw_dices(box, vector, boost, dist, before_roll, after_roll);
        });

        $t.bind(window, ['deviceorientation'], function(ev) {
            if(!options.continuous_rolling) return;

            let 
            oldVector = new THREE.Vector3(Geometry.calculate_quadrant(ev.alpha, 45) * (ev.alpha%45), ev.beta, ev.gamma),
            newVector = new THREE.Vector3(0, -9.8, 0),
            prop = physics.world_gravity;
            
            newVector.add(oldVector.negate());

            //Geometry.amplifyVector(newVector, 9.8 * 100);
            world.instance.gravity.set(newVector.x, newVector.y, newVector.z);
            $t.id("middleDiv").textContent = 
`
ev:
x: ${ev?.alpha?.toFixed(0)}, 
y: ${ev?.beta?.toFixed(0)}, 
z: ${ev?.gamma?.toFixed(0)}, 

oldVector:
x: ${oldVector.x.toFixed(0)}, 
y: ${oldVector.y.toFixed(0)}, 
z: ${oldVector.z.toFixed(0)}, 

newVector:
x: ${newVector.x.toFixed(0)}, 
y: ${newVector.y.toFixed(0)}, 
z: ${newVector.z.toFixed(0)}, 



`
            // diceFactory.dices.forEach(die => {
            //     die.body.angularVelocity.set(
            //         die.body.angularVelocity.x + ev.alpha / 50, 
            //         die.body.angularVelocity.y + ev.beta / 50, 
            //        0 );// die.body.angularVelocity.z + ev.gamma/ 50);
            //     die.dice_stopped = 0;
            // });
        });
        $t.bind(window, ['devicemotion'], function(ev) {
            if(!options.continuous_rolling) return;

            diceFactory.dices.forEach(die => {
                // die.body.velocity.set(
                //     die.body.velocity.x + ev.accelerationIncludingGravity.x * 5, 
                //     die.body.velocity.y + ev.accelerationIncludingGravity.y * 5, 
                //     (Math.abs(die.body.velocity.z) + Math.abs(ev.accelerationIncludingGravity.z) ) * (ev.accelerationIncludingGravity.z > 0 ? -1 : 1));
                die.dice_stopped = 0;
            });

            // diceFactory.dices[i].body.quaternion.setFromAxisAngle(new CANNON.Vec3(vector.axis.x, vector.axis.y, vector.axis.z), vector.axis.a * Math.PI * 2);
            //     diceFactory.dices[i].body.angularVelocity.set(vector.angle.x *2, vector.angle.y *2, vector.angle.z *2);
            //     diceFactory.dices[i].body.velocity.set(vector.velocity.x *2, vector.velocity.y *2, vector.velocity.z *2);
          
        });

    }


    start_throw (before_roll, after_roll) {
        var box = this;
        if (box.rolling) return;
            var vector = { x: (rndGen.rnd() * 2 - 1) * playingField.dimensions.scene_width, y: -(rndGen.rnd() * 2 - 1) * playingField.dimensions.scene_height};
            var dist = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
            var boost = (rndGen.rnd() + 3) * dist;
            this.throw_dices(box, vector, boost, dist, before_roll, after_roll);
    }

}
//teal.dice = teal.dice || {}