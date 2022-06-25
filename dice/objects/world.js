const world = {
    instance: new CANNON.World(),
    initiate: function() {

        //world.gravity.set(0, 0, -9.8 * 800);
        this.instance.gravity.set(physics.gravity.x, physics.gravity.y, physics.gravity.z);

        this.instance.broadphase = new CANNON.NaiveBroadphase();
        this.instance.solver.iterations = 200;

        this.objects.initiate();

        this.instance.addContactMaterial(this.objects.dice_contact);          
        this.instance.addContactMaterial(this.objects.desk_contact);          
        this.instance.addContactMaterial(this.objects.barrier_left_contact);  
        this.instance.addContactMaterial(this.objects.barrier_right_contact); 
        this.instance.addContactMaterial(this.objects.barrier_top_contact);   
        this.instance.addContactMaterial(this.objects.barrier_bottom_contact);

        this.instance.add(this.objects.desk_body);          
        this.instance.add(this.objects.barrier_left_body);  
        this.instance.add(this.objects.barrier_right_body); 
        this.instance.add(this.objects.barrier_top_body);   
        this.instance.add(this.objects.barrier_bottom_body);
    },

    objects: {
        dice_material:           new CANNON.Material(),
        desk_material:           new CANNON.Material(),
        barrier_left_material:   new CANNON.Material(),
        barrier_right_material:  new CANNON.Material(),
        barrier_top_material:    new CANNON.Material(),
        barrier_bottom_material: new CANNON.Material(),

        initiate: function() {
            
            this.dice_contact           = new CANNON.ContactMaterial(this.dice_material,           this.dice_material, 0,    0.5);
            this.desk_contact           = new CANNON.ContactMaterial(this.desk_material,           this.dice_material, 0.01, 0.5);
            this.barrier_left_contact   = new CANNON.ContactMaterial(this.barrier_left_material,   this.dice_material, 0,    1.0);
            this.barrier_right_contact  = new CANNON.ContactMaterial(this.barrier_right_material,  this.dice_material, 0,    1.0);
            this.barrier_top_contact    = new CANNON.ContactMaterial(this.barrier_top_material,    this.dice_material, 0,    1.0);
            this.barrier_bottom_contact = new CANNON.ContactMaterial(this.barrier_bottom_material, this.dice_material, 0,    1.0);

            this.desk_body              = new CANNON.RigidBody(0, new CANNON.Plane(), this.desk_material);
            this.barrier_left_body      = new CANNON.RigidBody(0, new CANNON.Plane(), this.barrier_left_material);
            this.barrier_right_body     = new CANNON.RigidBody(0, new CANNON.Plane(), this.barrier_right_material);
            this.barrier_top_body       = new CANNON.RigidBody(0, new CANNON.Plane(), this.barrier_top_material);
            this.barrier_bottom_body    = new CANNON.RigidBody(0, new CANNON.Plane(), this.barrier_bottom_material);

            this.barrier_left_body.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);
            this.barrier_left_body.position.set(0, options.scene_height * 0.93, 0);

            this.barrier_right_body.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
            this.barrier_right_body.position.set(0, -options.scene_height * 0.93, 0);

            this.barrier_top_body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), -Math.PI / 2);
            this.barrier_top_body.position.set(options.scene_width * 0.93, 0, 0);

            this.barrier_bottom_body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI / 2);
            this.barrier_bottom_body.position.set(-options.scene_width * 0.93, 0, 0);

        }
    },

}