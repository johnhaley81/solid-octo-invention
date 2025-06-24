import { gql } from '@apollo/client';

/**
 * GraphQL queries for the application
 * These queries are automatically generated from the PostGraphile schema
 */

/**
 * Get user profile information by nodeId
 */
export const GET_USER = gql`
  query GetUser($nodeId: ID!) {
    user(nodeId: $nodeId) {
      id
      nodeId
      name
      email
      avatarUrl
      authMethod
      createdAt
      updatedAt
    }
  }
`;

/**
 * Get user profile information by email
 */
export const GET_USER_BY_EMAIL = gql`
  query GetUserByEmail($email: String!) {
    userByEmail(email: $email) {
      id
      nodeId
      name
      email
      avatarUrl
      authMethod
      createdAt
      updatedAt
    }
  }
`;

/**
 * Get user profile information by UUID
 */
export const GET_USER_BY_ID = gql`
  query GetUserById($id: UUID!) {
    userById(id: $id) {
      id
      nodeId
      name
      email
      avatarUrl
      authMethod
      createdAt
      updatedAt
    }
  }
`;

/**
 * Authentication mutations
 */

/**
 * Register a new user with password
 */
export const REGISTER_USER_WITH_PASSWORD = gql`
  mutation RegisterUserWithPassword($email: String!, $name: String!, $password: String!) {
    registerUserWithPassword(input: { email: $email, name: $name, password: $password }) {
      user {
        id
        nodeId
        email
        name
        authMethod
        createdAt
      }
    }
  }
`;

/**
 * Register a new user (without password - for WebAuthn)
 */
export const REGISTER_USER = gql`
  mutation RegisterUser($email: String!, $name: String!, $authMethod: AuthMethod!) {
    registerUser(input: { email: $email, name: $name, authMethod: $authMethod }) {
      user {
        id
        nodeId
        email
        name
        authMethod
        createdAt
      }
    }
  }
`;

/**
 * Update user profile
 */
export const UPDATE_USER_PROFILE = gql`
  mutation UpdateUserProfile($nodeId: ID!, $name: String, $avatarUrl: String) {
    updateUser(input: { nodeId: $nodeId, userPatch: { name: $name, avatarUrl: $avatarUrl } }) {
      user {
        id
        nodeId
        name
        email
        avatarUrl
        updatedAt
      }
    }
  }
`;

/**
 * Get all users (with pagination)
 */
export const GET_ALL_USERS = gql`
  query GetAllUsers($first: Int, $after: Cursor) {
    allUsers(first: $first, after: $after) {
      nodes {
        id
        nodeId
        name
        email
        avatarUrl
        authMethod
        createdAt
        updatedAt
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
 * Create a new user
 */
export const CREATE_USER = gql`
  mutation CreateUser($email: String!, $name: String!, $authMethod: AuthMethod!) {
    createUser(input: { user: { email: $email, name: $name, authMethod: $authMethod } }) {
      user {
        id
        nodeId
        email
        name
        authMethod
        createdAt
      }
    }
  }
`;

/**
 * Delete a user by nodeId
 */
export const DELETE_USER = gql`
  mutation DeleteUser($nodeId: ID!) {
    deleteUser(input: { nodeId: $nodeId }) {
      user {
        id
        nodeId
        name
        email
      }
    }
  }
`;

/**
 * Delete a user by email
 */
export const DELETE_USER_BY_EMAIL = gql`
  mutation DeleteUserByEmail($email: String!) {
    deleteUserByEmail(input: { email: $email }) {
      user {
        id
        nodeId
        name
        email
      }
    }
  }
`;

/**
 * Login with password
 */
export const LOGIN_WITH_PASSWORD = gql`
  mutation LoginWithPassword($email: String!, $password: String!) {
    loginWithPassword(input: { email: $email, password: $password }) {
      results {
        sessionToken
        userId
        expiresAt
      }
    }
  }
`;

/**
 * Get current user from session
 */
export const CURRENT_USER_FROM_SESSION = gql`
  mutation CurrentUserFromSession {
    currentUserFromSession(input: {}) {
      user {
        id
        nodeId
        name
        email
        avatarUrl
        authMethod
        createdAt
        updatedAt
      }
    }
  }
`;

/**
 * Placeholder queries for passkey authentication
 * These need to be implemented in the backend schema
 * For now, we'll create stub implementations to satisfy the existing components
 */

// TODO: Implement these mutations in the backend schema
// For now, these are commented out to avoid codegen errors

/*
export const LOGIN_WITH_PASSKEY = gql`
  mutation LoginWithPasskey($email: String!, $credential: String!) {
    loginWithPasskey(input: { email: $email, credential: $credential }) {
      results {
        sessionToken
        userId
        expiresAt
      }
    }
  }
`;

export const GET_PASSKEY_CHALLENGE = gql`
  query GetPasskeyChallenge($email: String!) {
    passkeyChallenge(email: $email) {
      challenge
      allowCredentials
    }
  }
`;
*/

// Temporary stub exports to satisfy existing imports
// These should be replaced with proper implementations
export const LOGIN_WITH_PASSKEY = null;
export const GET_PASSKEY_CHALLENGE = null;
