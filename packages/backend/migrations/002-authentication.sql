-- Authentication System Migration
-- Adds support for Email/Password + OTP and WebAuthn Passkeys with mutual exclusivity

-- Add authentication method to users table
ALTER TABLE users ADD COLUMN auth_method TEXT NOT NULL DEFAULT 'password' 
  CHECK (auth_method IN ('password', 'webauthn'));

-- Password-based authentication credentials
CREATE TABLE password_credentials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  email_verification_token TEXT,
  email_verification_expires TIMESTAMPTZ,
  password_reset_token TEXT,
  password_reset_expires TIMESTAMPTZ,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure only one password credential per user
  UNIQUE(user_id)
);

-- WebAuthn credentials for passkey authentication
CREATE TABLE webauthn_credentials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter BIGINT NOT NULL DEFAULT 0,
  device_type TEXT,
  backup_eligible BOOLEAN NOT NULL DEFAULT false,
  backup_state BOOLEAN NOT NULL DEFAULT false,
  transports TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used TIMESTAMPTZ
);

-- OTP tokens for email verification and login
CREATE TABLE otp_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  token_type TEXT NOT NULL CHECK (token_type IN ('email_verification', 'login_otp', 'password_reset')),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User sessions for authentication tracking
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE,
  auth_method TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Apply updated_at triggers
CREATE TRIGGER update_password_credentials_updated_at 
  BEFORE UPDATE ON password_credentials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes for performance
CREATE INDEX idx_password_credentials_user_id ON password_credentials(user_id);
CREATE INDEX idx_password_credentials_email_verification_token ON password_credentials(email_verification_token);
CREATE INDEX idx_password_credentials_password_reset_token ON password_credentials(password_reset_token);

CREATE INDEX idx_webauthn_credentials_user_id ON webauthn_credentials(user_id);
CREATE INDEX idx_webauthn_credentials_credential_id ON webauthn_credentials(credential_id);

CREATE INDEX idx_otp_tokens_user_id ON otp_tokens(user_id);
CREATE INDEX idx_otp_tokens_token ON otp_tokens(token);
CREATE INDEX idx_otp_tokens_expires_at ON otp_tokens(expires_at);
CREATE INDEX idx_otp_tokens_token_type ON otp_tokens(token_type);

CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_session_token ON user_sessions(session_token);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);

-- Row Level Security policies
ALTER TABLE password_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE webauthn_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (will be enhanced with proper authentication context)
CREATE POLICY password_credentials_policy ON password_credentials 
  FOR ALL USING (user_id = current_setting('app.current_user_id', true)::UUID);

CREATE POLICY webauthn_credentials_policy ON webauthn_credentials 
  FOR ALL USING (user_id = current_setting('app.current_user_id', true)::UUID);

CREATE POLICY otp_tokens_policy ON otp_tokens 
  FOR ALL USING (user_id = current_setting('app.current_user_id', true)::UUID);

CREATE POLICY user_sessions_policy ON user_sessions 
  FOR ALL USING (user_id = current_setting('app.current_user_id', true)::UUID);

-- Function to enforce mutual exclusivity between auth methods
CREATE OR REPLACE FUNCTION enforce_auth_method_exclusivity()
RETURNS TRIGGER AS $$
BEGIN
  -- When user switches to password auth, remove WebAuthn credentials
  IF NEW.auth_method = 'password' AND OLD.auth_method = 'webauthn' THEN
    DELETE FROM webauthn_credentials WHERE user_id = NEW.id;
  END IF;
  
  -- When user switches to WebAuthn auth, remove password credentials
  IF NEW.auth_method = 'webauthn' AND OLD.auth_method = 'password' THEN
    DELETE FROM password_credentials WHERE user_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce mutual exclusivity
CREATE TRIGGER enforce_auth_method_exclusivity_trigger
  AFTER UPDATE OF auth_method ON users
  FOR EACH ROW
  EXECUTE FUNCTION enforce_auth_method_exclusivity();

-- Function to cleanup expired tokens and sessions
CREATE OR REPLACE FUNCTION cleanup_expired_auth_data()
RETURNS void AS $$
BEGIN
  -- Delete expired OTP tokens
  DELETE FROM otp_tokens WHERE expires_at < NOW();
  
  -- Delete expired sessions
  DELETE FROM user_sessions WHERE expires_at < NOW();
  
  -- Reset failed login attempts after 24 hours
  UPDATE password_credentials 
  SET failed_login_attempts = 0, locked_until = NULL 
  WHERE locked_until < NOW();
END;
$$ LANGUAGE plpgsql;

-- Grant permissions to PostGraphile
GRANT SELECT, INSERT, UPDATE, DELETE ON password_credentials TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON webauthn_credentials TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON otp_tokens TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_sessions TO postgres;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO postgres;

