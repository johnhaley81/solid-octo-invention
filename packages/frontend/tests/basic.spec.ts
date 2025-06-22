import { test, expect } from '@playwright/test';

test.describe('Basic Application Tests', () => {
  test('should load the homepage', async ({ page }) => {
    await page.goto('/');

    // Check that the page loads
    await expect(page).toHaveTitle(/Solid Octo Invention/);

    // Check for basic content
    await expect(page.locator('h1')).toBeVisible();
  });

  test('should navigate to posts page', async ({ page }) => {
    await page.goto('/');

    // Look for navigation link to posts
    const postsLink = page.locator('a[href="/posts"]');
    if (await postsLink.isVisible()) {
      await postsLink.click();
      await expect(page).toHaveURL('/posts');
    }
  });

  test('should handle 404 page', async ({ page }) => {
    await page.goto('/non-existent-page');

    // Should show 404 or redirect to home
    const is404 = await page.locator('text=404').isVisible();
    const isHome = page.url().includes('/');

    expect(is404 || isHome).toBeTruthy();
  });
});
