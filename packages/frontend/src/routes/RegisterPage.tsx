import { Navigate } from 'react-router-dom';
import { RegisterForm } from '../components/auth/RegisterForm.js';
import { useAuth } from '../contexts/AuthContext.js';

/**
 * Registration page component
 */
export function RegisterPage() {
  const { state } = useAuth();

  // Redirect if already authenticated
  if (state.isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <RegisterForm />;
}
