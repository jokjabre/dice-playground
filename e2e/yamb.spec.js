import { expect, test } from '@playwright/test';

// Yamb rolls settle in real-time physics but SwiftShader renders at a
// fraction of real-time speed. Parallel workers share the CPU and starve
// each other's frames, so this file runs serially.
test.describe.configure({ mode: 'serial' });

const yambUrl = 'http://127.0.0.1:5181/dice-playground/apps/games/yamb/';
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

/**
 * @param {import('@playwright/test').Page} page
 */
async function expectFiveValues(page) {
  const text = (await page.getByTestId('result-banner').textContent()) ?? '';
  const values = text
    .split('=')[0]
    .split('+')
    .map((part) => Number.parseInt(part.trim(), 10));
  expect(values).toHaveLength(5);
  for (const value of values) {
    expect(value).toBeGreaterThanOrEqual(1);
    expect(value).toBeLessThanOrEqual(6);
  }
}

test.describe('yamb', () => {
  test.use({ viewport: { width: 640, height: 400 } });

  test('loads without console errors and renders the setup shell', async ({
    page
  }) => {
    const errors = await consoleErrors(page);

    await page.goto(yambUrl);
    await expect(
      page.getByRole('heading', { name: 'Yamb', level: 1 })
    ).toBeVisible();
    await expect(page.getByTestId('stage')).toBeVisible();
    await expect(page.getByTestId('setup-panel')).toBeVisible();
    await expect(page.getByTestId('player-count-select')).toBeVisible();
    await expect(page.getByTestId('player-name-1')).toBeVisible();
    await expect(page.getByTestId('start-game-button')).toBeVisible();
    await expect(page.getByTestId('dice-tray')).toBeVisible();

    expect(errors).toEqual([]);
  });

  test('starts a game, holds dice, rerolls, and scores a category', async ({
    page
  }) => {
    test.setTimeout(600000);
    const errors = await consoleErrors(page);

    await page.goto(`${yambUrl}?seed=e2e-yamb&maxSubSteps=120&maxFrameGap=5`);
    await page.getByTestId('start-game-button').click();

    // First roll settles with five dice.
    await expectResultVisible(page);
    await expectFiveValues(page);
    await expect(page.getByTestId('turn-info')).toContainText('Player 1');

    // Hold one die, then reroll the rest. Wait for the roll button to
    // cycle disabled -> enabled so the reroll has settled (the banner
    // keeps showing the previous result while rolling).
    await page.getByTestId('tray-die-1').click();
    await expect(page.getByTestId('tray-die-1')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await page.getByTestId('roll-button').click();
    await expect(page.getByTestId('roll-button')).toBeDisabled({
      timeout: RESULT_TIMEOUT
    });
    await expect(page.getByTestId('roll-button')).toBeEnabled({
      timeout: RESULT_TIMEOUT
    });
    await expectResultVisible(page);
    await expectFiveValues(page);

    // Select a category and score it.
    await page.getByTestId('score-cell-down-ones').click();
    await expect(page.getByTestId('score-button')).toBeEnabled();
    await page.getByTestId('score-button').click();

    // The turn passes to Player 2 and their first roll starts.
    await expect(page.getByTestId('turn-info')).toContainText('Player 2', {
      timeout: RESULT_TIMEOUT
    });
    await expectResultVisible(page);
    await expectFiveValues(page);
    await expect(page.getByTestId('player-bar')).toBeVisible();

    expect(errors).toEqual([]);
  });

  test('returns to setup with new game', async ({ page }) => {
    test.setTimeout(300000);
    const errors = await consoleErrors(page);

    await page.goto(`${yambUrl}?seed=e2e-yamb-new&maxSubSteps=120&maxFrameGap=5`);
    await page.getByTestId('start-game-button').click();
    await expectResultVisible(page);

    await page.getByTestId('new-game-button').click();
    await expect(page.getByTestId('setup-panel')).toBeVisible();
    await expect(page.getByTestId('start-game-button')).toBeVisible();

    expect(errors).toEqual([]);
  });
});
