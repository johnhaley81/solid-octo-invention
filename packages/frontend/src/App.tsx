import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout.js';
import { HomePage } from './routes/HomePage.js';
import { LoginPage } from './routes/LoginPage.js';
import { RegisterPage } from './routes/RegisterPage.js';
import { NotFoundPage } from './routes/NotFoundPage.js';
import { AuthProvider } from './contexts/AuthContext.js';
import { ProtectedRoute } from './components/auth/ProtectedRoute.js';

// Mock protected component for testing
function DashboardPage() {
  return (
    <div className="max-w-4xl mx-auto py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Dashboard</h1>
      <div className="bg-white rounded-lg shadow-md p-6">
        <p className="text-gray-600 mb-4">
          Welcome to your dashboard! This is a protected route that requires authentication.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-2">User Profile</h3>
            <p className="text-blue-700 text-sm">Manage your account settings and preferences.</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <h3 className="font-semibold text-green-900 mb-2">Activity</h3>
            <p className="text-green-700 text-sm">View your recent activity and usage statistics.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Main application component with routing
 * Implements the core application structure with React Router and authentication
 */
function App() {
  return (
    <AuthProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Layout>
    </AuthProvider>
  );
}

export default App;
