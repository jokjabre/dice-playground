const physics = {

    gravity: {
        x: 0,
        y: -9.8 * 200,
        z: -9.8 * 120
    },

    setWorldOptions: function(world) {
        //world.gravity.set(0, 0, -9.8 * 800);
        var x = 0, y = -9.8 * 200, z = -9.8 * 120;
        world.gravity.set(x, y, z);

        world.broadphase = new CANNON.NaiveBroadphase();
        world.solver.iterations = 200;
    },
    
}