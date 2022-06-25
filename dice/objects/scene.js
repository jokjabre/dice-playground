const scene = {
  instance: new THREE.Scene(),
  ambientLight: new THREE.AmbientLight(options.colors.ambient_light),
  camera: new THREE.PerspectiveCamera(20, 1, 1, 1000),
  light: new THREE.SpotLight(options.colors.spotlight, 2.0),

  add: function (item) {
    this.instance.add(item);
  },
  remove: function (item) {
    this.instance.remove(item);
  },

  recreate_camera: function () {
    //this.remove(this.camera);
    let dimensions = playingField.dimensions;
    this.camera.aspect = dimensions.scene_width / dimensions.scene_height;
    this.camera.far =  dimensions.wall_height * 1.3;

    // this.camera = new THREE.PerspectiveCamera(
    //   20,
    //   dimensions.scene_width / dimensions.scene_height,
    //   1,
    //   dimensions.wall_height * 1.3
    // );
    this.camera.position.z = dimensions.wall_height;
    this.camera.updateProjectionMatrix();
    // this.add(this.camera);
  },

  recreate_light: function () {
    var max_width = Math.max(
      playingField.dimensions.scene_width,
      playingField.dimensions.scene_height
    );

    this.light.position.set(-max_width / 2, max_width / 2, max_width * 2);
    this.light.target.position.set(0, 0, 0);
    this.light.distance = max_width * 5;
    this.light.castShadow = true;
    this.light.shadowCameraNear = max_width / 10;
    this.light.shadowCameraFar = max_width * 5;
    this.light.shadowCameraFov = 50;
    this.light.shadowBias = 0.001;
    this.light.shadowDarkness = 1.1;
    this.light.shadowMapWidth = 1024;
    this.light.shadowMapHeight = 1024;

  },
};
