import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  const testUser = {
    name: 'Test User',
    email: `test-${Date.now()}@example.com`,
    password: 'TestPassword123!',
  };

  test.beforeEach(async ({ page }) => {
    // Set longer timeout for slow CI environments
    test.setTimeout(60000);
    
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

    // Add error handling for network failures
    page.on('requestfailed', request => {
      console.log('Request failed:', request.url(), request.failure()?.errorText);
    });
  });

  test('should display auth link when not authenticated', async ({ page }) => {
    await page.goto('/');

    // Check that auth link is visible
    await expect(page.locator('a[href="/auth"]').first()).toBeVisible();
    await expect(page.locator('text=Sign in / Sign up')).toBeVisible();

    // Check that user info is not visible
    await expect(page.locator('text=Welcome,')).not.toBeVisible();
    await expect(page.locator('text=Sign out')).not.toBeVisible();
  });

  test('should navigate to combined auth page', async ({ page }) => {
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

    try {
      // Navigate directly to auth page
      await page.goto('/auth', { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Should be on auth page
      await expect(page).toHaveURL('/auth');

      // Wait for page to load with a reasonable timeout
      await page.waitForLoadState('networkidle', { timeout: 15000 });

      // Debug: check if React app root exists
      const rootElement = await page.locator('#root').count();
      console.log('Root element count:', rootElement);

      if (rootElement > 0) {
        // Debug: check what's in the root
        const rootContent = await page.locator('#root').innerHTML();
        console.log('Root content length:', rootContent.length);
        console.log('Root content preview:', rootContent.substring(0, 200));
      }

      // Check for the specific headings with timeout
      await expect(page.locator('h2:has-text("Sign up")')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('h2:has-text("Log in")')).toBeVisible({ timeout: 10000 });
      
      // Verify both forms are present
      await expect(page.locator('#register-name')).toBeVisible();
      await expect(page.locator('#register-email')).toBeVisible();
      await expect(page.locator('#register-password')).toBeVisible();
      await expect(page.locator('#login-email')).toBeVisible();
      await expect(page.locator('#login-password')).toBeVisible();
      
      // Verify buttons are present
      await expect(page.locator('button:has-text("Sign up")')).toBeVisible();
      await expect(page.locator('button:has-text("Log in")')).toBeVisible();
      
    } catch (error) {
      console.log('Auth page test failed:', error.message);
      // Take a screenshot for debugging
      await page.screenshot({ path: 'auth-page-error.png', fullPage: true });
      throw error;
    }
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

    await page.goto('/auth');

    // Fill out registration form (left side)
    await page.fill('#register-name', testUser.name);
    await page.fill('#register-email', testUser.email);
    await page.fill('#register-password', testUser.password);

    // Submit form and wait for network request with timeout
    const responsePromise = page.waitForResponse(
      response => {
        const postData = response.request().postData();
        return (
          response.url().includes('graphql') &&
          postData !== null &&
          postData.includes('registerUserWithPassword')
        );
      },
      { timeout: 30000 } // 30 second timeout
    );

    // Click the sign up button (in the left form)
    await page.locator('button:has-text("Sign up")').click();

    try {
      // Wait for the GraphQL response
      const response = await responsePromise;
      console.log('Registration response status:', response.status());
      const responseBody = await response.text();
      console.log('Registration response body:', responseBody);
    } catch (error) {
      console.log('Failed to get registration response:', error.message);
      // Take a screenshot for debugging
      await page.screenshot({ path: 'registration-error.png', fullPage: true });
      throw error;
    }

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

    // Should show success message in the left form
    await expect(
      page.locator('text=Registration successful! Please check your email to verify your account.'),
    ).toBeVisible();

    // Should stay on auth page (no redirect in new design)
    await expect(page).toHaveURL('/auth');
  });

  test('should validate registration form fields', async ({ page }) => {
    await page.goto('/auth');

    // Try to submit empty registration form
    await page.locator('button:has-text("Sign up")').click();

    // Should show validation errors
    await expect(page.locator('text=Name is required')).toBeVisible();
    await expect(page.locator('text=Email is required')).toBeVisible();
    await expect(page.locator('text=Password is required')).toBeVisible();

    // Test invalid email
    await page.fill('#register-email', 'invalid-email');
    await page.locator('button:has-text("Sign up")').click();
    await expect(page.locator('text=Please enter a valid email address')).toBeVisible();

    // Test weak password
    await page.fill('#register-email', 'test@example.com');
    await page.fill('#register-password', 'weak');
    await page.locator('button:has-text("Sign up")').click();
    await expect(page.locator('text=Password must be at least 8 characters')).toBeVisible();
  });

  test('should validate login form fields', async ({ page }) => {
    await page.goto('/auth');

    // Try to submit empty login form (right side)
    await page.locator('button:has-text("Log in")').click();

    // Should show validation errors
    await expect(page.locator('text=Email is required')).toBeVisible();
    await expect(page.locator('text=Password is required')).toBeVisible();

    // Test invalid email
    await page.fill('#login-email', 'invalid-email');
    await page.locator('button:has-text("Log in")').click();
    await expect(page.locator('text=Please enter a valid email address')).toBeVisible();

    // Test short password
    await page.fill('#login-email', 'test@example.com');
    await page.fill('#login-password', 'short');
    await page.locator('button:has-text("Log in")').click();
    await expect(page.locator('text=Password must be at least 8 characters')).toBeVisible();
  });

  test('should handle login with invalid credentials', async ({ page }) => {
    await page.goto('/auth');

    // Fill login form with invalid credentials (right side)
    await page.fill('#login-email', 'nonexistent@example.com');
    await page.fill('#login-password', 'WrongPassword123!');

    // Submit login form
    await page.locator('button:has-text("Log in")').click();

    // Should show error message
    await expect(page.locator('text=Invalid email or password')).toBeVisible();
  });

  test('should redirect to auth when accessing protected routes', async ({ page }) => {
    // Try to access protected dashboard page
    await page.goto('/dashboard');

    // Should redirect to auth page
    await expect(page).toHaveURL('/auth');
    await expect(page.locator('h2:has-text("Log in")')).toBeVisible();
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
                user: {
                  id: '1',
                  email: 'test@example.com',
                  name: 'Test User',
                  authMethod: 'PASSWORD',
                  createdAt: new Date().toISOString(),
                },
              },
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Try to access auth page
    await page.goto('/auth');

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

    // Should eventually redirect to auth page
    await expect(page).toHaveURL('/auth', { timeout: 5000 });
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
                user: {
                  id: '1',
                  email: 'test@example.com',
                  name: 'Test User',
                  authMethod: 'PASSWORD',
                  createdAt: new Date().toISOString(),
                },
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
    await expect(page.locator('a[href="/auth"]').first()).toBeVisible();
    await expect(page.locator('text=Sign in / Sign up')).toBeVisible();
    await expect(page.locator('text=Welcome,')).not.toBeVisible();
  });

  test('should show both forms on combined auth page', async ({ page }) => {
    await page.goto('/auth');

    // Should show both sign up and login forms
    await expect(page.locator('h2:has-text("Sign up")')).toBeVisible();
    await expect(page.locator('h2:has-text("Log in")')).toBeVisible();

    // Should show form fields for both
    await expect(page.locator('#register-name')).toBeVisible();
    await expect(page.locator('#register-email')).toBeVisible();
    await expect(page.locator('#register-password')).toBeVisible();
    await expect(page.locator('#login-email')).toBeVisible();
    await expect(page.locator('#login-password')).toBeVisible();
  });

  test('should show forgot password link on auth page', async ({ page }) => {
    await page.goto('/auth');

    // Should show forgot password link in login section
    await expect(page.locator('text=Forgot your password?')).toBeVisible();

    // Link should be clickable (even if page doesn't exist yet)
    const forgotLink = page.locator('text=Forgot your password?');
    await expect(forgotLink).toHaveAttribute('href', '/forgot-password');
  });

  test('should not show OAuth buttons as requested', async ({ page }) => {
    await page.goto('/auth');

    // Should NOT show Google/Facebook OAuth buttons as per requirements
    await expect(page.locator('text=Google')).not.toBeVisible();
    await expect(page.locator('text=Facebook')).not.toBeVisible();
    await expect(page.locator('text=Continue with Google')).not.toBeVisible();
    await expect(page.locator('text=Continue with Facebook')).not.toBeVisible();
  });
});
