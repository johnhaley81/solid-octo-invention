import React from 'react'
import { Link } from 'react-router-dom'

/**
 * Home page component
 * Displays welcome message and key features of the application
 */
export function HomePage() {
  return (
    <div className="home-page">
      <section className="hero">
        <h1 className="hero-title">Welcome to Solid Octo Invention</h1>
        <p className="hero-subtitle">
          A modern full-stack application built with functional programming principles
        </p>
        <div className="hero-actions">
          <Link to="/posts" className="btn btn-primary">
            View Posts
          </Link>
        </div>
      </section>
      
      <section className="features">
        <h2>Built with Modern Technologies</h2>
        <div className="features-grid">
          <div className="feature-card">
            <h3>🏗️ Graphile Stack</h3>
            <p>
              PostGraphile for automatic GraphQL API generation, 
              Graphile Worker for background jobs, and Graphile Migrate 
              for database schema management.
            </p>
          </div>
          
          <div className="feature-card">
            <h3>⚛️ React & Apollo</h3>
            <p>
              Modern React with hooks and concurrent features, 
              Apollo Client for GraphQL data fetching with intelligent caching.
            </p>
          </div>
          
          <div className="feature-card">
            <h3>🔧 Effect-TS</h3>
            <p>
              Functional programming with Effect-TS for type-safe 
              side effects, error handling, and composable business logic.
            </p>
          </div>
          
          <div className="feature-card">
            <h3>🎯 Domain-Driven</h3>
            <p>
              Clean architecture with domain-driven design principles, 
              making impossible states impossible with TypeScript.
            </p>
          </div>
        </div>
      </section>
      
      <section className="architecture">
        <h2>Architecture Principles</h2>
        <ul className="principles-list">
          <li>✅ Pure functional programming with immutable data</li>
          <li>✅ Domain-driven development with clear boundaries</li>
          <li>✅ Type safety from database to UI</li>
          <li>✅ Comprehensive error handling and logging</li>
          <li>✅ Testable and maintainable code structure</li>
        </ul>
      </section>
    </div>
  )
}

