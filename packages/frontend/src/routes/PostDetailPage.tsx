import { useQuery } from '@apollo/client';
import { useParams, Link } from 'react-router-dom';
import { GET_POST_BY_SLUG } from '../graphql/queries.js';

/**
 * Post detail page component
 * Displays a single post with its content and comments
 */
export function PostDetailPage() {
  const { slug } = useParams<{ slug: string }>();

  const { loading, error, data } = useQuery(GET_POST_BY_SLUG, {
    variables: { slug },
    skip: !slug,
  });

  if (loading) {
    return (
      <div className="post-detail-page">
        <div className="loading">
          <p>Loading post...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="post-detail-page">
        <div className="error">
          <h2>Error Loading Post</h2>
          <p>{error.message}</p>
          <Link to="/posts" className="btn btn-secondary">
            ← Back to Posts
          </Link>
        </div>
      </div>
    );
  }

  const post = data?.posts?.nodes?.[0];

  if (!post) {
    return (
      <div className="post-detail-page">
        <div className="not-found">
          <h2>Post Not Found</h2>
          <p>The post you're looking for doesn't exist or has been removed.</p>
          <Link to="/posts" className="btn btn-secondary">
            ← Back to Posts
          </Link>
        </div>
      </div>
    );
  }

  const comments = post.commentsByPostId?.nodes || [];

  return (
    <div className="post-detail-page">
      <nav className="breadcrumb">
        <Link to="/posts">Posts</Link>
        <span className="breadcrumb-separator">→</span>
        <span className="breadcrumb-current">{post.title}</span>
      </nav>

      <article className="post-detail">
        <header className="post-header">
          <h1 className="post-title">{post.title}</h1>
          <div className="post-meta">
            <span className="post-author">By {post.userByAuthorId?.name || 'Unknown Author'}</span>
            <span className="post-date">
              Published on {new Date(post.publishedAt).toLocaleDateString()}
            </span>
            {post.updatedAt !== post.createdAt && (
              <span className="post-updated">
                Updated on {new Date(post.updatedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </header>

        <div className="post-content">
          <div className="prose">
            {post.content.split('\n').map((paragraph: string, index: number) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        </div>
      </article>

      <section className="comments-section">
        <header className="comments-header">
          <h2>Comments ({comments.length})</h2>
        </header>

        {comments.length === 0 ? (
          <div className="no-comments">
            <p>No comments yet. Be the first to share your thoughts!</p>
          </div>
        ) : (
          <div className="comments-list">
            {comments.map((comment: any) => (
              <div key={comment.id} className="comment">
                <div className="comment-header">
                  <span className="comment-author">
                    {comment.userByAuthorId?.name || 'Anonymous'}
                  </span>
                  <span className="comment-date">
                    {new Date(comment.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="comment-content">
                  <p>{comment.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
