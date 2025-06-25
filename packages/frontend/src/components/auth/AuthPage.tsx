import React, { useState } from 'react';
import { useMutation, useLazyQuery } from '@apollo/client';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  LOGIN_WITH_PASSWORD,
  REGISTER_USER_WITH_PASSWORD,
  CURRENT_USER_FROM_SESSION,
} from '../../graphql/queries.js';
import { useAuth } from '../../contexts/AuthContext.js';
import { validateLoginForm, validateRegistrationForm } from '../../utils/validation.ts';

/**
 * Combined authentication page with sign up and login forms
 * Matches the provided design mockup with gradient background and split layout
 */
export function AuthPage() {
  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginErrors, setLoginErrors] = useState<{
    email?: string;
    password?: string;
    general?: string;
  }>({});
  const [isLoginLoading, setIsLoginLoading] = useState(false);

  // Registration form state
  const [registerData, setRegisterData] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [registerErrors, setRegisterErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    general?: string;
  }>({});
  const [isRegisterLoading, setIsRegisterLoading] = useState(false);
  const [isRegisterSuccess, setIsRegisterSuccess] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  // GraphQL mutations and queries
  const [loginWithPassword] = useMutation(LOGIN_WITH_PASSWORD);
  const [registerUser] = useMutation(REGISTER_USER_WITH_PASSWORD);
  const [getCurrentUser] = useLazyQuery(CURRENT_USER_FROM_SESSION);

  // Get the intended destination or default to home
  const from = (location.state as any)?.from?.pathname || '/';

  /**
   * Handle login form submission
   */
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = validateLoginForm(loginEmail, loginPassword);
    setLoginErrors(validation.errors);

    if (!validation.isValid) {
      return;
    }

    setIsLoginLoading(true);

    try {
      const result = await loginWithPassword({
        variables: { email: loginEmail.trim(), password: loginPassword },
        errorPolicy: 'all',
      });

      if (result.errors && result.errors.length > 0) {
        const errorMessage = result.errors[0]?.message || 'Login failed';
        if (errorMessage.toLowerCase().includes('verify')) {
          setLoginErrors({ general: 'Please verify your email address before logging in' });
        } else if (errorMessage.toLowerCase().includes('invalid')) {
          setLoginErrors({ general: 'Invalid email or password' });
        } else {
          setLoginErrors({ general: errorMessage });
        }
        return;
      }

      const loginData = result.data;

      if (loginData?.loginWithPassword?.results) {
        const { sessionToken } = loginData.loginWithPassword.results;

        const { data: userData } = await getCurrentUser({
          variables: { sessionToken },
        });

        if (userData?.currentUserFromSession) {
          login(userData.currentUserFromSession, sessionToken);
          navigate(from, { replace: true });
        } else {
          setLoginErrors({ general: 'Failed to retrieve user information' });
        }
      } else {
        setLoginErrors({ general: 'Login failed - no response data' });
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Login failed';
      if (errorMessage.toLowerCase().includes('verify')) {
        setLoginErrors({ general: 'Please verify your email address before logging in' });
      } else if (errorMessage.toLowerCase().includes('invalid')) {
        setLoginErrors({ general: 'Invalid email or password' });
      } else {
        setLoginErrors({ general: errorMessage });
      }
    } finally {
      setIsLoginLoading(false);
    }
  };

  /**
   * Handle registration form submission
   */
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = validateRegistrationForm(
      registerData.email,
      registerData.name,
      registerData.password,
      registerData.password, // Using same password for confirmation
    );
    setRegisterErrors(validation.errors);

    if (!validation.isValid) {
      return;
    }

    setIsRegisterLoading(true);
    setRegisterErrors({});

    try {
      const { data } = await registerUser({
        variables: {
          email: registerData.email.trim(),
          name: registerData.name.trim(),
          password: registerData.password,
        },
      });

      if (data?.registerUserWithPassword?.user) {
        setIsRegisterSuccess(true);
        // Reset form
        setRegisterData({ name: '', email: '', password: '' });
        // Show success message for a few seconds
        setTimeout(() => {
          setIsRegisterSuccess(false);
        }, 3000);
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Registration failed';
      if (
        errorMessage.toLowerCase().includes('email') &&
        errorMessage.toLowerCase().includes('exists')
      ) {
        setRegisterErrors({ email: 'An account with this email already exists' });
      } else {
        setRegisterErrors({ general: errorMessage });
      }
    } finally {
      setIsRegisterLoading(false);
    }
  };

  /**
   * Handle registration form input changes
   */
  const handleRegisterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setRegisterData(prev => ({ ...prev, [name]: value }));

    // Clear error for this field when user starts typing
    if (registerErrors[name as keyof typeof registerErrors]) {
      setRegisterErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-purple-400 via-purple-500 to-blue-500">
      {/* Sign Up Section */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 shadow-xl">
            <h2 className="text-3xl font-bold text-white mb-8 text-center">Sign up</h2>

            {isRegisterSuccess ? (
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                  <svg
                    className="h-6 w-6 text-green-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="1.5"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <p className="text-white text-sm">
                  Registration successful! Please check your email to verify your account.
                </p>
              </div>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div>
                  <input
                    id="register-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    value={registerData.name}
                    onChange={handleRegisterChange}
                    className="w-full px-4 py-3 rounded-lg bg-white/20 backdrop-blur-sm border border-white/30 text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent"
                    placeholder="Name"
                    disabled={isRegisterLoading}
                  />
                  {registerErrors.name && (
                    <p className="mt-1 text-sm text-red-200" role="alert">
                      {registerErrors.name}
                    </p>
                  )}
                </div>

                <div>
                  <input
                    id="register-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={registerData.email}
                    onChange={handleRegisterChange}
                    className="w-full px-4 py-3 rounded-lg bg-white/20 backdrop-blur-sm border border-white/30 text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent"
                    placeholder="Email"
                    disabled={isRegisterLoading}
                  />
                  {registerErrors.email && (
                    <p className="mt-1 text-sm text-red-200" role="alert">
                      {registerErrors.email}
                    </p>
                  )}
                </div>

                <div>
                  <input
                    id="register-password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    value={registerData.password}
                    onChange={handleRegisterChange}
                    className="w-full px-4 py-3 rounded-lg bg-white/20 backdrop-blur-sm border border-white/30 text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent"
                    placeholder="••••••"
                    disabled={isRegisterLoading}
                  />
                  {registerErrors.password && (
                    <p className="mt-1 text-sm text-red-200" role="alert">
                      {registerErrors.password}
                    </p>
                  )}
                </div>

                {registerErrors.general && (
                  <div className="rounded-lg bg-red-500/20 backdrop-blur-sm p-3">
                    <p className="text-sm text-red-200" role="alert">
                      {registerErrors.general}
                    </p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isRegisterLoading}
                  className="w-full py-3 px-4 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isRegisterLoading ? 'Creating account...' : 'Sign up'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Login Section */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl p-8 shadow-xl">
            <h2 className="text-3xl font-bold text-gray-900 mb-2 text-center">Log in</h2>
            <p className="text-gray-600 text-center mb-8">Already have an account?</p>

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={loginEmail}
                  onChange={e => {
                    setLoginEmail(e.target.value);
                    if (loginErrors.email) {
                      setLoginErrors(prev => ({ ...prev, email: '' }));
                    }
                  }}
                  className={`w-full px-4 py-3 rounded-lg border ${
                    loginErrors.email ? 'border-red-300' : 'border-gray-300'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                  placeholder="Email"
                  disabled={isLoginLoading}
                />
                {loginErrors.email && (
                  <p className="mt-1 text-sm text-red-600" role="alert">
                    {loginErrors.email}
                  </p>
                )}
              </div>

              <div>
                <input
                  id="login-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={loginPassword}
                  onChange={e => {
                    setLoginPassword(e.target.value);
                    if (loginErrors.password) {
                      setLoginErrors(prev => ({ ...prev, password: '' }));
                    }
                  }}
                  className={`w-full px-4 py-3 rounded-lg border ${
                    loginErrors.password ? 'border-red-300' : 'border-gray-300'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                  placeholder="Password"
                  disabled={isLoginLoading}
                />
                {loginErrors.password && (
                  <p className="mt-1 text-sm text-red-600" role="alert">
                    {loginErrors.password}
                  </p>
                )}
              </div>

              {loginErrors.general && (
                <div className="rounded-lg bg-red-50 p-3">
                  <p className="text-sm text-red-800" role="alert">
                    {loginErrors.general}
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoginLoading}
                className="w-full py-3 px-4 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoginLoading ? 'Signing in...' : 'Log in'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <Link
                to="/forgot-password"
                className="text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                Forgot your password?
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
