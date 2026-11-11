import { expect, test } from '@playwright/test';

// Visual lab rolls settle in real-time physics but SwiftShader renders at
// a fraction of real-time speed. Parallel workers share the CPU and
// starve each other's frames, so this file runs serially.
test.describe.configure({ mode: 'serial' });

const visualUrl =
  'http://127.0.0.1:5181/dice-playground/apps/demos/dice-visual-lab/';
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

test.describe('dice visual lab', () => {
  test.use({ viewport: { width: 640, height: 400 } });

  test('loads without console errors and renders the lab shell', async ({
    page
  }) => {
    const errors = await consoleErrors(page);

    await page.goto(visualUrl);
    await expect(
      page.getByRole('heading', { name: 'Dice Visual Lab', level: 1 })
    ).toBeVisible();
    await expect(page.getByTestId('stage')).toBeVisible();
    // The throw-arrow overlay mounts on the stage with PointerInput.
    await expect(page.getByTestId('throw-visualizer')).toBeAttached();
    await expect(page.getByTestId('chamfer-slider')).toBeVisible();
    await expect(page.getByTestId('radius-scale-slider')).toBeVisible();
    await expect(page.getByTestId('body-color-input')).toBeVisible();
    await expect(page.getByTestId('face-mapping-select')).toBeVisible();
    await expect(page.getByTestId('preview-panel')).toBeVisible();
    await expect(page.getByTestId('preview-panel')).toContainText('Chamfer:');

    expect(errors).toEqual([]);
  });

  test('rolls on load and again through the button', async ({ page }) => {
    test.setTimeout(300000);
    const errors = await consoleErrors(page);

    await page.goto(`${visualUrl}?seed=e2e-visual&maxSubSteps=120&maxFrameGap=5`);
    await expectResultVisible(page);

    await page.getByTestId('roll-button').click();
    await expectResultVisible(page);

    expect(errors).toEqual([]);
  });

  test('updates chamfer, radius, mapping, and colors', async ({
    page
  }) => {
    test.setTimeout(600000);

    await page.goto(`${visualUrl}?seed=e2e-visual-controls&maxSubSteps=120&maxFrameGap=5`);
    await expectResultVisible(page);

    await page.getByTestId('chamfer-slider').fill('0.7');
    await expect(page.getByTestId('preview-panel')).toContainText(
      'Chamfer: 0.7',
      { timeout: RESULT_TIMEOUT }
    );
    await expectResultVisible(page);

    await page.getByTestId('radius-scale-slider').fill('1.5');
    await expect(page.getByTestId('preview-panel')).toContainText(
      'Die radius',
      { timeout: RESULT_TIMEOUT }
    );
    await expectResultVisible(page);

    await page.getByTestId('face-mapping-select').selectOption('shift-1');
    await expect(page.getByTestId('preview-panel')).toContainText(
      'Face mapping: [2, 3, 4, 5, 6, 1]',
      { timeout: RESULT_TIMEOUT }
    );

    await page.getByTestId('body-color-input').fill('#303030');
    await page.getByTestId('apply-style-button').click();
    await expect(page.getByTestId('preview-panel')).toContainText(
      'body #303030',
      { timeout: RESULT_TIMEOUT }
    );
    await expectResultVisible(page);
  });

  test('reset restores default visuals', async ({ page }) => {
    test.setTimeout(300000);

    await page.goto(`${visualUrl}?seed=e2e-visual-reset&maxSubSteps=120&maxFrameGap=5`);
    await expectResultVisible(page);

    await page.getByTestId('chamfer-slider').fill('0.7');
    await expect(page.getByTestId('preview-panel')).toContainText(
      'Chamfer: 0.7',
      { timeout: RESULT_TIMEOUT }
    );

    await page.getByTestId('reset-button').click();
    await expect(page.getByTestId('preview-panel')).toContainText(
      'Chamfer: 0.96',
      { timeout: RESULT_TIMEOUT }
    );
    await expectResultVisible(page);
  });
});
