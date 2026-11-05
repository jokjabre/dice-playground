"use strict";

import { Geometry } from "./objects/geometry.js";
import { $t } from "../teal.js";
import { diceFactory } from "./objects/diceFactory.js";
import { physics } from "./objects/physics.js";
import { world } from "./objects/world.js";
import { scene } from "./objects/scene.js";
import { options } from "../src/config/options.js";
import { dimensions, playingField } from "../src/config/dimensions.js";
import { rndGen } from "../src/utils/rndGen.js";
import { EventBus } from "../src/core/EventBus.js";
import { GameLoop, StandardRollStrategy, ContinuousMotionStrategy } from "../src/core/GameLoop.js";
import { MeshBodySync } from "../src/rendering/MeshBodySync.js";
import { FaceReader } from "../src/determinism/FaceReader.js";
import { FaceShifter } from "../src/determinism/FaceShifter.js";
import { OutcomePredictor } from "../src/determinism/OutcomePredictor.js";
import { InputManager } from "../src/input/InputManager.js";
import { RaycastPicker } from "../src/input/RaycastPicker.js";
import { MotionController } from "../src/input/MotionController.js";

export class DiceBox {

   constructor(container) {

        this.dices = [];
        this.eventBus = new EventBus();
        container.appendChild(scene.renderer.domElement);
        
        this.reinit(container);

        world.initiate();

        this.last_time = 0;
        this.running = false;
        
        // Initialize modular GameLoop
        this.gameLoop = new GameLoop({
            stepPhysics: (dt) => {
                world.instance.step(dt);
            },
            syncMeshes: () => {
                this.sync_meshes();
            },
            render: () => {
                scene.renderer.render(scene.instance, scene.camera);
            },
            getDices: () => diceFactory.dices,
            getDiceValues: () => this.get_dice_values(diceFactory.dices),
            eventBus: this.eventBus,
            options: options
        });

        // Forward loop settle event to DiceBox callback
        this.eventBus.on('roll:settle', ({ values }) => {
            this.running = false;
            if (this.callback) {
                const cb = this.callback;
                this.callback = null;
                cb.call(this, values);
            }
        });

        scene.renderer.render(scene.instance, scene.camera);
    }

    sync_meshes() {
        MeshBodySync.syncScene(scene.instance);
    }

    reinit(container) {
        playingField.dimensions.re_init(container);
        if (world.updateDimensions) {
            world.updateDimensions();
        }
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
        return FaceReader.getDiceValue(dice);
    }

    get_dice_values(dices) {
        return FaceReader.getDiceValues(dices);
    }

    emulate_throw () {
        const predictor = new OutcomePredictor({
            physicsWorld: world,
            options: options
        });
        return predictor.emulateThrow({
            world: world,
            dices: diceFactory.dices,
            frameRate: options.frame_rate
        });
    }

    /**
     * Legacy animation method maintained for backwards compatibility.
     * New code routes through this.gameLoop.
     */
    __animate (threadid) {
        this.gameLoop.start();
    }

    clear () {
        if(options.continuous_rolling) return;

        this.gameLoop.stop();
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
        FaceShifter.shiftDiceFaces(dice, value, res);
    }

    roll (vectors, values, callback) {

        if (values != undefined && values.length) {
            options.use_adaptive_timestep = false;
            const predictor = new OutcomePredictor({
                physicsWorld: world,
                options: options
            });
            predictor.predictAndShift({
                prepareDices: (vecs) => this.prepare_dices_for_roll(vecs),
                vectors: vectors,
                targetValues: values,
                dices: diceFactory.dices,
                world: world,
                frameRate: options.frame_rate
            });
        } else {
            this.prepare_dices_for_roll(vectors);
        }
        this.callback = callback;
        this.running = (new Date()).getTime();
        this.last_time = 0;

        // Choose strategy based on continuous_rolling option
        if (options.continuous_rolling) {
            this.gameLoop.start(new ContinuousMotionStrategy());
        } else {
            this.gameLoop.start(new StandardRollStrategy({
                onSettle: (resultValues) => {
                    this.running = false;
                    if (this.callback) {
                        const cb = this.callback;
                        this.callback = null;
                        cb.call(this, resultValues);
                    }
                }
            }));
        }
    }

    search_dice_by_mouse (ev) {
        if (!this.raycastPicker) {
            this.raycastPicker = new RaycastPicker({
                camera: scene.camera,
                dimensions: playingField
            });
        }
        var m = $t.get_mouse_coords(ev);
        return this.raycastPicker.pick(m.x, m.y, diceFactory.dices);
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

        if (this.inputManager) {
            this.inputManager.destroy();
        }

        this.inputManager = new InputManager({
            container: container,
            dimensions: playingField,
            options: options,
            onThrow: (vectors, boost, dist) => {
                if (options.diceCount == 0) return;
                var uat = options.use_adaptive_timestep;
                function roll(request_results) {
                    box.clear();
                    box.roll(vectors, request_results, function(result) {
                        if (after_roll) after_roll.call(box, result);
                        box.rolling = false;
                        options.use_adaptive_timestep = uat;
                    });
                }
                box.rolling = true;
                if (before_roll) before_roll.call(box, vectors, roll);
                else roll();
            }
        });

        if (this.motionController) {
            this.motionController.destroy();
        }

        this.motionController = new MotionController({
            physicsWorld: world.physicsWorld,
            getDices: () => diceFactory.dices,
            eventBus: this.eventBus
        });

        if (options.continuous_rolling) {
            this.motionController.enable();
        }
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