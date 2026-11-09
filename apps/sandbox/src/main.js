import { createSandboxApp } from './app.js';
import { SANDBOX_DICE_COUNT, SANDBOX_ENCLOSURES } from './content.js';
import { isSandboxMode } from './modes.js';
import './styles.css';

/**
 * Bootstrap the sandbox. Shows a readable failure state when the engine
 * cannot start (for example, when WebGL is unavailable).
 */

const stage = /** @type {HTMLElement|null} */ (document.getElementById('stage'));
const panelHost = /** @type {HTMLElement|null} */ (
  document.getElementById('panel-host')
);
const bannerHost = /** @type {HTMLElement|null} */ (
  document.getElementById('banner-host')
);
const errorHost = /** @type {HTMLElement|null} */ (
  document.getElementById('sandbox-error')
);

const search = new URLSearchParams(window.location.search);
const enclosureParam = search.get('enclosure');
const initialEnclosure = SANDBOX_ENCLOSURES.some(
  (enclosure) => enclosure.id === enclosureParam
)
  ? /** @type {string} */ (enclosureParam)
  : undefined;
const modeParam = search.get('mode');
const initialMode = isSandboxMode(modeParam ?? '')
  ? /** @type {string} */ (modeParam)
  : undefined;
const seedParam = search.get('seed') ?? undefined;

// Fast-forward hooks for end-to-end tests: software rendering advances the
// browser frame rate far below real time, so specs may raise the loop
// sub-step budget and frame-gap clamp instead of waiting minutes per roll.
/** @type {{ maxSubSteps?: number, maxFrameGap?: number }|undefined} */
const loopParams = (() => {
  const maxSubSteps = Number.parseInt(search.get('maxSubSteps') ?? '', 10);
  const maxFrameGap = Number.parseFloat(search.get('maxFrameGap') ?? '');
  if (
    !(Number.isFinite(maxSubSteps) && maxSubSteps > 0) &&
    !(Number.isFinite(maxFrameGap) && maxFrameGap > 0)
  ) {
    return undefined;
  }
  return {
    maxSubSteps: maxSubSteps > 0 ? maxSubSteps : undefined,
    maxFrameGap: maxFrameGap > 0 ? maxFrameGap : undefined
  };
})();

/**
 * @param {Error} error
 */
function showFatal(error) {
  if (!errorHost) return;
  errorHost.hidden = false;
  errorHost.textContent = `Unable to start the 3D dice engine: ${error.message}`;
}

async function start() {
  if (!stage || !panelHost || !bannerHost) {
    showFatal(new Error('Sandbox mount points are missing from the document.'));
    return;
  }

  const app = await createSandboxApp({
    stage,
    panelHost,
    bannerHost,
    initialEnclosure,
    initialMode,
    seed: seedParam,
    loop: loopParams
  });

  const resizeObserver = new ResizeObserver(() => {
    app.resize();
  });
  resizeObserver.observe(stage);
  app.resize();

  if (import.meta.env.DEV) {
    /** @type {any} */ (window).__diceApp = app;
  }

  const teardown = () => {
    resizeObserver.disconnect();
    app.destroy();
  };
  window.addEventListener('beforeunload', teardown);
  import.meta.hot?.dispose(teardown);

  // Initial roll so the stage opens with motion, as the legacy demo did.
  // In continuous mode the initial roll is itself the live continuous run.
  const initialRequest =
    initialMode === 'continuous'
      ? {
          dice: SANDBOX_DICE_COUNT,
          mode: 'continuous',
          cancelActive: true
        }
      : { dice: SANDBOX_DICE_COUNT, seed: seedParam };
  await app
    .throwDice(initialRequest)
    .catch((error) => {
      console.error(error);
    });
}

start().catch((error) => {
  const failure = error instanceof Error ? error : new Error(String(error));
  console.error(failure);
  showFatal(failure);
});
