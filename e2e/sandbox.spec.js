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
 * Drag from the stage rightward into the options sidebar (row layout at
 * the e2e viewport): the release happens outside the stage, and the throw
 * must still count because pointer-up is observed on the window.
 *
 * @param {import('@playwright/test').Page} page
 */
async function flickStageIntoPanel(page) {
  const stageBox = await page.getByTestId('stage').boundingBox();
  if (!stageBox) throw new Error('Stage has no bounding box.');
  const actionsBox = await page.getByTestId('sandbox-actions').boundingBox();
  if (!actionsBox) throw new Error('Actions row has no bounding box.');
  const startX = stageBox.x + stageBox.width / 2;
  const startY = stageBox.y + stageBox.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(actionsBox.x + actionsBox.width / 2, startY, { steps: 10 });
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
  // Desktop width keeps the options panel expanded by default; the mobile
  // collapse behavior is asserted explicitly in the shell test.
  test.use({ viewport: { width: 1280, height: 800 } });

  test('loads without console errors and renders the sandbox shell', async ({
    page
  }) => {
    const errors = await consoleErrors(page);

    await page.goto(sandboxUrl);
    await expect(
      page.getByRole('heading', { name: 'Sandbox', level: 1 })
    ).toBeVisible();
    await expect(page.getByTestId('stage')).toBeVisible();
    // The Engine group is open by default; the accordion keeps the others
    // collapsed.
    await expect(page.getByTestId('mode-select')).toBeVisible();
    await expect(page.getByTestId('enclosure-select')).toBeHidden();
    await expect(page.getByTestId('info-panel')).toBeHidden();

    // The hamburger toggle collapses the whole options panel.
    await page.getByTestId('engine-panel-toggle').click();
    await expect(page.getByTestId('mode-select')).toBeHidden();
    await expect(page.getByTestId('sandbox-actions')).toBeHidden();
    await page.getByTestId('engine-panel-toggle').click();
    await expect(page.getByTestId('mode-select')).toBeVisible();

    // Accordion: opening a group closes the others.
    await page.getByTestId('group-enclosure-toggle').click();
    await expect(page.getByTestId('enclosure-select')).toBeVisible();
    await expect(page.getByTestId('mode-select')).toBeHidden();
    await page.getByTestId('group-camera-toggle').click();
    await expect(page.getByTestId('camera-distance-slider')).toBeVisible();
    await expect(page.getByTestId('enclosure-select')).toBeHidden();
    // Clicking the open group's toggle closes it again.
    await page.getByTestId('group-camera-toggle').click();
    await expect(page.getByTestId('camera-distance-slider')).toBeHidden();
    // Details opens on its own toggle.
    await page.getByTestId('group-details-toggle').click();
    await expect(page.getByTestId('info-panel')).toBeVisible();
    // Re-open Engine for a sane rest state.
    await page.getByTestId('group-engine-toggle').click();
    await expect(page.getByTestId('mode-select')).toBeVisible();

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

  test('shows the throw arrow while flicking and clamps it at maximum power', async ({
    page
  }) => {
    test.setTimeout(600000);
    const errors = await consoleErrors(page);

    await page.goto(`${sandboxUrl}?seed=e2e-visualizer&maxSubSteps=120&maxFrameGap=5`);
    await expectResultVisible(page);
    await expectValuesInRange(page, 6);

    const visualizer = page.getByTestId('throw-visualizer');
    await expect(visualizer).toBeAttached();
    await expect(visualizer).toBeHidden();

    const stageBox = await page.getByTestId('stage').boundingBox();
    if (!stageBox) throw new Error('Stage has no bounding box.');
    const startX = stageBox.x + stageBox.width / 2;
    const startY = stageBox.y + stageBox.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    // Past the 18px threshold: the arrow appears in the DOM ...
    await page.mouse.move(startX, startY + 80, { steps: 5 });
    await expect(visualizer).toBeVisible();
    // ... and dragging far beyond the 190px maximum clamps the tip to it.
    await page.mouse.move(startX, startY + 400, { steps: 5 });
    await expect(visualizer).toBeVisible();
    const arrowLength = await visualizer.evaluate((element) => {
      const line = element.querySelector('line');
      const x1 = Number(line?.getAttribute('x1') ?? 0);
      const y1 = Number(line?.getAttribute('y1') ?? 0);
      const x2 = Number(line?.getAttribute('x2') ?? 0);
      const y2 = Number(line?.getAttribute('y2') ?? 0);
      return Math.hypot(x2 - x1, y2 - y1);
    });
    expect(arrowLength).toBeCloseTo(190, 0);

    await page.mouse.up();
    await expectRollCycle(page);
    await expectValuesInRange(page, 6);
    // The release snap finishes and the overlay hides again.
    await expect(visualizer).toBeHidden();

    expect(errors).toEqual([]);
  });

  test('switches enclosures and rolls in each one', async ({ page }) => {
    test.setTimeout(600000);

    await page.goto(`${sandboxUrl}?seed=e2e-enclosures&maxSubSteps=120&maxFrameGap=5`);
    await expectResultVisible(page);

    // The Enclosure group starts collapsed (accordion).
    await page.getByTestId('group-enclosure-toggle').click();
    await expect(page.getByTestId('enclosure-select')).toBeVisible();

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

    // Enclosure size rebuilds the boundaries and rolls again.
    await page.getByTestId('enclosure-scale-select').selectOption('1.5');
    await expectRollCycle(page);
    await expectValuesInRange(page, 6);

    // The enclosure group reset restores box at 100% and rolls again.
    await page.getByTestId('enclosure-reset-button').click();
    await expect(page.getByTestId('info-panel')).toContainText('Enclosure: box', {
      timeout: RESULT_TIMEOUT
    });
    await expectRollCycle(page);
    await expectValuesInRange(page, 6);
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
    await page.getByTestId('group-camera-toggle').click();
    await expect(page.getByTestId('camera-distance-slider')).toBeVisible();
    await page.getByTestId('camera-distance-slider').fill('2');
    await expect(page.getByTestId('info-panel')).toContainText(
      'Camera distance: 2.00×',
      { timeout: RESULT_TIMEOUT }
    );
    await page.getByTestId('camera-reset-button').click();
    await expect(page.getByTestId('info-panel')).toContainText(
      'Camera distance: 1.00×',
      { timeout: RESULT_TIMEOUT }
    );

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

    await page.setViewportSize({ width: 1280, height: 800 });
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
