import { gql } from '@apollo/client';

/**
 * User registration mutation
 */
export const REGISTER_USER = gql`
  mutation RegisterUser($email: String!, $name: String!, $password: String!) {
    registerUser(input: { email: $email, name: $name, password: $password }) {
      id
      email
      name
      isVerified
      createdAt
    }
  }
`;

/**
 * User login with password mutation
 */
export const LOGIN_WITH_PASSWORD = gql`
  mutation LoginWithPassword($email: String!, $password: String!) {
    loginWithPassword(input: { email: $email, password: $password }) {
      token
      user {
        id
        email
        name
        isVerified
        createdAt
      }
    }
  }
`;

/**
 * User login with passkey mutation
 */
export const LOGIN_WITH_PASSKEY = gql`
  mutation LoginWithPasskey($email: String!, $credential: String!) {
    loginWithPasskey(email: $email, credential: $credential) {
      token
      user {
        id
        email
        name
        isVerified
        createdAt
      }
    }
  }
`;

/**
 * Get passkey challenge query
 */
export const GET_PASSKEY_CHALLENGE = gql`
  query GetPasskeyChallenge($email: String!) {
    getPasskeyChallenge(email: $email) {
      challenge
      allowCredentials {
        id
        type
        transports
      }
    }
  }
`;

/**
 * Get current user from session query
 */
export const CURRENT_USER_FROM_SESSION = gql`
  query CurrentUserFromSession {
    currentUserFromSession {
      id
      email
      name
      isVerified
      createdAt
    }
  }
`;

/**
 * Get current user query
 */
export const GET_CURRENT_USER = gql`
  query GetCurrentUser {
    currentUser {
      id
      email
      name
      isVerified
      createdAt
    }
  }
`;

/**
 * Verify email mutation
 */
export const VERIFY_EMAIL = gql`
  mutation VerifyEmail($token: String!) {
    verifyEmail(input: { token: $token }) {
      success
      message
    }
  }
`;

/**
 * Request password reset mutation
 */
export const REQUEST_PASSWORD_RESET = gql`
  mutation RequestPasswordReset($email: String!) {
    requestPasswordReset(email: $email) {
      success
      message
    }
  }
`;

/**
 * Reset password mutation
 */
export const RESET_PASSWORD = gql`
  mutation ResetPassword($token: String!, $password: String!) {
    resetPassword(token: $token, password: $password) {
      success
      message
    }
  }
`;

/**
 * Get posts query
 */
export const GET_POSTS = gql`
  query GetPosts($first: Int, $condition: PostCondition) {
    posts(first: $first, condition: $condition) {
      nodes {
        id
        title
        slug
        content
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
 * Get post by slug query
 */
export const GET_POST_BY_SLUG = gql`
  query GetPostBySlug($slug: String!) {
    postBySlug(slug: $slug) {
      id
      title
      slug
      content
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
  }
`;
