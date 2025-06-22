import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { Layout } from './Layout'

// Mock React Testing Library setup
const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>)
}

describe('Layout', () => {
  it('should render navigation', () => {
    renderWithRouter(
      <Layout>
        <div>Test Content</div>
      </Layout>,
    )

    expect(screen.getByText('Solid Octo Invention')).toBeInTheDocument()
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('Posts')).toBeInTheDocument()
  })

  it('should render children content', () => {
    renderWithRouter(
      <Layout>
        <div>Test Content</div>
      </Layout>,
    )

    expect(screen.getByText('Test Content')).toBeInTheDocument()
  })
})

