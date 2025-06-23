import { useLocation, Navigate } from 'react-router-dom';
import { LoginForm } from '../components/auth/LoginForm.js';
import { useAuth } from '../contexts/AuthContext.js';

/**
 * Login page component
 */
export function LoginPage() {
  const { state } = useAuth();
  const location = useLocation();

  // Show success message if coming from registration
  const message = (location.state as any)?.message;

  // Redirect if already authenticated
  if (state.isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <>
      {message && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-4 mx-4 mt-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-green-400"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.236 4.53L7.53 10.23a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-green-800">{message}</p>
            </div>
          </div>
        </div>
      )}
      <LoginForm />
    </>
  );
}
