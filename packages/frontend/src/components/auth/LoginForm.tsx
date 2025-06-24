import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  LOGIN_WITH_PASSWORD,
  LOGIN_WITH_PASSKEY,
  GET_PASSKEY_CHALLENGE,
  CURRENT_USER_FROM_SESSION,
} from '../../graphql/queries.ts';
import { useAuth } from '../../contexts/AuthContext.js';
import { validateLoginForm } from '../../utils/validation.ts';
import { isPasskeySupported, authenticateWithPasskey } from '../../utils/passkey.js';

/**
 * Login form component with validation and error handling
 */
export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [loginWithPassword] = useMutation(LOGIN_WITH_PASSWORD);
  // TODO: Implement passkey authentication mutations in backend
  const [loginWithPasskey] = useMutation(LOGIN_WITH_PASSKEY || LOGIN_WITH_PASSWORD); // Fallback to password login
  const [getPasskeyChallenge] = useMutation(GET_PASSKEY_CHALLENGE || CURRENT_USER_FROM_SESSION); // Fallback
  const [getCurrentUser] = useMutation(CURRENT_USER_FROM_SESSION);

  // Get the intended destination or default to home
  const from = (location.state as any)?.from?.pathname || '/';

  /**
   * Validate form inputs using shared validation schema
   */
  const validateForm = (): boolean => {
    const validation = validateLoginForm(email, password);
    setErrors(validation.errors);
    return validation.isValid;
  };

  /**
   * Handle passkey login
   */
  const handlePasskeyLogin = async () => {
    if (!email.trim()) {
      setErrors({ email: 'Email is required for passkey login' });
      return;
    }

    if (!isPasskeySupported()) {
      setErrors({ general: 'Passkeys are not supported in this browser' });
      return;
    }

    setIsLoading(true);

    try {
      // Get passkey challenge from server
      const { data: challengeData } = await getPasskeyChallenge({
        variables: { email: email.trim() },
      });

      if (!challengeData?.getPasskeyChallenge) {
        setErrors({ general: 'No passkeys found for this email address' });
        return;
      }

      // Authenticate with passkey
      const credential = await authenticateWithPasskey({
        challenge: challengeData.getPasskeyChallenge.challenge,
        allowCredentials: challengeData.getPasskeyChallenge.allowCredentials,
      });

      // Login with passkey credential
      const { data: loginData } = await loginWithPasskey({
        variables: { email: email.trim(), credential },
      });

      if (loginData?.loginWithPasskey) {
        const { sessionToken } = loginData.loginWithPasskey;

        // Get user details
        const { data: userData } = await getCurrentUser();

        if (userData?.currentUserFromSession?.user) {
          // Login successful
          login(userData.currentUserFromSession.user, sessionToken);
          navigate(from, { replace: true });
        } else {
          setErrors({ general: 'Failed to retrieve user information' });
        }
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Passkey login failed';
      setErrors({ general: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle form submission (password login)
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      // Attempt login
      const result = await loginWithPassword({
        variables: { email: email.trim(), password },
        errorPolicy: 'all', // Allow both data and errors to be returned
      });

      // Check for GraphQL errors first
      if (result.errors && result.errors.length > 0) {
        const errorMessage = result.errors[0]?.message || 'Login failed';
        if (errorMessage.toLowerCase().includes('verify')) {
          setErrors({ general: 'Please verify your email address before logging in' });
        } else if (errorMessage.toLowerCase().includes('invalid')) {
          setErrors({ general: 'Invalid email or password' });
        } else {
          setErrors({ general: errorMessage });
        }
        return;
      }

      const loginData = result.data;

      if (loginData?.loginWithPassword?.results) {
        const { sessionToken } = loginData.loginWithPassword.results;

        // Get user details
        const { data: userData } = await getCurrentUser();

        if (userData?.currentUserFromSession?.user) {
          // Login successful
          login(userData.currentUserFromSession.user, sessionToken);
          navigate(from, { replace: true });
        } else {
          setErrors({ general: 'Failed to retrieve user information' });
        }
      } else {
        setErrors({ general: 'Login failed - no response data' });
      }
    } catch (error: any) {
      // Handle network errors or other exceptions
      const errorMessage = error.message || 'Login failed';
      if (errorMessage.toLowerCase().includes('verify')) {
        setErrors({ general: 'Please verify your email address before logging in' });
      } else if (errorMessage.toLowerCase().includes('invalid')) {
        setErrors({ general: 'Invalid email or password' });
      } else {
        setErrors({ general: errorMessage });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Or{' '}
            <Link
              to="/register"
              className="font-medium text-indigo-600 hover:text-indigo-500 transition-colors"
            >
              create a new account
            </Link>
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit} noValidate>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => {
                  setEmail(e.target.value);
                  if (errors.email) {
                    setErrors(prev => ({ ...prev, email: '' }));
                  }
                }}
                className={`mt-1 appearance-none relative block w-full px-3 py-2 border ${
                  errors.email ? 'border-red-300' : 'border-gray-300'
                } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm transition-colors`}
                placeholder="Enter your email"
                disabled={isLoading}
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600" role="alert">
                  {errors.email}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={e => {
                  setPassword(e.target.value);
                  if (errors.password) {
                    setErrors(prev => ({ ...prev, password: '' }));
                  }
                }}
                className={`mt-1 appearance-none relative block w-full px-3 py-2 border ${
                  errors.password ? 'border-red-300' : 'border-gray-300'
                } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm transition-colors`}
                placeholder="Enter your password"
                disabled={isLoading}
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-600" role="alert">
                  {errors.password}
                </p>
              )}
            </div>
          </div>

          {errors.general && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-red-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-800" role="alert" data-testid="general-error">
                    {errors.general}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Signing in...
                </>
              ) : (
                'Sign in with Password'
              )}
            </button>

            {/* Passkey Login Button */}
            {isPasskeySupported() && (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-gray-50 text-gray-500">Or</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handlePasskeyLogin}
                  disabled={isLoading}
                  className="group relative w-full flex justify-center py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <svg
                    className="w-5 h-5 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                  Sign in with Passkey
                </button>
              </>
            )}
          </div>

          <div className="text-center">
            <Link
              to="/forgot-password"
              className="text-sm text-indigo-600 hover:text-indigo-500 transition-colors"
            >
              Forgot your password?
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
