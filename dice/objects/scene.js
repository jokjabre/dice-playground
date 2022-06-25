const scene = {
    instance: new THREE.Scene(),
    addAmbientLight: function() {
        this.instance.add(new THREE.AmbientLight(options.lighting.scene_ambientLight));
    }
}