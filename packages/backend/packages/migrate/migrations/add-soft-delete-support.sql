-- Add soft delete support to the database
-- This migration adds deleted_at column to existing tables and creates infrastructure for soft deletes

-- Add deleted_at column to users table
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Create index for performance on active (non-deleted) records
CREATE INDEX CONCURRENTLY users_active_idx ON users (id) WHERE deleted_at IS NULL;

-- Create index for performance on deleted records (for admin queries)
CREATE INDEX CONCURRENTLY users_deleted_idx ON users (deleted_at) WHERE deleted_at IS NOT NULL;

-- Create soft delete function
CREATE OR REPLACE FUNCTION soft_delete_record(table_name TEXT, record_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  sql_query TEXT;
  rows_affected INTEGER;
BEGIN
  -- Construct the SQL query dynamically
  sql_query := format('UPDATE %I SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL', table_name);
  
  -- Execute the query
  EXECUTE sql_query USING record_id;
  
  -- Get the number of affected rows
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  
  -- Return true if a row was updated, false otherwise
  RETURN rows_affected > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create restore function
CREATE OR REPLACE FUNCTION restore_record(table_name TEXT, record_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  sql_query TEXT;
  rows_affected INTEGER;
BEGIN
  -- Construct the SQL query dynamically
  sql_query := format('UPDATE %I SET deleted_at = NULL WHERE id = $1 AND deleted_at IS NOT NULL', table_name);
  
  -- Execute the query
  EXECUTE sql_query USING record_id;
  
  -- Get the number of affected rows
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  
  -- Return true if a row was updated, false otherwise
  RETURN rows_affected > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to prevent hard deletes
CREATE OR REPLACE FUNCTION prevent_hard_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Hard deletes are not allowed. Use soft delete instead by setting deleted_at = NOW()';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to prevent hard deletes on users table
CREATE TRIGGER prevent_users_hard_delete
  BEFORE DELETE ON users
  FOR EACH ROW
  EXECUTE FUNCTION prevent_hard_delete();

-- Update RLS policies to exclude soft deleted records by default
DROP POLICY IF EXISTS users_select_policy ON users;

-- Policy for regular users - only see active (non-deleted) records
CREATE POLICY users_select_policy ON users 
  FOR SELECT 
  USING (deleted_at IS NULL);

-- Policy for admin users to see all records (including soft deleted)
-- This assumes you have a way to identify admin users - adjust as needed
CREATE POLICY users_admin_select_policy ON users 
  FOR SELECT 
  USING (
    deleted_at IS NULL OR 
    current_setting('app.user_role', true) = 'admin'
  );

-- Grant permissions for the new functions
GRANT EXECUTE ON FUNCTION soft_delete_record(TEXT, UUID) TO postgres;
GRANT EXECUTE ON FUNCTION restore_record(TEXT, UUID) TO postgres;

-- Comment on the functions for documentation
COMMENT ON FUNCTION soft_delete_record(TEXT, UUID) IS 'Soft delete a record by setting deleted_at to current timestamp';
COMMENT ON FUNCTION restore_record(TEXT, UUID) IS 'Restore a soft deleted record by setting deleted_at to NULL';
COMMENT ON FUNCTION prevent_hard_delete() IS 'Trigger function to prevent hard deletes and enforce soft delete pattern';
