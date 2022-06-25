const options = {
    scene_width: 0,
    scene_height:0,

    frame_rate: 1 / 60,
    diceCount: 4,
    use_adaptive_timestep: true,

    material_options: {
        specular: 0x172022,
        color: 0xf0f0f0,
        shininess: 40,
        shading: THREE.FlatShading,
    },

    label_color: '#aaaaaa',
    dice_color: '#202020',
    ambient_light_color: 0xf0f5fb,
    spot_light_color: 0xefdfd5,
    desk_color: 0x2596be, //0xdfdfdf,
    use_shadows: true,

    dice_mass: 300,
    dice_inertia: 13,

    scale: 50,

    lighting: {
        scene_ambientLight: 0xf0f5fb,
    },

    threeJS: {
        ambientLight: new THREE.AmbientLight(this.ambient_light_color)
    }
}