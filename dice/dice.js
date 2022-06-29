"use strict";


(function(dice) {

    var that = this;

    this.dice_box = function(container, dimentions) {

        this.dices = [];
        container.appendChild(scene.renderer.domElement);
        
        this.reinit(container, dimentions);

        world.initiate();

        this.last_time = 0;
        this.running = false;
        
        scene.renderer.render(scene.instance, scene.camera);
    }

    this.dice_box.prototype.reinit = function(container, dimentions) {
        playingField.dimensions.re_init(container);
        scene.rerender();
    }


    this.dice_box.prototype.generate_vectors = function(vector, boost) {
        var vectors = [];
        
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
            vectors.push({ pos: pos, velocity: velocity, angle: angle, axis: axis });
        }
        return vectors;
    }

    this.dice_box.prototype.create_dice = function(pos, velocity, angle, axis) {
        var dice = diceFactory.createDice(that, pos, velocity, angle, axis);
        // dice.castShadow = true;
        // dice.body = new CANNON.RigidBody(physics.die_mass,
        //         dice.geometry.cannon_shape, this.dice_body_material);
        // dice.body.position.set(pos.x, pos.y, pos.z);
        // dice.body.quaternion.setFromAxisAngle(new CANNON.Vec3(axis.x, axis.y, axis.z), axis.a * Math.PI * 2);
        // dice.body.angularVelocity.set(angle.x, angle.y, angle.z);
        // dice.body.velocity.set(velocity.x, velocity.y, velocity.z);
        // dice.body.linearDamping = 0.1;
        // dice.body.angularDamping = 0.1;
        // scene.add(dice);
        // this.dices.push(dice);
        // world.add(dice.body);
    }

    this.dice_box.prototype.check_if_throw_finished = function() {
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

    function get_dice_value(dice) {
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

    function get_dice_values(dices) {
        var values = [];
        for (var i = 0, l = dices.length; i < l; ++i) {
            values.push(get_dice_value(dices[i]));
        }
        return values;
    }

    this.dice_box.prototype.emulate_throw = function() {
        while (!this.check_if_throw_finished()) {
            ++this.iteration;
            world.instance.step(options.frame_rate);
        }
        return get_dice_values(diceFactory.dices);
    }

    this.dice_box.prototype.__animate = function(threadid) {
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
            if (this.callback) this.callback.call(this, get_dice_values(diceFactory.dices));
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

    this.dice_box.prototype.clear = function() {
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

    this.dice_box.prototype.prepare_dices_for_roll = function(vectors) {
        this.clear();
        this.iteration = 0;
        for (var i in vectors) {
            this.create_dice(vectors[i].pos, vectors[i].velocity,
                    vectors[i].angle, vectors[i].axis);
        }
    }

    function shift_dice_faces(dice, value, res) {
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

    this.dice_box.prototype.roll = function(vectors, values, callback) {
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

    this.dice_box.prototype.search_dice_by_mouse = function(ev) {
        var m = $t.get_mouse_coords(ev);
        var intersects = (new THREE.Raycaster(scene.camera.position, 
                    (new THREE.Vector3((m.x - this.cw) / playingField.dimensions.aspect,
                                       1 - (m.y - playingField.dimensions.scene_height) / playingField.dimensions.aspect, playingField.dimensions.scene_width/ 9))
                    .sub(scene.camera.position).normalize())).intersectObjects(diceFactory.dices);
        if (intersects.length) return intersects[0].object;
    }

    function throw_dices(box, vector, boost, dist, before_roll, after_roll) {
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
        var vectors = box.generate_vectors(vector, boost);
        box.rolling = true;
        if (before_roll) before_roll.call(box, vectors, roll);
        else roll();
    }

    this.dice_box.prototype.bind_mouse = function(container, before_roll, after_roll) {
        var box = this;
        $t.bind(container, ['mousedown', 'touchstart'], function(ev) {
            ev.preventDefault();
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
                throw_dices(box, vector, boost, dist, before_roll, after_roll);
        });
    }


    this.dice_box.prototype.start_throw = function(before_roll, after_roll) {
        var box = this;
        if (box.rolling) return;
            var vector = { x: (rndGen.rnd() * 2 - 1) * playingField.dimensions.scene_width, y: -(rndGen.rnd() * 2 - 1) * playingField.dimensions.scene_height};
            var dist = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
            var boost = (rndGen.rnd() + 3) * dist;
            throw_dices(box, vector, boost, dist, before_roll, after_roll);
    }

}).apply(teal.dice = teal.dice || {});

