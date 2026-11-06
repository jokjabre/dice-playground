const domGlobals = [
  { name: 'document', message: 'Pure packages must not access the DOM.' },
  { name: 'window', message: 'Pure packages must not access the DOM.' },
  { name: 'navigator', message: 'Pure packages must not access the DOM.' }
];

const backendGlobals = [
  { name: 'THREE', message: 'Only @dice/rendering may reference Three.js.' },
  { name: 'CANNON', message: 'Only @dice/physics may reference Cannon.' }
];

export default [
  {
    ignores: [
      'legacy/**',
      '**/vendor/**',
      '**/node_modules/**',
      'dist/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**'
    ]
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module'
    }
  },
  {
    files: [
      'packages/{core,dice,enclosures,determinism,content,rules,world}/**/*.js'
    ],
    rules: {
      'no-restricted-globals': ['error', ...domGlobals, ...backendGlobals]
    }
  },
  {
    files: ['packages/physics/**/*.js'],
    rules: {
      'no-restricted-globals': ['error', ...domGlobals, backendGlobals[0]]
    }
  },
  {
    files: ['packages/rendering/**/*.js'],
    rules: {
      'no-restricted-globals': ['error', backendGlobals[1]]
    }
  },
  {
    files: ['packages/{input,ui,engine}/**/*.js'],
    rules: {
      'no-restricted-globals': ['error', ...backendGlobals]
    }
  },
  {
    files: ['apps/**/*.js', 'tools/**/*.js', 'tools/**/*.mjs'],
    rules: {
      'no-restricted-globals': ['error', ...backendGlobals]
    }
  }
];
