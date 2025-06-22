import { Link } from 'react-router-dom'

/**
 * 404 Not Found page component
 * Displayed when users navigate to non-existent routes
 */
export function NotFoundPage() {
  return (
    <div className="min-h-96 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-9xl font-bold text-gray-300 mb-4">404</h1>
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Page Not Found</h2>
        <p className="text-lg text-gray-600 mb-8 max-w-md mx-auto">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="space-x-4">
          <Link 
            to="/" 
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors inline-block"
          >
            Go Home
          </Link>
          <Link 
            to="/posts" 
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-6 rounded-lg transition-colors inline-block"
          >
            View Posts
          </Link>
        </div>
      </div>
    </div>
  );
}
