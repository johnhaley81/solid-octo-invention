-- Migration: Move from public schema to app_public schema
-- This migration creates a dedicated app_public schema for application objects
-- and migrates the users table from public to app_public schema

-- ============================================================================
-- SCHEMA CREATION
-- ============================================================================

-- Create the app_public schema for application objects
CREATE SCHEMA IF NOT EXISTS app_public;

-- ============================================================================
-- EXTENSIONS SETUP
-- ============================================================================

-- Install extensions in app_public schema instead of public
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA app_public;
CREATE EXTENSION IF NOT EXISTS "citext" WITH SCHEMA app_public;

-- ============================================================================
-- USERS TABLE MIGRATION
-- ============================================================================

-- Create the users table in app_public schema
CREATE TABLE IF NOT EXISTS app_public.users (
  id UUID PRIMARY KEY DEFAULT app_public.uuid_generate_v4(),
  email app_public.citext UNIQUE NOT NULL,
  username VARCHAR(50) UNIQUE,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  avatar_url TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- Migrate existing data from public.users to app_public.users (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    INSERT INTO app_public.users (id, email, username, first_name, last_name, avatar_url, is_verified, created_at, updated_at, deleted_at)
    SELECT id, email, username, first_name, last_name, avatar_url, is_verified, created_at, updated_at, deleted_at
    FROM public.users
    ON CONFLICT (id) DO NOTHING;
    
    -- Drop the old public.users table after migration
    DROP TABLE IF EXISTS public.users CASCADE;
  END IF;
END
$$;

-- ============================================================================
-- UPDATE FOREIGN KEY REFERENCES
-- ============================================================================

-- Update any foreign key references in app_private schema to point to app_public.users
DO $$
BEGIN
  -- Update user_authentication_methods table if it exists
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'app_private' AND table_name = 'user_authentication_methods') THEN
    -- Drop existing foreign key constraint
    ALTER TABLE app_private.user_authentication_methods 
    DROP CONSTRAINT IF EXISTS user_authentication_methods_user_id_fkey;
    
    -- Add new foreign key constraint pointing to app_public.users
    ALTER TABLE app_private.user_authentication_methods 
    ADD CONSTRAINT user_authentication_methods_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES app_public.users(id) ON DELETE CASCADE;
  END IF;

  -- Update user_emails table if it exists
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'app_private' AND table_name = 'user_emails') THEN
    -- Drop existing foreign key constraint
    ALTER TABLE app_private.user_emails 
    DROP CONSTRAINT IF EXISTS user_emails_user_id_fkey;
    
    -- Add new foreign key constraint pointing to app_public.users
    ALTER TABLE app_private.user_emails 
    ADD CONSTRAINT user_emails_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES app_public.users(id) ON DELETE CASCADE;
  END IF;

  -- Update sessions table if it exists
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'app_private' AND table_name = 'sessions') THEN
    -- Drop existing foreign key constraint
    ALTER TABLE app_private.sessions 
    DROP CONSTRAINT IF EXISTS sessions_user_id_fkey;
    
    -- Add new foreign key constraint pointing to app_public.users
    ALTER TABLE app_private.sessions 
    ADD CONSTRAINT sessions_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES app_public.users(id) ON DELETE CASCADE;
  END IF;
END
$$;

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS users_email_idx ON app_public.users(email);
CREATE INDEX IF NOT EXISTS users_username_idx ON app_public.users(username);
CREATE INDEX IF NOT EXISTS users_created_at_idx ON app_public.users(created_at);

-- Partial index for soft delete performance (only index non-deleted records)
CREATE INDEX IF NOT EXISTS users_active_idx ON app_public.users(id) WHERE deleted_at IS NULL;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Create or replace the updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to automatically update updated_at column
DROP TRIGGER IF EXISTS update_users_updated_at ON app_public.users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON app_public.users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SOFT DELETE FUNCTIONALITY
-- ============================================================================

-- Create function to prevent hard deletes (soft delete only)
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

-- Add trigger to prevent hard deletes on users table
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

-- Policy for regular users - only see active (non-deleted) records
DROP POLICY IF EXISTS users_select_policy ON app_public.users;
CREATE POLICY users_select_policy ON app_public.users 
  FOR SELECT 
  USING (deleted_at IS NULL);

-- Policy for admin users to see all records (including soft deleted)
-- This assumes you have a way to identify admin users - adjust as needed
DROP POLICY IF EXISTS users_admin_select_policy ON app_public.users;
CREATE POLICY users_admin_select_policy ON app_public.users 
  FOR SELECT 
  USING (
    deleted_at IS NULL OR 
    current_setting('app.user_role', true) = 'admin'
  );

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Update register_user function to use app_public schema
CREATE OR REPLACE FUNCTION register_user(
  email app_public.citext,
  username VARCHAR(50) DEFAULT NULL,
  first_name VARCHAR(100) DEFAULT NULL,
  last_name VARCHAR(100) DEFAULT NULL
) RETURNS app_public.users AS $$
DECLARE
  new_user app_public.users;
BEGIN
  INSERT INTO app_public.users (email, username, first_name, last_name)
  VALUES (email, username, first_name, last_name)
  RETURNING * INTO new_user;
  
  RETURN new_user;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update enforce_auth_method_exclusivity function if it exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_proc WHERE proname = 'enforce_auth_method_exclusivity') THEN
    DROP FUNCTION IF EXISTS enforce_auth_method_exclusivity();
    
    CREATE OR REPLACE FUNCTION enforce_auth_method_exclusivity()
    RETURNS TRIGGER AS $func$
    BEGIN
      -- Check if user exists in app_public.users
      IF NOT EXISTS (SELECT 1 FROM app_public.users WHERE id = NEW.user_id AND deleted_at IS NULL) THEN
        RAISE EXCEPTION 'User does not exist or has been deleted';
      END IF;
      
      -- Your existing logic here...
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;
  END IF;
END
$$;

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

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON SCHEMA app_public IS 'Schema for application public objects exposed via PostGraphile';
COMMENT ON TABLE app_public.users IS 'Application users with soft delete support';
COMMENT ON COLUMN app_public.users.deleted_at IS 'Soft delete timestamp - NULL means active user';

