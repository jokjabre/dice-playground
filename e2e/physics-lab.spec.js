import { expect, test } from '@playwright/test';

// Physics lab rolls settle in real-time physics but SwiftShader renders at
// a fraction of real-time speed. Parallel workers share the CPU and starve
// each other's frames, so this file runs serially.
test.describe.configure({ mode: 'serial' });

const labUrl = 'http://127.0.0.1:5181/dice-playground/apps/demos/physics-lab/';
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

test.describe('physics lab', () => {
  test.use({ viewport: { width: 640, height: 400 } });

  test('loads without console errors and renders the lab shell', async ({
    page
  }) => {
    const errors = await consoleErrors(page);

    await page.goto(labUrl);
    await expect(
      page.getByRole('heading', { name: 'Physics Lab', level: 1 })
    ).toBeVisible();
    await expect(page.getByTestId('stage')).toBeVisible();
    // The throw-arrow overlay mounts on the stage with PointerInput.
    await expect(page.getByTestId('throw-visualizer')).toBeAttached();
    await expect(page.getByTestId('throw-button')).toBeVisible();
    await expect(page.getByTestId('gravity-z-slider')).toBeVisible();
    await expect(page.getByTestId('surface-select')).toBeVisible();
    await expect(page.getByTestId('friction-slider')).toBeVisible();
    await expect(page.getByTestId('stats-panel')).toBeVisible();
    await expect(page.getByTestId('stats-panel')).toContainText('Bodies:');

    expect(errors).toEqual([]);
  });

  test('rolls on load and throws again through the button', async ({
    page
  }) => {
    test.setTimeout(300000);
    const errors = await consoleErrors(page);

    await page.goto(`${labUrl}?seed=e2e-physics&maxSubSteps=120&maxFrameGap=5`);
    await expectResultVisible(page);

    await page.getByTestId('throw-button').click();
    await expectResultVisible(page);

    await expect(page.getByTestId('stats-panel')).toContainText('Dice: 6');
    expect(errors).toEqual([]);
  });

  test('updates gravity, contact, and body settings live', async ({
    page
  }) => {
    test.setTimeout(300000);

    await page.goto(`${labUrl}?seed=e2e-physics-controls&maxSubSteps=120&maxFrameGap=5`);
    await expectResultVisible(page);

    await page.getByTestId('gravity-z-slider').fill('0');
    await expect(page.getByTestId('stats-panel')).toContainText(
      'Gravity: 0, 0, 0',
      { timeout: RESULT_TIMEOUT }
    );

    await page.getByTestId('surface-select').selectOption('die');
    await expect(page.getByTestId('stats-panel')).toContainText(
      'Die vs die: friction 0',
      { timeout: RESULT_TIMEOUT }
    );

    await page.getByTestId('friction-slider').fill('0.5');
    await expect(page.getByTestId('stats-panel')).toContainText(
      'Die vs die: friction 0.5',
      { timeout: RESULT_TIMEOUT }
    );

    await page.getByTestId('mass-slider').fill('600');
    await expect(page.getByTestId('stats-panel')).toContainText(
      'Die mass: 600',
      { timeout: RESULT_TIMEOUT }
    );

    await page.getByTestId('solver-iterations-slider').fill('30');
    await expect(page.getByTestId('stats-panel')).toContainText(
      'Solver iterations: 30',
      { timeout: RESULT_TIMEOUT }
    );
  });

  test('reset to defaults restores gravity, contacts, and mass', async ({
    page
  }) => {
    test.setTimeout(300000);

    await page.goto(`${labUrl}?seed=e2e-physics-reset&maxSubSteps=120&maxFrameGap=5`);
    await expectResultVisible(page);

    await page.getByTestId('gravity-z-slider').fill('0');
    await page.getByTestId('mass-slider').fill('600');
    await expect(page.getByTestId('stats-panel')).toContainText(
      'Gravity: 0, 0, 0',
      { timeout: RESULT_TIMEOUT }
    );

    await page.getByTestId('reset-defaults-button').click();
    await expect(page.getByTestId('stats-panel')).toContainText(
      'Gravity: 0, 0, -2940',
      { timeout: RESULT_TIMEOUT }
    );
    await expect(page.getByTestId('stats-panel')).toContainText(
      'Die mass: 300',
      { timeout: RESULT_TIMEOUT }
    );
    await expectResultVisible(page);
  });
});
