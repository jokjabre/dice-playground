const options = {

    continuous_rolling: true,
    frame_rate: 1 / 60,
    diceCount: 6,
    use_adaptive_timestep: false,

    material_options: {
        specular: 0x172022,
        color: 0xf0f0f0,
        shininess: 30, //40
        shading: THREE.FlatShading,
    },

    use_shadows: true,
  
    colors: {
        dice_label: '#aaaaaa',
        dice_body: '#202020',
        spotlight: 0xefdfd5,
        desk:  0x2596be, //0xdfdfdf,,
        ambient_light: 0xf0f5fb,
    },

}