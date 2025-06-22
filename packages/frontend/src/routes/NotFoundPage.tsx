import { Link } from 'react-router-dom'

/**
 * 404 Not Found page component
 * Displayed when users navigate to non-existent routes
 */
export function NotFoundPage() {
  return (
    <div className="not-found-page">
      <div className="not-found-content">
        <h1 className="not-found-title">404</h1>
        <h2 className="not-found-subtitle">Page Not Found</h2>
        <p className="not-found-description">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="not-found-actions">
          <Link to="/" className="btn btn-primary">
            Go Home
          </Link>
          <Link to="/posts" className="btn btn-secondary">
            View Posts
          </Link>
        </div>
      </div>
    </div>
  )
}

