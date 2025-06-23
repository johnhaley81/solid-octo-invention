import { gql } from '@apollo/client';

/**
 * GraphQL queries for the application
 * These queries are automatically generated from the PostGraphile schema
 */

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
 * Login with passkey (WebAuthn)
 */
export const LOGIN_WITH_PASSKEY = gql`
  mutation LoginWithPasskey($email: String!, $credential: String!) {
    loginWithPasskey(input: { email: $email, credential: $credential }) {
      userId
      sessionToken
      expiresAt
    }
  }
`;

/**
 * Register a new passkey for a user
 */
export const REGISTER_PASSKEY = gql`
  mutation RegisterPasskey($userId: String!, $credential: String!, $name: String) {
    registerPasskey(input: { userId: $userId, credential: $credential, name: $name }) {
      id
      name
      createdAt
    }
  }
`;

/**
 * Get passkey challenge for authentication
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
 * Logout current user
 */
export const LOGOUT = gql`
  mutation Logout {
    logout {
      success
    }
  }
`;

/**
 * Get current user session
 */
export const GET_CURRENT_USER = gql`
  query GetCurrentUser {
    currentUser {
      id
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
 * Update user profile
 */
export const UPDATE_USER_PROFILE = gql`
  mutation UpdateUserProfile($id: UUID!, $name: String, $avatarUrl: String) {
    updateUser(input: { id: $id, patch: { name: $name, avatarUrl: $avatarUrl } }) {
      user {
        id
        name
        email
        avatarUrl
        updatedAt
      }
    }
  }
`;

/**
 * Change user password
 */
export const CHANGE_PASSWORD = gql`
  mutation ChangePassword($currentPassword: String!, $newPassword: String!) {
    changePassword(input: { currentPassword: $currentPassword, newPassword: $newPassword }) {
      success
    }
  }
`;

/**
 * Request password reset
 */
export const REQUEST_PASSWORD_RESET = gql`
  mutation RequestPasswordReset($email: String!) {
    requestPasswordReset(input: { email: $email }) {
      success
    }
  }
`;

/**
 * Reset password with token
 */
export const RESET_PASSWORD = gql`
  mutation ResetPassword($token: String!, $newPassword: String!) {
    resetPassword(input: { token: $token, newPassword: $newPassword }) {
      success
    }
  }
`;

/**
 * Verify email address
 */
export const VERIFY_EMAIL = gql`
  mutation VerifyEmail($token: String!) {
    verifyEmail(input: { token: $token }) {
      success
    }
  }
`;

/**
 * Resend email verification
 */
export const RESEND_EMAIL_VERIFICATION = gql`
  mutation ResendEmailVerification {
    resendEmailVerification {
      success
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
