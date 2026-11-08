import { expect, test } from '@playwright/test';

// Gallery rolls settle in real-time physics but SwiftShader renders at a
// fraction of real-time speed. Parallel workers share the CPU and starve
// each other's frames, so this file runs serially.
test.describe.configure({ mode: 'serial' });

const galleryUrl =
  'http://127.0.0.1:5181/dice-playground/apps/demos/enclosure-gallery/';
const landingUrl = 'http://127.0.0.1:5181/dice-playground/';
const resultPattern = /^\d+(\s\+\s\d+)* = \d+$/;

// Software rendering (SwiftShader) runs the physics loop at a fraction of
// real-time speed, so gallery rolls need small viewports and patient
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
 */
async function expectSixValuesInRange(page) {
  const values = await readResultValues(page);
  expect(values).toHaveLength(6);
  for (const value of values) {
    expect(value).toBeGreaterThanOrEqual(1);
    expect(value).toBeLessThanOrEqual(6);
  }
}

test.describe('enclosure gallery', () => {
  test.use({ viewport: { width: 640, height: 400 } });

  test('loads without console errors and renders the gallery shell', async ({
    page
  }) => {
    const errors = await consoleErrors(page);

    await page.goto(galleryUrl);
    await expect(
      page.getByRole('heading', { name: 'Enclosure Gallery', level: 1 })
    ).toBeVisible();
    await expect(page.getByTestId('stage')).toBeVisible();
    await expect(page.getByTestId('enclosure-select')).toBeVisible();
    await expect(page.getByTestId('throw-button')).toBeVisible();
    await expect(page.getByTestId('info-panel')).toBeVisible();

    expect(errors).toEqual([]);
  });

  test('rolls on load, then throws again through the button', async ({
    page
  }) => {
    test.setTimeout(300000);
    const errors = await consoleErrors(page);

    await page.goto(`${galleryUrl}?seed=e2e-gallery&maxSubSteps=120&maxFrameGap=5`);
    // The initial roll settles and the banner presents six values.
    await expectResultVisible(page);
    await expectSixValuesInRange(page);

    await page.getByTestId('throw-button').click();
    await expectResultVisible(page);
    await expectSixValuesInRange(page);

    expect(errors).toEqual([]);
  });

  test('switches enclosures and rolls in each one', async ({ page }) => {
    test.setTimeout(600000);

    await page.goto(`${galleryUrl}?seed=e2e-enclosures&maxSubSteps=120&maxFrameGap=5`);
    await expectResultVisible(page);

    for (const enclosure of ['sphere', 'cylinder', 'box']) {
      await page.getByTestId('enclosure-select').selectOption(enclosure);
      // The switch clears the dice and starts a fresh roll: the throw
      // button disables while rolling and re-enables once it settles.
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
      await expectSixValuesInRange(page);
    }

    await expect(page.getByTestId('info-panel')).toContainText('Enclosure: box', {
      timeout: RESULT_TIMEOUT
    });
  });

  test('updates gravity and camera controls', async ({ page }) => {
    test.setTimeout(300000);

    await page.goto(`${galleryUrl}?seed=e2e-controls&maxSubSteps=120&maxFrameGap=5`);
    await expectResultVisible(page);

    await page.getByTestId('gravity-preset-select').selectOption('zero-g');
    await expect(page.getByTestId('info-panel')).toContainText('Gravity: 0, 0, 0', {
      timeout: RESULT_TIMEOUT
    });

    await page.getByTestId('gravity-preset-select').selectOption('down');
    await expect(page.getByTestId('info-panel')).toContainText(
      'Gravity: 0, 0, -2940',
      { timeout: RESULT_TIMEOUT }
    );

    await page.getByTestId('camera-distance-slider').fill('2');
    await expect(page.getByTestId('info-panel')).toContainText(
      'Camera distance: 2',
      { timeout: RESULT_TIMEOUT }
    );

    await page.getByTestId('camera-reset-button').click();
    await expect(page.getByTestId('info-panel')).toContainText(
      'Camera distance: 1',
      { timeout: RESULT_TIMEOUT }
    );

    await page.getByTestId('enclosure-scale-select').selectOption('1.5');
    await expect(page.getByTestId('info-panel')).toContainText(
      'Enclosure size: 150%',
      { timeout: RESULT_TIMEOUT }
    );

    await page.getByTestId('light-x-slider').fill('1');
    await expect(page.getByTestId('info-panel')).toContainText(
      'Light position: 1, 0.5, 2',
      { timeout: RESULT_TIMEOUT }
    );

    await page.getByTestId('light-reset-button').click();
    await expect(page.getByTestId('info-panel')).toContainText(
      'Light position: -0.5, 0.5, 2',
      { timeout: RESULT_TIMEOUT }
    );
  });

  test('resizes without losing the scene or controls', async ({ page }) => {
    test.setTimeout(300000);
    const errors = await consoleErrors(page);

    await page.goto(`${galleryUrl}?maxSubSteps=120&maxFrameGap=5`);
    await expectResultVisible(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('stage')).toBeVisible();
    await expect(page.getByTestId('enclosure-select')).toBeVisible();
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

    await page.goto(galleryUrl);

    await expect.poll(() => responses.length, { timeout: RESULT_TIMEOUT })
      .toBeGreaterThanOrEqual(1);
    for (const response of responses) {
      expect(response.status).toBe(200);
      expect(response.url).toContain(
        '/dice-playground/apps/demos/enclosure-gallery/assets/'
      );
    }
  });

  test('shows a readable message when the vendor script fails to load', async ({
    page
  }) => {
    await page.route('**/*three*.js', (route) => route.abort());
    await page.goto(galleryUrl);

    await expect(page.getByTestId('fatal-error')).toBeVisible();
    await expect(page.getByTestId('fatal-error')).toContainText(
      'Unable to start the 3D dice engine'
    );
  });
});

test.describe('landing page', () => {
  test('lists live and planned apps from the registry', async ({ page }) => {
    const errors = await consoleErrors(page);

    await page.goto(landingUrl);
    await expect(
      page.getByRole('heading', { name: 'Dice Playground', level: 1 })
    ).toBeVisible();

    const galleryCard = page.getByTestId('card-enclosure-gallery');
    await expect(galleryCard).toBeVisible();
    expect(await galleryCard.getAttribute('href')).toBe(
      './apps/demos/enclosure-gallery/'
    );
    await expect(page.getByTestId('badge-enclosure-gallery')).toHaveText('live');

    await expect(page.getByTestId('card-sandbox')).toBeVisible();
    await expect(page.getByTestId('badge-sandbox')).toHaveText('live');
    const sandboxCard = page.getByTestId('card-sandbox');
    expect(await sandboxCard.getAttribute('href')).toBe('./apps/sandbox/');
    await expect(page.getByTestId('card-yamb')).toBeVisible();

    await expect(page.getByTestId('card-enclosure-gallery')).toHaveCount(1);
    expect(errors).toEqual([]);
  });
});
