import { expect, test } from '@playwright/test';

const fixtureUrl = '/dice-playground/e2e-fixtures/rendering/';

/**
 * @param {import('@playwright/test').Page} page
 */
async function fixtureState(page) {
  return page.evaluate(() => /** @type {any} */ (window).__renderFixture.state);
}

test.describe('rendering smoke fixture', () => {
  test('mounts a scene, adds a die, light, and camera, and renders a frame', async ({
    page
  }) => {
    /** @type {string[]} */
    const errors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto(fixtureUrl);
    await expect
      .poll(async () => (await fixtureState(page)).status)
      .toBe('ready');

    const state = await fixtureState(page);
    expect(state.error).toBeNull();
    expect(state.threeLoaded).toBe(true);
    expect(state.frames).toBeGreaterThanOrEqual(1);
    expect(state.triangles).toBe(44);
    expect(state.faceGroups).toEqual([0, 1, 2, 3, 4, 5, -1]);
    expect(state.materialCount).toBe(7);
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

    await page.goto(fixtureUrl);
    await expect
      .poll(async () => (await fixtureState(page)).status)
      .toBe('ready');

    expect(responses.length).toBeGreaterThanOrEqual(1);
    for (const response of responses) {
      expect(response.status).toBe(200);
      expect(response.url).toContain(
        '/dice-playground/e2e-fixtures/rendering/assets/'
      );
      expect(response.url).not.toBe(
        '/dice-playground/e2e-fixtures/rendering/three.min.js'
      );
    }
  });

  test('surfaces a readable error when the vendor script fails to load', async ({
    page
  }) => {
    await page.route('**/*three*.js', (route) => route.abort());
    await page.goto(fixtureUrl);

    await expect
      .poll(async () => (await fixtureState(page)).status)
      .toBe('error');

    const state = await fixtureState(page);
    expect(state.error).toContain('Failed to load vendored Three r73');
  });

  test('resizes and disposes without leaving the canvas attached', async ({
    page
  }) => {
    await page.goto(fixtureUrl);
    await expect
      .poll(async () => (await fixtureState(page)).status)
      .toBe('ready');

    await page.evaluate(() => /** @type {any} */ (window).__renderFixture.resize(640, 480));
    await page.evaluate(() => /** @type {any} */ (window).__renderFixture.dispose());

    const result = await page.evaluate(() => ({
      status: /** @type {any} */ (window).__renderFixture.state.status,
      canvases: document.querySelectorAll('#scene canvas').length
    }));

    expect(result.status).toBe('disposed');
    expect(result.canvases).toBe(0);
  });
});
