import { Link } from 'react-router-dom'

/**
 * Home page component
 * Displays welcome message and key features of the application
 */
export function HomePage() {
  return (
    <div className="space-y-12">
      <section className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Welcome to Solid Octo Invention
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          A modern full-stack application built with functional programming principles
        </p>
        <div>
          <Link 
            to="/posts" 
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors inline-block"
          >
            View Posts
          </Link>
        </div>
      </section>
      
      <section>
        <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
          Built with Modern Technologies
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-md border">
            <h3 className="text-xl font-semibold text-gray-900 mb-3">🏗️ Graphile Stack</h3>
            <p className="text-gray-600">
              PostGraphile for automatic GraphQL API generation, 
              Graphile Worker for background jobs, and Graphile Migrate 
              for database schema management.
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md border">
            <h3 className="text-xl font-semibold text-gray-900 mb-3">⚛️ React & Apollo</h3>
            <p className="text-gray-600">
              Modern React with hooks and concurrent features, 
              Apollo Client for GraphQL data fetching with intelligent caching.
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md border">
            <h3 className="text-xl font-semibold text-gray-900 mb-3">🔧 Effect-TS</h3>
            <p className="text-gray-600">
              Functional programming with Effect-TS for type-safe 
              side effects, error handling, and composable business logic.
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md border">
            <h3 className="text-xl font-semibold text-gray-900 mb-3">🎯 Domain-Driven</h3>
            <p className="text-gray-600">
              Clean architecture with domain-driven design principles, 
              making impossible states impossible with TypeScript.
            </p>
          </div>
        </div>
      </section>
      
      <section className="bg-white p-8 rounded-lg shadow-md border">
        <h2 className="text-3xl font-bold text-gray-900 mb-6 text-center">
          Architecture Principles
        </h2>
        <ul className="space-y-3 max-w-2xl mx-auto">
          <li className="flex items-center text-gray-700">
            <span className="text-green-500 mr-3">✅</span>
            Pure functional programming with immutable data
          </li>
          <li className="flex items-center text-gray-700">
            <span className="text-green-500 mr-3">✅</span>
            Domain-driven development with clear boundaries
          </li>
          <li className="flex items-center text-gray-700">
            <span className="text-green-500 mr-3">✅</span>
            Type safety from database to UI
          </li>
          <li className="flex items-center text-gray-700">
            <span className="text-green-500 mr-3">✅</span>
            Comprehensive error handling and logging
          </li>
          <li className="flex items-center text-gray-700">
            <span className="text-green-500 mr-3">✅</span>
            Testable and maintainable code structure
          </li>
        </ul>
      </section>
    </div>
  );
}
