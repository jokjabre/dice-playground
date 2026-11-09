import { createVisualApp } from './app.js';
import { VISUAL_DICE_COUNT } from './content.js';
import './styles.css';

/**
 * Bootstrap the dice visual lab. Shows a readable failure state when the
 * engine cannot start (for example, when WebGL is unavailable).
 */

const stage = /** @type {HTMLElement|null} */ (document.getElementById('stage'));
const controlsHost = /** @type {HTMLElement|null} */ (
  document.getElementById('controls-host')
);
const bannerHost = /** @type {HTMLElement|null} */ (
  document.getElementById('banner-host')
);
const previewHost = /** @type {HTMLElement|null} */ (
  document.getElementById('preview-panel')
);
const errorHost = /** @type {HTMLElement|null} */ (
  document.getElementById('visual-error')
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
  if (!stage || !controlsHost || !bannerHost || !previewHost) {
    showFatal(new Error('Dice visual lab mount points are missing from the document.'));
    return;
  }

  const app = await createVisualApp({
    stage,
    controlsHost,
    bannerHost,
    previewHost,
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

  // Initial roll so the stage opens with motion.
  await app
    .throwDice({ seed: seedParam })
    .catch((error) => {
      console.error(error);
    });
}

start().catch((error) => {
  const failure = error instanceof Error ? error : new Error(String(error));
  console.error(failure);
  showFatal(failure);
});
