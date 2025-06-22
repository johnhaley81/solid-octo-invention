-- Initial database schema for Solid Octo Invention
-- This file contains the current state of the database schema

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";

-- Create app_private schema for sensitive data
CREATE SCHEMA IF NOT EXISTS app_private;

-- Create authentication method enum
CREATE TYPE auth_method AS ENUM ('password', 'webauthn');

-- Create OTP token type enum
CREATE TYPE otp_token_type AS ENUM ('email_verification', 'login_otp', 'password_reset');

-- Create users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email CITEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  auth_method auth_method NOT NULL DEFAULT 'password',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to users table
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Authentication tables in app_private schema
-- Password-based authentication credentials
CREATE TABLE app_private.password_credentials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  email_verified_at TIMESTAMPTZ,
  email_verification_token TEXT,
  email_verification_expires_at TIMESTAMPTZ,
  password_reset_token TEXT,
  password_reset_expires_at TIMESTAMPTZ,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure only one password credential per user
  UNIQUE(user_id)
);

-- WebAuthn credentials for passkey authentication
CREATE TABLE app_private.webauthn_credentials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter BIGINT NOT NULL DEFAULT 0,
  device_type TEXT,
  backup_eligible_at TIMESTAMPTZ,
  backup_state_at TIMESTAMPTZ,
  transports TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

-- OTP tokens for email verification and login
CREATE TABLE app_private.otp_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  token_type otp_token_type NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User sessions for authentication tracking
CREATE TABLE app_private.user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE,
  auth_method auth_method NOT NULL,
  ip_address INET,
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Apply updated_at triggers to app_private tables
CREATE TRIGGER update_password_credentials_updated_at 
  BEFORE UPDATE ON app_private.password_credentials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes for performance
CREATE INDEX idx_password_credentials_user_id ON app_private.password_credentials(user_id);
CREATE INDEX idx_password_credentials_email_verification_token ON app_private.password_credentials(email_verification_token);
CREATE INDEX idx_password_credentials_password_reset_token ON app_private.password_credentials(password_reset_token);

CREATE INDEX idx_webauthn_credentials_user_id ON app_private.webauthn_credentials(user_id);
CREATE INDEX idx_webauthn_credentials_credential_id ON app_private.webauthn_credentials(credential_id);

CREATE INDEX idx_otp_tokens_user_id ON app_private.otp_tokens(user_id);
CREATE INDEX idx_otp_tokens_token ON app_private.otp_tokens(token);
CREATE INDEX idx_otp_tokens_expires_at ON app_private.otp_tokens(expires_at);
CREATE INDEX idx_otp_tokens_token_type ON app_private.otp_tokens(token_type);

CREATE INDEX idx_user_sessions_user_id ON app_private.user_sessions(user_id);
CREATE INDEX idx_user_sessions_session_token ON app_private.user_sessions(session_token);
CREATE INDEX idx_user_sessions_expires_at ON app_private.user_sessions(expires_at);

-- Function to enforce mutual exclusivity between auth methods
CREATE OR REPLACE FUNCTION enforce_auth_method_exclusivity()
RETURNS TRIGGER AS $$
BEGIN
  -- When user switches to password auth, remove WebAuthn credentials
  IF NEW.auth_method = 'password' AND OLD.auth_method = 'webauthn' THEN
    DELETE FROM app_private.webauthn_credentials WHERE user_id = NEW.id;
  END IF;
  
  -- When user switches to WebAuthn auth, remove password credentials
  IF NEW.auth_method = 'webauthn' AND OLD.auth_method = 'password' THEN
    DELETE FROM app_private.password_credentials WHERE user_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce mutual exclusivity
CREATE TRIGGER enforce_auth_method_exclusivity_trigger
  AFTER UPDATE OF auth_method ON users
  FOR EACH ROW
  EXECUTE FUNCTION enforce_auth_method_exclusivity();

-- Row Level Security (RLS) setup
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.password_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.webauthn_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.otp_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.user_sessions ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (can be customized based on authentication needs)
CREATE POLICY users_select_policy ON users FOR SELECT USING (true);

-- App_private RLS policies - only accessible by the user themselves
CREATE POLICY password_credentials_policy ON app_private.password_credentials 
  FOR ALL USING (user_id = current_setting('app.current_user_id', true)::UUID);

CREATE POLICY webauthn_credentials_policy ON app_private.webauthn_credentials 
  FOR ALL USING (user_id = current_setting('app.current_user_id', true)::UUID);

CREATE POLICY otp_tokens_policy ON app_private.otp_tokens 
  FOR ALL USING (user_id = current_setting('app.current_user_id', true)::UUID);

CREATE POLICY user_sessions_policy ON app_private.user_sessions 
  FOR ALL USING (user_id = current_setting('app.current_user_id', true)::UUID);

-- Authentication functions for GraphQL mutations

-- Register user with password
CREATE OR REPLACE FUNCTION register_user(
  email CITEXT,
  name TEXT,
  password TEXT
) RETURNS users AS $$
DECLARE
  new_user users;
  password_hash TEXT;
BEGIN
  -- Hash the password (this would be done in the application layer with bcrypt)
  -- For now, we'll use a placeholder
  password_hash := 'bcrypt_hash_placeholder_' || password;
  
  -- Create the user
  INSERT INTO users (email, name, auth_method)
  VALUES (email, name, 'password')
  RETURNING * INTO new_user;
  
  -- Create password credentials
  INSERT INTO app_private.password_credentials (user_id, password_hash)
  VALUES (new_user.id, password_hash);
  
  -- Generate email verification token (would be done in worker job)
  -- For now, we'll create a placeholder
  INSERT INTO app_private.otp_tokens (user_id, token, token_type, expires_at)
  VALUES (new_user.id, 'email_verification_token', 'email_verification', NOW() + INTERVAL '24 hours');
  
  RETURN new_user;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

-- Verify email
CREATE OR REPLACE FUNCTION verify_email(
  token TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  otp_record app_private.otp_tokens;
BEGIN
  -- Find and validate the token
  SELECT * INTO otp_record
  FROM app_private.otp_tokens
  WHERE token = verify_email.token
    AND token_type = 'email_verification'
    AND expires_at > NOW()
    AND used_at IS NULL;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Mark token as used
  UPDATE app_private.otp_tokens
  SET used_at = NOW()
  WHERE id = otp_record.id;
  
  -- Mark email as verified
  UPDATE app_private.password_credentials
  SET email_verified_at = NOW()
  WHERE user_id = otp_record.user_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

-- Login with password (returns session info)
CREATE OR REPLACE FUNCTION login_with_password(
  email CITEXT,
  password TEXT
) RETURNS TABLE(
  user_id UUID,
  session_token TEXT,
  expires_at TIMESTAMPTZ
) AS $$
DECLARE
  user_record users;
  cred_record app_private.password_credentials;
  new_session_token TEXT;
  session_expires TIMESTAMPTZ;
BEGIN
  -- Find user
  SELECT * INTO user_record
  FROM users
  WHERE users.email = login_with_password.email
    AND auth_method = 'password';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid credentials';
  END IF;
  
  -- Get password credentials
  SELECT * INTO cred_record
  FROM app_private.password_credentials
  WHERE user_id = user_record.id;
  
  -- Check if email is verified
  IF cred_record.email_verified_at IS NULL THEN
    RAISE EXCEPTION 'Email not verified';
  END IF;
  
  -- Check if account is locked
  IF cred_record.locked_until IS NOT NULL AND cred_record.locked_until > NOW() THEN
    RAISE EXCEPTION 'Account locked';
  END IF;
  
  -- Verify password (this would be done with bcrypt in application layer)
  -- For now, we'll do a simple check
  IF cred_record.password_hash != 'bcrypt_hash_placeholder_' || password THEN
    -- Increment failed attempts
    UPDATE app_private.password_credentials
    SET failed_login_attempts = failed_login_attempts + 1,
        locked_until = CASE 
          WHEN failed_login_attempts >= 4 THEN NOW() + INTERVAL '15 minutes'
          ELSE NULL
        END
    WHERE user_id = user_record.id;
    
    RAISE EXCEPTION 'Invalid credentials';
  END IF;
  
  -- Reset failed attempts on successful login
  UPDATE app_private.password_credentials
  SET failed_login_attempts = 0,
      locked_until = NULL
  WHERE user_id = user_record.id;
  
  -- Generate session token
  new_session_token := encode(gen_random_bytes(32), 'hex');
  session_expires := NOW() + INTERVAL '24 hours';
  
  -- Create session
  INSERT INTO app_private.user_sessions (user_id, session_token, auth_method, expires_at)
  VALUES (user_record.id, new_session_token, 'password', session_expires);
  
  -- Return session info
  RETURN QUERY SELECT user_record.id, new_session_token, session_expires;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

-- Switch authentication method
CREATE OR REPLACE FUNCTION switch_auth_method(
  user_id UUID,
  new_method auth_method
) RETURNS users AS $$
DECLARE
  updated_user users;
BEGIN
  -- Update user's auth method (trigger will handle cleanup)
  UPDATE users
  SET auth_method = new_method
  WHERE id = user_id
  RETURNING * INTO updated_user;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  RETURN updated_user;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

-- Get current user from session
CREATE OR REPLACE FUNCTION current_user_from_session(
  session_token TEXT
) RETURNS users AS $$
DECLARE
  user_record users;
  session_record app_private.user_sessions;
BEGIN
  -- Find valid session
  SELECT * INTO session_record
  FROM app_private.user_sessions
  WHERE user_sessions.session_token = current_user_from_session.session_token
    AND expires_at > NOW();
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired session';
  END IF;
  
  -- Get user
  SELECT * INTO user_record
  FROM users
  WHERE id = session_record.user_id;
  
  -- Set current user context for RLS
  PERFORM set_config('app.current_user_id', session_record.user_id::TEXT, true);
  
  RETURN user_record;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

-- Logout (invalidate session)
CREATE OR REPLACE FUNCTION logout(
  session_token TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  DELETE FROM app_private.user_sessions
  WHERE user_sessions.session_token = logout.session_token;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

-- Grant permissions to PostGraphile
GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA app_private TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app_private TO postgres;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA app_private TO postgres;
GRANT USAGE ON TYPE auth_method TO postgres;
GRANT USAGE ON TYPE otp_token_type TO postgres;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION register_user(CITEXT, TEXT, TEXT) TO postgres;
GRANT EXECUTE ON FUNCTION verify_email(TEXT) TO postgres;
GRANT EXECUTE ON FUNCTION login_with_password(CITEXT, TEXT) TO postgres;
GRANT EXECUTE ON FUNCTION switch_auth_method(UUID, auth_method) TO postgres;
GRANT EXECUTE ON FUNCTION current_user_from_session(TEXT) TO postgres;
GRANT EXECUTE ON FUNCTION logout(TEXT) TO postgres;
