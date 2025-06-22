# 🔐 Authentication System

A comprehensive authentication system supporting both traditional Email/Password + OTP and modern WebAuthn Passkeys authentication methods with **mutual exclusivity** - users can only have one authentication method active at a time.

## ✨ Features

### 🔑 Traditional Authentication
- **Email/Password Authentication** with strong password requirements
- **Mandatory Email Verification** before account activation
- **Login OTP** sent via email for additional security
- **Password Reset** functionality with secure tokens
- **Account Lockout** protection against brute force attacks

### 🚀 Modern Authentication
- **WebAuthn Passkeys** support for biometric authentication
- **Platform Authenticators** (Touch ID, Face ID, Windows Hello)
- **Cross-platform** compatibility with FIDO2/WebAuthn standards
- **Multiple Credentials** support per user
- **Backup and Sync** eligible credentials

### 🔒 Security Features
- **Mutual Exclusivity** - only one auth method active per user
- **Rate Limiting** on all authentication endpoints
- **Session Management** with secure cookies
- **CSRF Protection** and security headers
- **Input Validation** and sanitization
- **Secure Password Hashing** with bcrypt

## 🏗️ Architecture

### Database Schema
- **users** - Core user information and auth method tracking
- **password_credentials** - Password hashes and email verification
- **webauthn_credentials** - WebAuthn public keys and metadata
- **otp_tokens** - Temporary tokens for email verification and login
- **user_sessions** - Active user sessions

### Authentication Flow
1. **Registration**: Users choose between password or WebAuthn registration
2. **Method Switching**: Users can switch between auth methods (mutual exclusivity)
3. **Login**: Different flows based on user's active authentication method
4. **Session Management**: Secure session handling for both auth methods

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ 
- PostgreSQL 12+
- Modern browser with WebAuthn support (for passkeys)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd solid-octo-invention
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Set up the database**
   ```bash
   npm run db:setup
   ```

5. **Start the server**
   ```bash
   npm start
   # or for development
   npm run dev
   ```

6. **Open your browser**
   ```
   http://localhost:3000
   ```

## ⚙️ Configuration

### Environment Variables

#### Database Configuration
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=auth_system
DB_USER=postgres
DB_PASSWORD=your_password
```

#### Email Configuration (SMTP)
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=noreply@yourapp.com
```

#### WebAuthn Configuration
```env
WEBAUTHN_RP_NAME=Your App Name
WEBAUTHN_RP_ID=localhost  # your domain in production
WEBAUTHN_EXPECTED_ORIGIN=http://localhost:3000
```

#### Security Configuration
```env
SESSION_SECRET=your-super-secret-session-key
BCRYPT_ROUNDS=12
```

### Production Deployment

For production deployment, ensure you:

1. **Use HTTPS** - Required for WebAuthn
2. **Set proper domain** in WebAuthn configuration
3. **Use strong secrets** for sessions and JWT
4. **Configure email service** with proper SMTP credentials
5. **Set up SSL/TLS** for database connections
6. **Enable security headers** and CORS properly

## 📚 API Documentation

### Authentication Endpoints

#### Register with Email/Password
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

#### Login with Email/Password + OTP
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "otp": "123456"  // Optional on first call
}
```

#### WebAuthn Registration
```http
# Begin registration
POST /api/auth/webauthn/register/begin
Content-Type: application/json

{
  "email": "user@example.com"
}

# Complete registration
POST /api/auth/webauthn/register/complete
Content-Type: application/json

{
  "userId": "user-uuid",
  "registrationResponse": { /* WebAuthn response */ }
}
```

#### WebAuthn Authentication
```http
# Begin authentication
POST /api/auth/webauthn/authenticate/begin
Content-Type: application/json

{
  "email": "user@example.com"
}

# Complete authentication
POST /api/auth/webauthn/authenticate/complete
Content-Type: application/json

{
  "userId": "user-uuid",
  "authenticationResponse": { /* WebAuthn response */ }
}
```

### User Management Endpoints

#### Switch Authentication Methods
```http
# Switch to WebAuthn (from password)
POST /api/user/switch-to-webauthn

# Switch to password (from WebAuthn)
POST /api/user/switch-to-password
Content-Type: application/json

{
  "password": "NewSecurePass123!"
}
```

#### Get User Profile
```http
GET /api/user/profile
```

#### Manage WebAuthn Credentials
```http
# Get credentials
GET /api/user/webauthn/credentials

# Delete credential
DELETE /api/user/webauthn/credentials/:credentialId
```

## 🔧 Development

### Project Structure
```
src/
├── config/          # Configuration files
├── middleware/      # Express middleware
├── models/          # Database models
├── routes/          # API routes
├── services/        # Business logic
└── utils/           # Utility functions

public/
├── css/             # Stylesheets
├── js/              # Client-side JavaScript
└── index.html       # Main HTML file

database/
└── schema.sql       # Database schema

scripts/
└── setup-database.js  # Database setup script
```

### Available Scripts
- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm test` - Run tests
- `npm run db:setup` - Set up database

### Testing

Run the test suite:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

## 🔐 Security Considerations

### Password Authentication
- Passwords must contain uppercase, lowercase, number, and special character
- Bcrypt hashing with configurable rounds (default: 12)
- Account lockout after 5 failed attempts (15-minute lockout)
- Email verification required before account activation
- OTP required for each login (10-minute expiry)

### WebAuthn Authentication
- Platform authenticators preferred (Touch ID, Face ID, Windows Hello)
- User verification preferred but not required
- Credential counter validation to prevent replay attacks
- Support for multiple credentials per user
- Backup eligible credentials supported

### General Security
- Rate limiting on all authentication endpoints
- CSRF protection with secure session cookies
- Input validation and sanitization
- Security headers (Helmet.js)
- Secure session management
- SQL injection prevention with parameterized queries

## 🌐 Browser Compatibility

### WebAuthn Support
- **Chrome/Edge**: 67+ (full support)
- **Firefox**: 60+ (full support)
- **Safari**: 14+ (full support)
- **Mobile**: iOS 14+, Android 7+ with Chrome

### Fallback Behavior
- Browsers without WebAuthn support can still use email/password authentication
- Graceful degradation with clear error messages
- Feature detection on the client side

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

If you encounter any issues or have questions:

1. Check the [API Documentation](#-api-documentation)
2. Review the [Configuration](#️-configuration) section
3. Look at the browser console for client-side errors
4. Check server logs for backend issues

## 🔮 Future Enhancements

- [ ] Multi-factor authentication (TOTP)
- [ ] Social login integration (OAuth)
- [ ] Admin dashboard for user management
- [ ] Audit logging and monitoring
- [ ] Mobile app support with biometric authentication
- [ ] Hardware security key support (FIDO U2F)
- [ ] Advanced threat detection and prevention

