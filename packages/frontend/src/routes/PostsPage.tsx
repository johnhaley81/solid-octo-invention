import { useQuery } from '@apollo/client'
import { Link } from 'react-router-dom'
import { GET_POSTS } from '../graphql/queries.js'

/**
 * Posts listing page component
 * Displays a list of published posts with pagination
 */
export function PostsPage() {
  const { loading, error, data } = useQuery(GET_POSTS, {
    variables: {
      first: 10,
      condition: { status: 'published' },
    },
  })
  
  if (loading) {
    return (
      <div className="posts-page">
        <div className="loading">
          <p>Loading posts...</p>
        </div>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="posts-page">
        <div className="error">
          <h2>Error Loading Posts</h2>
          <p>{error.message}</p>
        </div>
      </div>
    )
  }
  
  const posts = data?.posts?.nodes || []
  
  return (
    <div className="posts-page">
      <header className="page-header">
        <h1>Blog Posts</h1>
        <p>Explore our latest articles and insights</p>
      </header>
      
      {posts.length === 0 ? (
        <div className="empty-state">
          <h2>No Posts Yet</h2>
          <p>Check back later for new content!</p>
        </div>
      ) : (
        <div className="posts-grid">
          {posts.map((post: any) => (
            <article key={post.id} className="post-card">
              <header className="post-card-header">
                <h2 className="post-title">
                  <Link to={`/posts/${post.slug}`}>
                    {post.title}
                  </Link>
                </h2>
                <div className="post-meta">
                  <span className="post-author">
                    By {post.userByAuthorId?.name || 'Unknown Author'}
                  </span>
                  <span className="post-date">
                    {new Date(post.publishedAt).toLocaleDateString()}
                  </span>
                </div>
              </header>
              
              <div className="post-excerpt">
                <p>
                  {post.content.length > 200 
                    ? `${post.content.substring(0, 200)}...`
                    : post.content
                  }
                </p>
              </div>
              
              <footer className="post-card-footer">
                <Link to={`/posts/${post.slug}`} className="read-more">
                  Read More →
                </Link>
              </footer>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

