import { test as base } from '@playwright/test';

export { expect } from '@playwright/test';
export type { Locator, Page } from '@playwright/test';

/**
 * `page.goto` that also waits for React to hydrate (AppProviders sets
 * `html[data-hydrated]`). Without it, a click on a slow machine can land
 * before React is attached and do nothing.
 */
export const test = base.extend({
  page: async ({ page }, provide) => {
    const goto = page.goto.bind(page);
    page.goto = async (...args: Parameters<typeof goto>) => {
      const response = await goto(...args);
      await page.locator('html[data-hydrated="true"]').waitFor({ state: 'attached' });
      return response;
    };
    await provide(page);
  },
});
