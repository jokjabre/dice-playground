export const defaultOptions = {
    continuous_rolling: false,
    frame_rate: 1 / 60,
    diceCount: 6,
    use_adaptive_timestep: false,

    material_options: {
        specular: 0x172022,
        color: 0xf0f0f0,
        shininess: 30,
        shading: typeof THREE !== 'undefined' ? THREE.FlatShading : 1,
    },

    use_shadows: true,

    // Camera controls (multiplier on the auto wall-height distance; far: 0 = auto)
    camera_distance: 1.0,
    camera_near: 1,
    camera_far: 0,

    colors: {
        dice_label: '#aaaaaa',
        dice_body: '#202020',
        spotlight: 0xefdfd5,
        desk: 0x2596be,
        ambient_light: 0xf0f5fb,
    },
};

export function createOptions(overrides = {}) {
    return {
        ...defaultOptions,
        ...overrides,
        material_options: {
            ...defaultOptions.material_options,
            ...(overrides.material_options || {})
        },
        colors: {
            ...defaultOptions.colors,
            ...(overrides.colors || {})
        }
    };
}

export const options = createOptions();
export default options;

