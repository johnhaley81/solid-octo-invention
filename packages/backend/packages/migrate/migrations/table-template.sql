-- Template for creating new tables with soft delete support
-- Copy this template when creating new tables to ensure consistency

-- Example table creation with soft delete support
-- Replace 'example_table' with your actual table name

/*
CREATE TABLE example_table (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Your table-specific columns here
  name TEXT NOT NULL,
  description TEXT,
  
  -- Standard audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Soft delete column - REQUIRED for all tables
  deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- Create updated_at trigger
CREATE TRIGGER update_example_table_updated_at 
  BEFORE UPDATE ON example_table
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for performance
-- Index for active (non-deleted) records - most common queries
CREATE INDEX CONCURRENTLY example_table_active_idx ON example_table (id) WHERE deleted_at IS NULL;

-- Index for deleted records (for admin/recovery queries)
CREATE INDEX CONCURRENTLY example_table_deleted_idx ON example_table (deleted_at) WHERE deleted_at IS NOT NULL;

-- Add any additional indexes your table needs
-- CREATE INDEX example_table_name_idx ON example_table (name) WHERE deleted_at IS NULL;

-- Prevent hard deletes with trigger
CREATE TRIGGER prevent_example_table_hard_delete
  BEFORE DELETE ON example_table
  FOR EACH ROW
  EXECUTE FUNCTION prevent_hard_delete();

-- Enable Row Level Security
ALTER TABLE example_table ENABLE ROW LEVEL SECURITY;

-- RLS Policy for regular users - only see active records
CREATE POLICY example_table_select_policy ON example_table 
  FOR SELECT 
  USING (deleted_at IS NULL);

-- RLS Policy for admin users - see all records including soft deleted
CREATE POLICY example_table_admin_select_policy ON example_table 
  FOR SELECT 
  USING (
    deleted_at IS NULL OR 
    current_setting('app.user_role', true) = 'admin'
  );

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON example_table TO postgres;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO postgres;
*/

-- Checklist for new tables with soft delete support:
-- ✅ Include deleted_at TIMESTAMPTZ DEFAULT NULL column
-- ✅ Create partial indexes on deleted_at for performance
-- ✅ Add prevent hard delete trigger
-- ✅ Set up RLS policies that respect soft delete status
-- ✅ Grant appropriate permissions
-- ✅ Test soft delete functionality with the table

-- Helper function to set up soft delete infrastructure for a new table
CREATE OR REPLACE FUNCTION setup_soft_delete_for_table(table_name TEXT)
RETURNS VOID AS $$
DECLARE
  index_name_active TEXT;
  index_name_deleted TEXT;
  trigger_name TEXT;
  policy_name TEXT;
  admin_policy_name TEXT;
BEGIN
  -- Generate names
  index_name_active := table_name || '_active_idx';
  index_name_deleted := table_name || '_deleted_idx';
  trigger_name := 'prevent_' || table_name || '_hard_delete';
  policy_name := table_name || '_select_policy';
  admin_policy_name := table_name || '_admin_select_policy';
  
  -- Create indexes
  EXECUTE format('CREATE INDEX CONCURRENTLY %I ON %I (id) WHERE deleted_at IS NULL', 
                 index_name_active, table_name);
  EXECUTE format('CREATE INDEX CONCURRENTLY %I ON %I (deleted_at) WHERE deleted_at IS NOT NULL', 
                 index_name_deleted, table_name);
  
  -- Add prevent hard delete trigger
  EXECUTE format('CREATE TRIGGER %I BEFORE DELETE ON %I FOR EACH ROW EXECUTE FUNCTION prevent_hard_delete()', 
                 trigger_name, table_name);
  
  -- Enable RLS
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
  
  -- Create RLS policies
  EXECUTE format('CREATE POLICY %I ON %I FOR SELECT USING (deleted_at IS NULL)', 
                 policy_name, table_name);
  EXECUTE format('CREATE POLICY %I ON %I FOR SELECT USING (deleted_at IS NULL OR current_setting(''app.user_role'', true) = ''admin'')', 
                 admin_policy_name, table_name);
  
  RAISE NOTICE 'Soft delete infrastructure set up for table: %', table_name;
END;
$$ LANGUAGE plpgsql;

-- Usage example:
-- SELECT setup_soft_delete_for_table('your_new_table_name');

COMMENT ON FUNCTION setup_soft_delete_for_table(TEXT) IS 'Helper function to set up soft delete infrastructure (indexes, triggers, RLS policies) for a new table';
