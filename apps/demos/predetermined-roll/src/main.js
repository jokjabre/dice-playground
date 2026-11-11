import { createPredApp } from './app.js';
import { PRED_DICE_COUNT } from './content.js';
import '@dice/ui/styles/settings.css';
import './styles.css';

/**
 * Bootstrap the predetermined-roll showcase. Shows a readable failure state
 * when the engine cannot start (for example, when WebGL is unavailable).
 */

const stage = /** @type {HTMLElement|null} */ (document.getElementById('stage'));
const controlsHost = /** @type {HTMLElement|null} */ (
  document.getElementById('controls-host')
);
const bannerHost = /** @type {HTMLElement|null} */ (
  document.getElementById('banner-host')
);
const targetsHost = /** @type {HTMLElement|null} */ (
  document.getElementById('targets-host')
);
const explanationHost = /** @type {HTMLElement|null} */ (
  document.getElementById('explanation-panel')
);
const errorHost = /** @type {HTMLElement|null} */ (
  document.getElementById('pred-error')
);

const search = new URLSearchParams(window.location.search);
const seedParam = search.get('seed') ?? undefined;

// Fast-forward hooks for end-to-end tests: software rendering advances the
// browser frame rate far below real time, so specs may raise the loop
// sub-step budget and frame-gap clamp instead of waiting minutes per roll.
const maxSubSteps = Number.parseInt(search.get('maxSubSteps') ?? '', 10);
const maxFrameGap = Number.parseFloat(search.get('maxFrameGap') ?? '');
/** @type {{ maxSubSteps?: number, maxFrameGap?: number }|undefined} */
const loop =
  (Number.isFinite(maxSubSteps) && maxSubSteps > 0) ||
  (Number.isFinite(maxFrameGap) && maxFrameGap > 0)
    ? {
        maxSubSteps: maxSubSteps > 0 ? maxSubSteps : undefined,
        maxFrameGap: maxFrameGap > 0 ? maxFrameGap : undefined
      }
    : undefined;

/**
 * @param {Error} error
 */
function showFatal(error) {
  if (!errorHost) return;
  errorHost.hidden = false;
  errorHost.textContent = `Unable to start the 3D dice engine: ${error.message}`;
}

async function start() {
  if (!stage || !controlsHost || !bannerHost || !targetsHost || !explanationHost) {
    showFatal(new Error('Predetermined roll mount points are missing from the document.'));
    return;
  }

  const app = await createPredApp({
    stage,
    controlsHost,
    bannerHost,
    targetsHost,
    explanationHost,
    seed: seedParam,
    loop
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

  // Open with a natural roll so the stage has motion; the user then rolls
  // their own predetermined targets.
  await app
    .throwDice({ dice: PRED_DICE_COUNT, seed: seedParam })
    .catch((error) => {
      console.error(error);
    });
}

start().catch((error) => {
  const failure = error instanceof Error ? error : new Error(String(error));
  console.error(failure);
  showFatal(failure);
});
