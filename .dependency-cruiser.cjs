/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-legacy-imports',
      severity: 'error',
      comment: 'New packages and apps must not import the frozen legacy tree.',
      from: { path: '^(packages|apps)/' },
      to: { path: '^legacy/' }
    },
    {
      name: 'three-only-in-rendering',
      severity: 'error',
      comment: 'Only @dice/rendering may reference the vendored Three build.',
      from: { pathNot: '^packages/rendering/' },
      to: { path: '^packages/rendering/vendor/three-r73/' }
    },
    {
      name: 'no-npm-three',
      severity: 'error',
      comment: 'Three is vendored behind @dice/rendering, not installed from npm.',
      from: {},
      to: { path: 'node_modules/three' }
    },
    {
      name: 'cannon-only-in-physics',
      severity: 'error',
      comment: 'Only @dice/physics may import cannon-es.',
      from: { pathNot: '^packages/physics/' },
      to: { path: 'node_modules/cannon-es' }
    },
    {
      name: 'core-has-no-workspace-deps',
      severity: 'error',
      comment: '@dice/core must not depend on any other workspace package.',
      from: { path: '^packages/core/' },
      to: { path: '^packages/(?!core/)' }
    },
    {
      name: 'physics-core-only',
      severity: 'error',
      comment: 'Physics may depend only on @dice/core.',
      from: { path: '^packages/physics/' },
      to: { path: '^packages/(?!core/|physics/)[^/]+/' }
    },
    {
      name: 'rendering-core-only',
      severity: 'error',
      comment: 'Rendering may depend only on @dice/core.',
      from: { path: '^packages/rendering/' },
      to: { path: '^packages/(?!core/|rendering/)[^/]+/' }
    },
    {
      name: 'dice-core-only',
      severity: 'error',
      comment: 'Dice may depend only on @dice/core.',
      from: { path: '^packages/dice/' },
      to: { path: '^packages/(?!core/|dice/)[^/]+/' }
    },
    {
      name: 'content-core-dice-only',
      severity: 'error',
      comment: '@dice/content may depend only on @dice/core and @dice/dice.',
      from: { path: '^packages/content/' },
      to: { path: '^packages/(?!core/|dice/)' }
    },
    {
      name: 'rules-core-only',
      severity: 'error',
      comment: '@dice/rules may depend only on @dice/core.',
      from: { path: '^packages/rules/' },
      to: { path: '^packages/(?!core/)' }
    },
    {
      name: 'enclosures-core-only',
      severity: 'error',
      comment: '@dice/enclosures may depend only on @dice/core contracts.',
      from: { path: '^packages/enclosures/' },
      to: { path: '^packages/(?!core/)' }
    },
    {
      name: 'ui-core-only',
      severity: 'error',
      comment: '@dice/ui may depend only on @dice/core types and constants.',
      from: { path: '^packages/ui/' },
      to: { path: '^packages/(?!core/)' }
    },
    {
      name: 'engine-imports-only-allowed',
      severity: 'error',
      comment: 'The engine facade may not import UI, input, or determinism.',
      from: { path: '^packages/engine/' },
      to: {
        path: '^packages/(physics|rendering|dice|enclosures|input|determinism|ui)/'
      }
    },
    {
      name: 'world-imports-only-allowed',
      severity: 'error',
      comment: 'The world may not import content, input, determinism, UI, or engine.',
      from: { path: '^packages/world/' },
      to: { path: '^packages/(content|input|determinism|ui|engine)/' }
    },
    {
      name: 'input-imports-only-allowed',
      severity: 'error',
      comment: 'Input may depend only on core contracts.',
      from: { path: '^packages/input/' },
      to: {
        path: '^packages/(physics|rendering|dice|enclosures|determinism|world|engine|ui|content)/'
      }
    },
    {
      name: 'determinism-imports-only-allowed',
      severity: 'error',
      comment: 'Determinism may depend only on core and dice contracts.',
      from: { path: '^packages/determinism/' },
      to: {
        path: '^packages/(physics|rendering|enclosures|input|world|engine|ui|content)/'
      }
    },
    {
      name: 'apps-no-deep-imports',
      severity: 'error',
      comment: 'Apps import public package entries, never another package src file.',
      from: { path: '^apps/' },
      to: { path: '^packages/[^/]+/src/' }
    },
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular dependencies are not allowed.',
      from: {},
      to: { circular: true }
    }
  ],
  options: {
    doNotFollow: {
      path: 'node_modules'
    },
    exclude: {
      path: '^(legacy|vendor|node_modules|dist|coverage|playwright-report|test-results)/'
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default']
    }
  }
};
