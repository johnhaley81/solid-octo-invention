# 📚 API Documentation

This document provides detailed information about all API endpoints available in the Authentication System.

## 🔗 Base URL

```
http://localhost:3000/api
```

## 🔐 Authentication

Most endpoints require authentication via session cookies. The session is established after successful login and is automatically included in subsequent requests.

### Session Headers
```http
Cookie: auth_session=<session-id>
```

## 📋 Response Format

All API responses follow a consistent format:

### Success Response
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { /* response data */ }
}
```

### Error Response
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": [ /* validation errors if applicable */ ]
}
```

## 🔑 Authentication Endpoints

### Register with Email/Password

Create a new user account with email/password authentication.

```http
POST /auth/register
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Password Requirements:**
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter  
- At least one number
- At least one special character

**Response:**
```json
{
  "success": true,
  "message": "Registration successful. Please check your email for verification.",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "authMethod": "password"
    },
    "requiresEmailVerification": true
  }
}
```

**Rate Limit:** 10 requests per 15 minutes per IP

---

### Login with Email/Password

Authenticate user with email/password. OTP is required for login.

```http
POST /auth/login
```

**Request Body (First Call):**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response (OTP Required):**
```json
{
  "success": true,
  "requiresOTP": true,
  "message": "OTP sent to your email"
}
```

**Request Body (With OTP):**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "otp": "123456"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "authMethod": "password"
  }
}
```

**Rate Limit:** 10 requests per 15 minutes per IP

---

### Verify Email

Verify user's email address using token from email.

```http
POST /auth/verify-email
```

**Request Body:**
```json
{
  "token": "email-verification-token"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Email verified successfully"
}
```

**Rate Limit:** 5 requests per hour per IP

---

### Resend Email Verification

Resend email verification for unverified accounts.

```http
POST /auth/resend-verification
```

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Verification email sent"
}
```

**Rate Limit:** 5 requests per hour per IP

---

### Request Password Reset

Initiate password reset process.

```http
POST /auth/password-reset/request
```

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "If an account with this email exists, a password reset link has been sent."
}
```

**Rate Limit:** 3 requests per hour per IP

---

### Complete Password Reset

Complete password reset using token from email.

```http
POST /auth/password-reset/complete
```

**Request Body:**
```json
{
  "token": "password-reset-token",
  "password": "NewSecurePass123!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

**Rate Limit:** 10 requests per 15 minutes per IP

---

## 🚀 WebAuthn Endpoints

### Begin WebAuthn Registration

Start WebAuthn credential registration process.

```http
POST /auth/webauthn/register/begin
```

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  },
  "options": {
    "challenge": "base64url-challenge",
    "rp": {
      "name": "Authentication System",
      "id": "localhost"
    },
    "user": {
      "id": "base64url-user-id",
      "name": "user@example.com",
      "displayName": "user@example.com"
    },
    "pubKeyCredParams": [
      { "alg": -7, "type": "public-key" },
      { "alg": -257, "type": "public-key" }
    ],
    "authenticatorSelection": {
      "authenticatorAttachment": "platform",
      "userVerification": "preferred",
      "residentKey": "preferred"
    },
    "timeout": 60000,
    "attestation": "none"
  }
}
```

**Rate Limit:** 20 requests per 15 minutes per IP

---

### Complete WebAuthn Registration

Complete WebAuthn credential registration.

```http
POST /auth/webauthn/register/complete
```

**Request Body:**
```json
{
  "userId": "user-uuid",
  "registrationResponse": {
    "id": "credential-id",
    "rawId": "base64url-raw-id",
    "response": {
      "clientDataJSON": "base64url-client-data",
      "attestationObject": "base64url-attestation-object",
      "transports": ["internal"]
    },
    "type": "public-key"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "WebAuthn registration successful",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "authMethod": "webauthn"
  }
}
```

**Rate Limit:** 20 requests per 15 minutes per IP

---

### Begin WebAuthn Authentication

Start WebAuthn authentication process.

```http
POST /auth/webauthn/authenticate/begin
```

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  },
  "options": {
    "challenge": "base64url-challenge",
    "timeout": 60000,
    "rpId": "localhost",
    "allowCredentials": [
      {
        "id": "base64url-credential-id",
        "type": "public-key",
        "transports": ["internal"]
      }
    ],
    "userVerification": "preferred"
  }
}
```

**Rate Limit:** 20 requests per 15 minutes per IP

---

### Complete WebAuthn Authentication

Complete WebAuthn authentication.

```http
POST /auth/webauthn/authenticate/complete
```

**Request Body:**
```json
{
  "userId": "user-uuid",
  "authenticationResponse": {
    "id": "credential-id",
    "rawId": "base64url-raw-id",
    "response": {
      "clientDataJSON": "base64url-client-data",
      "authenticatorData": "base64url-authenticator-data",
      "signature": "base64url-signature",
      "userHandle": null
    },
    "type": "public-key"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "WebAuthn authentication successful",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "authMethod": "webauthn"
  }
}
```

**Rate Limit:** 20 requests per 15 minutes per IP

---

### Logout

End user session.

```http
POST /auth/logout
```

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "message": "Logout successful"
}
```

---

### Get Current User

Get current authenticated user information.

```http
GET /auth/me
```

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "authMethod": "password",
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "passwordAuth": {
      "emailVerified": true,
      "isLocked": false,
      "failedAttempts": 0
    },
    "session": {
      "loginTime": "2024-01-01T12:00:00.000Z",
      "authMethod": "password"
    }
  }
}
```

---

## 👤 User Management Endpoints

### Change Password

Change password for password-authenticated users.

```http
POST /user/change-password
```

**Authentication:** Required (password method only)

**Request Body:**
```json
{
  "currentPassword": "CurrentPass123!",
  "newPassword": "NewSecurePass123!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

**Rate Limit:** 5 requests per hour per user

---

### Switch to WebAuthn

Switch from password to WebAuthn authentication.

```http
POST /user/switch-to-webauthn
```

**Authentication:** Required (password method only)

**Response:**
```json
{
  "success": true,
  "message": "Successfully switched to WebAuthn authentication",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "authMethod": "webauthn"
  }
}
```

**Rate Limit:** 5 requests per hour per user

---

### Switch to Password

Switch from WebAuthn to password authentication.

```http
POST /user/switch-to-password
```

**Authentication:** Required (webauthn method only)

**Request Body:**
```json
{
  "password": "NewSecurePass123!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully switched to password authentication",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "authMethod": "password"
    },
    "requiresEmailVerification": true
  }
}
```

**Rate Limit:** 5 requests per hour per user

---

### Get WebAuthn Credentials

Get user's WebAuthn credentials.

```http
GET /user/webauthn/credentials
```

**Authentication:** Required (webauthn method only)

**Response:**
```json
{
  "success": true,
  "data": {
    "credentials": [
      {
        "id": "uuid",
        "credentialId": "base64url-credential-id",
        "deviceType": "platform",
        "backupEligible": true,
        "backupState": false,
        "transports": ["internal"],
        "createdAt": "2024-01-01T00:00:00.000Z",
        "lastUsed": "2024-01-01T12:00:00.000Z"
      }
    ],
    "count": 1
  }
}
```

---

### Delete WebAuthn Credential

Delete a WebAuthn credential.

```http
DELETE /user/webauthn/credentials/:credentialId
```

**Authentication:** Required (webauthn method only)

**Response:**
```json
{
  "success": true,
  "message": "Credential deleted successfully"
}
```

**Rate Limit:** 5 requests per hour per user

---

### Add WebAuthn Credential

Add additional WebAuthn credential for existing WebAuthn users.

```http
POST /user/webauthn/add-credential/begin
```

**Authentication:** Required (webauthn method only)

**Response:**
```json
{
  "success": true,
  "options": {
    /* WebAuthn registration options */
  }
}
```

```http
POST /user/webauthn/add-credential/complete
```

**Authentication:** Required (webauthn method only)

**Request Body:**
```json
{
  "registrationResponse": {
    /* WebAuthn registration response */
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Additional WebAuthn credential added successfully",
  "credential": {
    "id": "uuid",
    "credentialId": "base64url-credential-id",
    "deviceType": "platform"
  }
}
```

---

### Get User Profile

Get detailed user profile information.

```http
GET /user/profile
```

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "authMethod": "webauthn",
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "webauthnAuth": {
      "credentialCount": 2,
      "credentials": [
        {
          "id": "uuid",
          "deviceType": "platform",
          "createdAt": "2024-01-01T00:00:00.000Z",
          "lastUsed": "2024-01-01T12:00:00.000Z"
        }
      ]
    }
  }
}
```

---

### Deactivate Account

Deactivate user account.

```http
POST /user/deactivate
```

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "message": "Account deactivated successfully"
}
```

**Rate Limit:** 5 requests per hour per user

---

## 🏥 Health Check

### Health Status

Check API health status.

```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "uptime": 3600,
  "environment": "development"
}
```

---

## ⚠️ Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Request validation failed |
| `AUTH_REQUIRED` | Authentication required |
| `AUTH_METHOD_MISMATCH` | Wrong authentication method |
| `ALREADY_AUTHENTICATED` | User already logged in |
| `REGISTRATION_FAILED` | User registration failed |
| `LOGIN_FAILED` | User login failed |
| `EMAIL_VERIFICATION_FAILED` | Email verification failed |
| `PASSWORD_RESET_REQUEST_FAILED` | Password reset request failed |
| `PASSWORD_RESET_COMPLETION_FAILED` | Password reset completion failed |
| `WEBAUTHN_REGISTRATION_BEGIN_FAILED` | WebAuthn registration start failed |
| `WEBAUTHN_REGISTRATION_COMPLETE_FAILED` | WebAuthn registration completion failed |
| `WEBAUTHN_AUTHENTICATION_BEGIN_FAILED` | WebAuthn authentication start failed |
| `WEBAUTHN_AUTHENTICATION_COMPLETE_FAILED` | WebAuthn authentication completion failed |
| `RATE_LIMIT_EXCEEDED` | Rate limit exceeded |
| `NOT_FOUND` | Resource not found |
| `INTERNAL_ERROR` | Internal server error |

---

## 🔒 Rate Limiting

Different endpoints have different rate limits:

- **General API**: 100 requests per 15 minutes per IP
- **Authentication**: 10 requests per 15 minutes per IP
- **Password Reset**: 3 requests per hour per IP
- **Email Verification**: 5 requests per hour per IP
- **OTP Requests**: 5 requests per 15 minutes per IP
- **WebAuthn Operations**: 20 requests per 15 minutes per IP
- **User Sensitive Operations**: 5 requests per hour per user

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Request limit
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset time

---

## 🔧 Development Notes

### Testing with cURL

Example login flow:
```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123!"}'

# Login (first call - triggers OTP)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"test@example.com","password":"TestPass123!"}'

# Login (with OTP)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -c cookies.txt \
  -d '{"email":"test@example.com","password":"TestPass123!","otp":"123456"}'

# Get user info
curl -X GET http://localhost:3000/api/auth/me \
  -b cookies.txt
```

### WebAuthn Testing

WebAuthn requires HTTPS in production but works with localhost over HTTP for development. Use a modern browser with biometric authentication support for testing.

