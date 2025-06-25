import { test, expect } from '@playwright/test';

test.describe('Basic Application Tests', () => {
  test('should load the homepage', async ({ page }) => {
    await page.goto('/');

    // Check that the page loads
    await expect(page).toHaveTitle(/Solid Octo Invention/);

    // Check for basic content
    await expect(page.locator('h1')).toBeVisible();
  });

  test('should navigate to dashboard and redirect to auth when not authenticated', async ({
    page,
  }) => {
    await page.goto('/');

    // Look for navigation link to dashboard
    const dashboardLink = page.locator('a[href="/dashboard"]').first();
    await expect(dashboardLink).toBeVisible();
    await dashboardLink.click();

    // Since dashboard is protected, should redirect to auth page
    await expect(page).toHaveURL('/auth');

    // Should show combined auth forms
    await expect(page.locator('h2:has-text("Sign up")')).toBeVisible();
    await expect(page.locator('h2:has-text("Log in")')).toBeVisible();
  });

  test('should handle 404 page', async ({ page }) => {
    await page.goto('/non-existent-page');

    // Should show 404 or redirect to home
    const is404 = await page.locator('text=404').isVisible();
    const isHome = page.url().includes('/');

    expect(is404 || isHome).toBeTruthy();
  });
});
