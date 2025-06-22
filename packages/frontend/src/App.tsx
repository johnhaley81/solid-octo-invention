import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout.js';
import { HomePage } from './routes/HomePage.js';
import { PostsPage } from './routes/PostsPage.js';
import { PostDetailPage } from './routes/PostDetailPage.js';
import { NotFoundPage } from './routes/NotFoundPage.js';

/**
 * Main application component with routing
 * Implements the core application structure with React Router
 */
export function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/posts" element={<PostsPage />} />
        <Route path="/posts/:slug" element={<PostDetailPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Layout>
  );
}
