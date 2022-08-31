import { $t } from "../../teal.js";
import { SettingsRenderer } from "./settingsRenderer.js";
import { world } from "./world.js";

export const scene = {
  instance: new THREE.Scene(),

  ambientLight: new THREE.AmbientLight(options.colors.ambient_light),
  camera: new THREE.PerspectiveCamera(20, 1, 1, 1000),
  light: new THREE.SpotLight(options.colors.spotlight, 2.0),
  desk: new THREE.Mesh(
    new THREE.PlaneGeometry(),
    new THREE.MeshPhongMaterial()
  ),
  barrier: new THREE.Mesh(
    new THREE.PlaneGeometry(),
    new THREE.MeshPhongMaterial()
  ),
  renderer: window.WebGLRenderingContext
    ? new THREE.WebGLRenderer({ antialias: true })
    : new THREE.CanvasRenderer({ antialias: true }),

  add: function (item) {
    this.instance.add(item);
  },
  remove: function (item) {
    this.instance.remove(item);
  },

  recreate_ambient_light: function () {
    this.remove(this.ambientLight);

    this.ambientLight = new THREE.AmbientLight(options.colors.ambient_light);

    this.add(this.ambientLight);
  },

  recreate_camera: function () {
    this.remove(this.camera);

    let dimensions = playingField.dimensions;
    this.camera.aspect = dimensions.scene_width / dimensions.scene_height;
    this.camera.far = dimensions.wall_height * 1.3;
    this.camera.position.z = dimensions.wall_height;
    this.camera.updateProjectionMatrix();

    this.add(this.camera);
  },

  recreate_light: function () {
    this.remove(this.light);

    var max_width = Math.max(
      playingField.dimensions.scene_width,
      playingField.dimensions.scene_height
    );

    this.light.position.set(-max_width / 2, max_width / 2, max_width * 2);
    this.light.target.position.set(0, 1, 0);
    this.light.distance = max_width * 5;
    this.light.castShadow = true;
    this.light.shadowCameraNear = max_width / 10;
    this.light.shadowCameraFar = max_width * 5;
    this.light.shadowCameraFov = 50;
    this.light.shadowBias = 0.001;
    this.light.shadowDarkness = 1.1;
    this.light.shadowMapWidth = 1024;
    this.light.shadowMapHeight = 1024;

    this.add(this.light);
  },

  recreate_desk: function () {
    this.remove(this.desk);

    this.desk = new THREE.Mesh(new THREE.PlaneGeometry(
        playingField.dimensions.scene_width * 2,
        playingField.dimensions.scene_height * 2,
        1,
        1
        ),
        new THREE.MeshPhongMaterial()
    );
    this.desk.material.color = new THREE.Color(options.colors.desk);
    this.desk.receiveShadow = options.use_shadows;

    this.add(this.desk);
  },

  recreate_renderer: function () {
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.setClearColor(0xffffff, 1);

    this.renderer.setSize(playingField.dimensions.scene_width * 2, playingField.dimensions.scene_height * 2);
  },
  recreate_barriers: function() {
    this.remove(this.barrier);
    this.barrier = new THREE.Mesh(new THREE.PlaneGeometry(
        playingField.dimensions.scene_width * 2,
        playingField.dimensions.scene_height * 2,
        1,
        1
        ),
        world.objects.barrier_left_material
    );
      this.barrier.material.color = new THREE.Color(0x223355);
      this.barrier.receiveShadow = options.use_shadows;

      this.barrier.body = world.objects.barrier_left_body;
      this.barrier.position.set(-54.60804577227019, -60.08322845939975, 44.060798706154316);

      this.add(this.barrier);
  },

  rerender: function () {
    this.recreate_renderer();
    this.recreate_ambient_light();
    this.recreate_camera();
    this.recreate_light();
    this.recreate_desk();

    // this.recreate_barriers();

    this.renderer.render(this.instance, this.camera);

    if(!$t.writeDebugInfo) return;
    let ren = new SettingsRenderer();

    ["position", "rotation"].forEach(prop => {
      ren.addVector(scene.camera[prop], `camera_${prop}`, function(vector) {
        scene.camera[prop].set(vector.x, vector.y, vector.z);
        scene.camera.updateProjectionMatrix();
      })
    });

    ren.addVector(scene.camera.quaternion, "camera_quaternion", function(vector) {
      vector.divideScalar(100);
      scene.camera.quaternion.set(vector.x, vector.y, vector.z, scene.camera.quaternion.w);
      scene.camera.updateProjectionMatrix();
    });

    ["far", "fov"].forEach(prop => {
      ren.add(scene.camera[prop], `camera_${prop}`, function(val) {
        scene.camera[prop] = val;
        scene.camera.updateProjectionMatrix();
      })
    })

  },
};
