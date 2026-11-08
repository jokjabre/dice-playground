import { expect, test } from '@playwright/test';

// Sandbox rolls settle in real-time physics but SwiftShader renders at a
// fraction of real-time speed. Parallel workers share the CPU and starve
// each other's frames, so this file runs serially.
test.describe.configure({ mode: 'serial' });

const sandboxUrl = 'http://127.0.0.1:5181/dice-playground/apps/sandbox/';
const resultPattern = /^\d+(\s\+\s\d+)* = \d+$/;

// Software rendering (SwiftShader) runs the physics loop at a fraction of
// real-time speed, so sandbox rolls need small viewports and patient
// polls. Timeouts are generous on purpose; failures still mean the
// result never appeared.
const RESULT_TIMEOUT = 180000;

/**
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string[]>}
 */
async function consoleErrors(page) {
  /** @type {string[]} */
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

/**
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<void>}
 */
async function expectResultVisible(page) {
  const banner = page.getByTestId('result-banner');
  await expect(banner).toBeVisible({ timeout: RESULT_TIMEOUT });
  await expect
    .poll(async () => banner.textContent(), { timeout: RESULT_TIMEOUT })
    .toMatch(resultPattern);
}

/**
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<number[]>}
 */
async function readResultValues(page) {
  const text = (await page.getByTestId('result-banner').textContent()) ?? '';
  return text
    .split('=')[0]
    .split('+')
    .map((part) => Number.parseInt(part.trim(), 10));
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {number} count
 */
async function expectValuesInRange(page, count) {
  const values = await readResultValues(page);
  expect(values).toHaveLength(count);
  for (const value of values) {
    expect(value).toBeGreaterThanOrEqual(1);
    expect(value).toBeLessThanOrEqual(6);
  }
}

/**
 * Drag the stage from its center to run the flick gesture.
 *
 * @param {import('@playwright/test').Page} page
 */
async function flickStage(page) {
  const stage = page.getByTestId('stage');
  const box = await stage.boundingBox();
  if (!box) throw new Error('Stage has no bounding box.');
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  const drag = Math.min(200, box.width / 2 - 10);
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + drag, startY, { steps: 8 });
  await page.mouse.up();
}

/**
 * Drag from the stage down into the control panel (column layout at the
 * e2e viewport): the release happens outside the stage, and the throw must
 * still count because pointer-up is observed on the window.
 *
 * @param {import('@playwright/test').Page} page
 */
async function flickStageIntoPanel(page) {
  const stageBox = await page.getByTestId('stage').boundingBox();
  if (!stageBox) throw new Error('Stage has no bounding box.');
  const panelBox = await page.getByTestId('sandbox-controls').boundingBox();
  if (!panelBox) throw new Error('Panel has no bounding box.');
  const startX = stageBox.x + stageBox.width / 2;
  const startY = stageBox.y + stageBox.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX, panelBox.y + 10, { steps: 10 });
  await page.mouse.up();
}

/**
 * Drag starting on the visible result banner, which overlays the stage.
 * The banner host lives inside the stage so the press begins a gesture.
 *
 * @param {import('@playwright/test').Page} page
 */
async function flickFromBanner(page) {
  const bannerBox = await page.getByTestId('result-banner').boundingBox();
  if (!bannerBox) throw new Error('Banner has no bounding box.');
  const stageBox = await page.getByTestId('stage').boundingBox();
  if (!stageBox) throw new Error('Stage has no bounding box.');
  await page.mouse.move(
    bannerBox.x + bannerBox.width / 2,
    bannerBox.y + bannerBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    stageBox.x + stageBox.width / 2 + 100,
    stageBox.y + stageBox.height / 2,
    { steps: 10 }
  );
  await page.mouse.up();
}

/**
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<void>}
 */
async function expectRollCycle(page) {
  await expect(page.getByTestId('throw-button')).toBeDisabled({
    timeout: RESULT_TIMEOUT
  });
  await expect(page.getByTestId('throw-button')).toBeEnabled({
    timeout: RESULT_TIMEOUT
  });
  await expectResultVisible(page);
}

test.describe('sandbox', () => {
  test.use({ viewport: { width: 640, height: 400 } });

  test('loads without console errors and renders the sandbox shell', async ({
    page
  }) => {
    const errors = await consoleErrors(page);

    await page.goto(sandboxUrl);
    await expect(
      page.getByRole('heading', { name: 'Sandbox', level: 1 })
    ).toBeVisible();
    await expect(page.getByTestId('stage')).toBeVisible();
    await expect(page.getByTestId('mode-select')).toBeVisible();
    await expect(page.getByTestId('enclosure-select')).toBeVisible();
    await expect(page.getByTestId('throw-button')).toBeVisible();
    await expect(page.getByTestId('clear-button')).toBeVisible();
    await expect(page.getByTestId('info-panel')).toBeVisible();
    await expect(page.getByTestId('engine-panel-toggle')).toBeVisible();

    expect(errors).toEqual([]);
  });

  test('rolls on load, then throws again through the button and a flick', async ({
    page
  }) => {
    test.setTimeout(600000);
    const errors = await consoleErrors(page);

    await page.goto(`${sandboxUrl}?seed=e2e-sandbox&maxSubSteps=120&maxFrameGap=5`);
    // The initial roll settles and the banner presents six values.
    await expectResultVisible(page);
    await expectValuesInRange(page, 6);
    await expect(page.getByTestId('info-panel')).toContainText('Dice: 6');

    await page.getByTestId('throw-button').click();
    await expectRollCycle(page);
    await expectValuesInRange(page, 6);

    // Drag/flick throw on the stage starts another settling roll.
    await flickStage(page);
    await expectRollCycle(page);
    await expectValuesInRange(page, 6);

    expect(errors).toEqual([]);
  });

  test('flicks that leave the stage and drags starting on the banner still throw', async ({
    page
  }) => {
    test.setTimeout(600000);
    const errors = await consoleErrors(page);

    await page.goto(`${sandboxUrl}?seed=e2e-flick-out&maxSubSteps=120&maxFrameGap=5`);
    await expectResultVisible(page);
    await expectValuesInRange(page, 6);

    // Release happens over the control panel, outside the stage.
    await flickStageIntoPanel(page);
    await expectRollCycle(page);
    await expectValuesInRange(page, 6);

    // The press starts on the visible result banner overlay.
    await flickFromBanner(page);
    await expectRollCycle(page);
    await expectValuesInRange(page, 6);

    expect(errors).toEqual([]);
  });

  test('switches enclosures and rolls in each one', async ({ page }) => {
    test.setTimeout(600000);

    await page.goto(`${sandboxUrl}?seed=e2e-enclosures&maxSubSteps=120&maxFrameGap=5`);
    await expectResultVisible(page);

    for (const enclosure of ['sphere', 'cylinder', 'box']) {
      await page.getByTestId('enclosure-select').selectOption(enclosure);
      // The switch clears the dice and starts a fresh roll.
      await expect(page.getByTestId('info-panel')).toContainText(
        `Enclosure: ${enclosure}`,
        { timeout: RESULT_TIMEOUT }
      );
      await expect(page.getByTestId('throw-button')).toBeDisabled({
        timeout: RESULT_TIMEOUT
      });
      await expect(page.getByTestId('throw-button')).toBeEnabled({
        timeout: RESULT_TIMEOUT
      });
      await expectResultVisible(page);
      await expectValuesInRange(page, 6);
    }

    await expect(page.getByTestId('info-panel')).toContainText('Enclosure: box', {
      timeout: RESULT_TIMEOUT
    });
  });

  test('predetermined mode rolls the requested values and rejects invalid input', async ({
    page
  }) => {
    test.setTimeout(300000);
    const errors = await consoleErrors(page);

    await page.goto(`${sandboxUrl}?seed=e2e-predetermined&maxSubSteps=120&maxFrameGap=5`);
    await expectResultVisible(page);

    await page.getByTestId('mode-select').selectOption('predetermined');
    await expect(page.getByTestId('predetermined-controls')).toBeVisible();
    await expect(page.getByTestId('predetermined-inputs')).toBeVisible();
    await expect(page.getByTestId('predetermined-roll-button')).toBeVisible();

    await page.getByTestId('predetermined-inputs').fill('6, 6, 6');
    await page.getByTestId('predetermined-roll-button').click();
    await expectRollCycle(page);
    await expect(page.getByTestId('result-banner')).toHaveText('6 + 6 + 6 = 18');
    await expect(page.getByTestId('info-panel')).toContainText('Dice: 3');

    await page.getByTestId('predetermined-inputs').fill('9, x');
    await page.getByTestId('predetermined-roll-button').click();
    await expect(page.getByTestId('predetermined-error')).toBeVisible();
    await expect(page.getByTestId('predetermined-error')).toContainText(
      'Invalid target'
    );
    // The invalid roll must not disturb the previous result.
    await expect(page.getByTestId('result-banner')).toHaveText('6 + 6 + 6 = 18');

    expect(errors).toEqual([]);
  });

  test('continuous mode keeps physics running with motion controls', async ({
    page
  }) => {
    test.setTimeout(300000);
    const errors = await consoleErrors(page);

    await page.goto(`${sandboxUrl}?seed=e2e-continuous&maxSubSteps=120&maxFrameGap=5`);
    await expectResultVisible(page);

    await page.getByTestId('mode-select').selectOption('continuous');
    await expect(page.getByTestId('motion-controls')).toBeVisible();
    await expect(page.getByTestId('enable-motion-button')).toBeVisible();

    // Entering continuous starts a live run that never auto-stops.
    await expect(page.getByTestId('info-panel')).toContainText(
      'Physics: running',
      { timeout: RESULT_TIMEOUT }
    );
    await expect(page.getByTestId('info-panel')).toContainText('Dice: 6', {
      timeout: RESULT_TIMEOUT
    });
    // Throw stays usable in continuous mode to replace the live run.
    await expect(page.getByTestId('throw-button')).toBeEnabled({
      timeout: RESULT_TIMEOUT
    });
    // Motion status is listening / reporting, never "off" after entry.
    await expect.poll(async () => page.getByTestId('motion-status').textContent(), {
      timeout: RESULT_TIMEOUT
    }).not.toBe('Motion sensors off');

    // Camera controls stay live while the simulation runs.
    await page.getByTestId('camera-distance-slider').fill('2');
    await expect(page.getByTestId('info-panel')).toContainText(
      'Camera distance: 2.00×',
      { timeout: RESULT_TIMEOUT }
    );
    await page.getByTestId('camera-near-input').fill('5');
    await expect(page.getByTestId('info-panel')).toContainText('Camera near: 5', {
      timeout: RESULT_TIMEOUT
    });
    await page.getByTestId('camera-far-input').fill('2500');
    await expect(page.getByTestId('info-panel')).toContainText(
      'Camera far: 2500',
      { timeout: RESULT_TIMEOUT }
    );
    await page.getByTestId('camera-reset-button').click();
    await expect(page.getByTestId('info-panel')).toContainText(
      'Camera distance: 1.00×',
      { timeout: RESULT_TIMEOUT }
    );
    await expect(page.getByTestId('info-panel')).toContainText('Camera near: 1', {
      timeout: RESULT_TIMEOUT
    });
    await expect(page.getByTestId('info-panel')).toContainText('Camera far: 0', {
      timeout: RESULT_TIMEOUT
    });

    // Clear cancels the live run and empties the tray.
    await page.getByTestId('clear-button').click();
    await expect(page.getByTestId('info-panel')).toContainText('Dice: 0', {
      timeout: RESULT_TIMEOUT
    });
    await expect(page.getByTestId('info-panel')).toContainText(
      'Physics: idle',
      { timeout: RESULT_TIMEOUT }
    );

    expect(errors).toEqual([]);
  });

  test('resizes without losing the scene or controls', async ({ page }) => {
    test.setTimeout(300000);
    const errors = await consoleErrors(page);

    await page.goto(`${sandboxUrl}?maxSubSteps=120&maxFrameGap=5`);
    await expectResultVisible(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('stage')).toBeVisible();
    await expect(page.getByTestId('mode-select')).toBeVisible();
    await expect(page.getByTestId('throw-button')).toBeVisible();

    // Fixed app shell: the page itself must never scroll, even on narrow
    // screens. The controls scroll inside the panel instead.
    const heights = await page.evaluate(() => ({
      scroll: document.documentElement.scrollHeight,
      viewport: window.innerHeight
    }));
    expect(heights.scroll).toBe(heights.viewport);

    await page.setViewportSize({ width: 640, height: 400 });
    await expect(page.getByTestId('stage')).toBeVisible();
    await expectResultVisible(page);

    expect(errors).toEqual([]);
  });

  test('loads the hashed vendor asset under the nested Pages base path', async ({
    page
  }) => {
    /** @type {Array<{ url: string, status: number }>} */
    const responses = [];

    page.on('response', (response) => {
      const url = response.url();
      if (/three/i.test(url) && /\.js(\?|$)/.test(url)) {
        responses.push({ url, status: response.status() });
      }
    });

    await page.goto(sandboxUrl);

    await expect.poll(() => responses.length, { timeout: RESULT_TIMEOUT })
      .toBeGreaterThanOrEqual(1);
    for (const response of responses) {
      expect(response.status).toBe(200);
      expect(response.url).toContain('/dice-playground/apps/sandbox/assets/');
    }
  });

  test('shows a readable message when the vendor script fails to load', async ({
    page
  }) => {
    await page.route('**/*three*.js', (route) => route.abort());
    await page.goto(sandboxUrl);

    await expect(page.getByTestId('fatal-error')).toBeVisible();
    await expect(page.getByTestId('fatal-error')).toContainText(
      'Unable to start the 3D dice engine'
    );
  });
});
