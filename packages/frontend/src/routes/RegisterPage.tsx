import { Navigate } from 'react-router-dom';
import { RegisterForm } from '../components/auth/RegisterForm.tsx';
import { useAuth } from '../contexts/AuthContext.tsx';

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
