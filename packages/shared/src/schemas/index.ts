import { Schema as S } from '@effect/schema';

/**
 * Branded types for domain identifiers
 */
export const UserId = S.String.pipe(S.brand('UserId'));
export type UserId = S.Schema.Type<typeof UserId>;

export const PostId = S.String.pipe(S.brand('PostId'));
export type PostId = S.Schema.Type<typeof PostId>;

export const CommentId = S.String.pipe(S.brand('CommentId'));
export type CommentId = S.Schema.Type<typeof CommentId>;

/**
 * Post status with impossible states prevention
 */
export const PostStatus = S.Literal('draft', 'published', 'archived');
export type PostStatus = S.Schema.Type<typeof PostStatus>;

/**
 * User schema
 */
export const User = S.Struct({
  id: UserId,
  email: S.String.pipe(S.minLength(1), S.maxLength(255)),
  name: S.String.pipe(S.minLength(1), S.maxLength(100)),
  avatarUrl: S.optional(S.String),
  createdAt: S.Date,
  updatedAt: S.Date,
});
export type User = S.Schema.Type<typeof User>;

/**
 * Post schema with discriminated union for status
 */
export const BasePost = S.Struct({
  id: PostId,
  title: S.String.pipe(S.minLength(1), S.maxLength(200)),
  content: S.String.pipe(S.minLength(1)),
  slug: S.String.pipe(S.minLength(1), S.maxLength(100)),
  authorId: UserId,
  createdAt: S.Date,
  updatedAt: S.Date,
});

export const DraftPost = BasePost.pipe(
  S.extend(
    S.Struct({
      status: S.Literal('draft'),
      publishedAt: S.Literal(null),
    }),
  ),
);

export const PublishedPost = BasePost.pipe(
  S.extend(
    S.Struct({
      status: S.Literal('published'),
      publishedAt: S.Date,
    }),
  ),
);

export const ArchivedPost = BasePost.pipe(
  S.extend(
    S.Struct({
      status: S.Literal('archived'),
      publishedAt: S.Date,
    }),
  ),
);

export const Post = S.Union(DraftPost, PublishedPost, ArchivedPost);
export type Post = S.Schema.Type<typeof Post>;
export type DraftPost = S.Schema.Type<typeof DraftPost>;
export type PublishedPost = S.Schema.Type<typeof PublishedPost>;
export type ArchivedPost = S.Schema.Type<typeof ArchivedPost>;

/**
 * Comment schema
 */
export const Comment = S.Struct({
  id: CommentId,
  content: S.String.pipe(S.minLength(1), S.maxLength(1000)),
  postId: PostId,
  authorId: UserId,
  parentId: S.optional(CommentId),
  createdAt: S.Date,
  updatedAt: S.Date,
});
export type Comment = S.Schema.Type<typeof Comment>;

/**
 * Input schemas for operations
 */
export const CreateUserInput = S.Struct({
  email: S.String.pipe(S.minLength(1), S.maxLength(255)),
  name: S.String.pipe(S.minLength(1), S.maxLength(100)),
  avatarUrl: S.optional(S.String),
});
export type CreateUserInput = S.Schema.Type<typeof CreateUserInput>;

export const CreatePostInput = S.Struct({
  title: S.String.pipe(S.minLength(1), S.maxLength(200)),
  content: S.String.pipe(S.minLength(1)),
  slug: S.String.pipe(S.minLength(1), S.maxLength(100)),
  authorId: UserId,
});
export type CreatePostInput = S.Schema.Type<typeof CreatePostInput>;

export const UpdatePostInput = S.Struct({
  title: S.optional(S.String.pipe(S.minLength(1), S.maxLength(200))),
  content: S.optional(S.String.pipe(S.minLength(1))),
  slug: S.optional(S.String.pipe(S.minLength(1), S.maxLength(100))),
});
export type UpdatePostInput = S.Schema.Type<typeof UpdatePostInput>;

export const CreateCommentInput = S.Struct({
  content: S.String.pipe(S.minLength(1), S.maxLength(1000)),
  postId: PostId,
  authorId: UserId,
  parentId: S.optional(CommentId),
});
export type CreateCommentInput = S.Schema.Type<typeof CreateCommentInput>;

/**
 * Pagination schemas
 */
export const PaginationInput = S.Struct({
  limit: S.Number.pipe(S.int(), S.greaterThan(0), S.lessThanOrEqualTo(100)),
  offset: S.Number.pipe(S.int(), S.greaterThanOrEqualTo(0)),
});
export type PaginationInput = S.Schema.Type<typeof PaginationInput>;

export const PaginatedResult = <T>(itemSchema: S.Schema<T>) =>
  S.Struct({
    items: S.Array(itemSchema),
    totalCount: S.Number.pipe(S.int(), S.greaterThanOrEqualTo(0)),
    hasNextPage: S.Boolean,
    hasPreviousPage: S.Boolean,
  });

export type PaginatedResult<T> = {
  items: T[];
  totalCount: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

/**
 * Utility functions for schema operations
 */
export const SchemaUtils = {
  /**
   * Create a new user ID
   */
  createUserId: (id: string): UserId => S.decodeSync(UserId)(id),

  /**
   * Create a new post ID
   */
  createPostId: (id: string): PostId => S.decodeSync(PostId)(id),

  /**
   * Create a new comment ID
   */
  createCommentId: (id: string): CommentId => S.decodeSync(CommentId)(id),

  /**
   * Check if a post is published
   */
  isPublishedPost: (post: Post): post is PublishedPost => post.status === 'published',

  /**
   * Check if a post is draft
   */
  isDraftPost: (post: Post): post is DraftPost => post.status === 'draft',

  /**
   * Check if a post is archived
   */
  isArchivedPost: (post: Post): post is ArchivedPost => post.status === 'archived',
};
