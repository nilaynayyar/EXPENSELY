-- =============================================================================
-- EXPENSELY - READ-ONLY PRE-DEPLOYMENT VERIFICATION SCRIPT
-- File: supabase/verification/pre_deployment_check.sql
-- PURPOSE: Safe, non-destructive inspection of schema, constraints, RLS & grants
-- GUARANTEE: Contains ONLY SELECT queries. Zero INSERT, UPDATE, DELETE, DDL, or DO blocks.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- CHECK 1: Required Base Schema Tables & Key Columns
-- Verifies that existing dependencies (groups.created_by, profiles, group_members) exist.
-- -----------------------------------------------------------------------------
SELECT
  c.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable,
  CASE
    WHEN c.table_name = 'groups' AND c.column_name = 'created_by' THEN 'CRITICAL DEPENDENCY: OK'
    WHEN c.table_name = 'group_members' AND c.column_name IN ('group_id', 'profile_id') THEN 'CRITICAL DEPENDENCY: OK'
    WHEN c.table_name = 'profiles' AND c.column_name = 'id' THEN 'CRITICAL DEPENDENCY: OK'
    ELSE 'VERIFIED'
  END AS dependency_status
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND (
    (c.table_name = 'groups' AND c.column_name IN ('id', 'name', 'created_by'))
    OR (c.table_name = 'group_members' AND c.column_name IN ('group_id', 'profile_id'))
    OR (c.table_name = 'profiles' AND c.column_name IN ('id', 'email', 'full_name'))
    OR (c.table_name = 'expenses' AND c.column_name IN ('id', 'user_id', 'amount'))
    OR (c.table_name = 'budgets' AND c.column_name IN ('id', 'user_id', 'category_id'))
  )
ORDER BY c.table_name, c.column_name;


-- -----------------------------------------------------------------------------
-- CHECK 2: Target Migration Tables Presence
-- Reports whether the three migration tables currently exist in public schema.
-- -----------------------------------------------------------------------------
SELECT
  targets.target_table,
  CASE
    WHEN t.table_name IS NOT NULL THEN 'ALREADY EXISTS (Will be updated idempotently)'
    ELSE 'NOT YET CREATED (Will be created by migration)'
  END AS current_table_status
FROM (
  SELECT 'scan_sessions' AS target_table
  UNION ALL SELECT 'group_settlements'
  UNION ALL SELECT 'bug_reports'
) targets
LEFT JOIN information_schema.tables t
  ON t.table_schema = 'public' AND t.table_name = targets.target_table;


-- -----------------------------------------------------------------------------
-- CHECK 3: scan_sessions Columns & Nullability (If Table Already Exists)
-- Checks whether token_hash column exists and its current nullability constraint.
-- -----------------------------------------------------------------------------
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'scan_sessions'
ORDER BY ordinal_position;


-- -----------------------------------------------------------------------------
-- CHECK 4: group_settlements Columns & Nullability (If Table Already Exists)
-- Checks whether idempotency_key column exists and its current nullability constraint.
-- -----------------------------------------------------------------------------
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'group_settlements'
ORDER BY ordinal_position;


-- -----------------------------------------------------------------------------
-- CHECK 5: Active Constraints on Target Tables
-- Inspects foreign keys and check constraints on the target tables.
-- -----------------------------------------------------------------------------
SELECT
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  cc.check_clause
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.check_constraints cc
  ON tc.constraint_name = cc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name IN ('scan_sessions', 'group_settlements', 'bug_reports')
ORDER BY tc.table_name, tc.constraint_type;


-- -----------------------------------------------------------------------------
-- CHECK 6: Row Level Security (RLS) Status on Public Tables
-- Confirms whether RLS is active on public tables.
-- -----------------------------------------------------------------------------
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'categories', 'expenses', 'groups', 'group_members', 'group_expenses', 'budgets', 'scan_sessions', 'group_settlements', 'bug_reports')
ORDER BY tablename;


-- -----------------------------------------------------------------------------
-- CHECK 7: Current RLS Policies on Target Tables
-- Lists every currently defined policy across scan_sessions, group_settlements, bug_reports.
-- -----------------------------------------------------------------------------
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('scan_sessions', 'group_settlements', 'bug_reports')
ORDER BY tablename, policyname;


-- -----------------------------------------------------------------------------
-- CHECK 8: Table Privileges for PUBLIC, anon, and authenticated
-- Audits direct grants to ensure client roles do not have unauthorized access.
-- -----------------------------------------------------------------------------
SELECT
  grantee,
  table_schema,
  table_name,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name IN ('scan_sessions', 'group_settlements', 'bug_reports')
  AND grantee IN ('PUBLIC', 'anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;


-- -----------------------------------------------------------------------------
-- CHECK 9: Storage Bucket & Storage Policies Inspection
-- Checks if 'receipts' bucket exists and its privacy status.
-- -----------------------------------------------------------------------------
SELECT
  id AS bucket_id,
  name AS bucket_name,
  public AS is_public_bucket,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
WHERE id = 'receipts';

SELECT
  policyname,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND (policyname ILIKE '%receipt%' OR qual ILIKE '%receipt%');
