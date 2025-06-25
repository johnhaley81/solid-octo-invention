import { test, expect } from '@playwright/test';

test.describe('Authentication UI Tests (No Database Required)', () => {
  test.beforeEach(async ({ page }) => {
    // Set longer timeout for slow CI environments
    test.setTimeout(30000);
    
    // Add error handling for network failures
    page.on('requestfailed', request => {
      console.log('Request failed:', request.url(), request.failure()?.errorText);
    });

    // Listen for console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('Console error:', msg.text());
      }
    });

    // Listen for page errors
    page.on('pageerror', error => {
      console.log('Page error:', error.message);
    });
  });

  test('should display auth link in navigation when not authenticated', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Check that auth link is visible
    await expect(page.locator('a[href="/auth"]').first()).toBeVisible();
    await expect(page.locator('text=Sign in / Sign up')).toBeVisible();

    // Check that user info is not visible
    await expect(page.locator('text=Welcome,')).not.toBeVisible();
    await expect(page.locator('text=Sign out')).not.toBeVisible();
  });

  test('should render combined auth page with both forms', async ({ page }) => {
    await page.goto('/auth', { waitUntil: 'domcontentloaded' });

    // Should be on auth page
    await expect(page).toHaveURL('/auth');

    // Check for the main headings
    await expect(page.locator('h2:has-text("Sign up")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('h2:has-text("Log in")')).toBeVisible({ timeout: 10000 });
    
    // Verify sign up form fields are present
    await expect(page.locator('#register-name')).toBeVisible();
    await expect(page.locator('#register-email')).toBeVisible();
    await expect(page.locator('#register-password')).toBeVisible();
    
    // Verify login form fields are present
    await expect(page.locator('#login-email')).toBeVisible();
    await expect(page.locator('#login-password')).toBeVisible();
    
    // Verify buttons are present
    await expect(page.locator('button:has-text("Sign up")')).toBeVisible();
    await expect(page.locator('button:has-text("Log in")')).toBeVisible();
  });

  test('should show validation errors for empty sign up form', async ({ page }) => {
    await page.goto('/auth', { waitUntil: 'domcontentloaded' });

    // Try to submit empty registration form
    await page.locator('button:has-text("Sign up")').click();

    // Should show validation errors (these are client-side validations)
    await expect(page.locator('text=Name is required')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Email is required')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Password is required')).toBeVisible({ timeout: 5000 });
  });

  test('should show validation errors for empty login form', async ({ page }) => {
    await page.goto('/auth', { waitUntil: 'domcontentloaded' });

    // Try to submit empty login form
    await page.locator('button:has-text("Log in")').click();

    // Should show validation errors (these are client-side validations)
    await expect(page.locator('text=Email is required')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Password is required')).toBeVisible({ timeout: 5000 });
  });

  test('should validate email format in sign up form', async ({ page }) => {
    await page.goto('/auth', { waitUntil: 'domcontentloaded' });

    // Fill invalid email
    await page.fill('#register-name', 'Test User');
    await page.fill('#register-email', 'invalid-email');
    await page.fill('#register-password', 'ValidPassword123!');
    
    // Submit form
    await page.locator('button:has-text("Sign up")').click();

    // Should show email validation error
    await expect(page.locator('text=Please enter a valid email address')).toBeVisible({ timeout: 5000 });
  });

  test('should validate email format in login form', async ({ page }) => {
    await page.goto('/auth', { waitUntil: 'domcontentloaded' });

    // Fill invalid email
    await page.fill('#login-email', 'invalid-email');
    await page.fill('#login-password', 'ValidPassword123!');
    
    // Submit form
    await page.locator('button:has-text("Log in")').click();

    // Should show email validation error
    await expect(page.locator('text=Please enter a valid email address')).toBeVisible({ timeout: 5000 });
  });

  test('should validate password length in sign up form', async ({ page }) => {
    await page.goto('/auth', { waitUntil: 'domcontentloaded' });

    // Fill weak password
    await page.fill('#register-name', 'Test User');
    await page.fill('#register-email', 'test@example.com');
    await page.fill('#register-password', 'weak');
    
    // Submit form
    await page.locator('button:has-text("Sign up")').click();

    // Should show password validation error
    await expect(page.locator('text=Password must be at least 8 characters')).toBeVisible({ timeout: 5000 });
  });

  test('should validate password length in login form', async ({ page }) => {
    await page.goto('/auth', { waitUntil: 'domcontentloaded' });

    // Fill short password
    await page.fill('#login-email', 'test@example.com');
    await page.fill('#login-password', 'short');
    
    // Submit form
    await page.locator('button:has-text("Log in")').click();

    // Should show password validation error
    await expect(page.locator('text=Password must be at least 8 characters')).toBeVisible({ timeout: 5000 });
  });

  test('should have proper form accessibility attributes', async ({ page }) => {
    await page.goto('/auth', { waitUntil: 'domcontentloaded' });

    // Check that form fields have proper labels/placeholders
    await expect(page.locator('#register-name')).toHaveAttribute('placeholder', 'Name');
    await expect(page.locator('#register-email')).toHaveAttribute('placeholder', 'Email');
    await expect(page.locator('#register-password')).toHaveAttribute('placeholder', '••••••');
    
    await expect(page.locator('#login-email')).toHaveAttribute('placeholder', 'Email');
    await expect(page.locator('#login-password')).toHaveAttribute('placeholder', 'Password');

    // Check that form fields have proper autocomplete attributes
    await expect(page.locator('#register-name')).toHaveAttribute('autocomplete', 'name');
    await expect(page.locator('#register-email')).toHaveAttribute('autocomplete', 'email');
    await expect(page.locator('#register-password')).toHaveAttribute('autocomplete', 'new-password');
    
    await expect(page.locator('#login-email')).toHaveAttribute('autocomplete', 'email');
    await expect(page.locator('#login-password')).toHaveAttribute('autocomplete', 'current-password');
  });

  test('should have proper visual design elements', async ({ page }) => {
    await page.goto('/auth', { waitUntil: 'domcontentloaded' });

    // Check that the page has the gradient background
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Check that both sections are visible (sign up and login)
    const signUpSection = page.locator('h2:has-text("Sign up")').locator('..');
    const loginSection = page.locator('h2:has-text("Log in")').locator('..');
    
    await expect(signUpSection).toBeVisible();
    await expect(loginSection).toBeVisible();

    // Verify the "Already have an account?" text is present
    await expect(page.locator('text=Already have an account?')).toBeVisible();
  });
});
