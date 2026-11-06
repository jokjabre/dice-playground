/**
 * Ambient types for the vendored Three r73 build.
 *
 * The rendering package loads the UMD build at runtime, so there is no module
 * declaration to import. Keeping the global narrow here prevents other
 * packages from treating Three as a build-time dependency.
 */
declare const THREE: any;

interface Window {
  THREE?: typeof THREE;
}
