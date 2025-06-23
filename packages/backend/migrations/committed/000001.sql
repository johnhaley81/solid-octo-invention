-- Migration: Create app_public schema and move users table
-- This migration creates the app_public schema and moves the users table from public to app_public

-- Create the app_public schema
CREATE SCHEMA IF NOT EXISTS app_public;

-- Move the users table from public to app_public schema
-- First, we need to drop the existing table in public and recreate it in app_public
-- Since this is a new setup, we'll create it directly in app_public

-- Enable necessary extensions in app_public schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA app_public;
CREATE EXTENSION IF NOT EXISTS "citext" WITH SCHEMA app_public;

-- Create users table in app_public schema
CREATE TABLE app_public.users (
  id UUID PRIMARY KEY DEFAULT app_public.uuid_generate_v4(),
  email app_public.CITEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create updated_at trigger function in app_public schema
CREATE OR REPLACE FUNCTION app_public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to users table
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON app_public.users
  FOR EACH ROW EXECUTE FUNCTION app_public.update_updated_at_column();

-- Row Level Security (RLS) setup
ALTER TABLE app_public.users ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (can be customized based on authentication needs)
CREATE POLICY users_select_policy ON app_public.users FOR SELECT USING (true);

-- Grant permissions to PostGraphile for app_public schema
GRANT USAGE ON SCHEMA app_public TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app_public TO postgres;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA app_public TO postgres;

-- Grant permissions to app_user role as well
GRANT USAGE ON SCHEMA app_public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app_public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA app_public TO app_user;

-- If there's existing data in public.users, migrate it
-- This is a conditional migration that only runs if public.users exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    -- Copy data from public.users to app_public.users
    INSERT INTO app_public.users (id, email, name, avatar_url, created_at, updated_at)
    SELECT id, email, name, avatar_url, created_at, updated_at
    FROM public.users;
    
    -- Drop the old table
    DROP TABLE public.users CASCADE;
  END IF;
END
$$;

