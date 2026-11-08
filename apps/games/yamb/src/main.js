import { createYambApp } from './app.js';
import './styles.css';

/**
 * Bootstrap Yamb. Shows a readable failure state when the engine cannot
 * start (for example, when WebGL is unavailable).
 */

const stage = /** @type {HTMLElement|null} */ (document.getElementById('stage'));
const setupHost = /** @type {HTMLElement|null} */ (
  document.getElementById('setup-host')
);
const trayHost = /** @type {HTMLElement|null} */ (
  document.getElementById('tray-host')
);
const controlsHost = /** @type {HTMLElement|null} */ (
  document.getElementById('controls-host')
);
const scorecardHost = /** @type {HTMLElement|null} */ (
  document.getElementById('scorecard-host')
);
const statusHost = /** @type {HTMLElement|null} */ (
  document.getElementById('yamb-status')
);
const bannerHost = /** @type {HTMLElement|null} */ (
  document.getElementById('banner-host')
);
const errorHost = /** @type {HTMLElement|null} */ (
  document.getElementById('yamb-error')
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
  if (
    !stage ||
    !setupHost ||
    !trayHost ||
    !controlsHost ||
    !scorecardHost ||
    !statusHost ||
    !bannerHost
  ) {
    showFatal(new Error('Yamb mount points are missing from the document.'));
    return;
  }

  const app = await createYambApp({
    stage,
    setupHost,
    trayHost,
    controlsHost,
    scorecardHost,
    statusHost,
    bannerHost,
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
}

start().catch((error) => {
  const failure = error instanceof Error ? error : new Error(String(error));
  console.error(failure);
  showFatal(failure);
});
