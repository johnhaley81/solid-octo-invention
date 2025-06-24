import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockedProvider } from '@apollo/client/testing';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { LoginForm } from './LoginForm.tsx';
import { LOGIN_WITH_PASSWORD, CURRENT_USER_FROM_SESSION } from '../../graphql/queries.ts';
import { AuthProvider } from '../../contexts/AuthContext.tsx';

// Mock react-router-dom hooks
const mockNavigate = vi.fn();
const mockLocation = { state: null };

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => mockLocation,
  };
});

const renderLoginForm = (mocks: any[] = []) => {
  return render(
    <MockedProvider mocks={mocks} addTypename={false}>
      <BrowserRouter>
        <AuthProvider>
          <LoginForm />
        </AuthProvider>
      </BrowserRouter>
    </MockedProvider>,
  );
};

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders login form correctly', () => {
    renderLoginForm();

    expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in with Password' })).toBeInTheDocument();
    expect(screen.getByText('create a new account')).toBeInTheDocument();
    expect(screen.getByText('Forgot your password?')).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    const user = userEvent.setup();
    renderLoginForm();

    const submitButton = screen.getByRole('button', { name: 'Sign in with Password' });
    await user.click(submitButton);

    expect(screen.getByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
  });

  it('validates email format', async () => {
    const user = userEvent.setup();
    renderLoginForm();

    const emailInput = screen.getByLabelText('Email address');
    const passwordInput = screen.getByLabelText('Password');
    const submitButton = screen.getByRole('button', { name: 'Sign in with Password' });

    await user.type(emailInput, 'invalid-email');
    await user.type(passwordInput, 'password123!');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    });
  });

  it('validates password is required', async () => {
    const user = userEvent.setup();
    renderLoginForm();

    const emailInput = screen.getByLabelText('Email address');
    const submitButton = screen.getByRole('button', { name: 'Sign in with Password' });

    await user.type(emailInput, 'test@example.com');
    // Don't enter password
    await user.click(submitButton);

    expect(screen.getByText('Password is required')).toBeInTheDocument();
  });

  it('handles successful login', async () => {
    const user = userEvent.setup();
    const mocks = [
      {
        request: {
          query: LOGIN_WITH_PASSWORD,
          variables: {
            email: 'test@example.com',
            password: 'Password123!',
          },
        },
        result: {
          data: {
            loginWithPassword: {
              results: {
                userId: '1',
                sessionToken: 'mock-session-token',
                expiresAt: new Date(Date.now() + 3600000).toISOString(),
              },
            },
          },
        },
      },
      {
        request: {
          query: CURRENT_USER_FROM_SESSION,
          variables: {},
        },
        result: {
          data: {
            currentUserFromSession: {
              user: {
                id: '1',
                email: 'test@example.com',
                name: 'Test User',
<<<<<<< HEAD
=======
                isVerified: true,
>>>>>>> f669cff (Remove JS files: migrate queries.js to queries.ts)
                createdAt: new Date().toISOString(),
              },
            },
          },
        },
      },
    ];

    renderLoginForm(mocks);

    const emailInput = screen.getByLabelText('Email address');
    const passwordInput = screen.getByLabelText('Password');
    const submitButton = screen.getByRole('button', { name: 'Sign in with Password' });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'Password123!');
    await user.click(submitButton);

    // Should show loading state
    await waitFor(() => {
      expect(screen.getByText('Signing in...')).toBeInTheDocument();
    });

    // Wait for navigation
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    });
  });

  it('handles login error', async () => {
    const user = userEvent.setup();
    const mocks = [
      {
        request: {
          query: LOGIN_WITH_PASSWORD,
          variables: {
            email: 'test@example.com',
            password: 'WrongPassword123!',
          },
        },
        error: new Error('Invalid email or password'),
      },
    ];

    renderLoginForm(mocks);

    const emailInput = screen.getByLabelText('Email address');
    const passwordInput = screen.getByLabelText('Password');
    const submitButton = screen.getByRole('button', { name: 'Sign in with Password' });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'WrongPassword123!');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Invalid email or password')).toBeInTheDocument();
    });
  });

  it('handles email verification error', async () => {
    const user = userEvent.setup();
    const mocks = [
      {
        request: {
          query: LOGIN_WITH_PASSWORD,
          variables: {
            email: 'test@example.com',
            password: 'Password123!',
          },
        },
        error: new Error('Please verify your email address'),
      },
    ];

    renderLoginForm(mocks);

    const emailInput = screen.getByLabelText('Email address');
    const passwordInput = screen.getByLabelText('Password');
    const submitButton = screen.getByRole('button', { name: 'Sign in with Password' });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'Password123!');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByTestId('general-error')).toHaveTextContent(
        'Please verify your email address before logging in',
      );
    });
  });

  it('clears field errors when user starts typing', async () => {
    const user = userEvent.setup();
    renderLoginForm();

    const emailInput = screen.getByLabelText('Email address');
    const submitButton = screen.getByRole('button', { name: 'Sign in with Password' });

    // Trigger validation error
    await user.click(submitButton);
    expect(screen.getByText('Email is required')).toBeInTheDocument();

    // Start typing to clear error
    await user.type(emailInput, 'test');
    expect(screen.queryByText('Email is required')).not.toBeInTheDocument();
  });

  it('disables form during submission', async () => {
    const user = userEvent.setup();
    const mocks = [
      {
        request: {
          query: LOGIN_WITH_PASSWORD,
          variables: {
            email: 'test@example.com',
            password: 'Password123!',
          },
        },
        delay: 1000, // Simulate slow response
        result: {
          data: {
            loginWithPassword: {
              results: {
                userId: '1',
                sessionToken: 'mock-session-token',
                expiresAt: new Date(Date.now() + 3600000).toISOString(),
              },
            },
          },
        },
      },
    ];

    renderLoginForm(mocks);

    const emailInput = screen.getByLabelText('Email address');
    const passwordInput = screen.getByLabelText('Password');
    const submitButton = screen.getByRole('button', { name: 'Sign in with Password' });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'Password123!');
    await user.click(submitButton);

    // Wait for loading state to be set
    await waitFor(() => {
      expect(screen.getByText('Signing in...')).toBeInTheDocument();
    });

    // Form should be disabled during submission
    expect(emailInput).toBeDisabled();
    expect(passwordInput).toBeDisabled();
    expect(submitButton).toBeDisabled();
  });
});
