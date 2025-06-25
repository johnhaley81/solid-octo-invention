import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  const testUser = {
    name: 'Test User',
    email: `test-${Date.now()}@example.com`,
    password: 'TestPassword123!',
  };

  test.beforeEach(async ({ page }) => {
    // Clear any existing auth state
    await page.context().clearCookies();
    // Try to clear localStorage, but handle security errors gracefully
    try {
      await page.evaluate(() => localStorage.clear());
    } catch (error) {
      // Ignore localStorage security errors in test environment
      console.log(
        'localStorage.clear() failed (expected in some test environments):',
        error.message,
      );
    }
  });

  test('should display login and register links when not authenticated', async ({ page }) => {
    await page.goto('/');

    // Check that auth links are visible
    await expect(page.locator('a[href="/login"]').first()).toBeVisible();
    await expect(page.locator('a[href="/register"]').first()).toBeVisible();

    // Check that user info is not visible
    await expect(page.locator('text=Welcome,')).not.toBeVisible();
    await expect(page.locator('text=Sign out')).not.toBeVisible();
  });

  test('should navigate to registration page', async ({ page }) => {
    await page.goto('/');

    // Click sign up link
    await page.locator('text=Sign up').click();

    // Should be on registration page
    await expect(page).toHaveURL('/register');
    await expect(page.locator('h2:has-text("Create your account")')).toBeVisible();
  });

  test('should navigate to login page', async ({ page }) => {
    await page.goto('/');

    // Click sign in link
    await page.locator('a[href="/login"]').first().click();

    // Should be on login page
    await expect(page).toHaveURL('/login');
    await expect(page.locator('h2:has-text("Sign in to your account")')).toBeVisible();
  });

  test('should register a new user successfully', async ({ page }) => {
    // Listen for console logs and errors
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

    // Listen for network requests
    page.on('request', request => {
      if (request.url().includes('graphql')) {
        console.log('GraphQL REQUEST:', request.method(), request.url());
        console.log('GraphQL BODY:', request.postData());
      }
    });

    page.on('response', response => {
      if (response.url().includes('graphql')) {
        console.log('GraphQL RESPONSE:', response.status(), response.url());
        response.text().then(text => console.log('GraphQL RESPONSE BODY:', text));
      }
    });

    await page.goto('/register');

    // Fill out registration form
    await page.fill('#name', testUser.name);
    await page.fill('#email', testUser.email);
    await page.fill('#password', testUser.password);
    await page.fill('#confirmPassword', testUser.password);

    // Submit form and wait for network request
    const responsePromise = page.waitForResponse(response => {
      const postData = response.request().postData();
      return (
        response.url().includes('graphql') && postData !== null && postData.includes('registerUserWithPassword')
      );
    });

    await page.click('button[type="submit"]');

    // Wait for the GraphQL response
    const response = await responsePromise;
    console.log('Registration response status:', response.status());
    const responseBody = await response.text();
    console.log('Registration response body:', responseBody);

    // Check for any error messages on the page
    const errorElements = await page
      .locator('[class*="error"], [class*="Error"], .text-red-500, .text-red-600')
      .all();
    for (const element of errorElements) {
      const text = await element.textContent();
      if (text && text.trim()) {
        console.log('Error element found:', text);
      }
    }

    // Should show success message
    await expect(page.locator('h2:has-text("Registration Successful!")')).toBeVisible();
    await expect(page.locator('text=Please check your email to verify')).toBeVisible();

    // Should redirect to login page
    await expect(page).toHaveURL('/login', { timeout: 10000 });
    await expect(page.locator('text=Registration successful!')).toBeVisible();
  });

  test('should validate registration form fields', async ({ page }) => {
    await page.goto('/register');

    // Try to submit empty form
    await page.click('button[type="submit"]');

    // Should show validation errors
    await expect(page.locator('text=Name is required')).toBeVisible();
    await expect(page.locator('text=Email is required')).toBeVisible();
    await expect(page.locator('text=Password is required')).toBeVisible();

    // Test invalid email
    await page.fill('#email', 'invalid-email');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Please enter a valid email address')).toBeVisible();

    // Test weak password
    await page.fill('#email', 'test@example.com');
    await page.fill('#password', 'weak');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Password must be at least 8 characters')).toBeVisible();

    // Test password mismatch
    await page.fill('#password', 'StrongPassword123!');
    await page.fill('#confirmPassword', 'DifferentPassword123!');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Passwords do not match')).toBeVisible();
  });

  test('should validate login form fields', async ({ page }) => {
    await page.goto('/login');

    // Try to submit empty form
    await page.click('button[type="submit"]');

    // Should show validation errors
    await expect(page.locator('text=Email is required')).toBeVisible();
    await expect(page.locator('text=Password is required')).toBeVisible();

    // Test invalid email
    await page.fill('#email', 'invalid-email');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Please enter a valid email address')).toBeVisible();

    // Test short password
    await page.fill('#email', 'test@example.com');
    await page.fill('#password', 'short');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Password must be at least 8 characters')).toBeVisible();
  });

  test('should handle login with invalid credentials', async ({ page }) => {
    await page.goto('/login');

    // Fill form with invalid credentials
    await page.fill('#email', 'nonexistent@example.com');
    await page.fill('#password', 'WrongPassword123!');

    // Submit form
    await page.click('button[type="submit"]');

    // Should show error message
    await expect(page.locator('text=Invalid email or password')).toBeVisible();
  });

  test('should redirect to login when accessing protected routes', async ({ page }) => {
    // Try to access protected dashboard page
    await page.goto('/dashboard');

    // Should redirect to login
    await expect(page).toHaveURL('/login');
    await expect(page.locator('h2:has-text("Sign in to your account")')).toBeVisible();
  });

  test('should redirect authenticated users away from auth pages', async ({ page }) => {
    // Mock authenticated state
    await page.addInitScript(() => {
      localStorage.setItem('auth-token', 'mock-token');
    });

    // Mock the GraphQL response for current user
    await page.route('**/graphql', async route => {
      const request = route.request();
      const postData = request.postData();

      if (postData?.includes('currentUserFromSession')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              currentUserFromSession: {
                id: '1',
                email: 'test@example.com',
                name: 'Test User',
                authMethod: 'PASSWORD',
                createdAt: new Date().toISOString(),
              },
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Try to access login page
    await page.goto('/login');

    // Should redirect to home
    await expect(page).toHaveURL('/');
  });

  test('should show loading state during authentication check', async ({ page }) => {
    // Mock slow authentication check
    await page.route('**/graphql', async route => {
      const request = route.request();
      const postData = request.postData();

      if (postData?.includes('currentUserFromSession')) {
        // Delay response to test loading state
        await new Promise(resolve => setTimeout(resolve, 1000));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: { currentUserFromSession: null },
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.addInitScript(() => {
      localStorage.setItem('auth-token', 'mock-token');
    });

    await page.goto('/dashboard');

    // Should show loading state
    await expect(page.locator('text=Loading...')).toBeVisible();

    // Should eventually redirect to login
    await expect(page).toHaveURL('/login', { timeout: 5000 });
  });

  test('should handle logout functionality', async ({ page }) => {
    // Mock authenticated state
    await page.addInitScript(() => {
      localStorage.setItem('auth-token', 'mock-token');
    });

    // Mock GraphQL responses
    await page.route('**/graphql', async route => {
      const request = route.request();
      const postData = request.postData();

      if (postData?.includes('currentUserFromSession')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              currentUserFromSession: {
                id: '1',
                email: 'test@example.com',
                name: 'Test User',
                authMethod: 'PASSWORD',
                createdAt: new Date().toISOString(),
              },
            },
          }),
        });
      } else if (postData?.includes('logout')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: { logout: { success: true } },
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/');

    // Should show authenticated state
    await expect(page.locator('text=Welcome, Test User')).toBeVisible();
    await expect(page.locator('text=Sign out')).toBeVisible();

    // Click logout
    await page.click('text=Sign out');

    // Should show unauthenticated state
    await expect(page.locator('a[href="/login"]').first()).toBeVisible();
    await expect(page.locator('a[href="/register"]').first()).toBeVisible();
    await expect(page.locator('text=Welcome,')).not.toBeVisible();
  });

  test('should navigate between login and register pages', async ({ page }) => {
    await page.goto('/login');

    // Click "create a new account" link
    await page.click('text=create a new account');
    await expect(page).toHaveURL('/register');

    // Click "sign in to your existing account" link
    await page.click('text=sign in to your existing account');
    await expect(page).toHaveURL('/login');
  });

  test('should show forgot password link on login page', async ({ page }) => {
    await page.goto('/login');

    // Should show forgot password link
    await expect(page.locator('text=Forgot your password?')).toBeVisible();

    // Link should be clickable (even if page doesn't exist yet)
    const forgotLink = page.locator('text=Forgot your password?');
    await expect(forgotLink).toHaveAttribute('href', '/forgot-password');
  });

  test('should show terms and privacy links on register page', async ({ page }) => {
    await page.goto('/register');

    // Should show terms and privacy links
    await expect(page.locator('text=Terms of Service')).toBeVisible();
    await expect(page.locator('text=Privacy Policy')).toBeVisible();

    // Links should be clickable (even if pages don't exist yet)
    const termsLink = page.locator('text=Terms of Service');
    const privacyLink = page.locator('text=Privacy Policy');
    await expect(termsLink).toHaveAttribute('href', '/terms');
    await expect(privacyLink).toHaveAttribute('href', '/privacy');
  });
});
