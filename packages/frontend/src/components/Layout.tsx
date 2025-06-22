import { Link, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

/**
 * Main layout component with navigation
 * Provides consistent structure across all pages
 */
export function Layout({ children }: LayoutProps) {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path
      ? 'text-blue-600 font-semibold border-b-2 border-blue-600'
      : 'text-gray-600 hover:text-blue-600 transition-colors';
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex-shrink-0">
              <Link
                to="/"
                className="text-xl font-bold text-gray-900 hover:text-blue-600 transition-colors"
              >
                Solid Octo Invention
              </Link>
            </div>
            <ul className="flex space-x-8">
              <li>
                <Link to="/" className={`py-2 px-1 ${isActive('/')}`}>
                  Home
                </Link>
              </li>
              <li>
                <Link to="/posts" className={`py-2 px-1 ${isActive('/posts')}`}>
                  Posts
                </Link>
              </li>
            </ul>
          </div>
        </nav>
      </header>

      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</div>
      </main>

      <footer className="bg-white border-t">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-gray-600">
            &copy; 2024 Solid Octo Invention. Built with Graphile, React, and Effect-TS.
          </p>
        </div>
      </footer>
    </div>
  );
}
