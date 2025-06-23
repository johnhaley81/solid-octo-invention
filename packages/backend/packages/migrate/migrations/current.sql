-- Initial database schema for Solid Octo Invention
-- This file contains the current state of the database schema

-- ============================================================================
-- SCHEMA CREATION
-- ============================================================================

-- Create the app_public schema for application objects
CREATE SCHEMA IF NOT EXISTS app_public;

-- Create app_private schema for sensitive data
CREATE SCHEMA IF NOT EXISTS app_private;

-- ============================================================================
-- EXTENSIONS SETUP
-- ============================================================================

-- Enable necessary extensions in app_public schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA app_public;
CREATE EXTENSION IF NOT EXISTS "citext" WITH SCHEMA app_public;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA app_public;

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Create authentication method enum (idempotent)
DO $$ BEGIN
  CREATE TYPE auth_method AS ENUM ('password', 'webauthn');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create OTP token type enum (idempotent)
DO $$ BEGIN
  CREATE TYPE otp_token_type AS ENUM ('email_verification', 'login_otp', 'password_reset');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- USERS TABLE (APP_PUBLIC SCHEMA)
-- ============================================================================

-- Create users table in app_public schema (idempotent)
CREATE TABLE IF NOT EXISTS app_public.users (
  id UUID PRIMARY KEY DEFAULT app_public.uuid_generate_v4(),
  email app_public.citext UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  auth_method auth_method NOT NULL DEFAULT 'password',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- ============================================================================
-- TRIGGERS AND FUNCTIONS
-- ============================================================================

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to users table (idempotent)
DROP TRIGGER IF EXISTS update_users_updated_at ON app_public.users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON app_public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- AUTHENTICATION TABLES (APP_PRIVATE SCHEMA)
-- ============================================================================

-- User authentication methods table (idempotent)
CREATE TABLE IF NOT EXISTS app_private.user_authentication_methods (
  id UUID PRIMARY KEY DEFAULT app_public.uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES app_public.users(id) ON DELETE CASCADE,
  method auth_method NOT NULL,
  password_hash TEXT, -- Only used for password auth
  webauthn_credential_id TEXT, -- Only used for WebAuthn
  webauthn_public_key TEXT, -- Only used for WebAuthn
  webauthn_counter BIGINT DEFAULT 0, -- Only used for WebAuthn
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure only one auth method per user
  UNIQUE(user_id, method),

  -- Ensure password_hash is only set for password method
  CONSTRAINT password_hash_only_for_password CHECK (
    (method = 'password' AND password_hash IS NOT NULL) OR
    (method != 'password' AND password_hash IS NULL)
  ),

  -- Ensure WebAuthn fields are only set for webauthn method
  CONSTRAINT webauthn_fields_only_for_webauthn CHECK (
    (method = 'webauthn' AND webauthn_credential_id IS NOT NULL AND webauthn_public_key IS NOT NULL) OR
    (method != 'webauthn' AND webauthn_credential_id IS NULL AND webauthn_public_key IS NULL AND webauthn_counter = 0)
  )
);

-- Apply updated_at trigger to user_authentication_methods table (idempotent)
DROP TRIGGER IF EXISTS update_user_authentication_methods_updated_at ON app_private.user_authentication_methods;
CREATE TRIGGER update_user_authentication_methods_updated_at BEFORE UPDATE ON app_private.user_authentication_methods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- User emails table for email verification (idempotent)
CREATE TABLE IF NOT EXISTS app_private.user_emails (
  id UUID PRIMARY KEY DEFAULT app_public.uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES app_public.users(id) ON DELETE CASCADE,
  email app_public.citext NOT NULL,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure only one primary email per user
  UNIQUE(user_id, is_primary) DEFERRABLE INITIALLY DEFERRED
);

-- Apply updated_at trigger to user_emails table (idempotent)
DROP TRIGGER IF EXISTS update_user_emails_updated_at ON app_private.user_emails;
CREATE TRIGGER update_user_emails_updated_at BEFORE UPDATE ON app_private.user_emails
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sessions table (idempotent)
CREATE TABLE IF NOT EXISTS app_private.sessions (
  id UUID PRIMARY KEY DEFAULT app_public.uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES app_public.users(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Apply updated_at trigger to sessions table (idempotent)
DROP TRIGGER IF EXISTS update_sessions_updated_at ON app_private.sessions;
CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON app_private.sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- OTP tokens table (idempotent)
CREATE TABLE IF NOT EXISTS app_private.otp_tokens (
  id UUID PRIMARY KEY DEFAULT app_public.uuid_generate_v4(),
  user_id UUID REFERENCES app_public.users(id) ON DELETE CASCADE, -- Nullable for registration flow
  email app_public.citext NOT NULL,
  token_hash TEXT NOT NULL,
  token_type otp_token_type NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure token is unique per type and email
  UNIQUE(email, token_type, token_hash)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Users table indexes
CREATE INDEX IF NOT EXISTS users_email_idx ON app_public.users(email);
CREATE INDEX IF NOT EXISTS users_created_at_idx ON app_public.users(created_at);
CREATE INDEX IF NOT EXISTS users_auth_method_idx ON app_public.users(auth_method);

-- Partial index for soft delete performance (only index non-deleted records)
CREATE INDEX IF NOT EXISTS users_active_idx ON app_public.users(id) WHERE deleted_at IS NULL;

-- Authentication methods indexes
CREATE INDEX IF NOT EXISTS user_authentication_methods_user_id_idx ON app_private.user_authentication_methods(user_id);
CREATE INDEX IF NOT EXISTS user_authentication_methods_method_idx ON app_private.user_authentication_methods(method);

-- User emails indexes
CREATE INDEX IF NOT EXISTS user_emails_user_id_idx ON app_private.user_emails(user_id);
CREATE INDEX IF NOT EXISTS user_emails_email_idx ON app_private.user_emails(email);
CREATE INDEX IF NOT EXISTS user_emails_is_primary_idx ON app_private.user_emails(is_primary) WHERE is_primary = TRUE;

-- Sessions indexes
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON app_private.sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_token_idx ON app_private.sessions(session_token);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON app_private.sessions(expires_at);

-- OTP tokens indexes
CREATE INDEX IF NOT EXISTS otp_tokens_user_id_idx ON app_private.otp_tokens(user_id);
CREATE INDEX IF NOT EXISTS otp_tokens_email_idx ON app_private.otp_tokens(email);
CREATE INDEX IF NOT EXISTS otp_tokens_type_idx ON app_private.otp_tokens(token_type);
CREATE INDEX IF NOT EXISTS otp_tokens_expires_at_idx ON app_private.otp_tokens(expires_at);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to register a new user (idempotent)
CREATE OR REPLACE FUNCTION app_public.register_user(
  email app_public.citext,
  name TEXT,
  auth_method auth_method DEFAULT 'password'
) RETURNS app_public.users AS $$
DECLARE
  new_user app_public.users;
BEGIN
  -- Insert new user
  INSERT INTO app_public.users (email, name, auth_method)
  VALUES (email, name, auth_method)
  RETURNING * INTO new_user;

  -- Create primary email record
  INSERT INTO app_private.user_emails (user_id, email, is_primary, is_verified)
  VALUES (new_user.id, email, TRUE, FALSE);

  RETURN new_user;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to register a new user with password (for GraphQL mutation)
CREATE OR REPLACE FUNCTION app_public.register_user_with_password(
  email app_public.citext,
  name TEXT,
  password TEXT
) RETURNS app_public.users AS $$
DECLARE
  new_user app_public.users;
  password_hash TEXT;
BEGIN
  -- Hash the password using pgcrypto
  password_hash := app_public.crypt(password, app_public.gen_salt('bf'));

  -- Insert new user
  INSERT INTO app_public.users (email, name, auth_method)
  VALUES (email, name, 'password')
  RETURNING * INTO new_user;

  -- Create primary email record
  INSERT INTO app_private.user_emails (user_id, email, is_primary, is_verified)
  VALUES (new_user.id, email, TRUE, FALSE);

  -- Store password hash
  INSERT INTO app_private.user_authentication_methods (user_id, method, password_hash)
  VALUES (new_user.id, 'password', password_hash);

  RETURN new_user;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to login with password (for GraphQL mutation)
CREATE OR REPLACE FUNCTION app_public.login_with_password(
  email app_public.citext,
  password TEXT
) RETURNS TABLE(
  user_id UUID,
  session_token TEXT,
  expires_at TIMESTAMPTZ
) AS $$
DECLARE
  user_record app_public.users;
  auth_record app_private.user_authentication_methods;
  new_session_token TEXT;
  session_expires_at TIMESTAMPTZ;
BEGIN
  -- Find user by email
  SELECT * INTO user_record
  FROM app_public.users u
  WHERE u.email = login_with_password.email
    AND u.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid email or password';
  END IF;

  -- Get authentication method
  SELECT * INTO auth_record
  FROM app_private.user_authentication_methods uam
  WHERE uam.user_id = user_record.id
    AND uam.method = 'password';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid email or password';
  END IF;

  -- Verify password
  IF NOT (auth_record.password_hash = app_public.crypt(password, auth_record.password_hash)) THEN
    RAISE EXCEPTION 'Invalid email or password';
  END IF;

  -- Generate session token
  new_session_token := encode(app_public.gen_random_bytes(32), 'base64');
  session_expires_at := NOW() + INTERVAL '30 days';

  -- Create session
  INSERT INTO app_private.sessions (user_id, session_token, expires_at)
  VALUES (user_record.id, new_session_token, session_expires_at);

  -- Return session info
  RETURN QUERY SELECT user_record.id, new_session_token, session_expires_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current user from session
CREATE OR REPLACE FUNCTION app_public.current_user_from_session(
  session_token TEXT DEFAULT NULL
) RETURNS app_public.users AS $$
DECLARE
  user_record app_public.users;
  session_record app_private.sessions;
  token TEXT;
BEGIN
  -- Use provided token or get from settings
  token := COALESCE(session_token, current_setting('app.session_token', true));

  IF token IS NULL THEN
    RETURN NULL;
  END IF;

  -- Find valid session
  SELECT * INTO session_record
  FROM app_private.sessions s
  WHERE s.session_token = token
    AND s.expires_at > NOW();

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Get user
  SELECT * INTO user_record
  FROM app_public.users u
  WHERE u.id = session_record.user_id
    AND u.deleted_at IS NULL;

  RETURN user_record;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to enforce auth method exclusivity (idempotent)
CREATE OR REPLACE FUNCTION enforce_auth_method_exclusivity()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if user already has a different auth method
  IF EXISTS (
    SELECT 1 FROM app_private.user_authentication_methods
    WHERE user_id = NEW.user_id AND method != NEW.method
  ) THEN
    RAISE EXCEPTION 'User can only have one authentication method';
  END IF;

  -- Update user's auth_method
  UPDATE app_public.users
  SET auth_method = NEW.method
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply auth method exclusivity trigger (idempotent)
DROP TRIGGER IF EXISTS enforce_auth_method_exclusivity_trigger ON app_private.user_authentication_methods;
CREATE TRIGGER enforce_auth_method_exclusivity_trigger
  BEFORE INSERT OR UPDATE ON app_private.user_authentication_methods
  FOR EACH ROW
  EXECUTE FUNCTION enforce_auth_method_exclusivity();

-- Function to clean up expired tokens (idempotent)
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
  sessions_deleted INTEGER;
BEGIN
  DELETE FROM app_private.otp_tokens
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  DELETE FROM app_private.sessions
  WHERE expires_at < NOW();

  GET DIAGNOSTICS sessions_deleted = ROW_COUNT;

  RETURN deleted_count + sessions_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SOFT DELETE FUNCTIONALITY
-- ============================================================================

-- Function to prevent hard deletes (soft delete only)
CREATE OR REPLACE FUNCTION prevent_hard_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Instead of deleting, set deleted_at timestamp
  UPDATE app_public.users
  SET deleted_at = NOW()
  WHERE id = OLD.id AND deleted_at IS NULL;

  -- Prevent the actual DELETE
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to prevent hard deletes on users table (idempotent)
DROP TRIGGER IF EXISTS prevent_users_hard_delete ON app_public.users;
CREATE TRIGGER prevent_users_hard_delete
  BEFORE DELETE ON app_public.users
  FOR EACH ROW
  EXECUTE FUNCTION prevent_hard_delete();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on users table
ALTER TABLE app_public.users ENABLE ROW LEVEL SECURITY;

-- Update RLS policies to exclude soft deleted records by default
DROP POLICY IF EXISTS users_select_policy ON app_public.users;

-- Policy for regular users - only see active (non-deleted) records
CREATE POLICY users_select_policy ON app_public.users
  FOR SELECT
  USING (deleted_at IS NULL);

-- Policy for admin users to see all records (including soft deleted) (idempotent)
-- This assumes you have a way to identify admin users - adjust as needed
DROP POLICY IF EXISTS users_admin_select_policy ON app_public.users;
CREATE POLICY users_admin_select_policy ON app_public.users
  FOR SELECT
  USING (
    deleted_at IS NULL OR
    current_setting('app.user_role', true) = 'admin'
  );

-- ============================================================================
-- PERMISSIONS
-- ============================================================================

-- Grant permissions to PostGraphile for app_public schema
GRANT USAGE ON SCHEMA app_public TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app_public TO postgres;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA app_public TO postgres;

-- Grant permissions to app_user role as well (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_user') THEN
    GRANT USAGE ON SCHEMA app_public TO app_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app_public TO app_user;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA app_public TO app_user;
  END IF;
END
$$;

-- Grant permissions for app_private schema (limited access)
GRANT USAGE ON SCHEMA app_private TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app_private TO postgres;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA app_private TO postgres;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON SCHEMA app_public IS 'Schema for application public objects exposed via PostGraphile';
COMMENT ON SCHEMA app_private IS 'Schema for sensitive application data not exposed via PostGraphile';
COMMENT ON TABLE app_public.users IS 'Application users with soft delete support';
COMMENT ON COLUMN app_public.users.deleted_at IS 'Soft delete timestamp - NULL means active user';

-- Checklist for new tables with soft delete support:
-- ✅ Include deleted_at TIMESTAMPTZ DEFAULT NULL column
-- ✅ Create partial indexes on deleted_at for performance
-- ✅ Add prevent hard delete trigger
-- ✅ Set up RLS policies that respect soft delete status
-- ✅ Grant appropriate permissions
-- ✅ Test soft delete functionality with the table
