import { expect, test } from '@playwright/test';

// Predetermined rolls settle in real-time physics but SwiftShader renders
// at a fraction of real-time speed. Parallel workers share the CPU and
// starve each other's frames, so this file runs serially.
test.describe.configure({ mode: 'serial' });

const predUrl =
  'http://127.0.0.1:5181/dice-playground/apps/demos/predetermined-roll/';
const resultPattern = /^\d+(\s\+\s\d+)* = \d+$/;

// Software rendering (SwiftShader) runs the physics loop at a fraction of
// real-time speed, so rolls need small viewports and patient polls.
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
 */
async function expectResultVisible(page) {
  const banner = page.getByTestId('result-banner');
  await expect(banner).toBeVisible({ timeout: RESULT_TIMEOUT });
  await expect
    .poll(async () => banner.textContent(), { timeout: RESULT_TIMEOUT })
    .toMatch(resultPattern);
}

test.describe('predetermined roll', () => {
  test.use({ viewport: { width: 640, height: 400 } });

  test('loads without console errors and renders the showcase shell', async ({
    page
  }) => {
    const errors = await consoleErrors(page);

    await page.goto(predUrl);
    await expect(
      page.getByRole('heading', { name: 'Predetermined Roll', level: 1 })
    ).toBeVisible();
    await expect(page.getByTestId('stage')).toBeVisible();
    // The throw-arrow overlay mounts on the stage with PointerInput.
    await expect(page.getByTestId('throw-visualizer')).toBeAttached();
    await expect(page.getByTestId('mode-select')).toBeVisible();
    await expect(page.getByTestId('target-input-1')).toBeVisible();
    await expect(page.getByTestId('target-input-3')).toBeVisible();
    await expect(page.getByTestId('predict-button')).toBeVisible();
    await expect(page.getByTestId('roll-button')).toBeVisible();
    await expect(page.getByTestId('explanation-panel')).toBeVisible();
    await expect(page.getByTestId('explanation-mode')).toContainText(
      'Predict and shift'
    );

    expect(errors).toEqual([]);
  });

  test('predict shows natural values without moving live dice', async ({
    page
  }) => {
    test.setTimeout(300000);
    const errors = await consoleErrors(page);

    await page.goto(`${predUrl}?seed=e2e-predict&maxSubSteps=120&maxFrameGap=5`);
    await expectResultVisible(page);

    await page.getByTestId('predict-button').click();
    await expect(page.getByTestId('explanation-panel')).toContainText(
      'Last prediction (natural):',
      { timeout: RESULT_TIMEOUT }
    );

    expect(errors).toEqual([]);
  });

  test('predict-and-shift rolls the requested 6, 6, 6', async ({
    page
  }) => {
    test.setTimeout(300000);
    const errors = await consoleErrors(page);

    await page.goto(`${predUrl}?seed=e2e-shift&maxSubSteps=120&maxFrameGap=5`);
    await expectResultVisible(page);

    await page.getByTestId('target-input-1').fill('6');
    await page.getByTestId('target-input-2').fill('6');
    await page.getByTestId('target-input-3').fill('6');
    await page.getByTestId('roll-button').click();

    await expect(page.getByTestId('result-banner')).toHaveText('6 + 6 + 6 = 18', {
      timeout: RESULT_TIMEOUT
    });
    await expect(page.getByTestId('explanation-panel')).toContainText(
      'all matched',
      { timeout: RESULT_TIMEOUT }
    );

    expect(errors).toEqual([]);
  });

  test('rejects invalid targets without rolling', async ({ page }) => {
    test.setTimeout(300000);
    const errors = await consoleErrors(page);

    await page.goto(`${predUrl}?seed=e2e-invalid&maxSubSteps=120&maxFrameGap=5`);
    await expectResultVisible(page);
    await expect(page.getByTestId('result-banner')).toBeVisible();

    await page.getByTestId('target-input-1').fill('9');
    await page.getByTestId('roll-button').click();
    await expect(page.getByTestId('targets-error')).toBeVisible();
    await expect(page.getByTestId('targets-error')).toContainText('Die 1');

    expect(errors).toEqual([]);
  });

  test('predict-only rolls unforced dice', async ({ page }) => {
    test.setTimeout(300000);
    const errors = await consoleErrors(page);

    await page.goto(`${predUrl}?seed=e2e-predict-only&maxSubSteps=120&maxFrameGap=5`);
    await expectResultVisible(page);

    await page.getByTestId('mode-select').selectOption('predict-only');
    await expect(page.getByTestId('explanation-mode')).toContainText(
      'Predict only'
    );

    await page.getByTestId('roll-button').click();
    await expectResultVisible(page);
    const text = (await page.getByTestId('result-banner').textContent()) ?? '';
    const values = text
      .split('=')[0]
      .split('+')
      .map((part) => Number.parseInt(part.trim(), 10));
    expect(values).toHaveLength(3);

    expect(errors).toEqual([]);
  });
});
