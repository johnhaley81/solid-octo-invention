import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout.js';
import { HomePage } from './routes/HomePage.js';
import { PostsPage } from './routes/PostsPage.js';
import { PostDetailPage } from './routes/PostDetailPage.js';
import { LoginPage } from './routes/LoginPage.js';
import { RegisterPage } from './routes/RegisterPage.js';
import { NotFoundPage } from './routes/NotFoundPage.js';
import { AuthProvider } from './contexts/AuthContext.js';
import { ProtectedRoute } from './components/auth/ProtectedRoute.js';

/**
 * Main application component with routing
 * Implements the core application structure with React Router and authentication
 */
export function App() {
  return (
    <AuthProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route 
            path="/posts" 
            element={
              <ProtectedRoute>
                <PostsPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/posts/:slug" 
            element={
              <ProtectedRoute>
                <PostDetailPage />
              </ProtectedRoute>
            } 
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Layout>
    </AuthProvider>
  );
}
