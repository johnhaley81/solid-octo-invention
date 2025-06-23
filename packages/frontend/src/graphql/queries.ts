import { gql } from '@apollo/client';

/**
 * GraphQL queries for the application
 * These queries are automatically generated from the PostGraphile schema
 */

/**
 * Get all posts with pagination and filtering
 */
export const GET_POSTS = gql`
  query GetPosts($first: Int, $after: Cursor, $condition: PostCondition) {
    posts(first: $first, after: $after, condition: $condition, orderBy: PUBLISHED_AT_DESC) {
      nodes {
        id
        title
        content
        slug
        status
        publishedAt
        createdAt
        updatedAt
        userByAuthorId {
          id
          name
          email
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      totalCount
    }
  }
`;

/**
 * Get a single post by slug with comments
 */
export const GET_POST_BY_SLUG = gql`
  query GetPostBySlug($slug: String!) {
    posts(condition: { slug: $slug }) {
      nodes {
        id
        title
        content
        slug
        status
        publishedAt
        createdAt
        updatedAt
        userByAuthorId {
          id
          name
          email
        }
        commentsByPostId(orderBy: CREATED_AT_ASC) {
          nodes {
            id
            content
            createdAt
            updatedAt
            userByAuthorId {
              id
              name
            }
            parentId
          }
        }
      }
    }
  }
`;

/**
 * Get user profile information
 */
export const GET_USER = gql`
  query GetUser($id: UUID!) {
    user(id: $id) {
      id
      name
      email
      avatarUrl
      createdAt
      updatedAt
    }
  }
`;

/**
 * Get comments for a specific post
 */
export const GET_COMMENTS = gql`
  query GetComments($postId: UUID!, $first: Int, $after: Cursor) {
    comments(
      condition: { postId: $postId }
      first: $first
      after: $after
      orderBy: CREATED_AT_ASC
    ) {
      nodes {
        id
        content
        createdAt
        updatedAt
        userByAuthorId {
          id
          name
        }
        parentId
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      totalCount
    }
  }
`;

/**
 * Authentication mutations
 */

/**
 * Register a new user
 */
export const REGISTER_USER = gql`
  mutation RegisterUser($email: String!, $name: String!, $password: String!) {
    registerUser(input: { email: $email, name: $name, password: $password }) {
      id
      email
      name
      authMethod
      createdAt
    }
  }
`;

/**
 * Login with email and password
 */
export const LOGIN_WITH_PASSWORD = gql`
  mutation LoginWithPassword($email: String!, $password: String!) {
    loginWithPassword(input: { email: $email, password: $password }) {
      userId
      sessionToken
      expiresAt
    }
  }
`;

/**
 * Get current user from session token
 */
export const CURRENT_USER_FROM_SESSION = gql`
  mutation CurrentUserFromSession($sessionToken: String!) {
    currentUserFromSession(input: { sessionToken: $sessionToken }) {
      id
      email
      name
      authMethod
      createdAt
    }
  }
`;

/**
 * Logout user
 */
export const LOGOUT = gql`
  mutation Logout($sessionToken: String!) {
    logout(input: { sessionToken: $sessionToken }) {
      success
    }
  }
`;

/**
 * Verify email with token
 */
export const VERIFY_EMAIL = gql`
  mutation VerifyEmail($token: String!) {
    verifyEmail(input: { token: $token }) {
      success
    }
  }
`;
