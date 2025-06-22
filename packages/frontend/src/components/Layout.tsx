import React from 'react'
import { Link, useLocation } from 'react-router-dom'

interface LayoutProps {
  children: React.ReactNode
}

/**
 * Main layout component with navigation
 * Provides consistent structure across all pages
 */
export function Layout({ children }: LayoutProps) {
  const location = useLocation()
  
  const isActive = (path: string) => {
    return location.pathname === path ? 'nav-link active' : 'nav-link'
  }
  
  return (
    <div className="app">
      <header className="header">
        <nav className="nav">
          <div className="nav-brand">
            <Link to="/" className="brand-link">
              Solid Octo Invention
            </Link>
          </div>
          <ul className="nav-menu">
            <li className="nav-item">
              <Link to="/" className={isActive('/')}>
                Home
              </Link>
            </li>
            <li className="nav-item">
              <Link to="/posts" className={isActive('/posts')}>
                Posts
              </Link>
            </li>
          </ul>
        </nav>
      </header>
      
      <main className="main">
        <div className="container">
          {children}
        </div>
      </main>
      
      <footer className="footer">
        <div className="container">
          <p>&copy; 2024 Solid Octo Invention. Built with Graphile, React, and Effect-TS.</p>
        </div>
      </footer>
    </div>
  )
}

