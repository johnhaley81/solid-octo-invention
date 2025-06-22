-- Initial setup for Docker container
-- This file is run when the PostgreSQL container starts for the first time

-- Create the main database user if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user WITH LOGIN PASSWORD 'app_password';
  END IF;
END
$$;

-- Grant necessary permissions
GRANT CONNECT ON DATABASE solid_octo_invention TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT CREATE ON SCHEMA public TO app_user;

