const world = {
    instance: new CANNON.World(),
    initiate: function() {
        //world.gravity.set(0, 0, -9.8 * 800);
        this.instance.gravity.set(physics.gravity.x, physics.gravity.y, physics.gravity.z);

        this.instance.broadphase = new CANNON.NaiveBroadphase();
        this.instance.solver.iterations = 200;
    }
}