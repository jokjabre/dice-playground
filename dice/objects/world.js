import { physics } from "./physics.js";

export const world = {
    instance: new CANNON.World(),

    add: function(item) {
        this.instance.add(item);
    },
    remove: function(item) {
        this.instance.remove(item);
    },

    initiate: function() {

        //world.gravity.set(0, 0, -9.8 * 800);
        this.instance.gravity.set(physics.world_gravity.x, physics.world_gravity.y, physics.world_gravity.z);

        this.instance.broadphase = new CANNON.NaiveBroadphase();
        this.instance.solver.iterations = 20;

        this.objects.initiate();

        this.instance.addContactMaterial(this.objects.die_contact);          
        this.instance.addContactMaterial(this.objects.desk_contact);     
        this.instance.addContactMaterial(this.objects.screen_contact);

        this.instance.addContactMaterial(this.objects.barrier_left_contact);  
        this.instance.addContactMaterial(this.objects.barrier_right_contact); 
        this.instance.addContactMaterial(this.objects.barrier_top_contact);   
        this.instance.addContactMaterial(this.objects.barrier_bottom_contact);

        this.add(this.objects.desk_body);          
        this.add(this.objects.screen_body);          
        this.add(this.objects.barrier_left_body);  
        this.add(this.objects.barrier_right_body); 
        this.add(this.objects.barrier_top_body);   
        this.add(this.objects.barrier_bottom_body);
    },

    objects: {
        die_material:            new CANNON.Material(),
        desk_material:           new CANNON.Material(),
        barrier_left_material:   new CANNON.Material(),
        barrier_right_material:  new CANNON.Material(),
        barrier_top_material:    new CANNON.Material(),
        barrier_bottom_material: new CANNON.Material(),
        
        desk_body           : undefined,
        barrier_left_body   : undefined,
        barrier_right_body  : undefined,
        barrier_top_body    : undefined,
        barrier_bottom_body : undefined,

        initiate: function() {
            var objs = this;
            var obj_arr = ['die', 'desk', 'screen', 'barrier_left', 'barrier_right', 'barrier_top', 'barrier_bottom'];
            
            var create_material = function(obj) {
                objs[`${obj}_material`] = new CANNON.Material();
            };

            //creates a contact material between a die and a chosen material
            var create_contact = function(obj) {
                objs[`${obj}_contact`] = new CANNON.ContactMaterial(
                    objs[`${obj}_material`],
                    objs.die_material, 
                    physics.die_friction[obj],
                    physics.die_restitution[obj]);
            };

            var create_body = function(obj) {
                objs[`${obj}_body`] = new CANNON.RigidBody(0, new CANNON.Plane(), objs[`${obj}_material`]);
            };

//------------------ code --------------
            obj_arr.forEach(obj => {
                create_material(obj);
                create_contact(obj);
                if(obj === 'die') return;

                create_body(obj);

            });

            this.barrier_top_body.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);
            this.barrier_top_body.position.set(0, playingField.dimensions.scene_height * 0.93, 0);

            this.barrier_bottom_body.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
            this.barrier_bottom_body.position.set(0, -playingField.dimensions.scene_height * 0.93, 0);

            this.barrier_right_body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), -Math.PI / 2);
            this.barrier_right_body.position.set(playingField.dimensions.scene_width * 0.93, 0, 0);

            this.barrier_left_body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI / 2);
            this.barrier_left_body.position.set(-playingField.dimensions.scene_width * 0.93, 0, 0);

            this.screen_body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI);
            this.screen_body.position.set(playingField.dimensions.scene_width, playingField.dimensions.scene_height, 2700);
        }
    },

}