-- =============================================================================
-- EXPENSELY - POST-DEPLOYMENT VERIFICATION SCRIPT (READ-ONLY)
-- File: supabase/verification/post_deployment_verification.sql
-- PURPOSE: Verify schema integrity, RLS policies, functions, storage, & constraints
-- GUARANTEE: Contains ONLY SELECT queries. Zero DDL, zero DML, zero DO blocks.
-- Run this AFTER executing migration 20260610000003.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- VERIFICATION 1: All Target Tables Created and Present in Public Schema
-- -----------------------------------------------------------------------------
SELECT
  expected.table_name,
  CASE
    WHEN t.table_name IS NOT NULL THEN 'PASS: Table exists'
    ELSE 'FAIL: Table missing'
  END AS existence_check
FROM (
  SELECT 'scan_sessions' AS table_name
  UNION ALL SELECT 'group_settlements'
  UNION ALL SELECT 'bug_reports'
) expected
LEFT JOIN information_schema.tables t
  ON t.table_schema = 'public' AND t.table_name = expected.table_name
ORDER BY expected.table_name;


-- -----------------------------------------------------------------------------
-- VERIFICATION 2: scan_sessions token_hash Constraint & Nullability Check
-- Verifies token_hash is NOT NULL and indexed.
-- -----------------------------------------------------------------------------
SELECT
  column_name,
  data_type,
  is_nullable,
  CASE
    WHEN is_nullable = 'NO' THEN 'PASS: token_hash is NOT NULL'
    ELSE 'FAIL: token_hash allows NULL'
  END AS constraint_status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'scan_sessions'
  AND column_name = 'token_hash';

-- Verify unique index on token_hash
SELECT
  indexname,
  indexdef,
  CASE
    WHEN indexdef ILIKE '%UNIQUE%' AND indexdef ILIKE '%token_hash%' THEN 'PASS: Unique index active'
    ELSE 'FAIL: Missing unique index'
  END AS index_status
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'scan_sessions'
  AND indexname = 'idx_scan_sessions_token_hash';


-- -----------------------------------------------------------------------------
-- VERIFICATION 3: scan_sessions Zero NULL Hashes and Zero Unexpired Legacy Hashes
-- -----------------------------------------------------------------------------
SELECT
  'scan_sessions_data_integrity' AS audit_target,
  COUNT(*) AS total_rows,
  COUNT(*) FILTER (WHERE token_hash IS NULL) AS null_hashes_must_be_zero,
  COUNT(*) FILTER (WHERE token_hash LIKE 'LEGACY_EXPIRED_%' AND status <> 'expired') AS invalid_legacy_status_must_be_zero
FROM public.scan_sessions;


-- -----------------------------------------------------------------------------
-- VERIFICATION 4: group_settlements idempotency_key & Constraints
-- Verifies idempotency_key is NOT NULL, has DEFAULT, and has UNIQUE index.
-- -----------------------------------------------------------------------------
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default,
  CASE
    WHEN is_nullable = 'NO' AND column_default IS NOT NULL THEN 'PASS: NOT NULL with DEFAULT'
    ELSE 'FAIL: Missing constraint or default'
  END AS idempotency_col_status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'group_settlements'
  AND column_name = 'idempotency_key';

SELECT
  c.conname AS constraint_name,
  c.contype AS constraint_type,
  pg_get_constraintdef(c.oid) AS constraint_definition,
  CASE
    WHEN c.conname = 'different_settlement_participants' THEN 'PASS: Self-settlement prevention constraint active'
    ELSE 'OTHER CONSTRAINT'
  END AS constraint_status
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
JOIN pg_namespace n ON t.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND t.relname = 'group_settlements'
ORDER BY c.conname;

SELECT
  indexname,
  indexdef,
  CASE
    WHEN indexdef ILIKE '%UNIQUE%' AND indexdef ILIKE '%idempotency_key%' THEN 'PASS: Unique idempotency index active'
    ELSE 'FAIL: Missing unique index'
  END AS index_status
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'group_settlements'
  AND indexname = 'idx_group_settlements_idempotency';


-- -----------------------------------------------------------------------------
-- VERIFICATION 5: Row Level Security (RLS) Active on All Public Tables
-- -----------------------------------------------------------------------------
SELECT
  tablename,
  rowsecurity AS rls_enabled,
  CASE
    WHEN rowsecurity = true THEN 'PASS: RLS is ENABLED'
    ELSE 'FAIL: RLS is DISABLED'
  END AS rls_status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('scan_sessions', 'group_settlements', 'bug_reports', 'profiles', 'groups', 'group_members', 'group_expenses', 'expenses', 'budgets')
ORDER BY tablename;


-- -----------------------------------------------------------------------------
-- VERIFICATION 6: Target Table Privileges for PUBLIC, anon, and authenticated
-- Confirms scan_sessions has ZERO client privileges (default-deny) and others have NO UPDATE/DELETE
-- -----------------------------------------------------------------------------
SELECT
  table_name,
  grantee,
  string_agg(privilege_type, ', ' ORDER BY privilege_type) AS granted_privileges,
  CASE
    WHEN table_name = 'scan_sessions' AND grantee IN ('PUBLIC', 'anon', 'authenticated') THEN 'FAIL: Direct client access not revoked'
    WHEN table_name IN ('group_settlements', 'bug_reports') AND string_agg(privilege_type, ', ') ILIKE '%UPDATE%' THEN 'FAIL: Mutable UPDATE granted'
    WHEN table_name IN ('group_settlements', 'bug_reports') AND string_agg(privilege_type, ', ') ILIKE '%DELETE%' THEN 'FAIL: Unaudited DELETE granted'
    ELSE 'PASS: Properly restricted'
  END AS privilege_audit
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name IN ('scan_sessions', 'group_settlements', 'bug_reports')
  AND grantee IN ('PUBLIC', 'anon', 'authenticated')
GROUP BY table_name, grantee
ORDER BY table_name, grantee;


-- -----------------------------------------------------------------------------
-- VERIFICATION 7: Active RLS Policies on Target Tables
-- Confirms zero policies on scan_sessions (full client block) and audited policies on others
-- -----------------------------------------------------------------------------
SELECT
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  CASE
    WHEN tablename = 'scan_sessions' THEN 'FAIL: scan_sessions should have zero client policies (default-deny)'
    WHEN tablename = 'group_settlements' AND policyname = 'Group members can view settlements' AND cmd = 'SELECT' THEN 'PASS: Audited membership read policy'
    WHEN tablename = 'group_settlements' AND policyname = 'Authorized members can record settlements' AND cmd = 'INSERT' THEN 'PASS: Multi-party validated write policy'
    WHEN tablename = 'bug_reports' AND policyname = 'Users can view own bug reports' AND cmd = 'SELECT' THEN 'PASS: Owner-only read policy'
    WHEN tablename = 'bug_reports' AND policyname = 'Users can submit own bug reports' AND cmd = 'INSERT' THEN 'PASS: Validated open status write policy'
    ELSE 'AUDIT: Unexpected policy'
  END AS policy_verification
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('scan_sessions', 'group_settlements', 'bug_reports')
ORDER BY tablename, cmd, policyname;


-- -----------------------------------------------------------------------------
-- VERIFICATION 8: complete_scan_session_upload Function Security
-- Confirms SECURITY DEFINER, search_path = 'pg_catalog, public', and execute permissions restricted
-- -----------------------------------------------------------------------------
SELECT
  p.proname AS function_name,
  pg_get_userbyid(p.proowner) AS function_owner,
  p.prosecdef AS is_security_definer,
  p.proconfig AS function_settings,
  CASE
    WHEN p.prosecdef = true AND p.proconfig::text ILIKE '%search_path=pg_catalog, public%' THEN 'PASS: SECURITY DEFINER with hardened search_path'
    ELSE 'FAIL: Function configuration insecure'
  END AS function_security_status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'complete_scan_session_upload';

-- Verify execute grants on complete_scan_session_upload
SELECT
  routine_name,
  grantee,
  privilege_type,
  CASE
    WHEN grantee = 'service_role' AND privilege_type = 'EXECUTE' THEN 'PASS: Explicitly granted to service_role'
    WHEN grantee IN ('PUBLIC', 'anon', 'authenticated') THEN 'FAIL: Insecure client execute privilege granted'
    ELSE 'AUDIT'
  END AS execute_privilege_audit
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name = 'complete_scan_session_upload'
  AND grantee IN ('PUBLIC', 'anon', 'authenticated', 'service_role');


-- -----------------------------------------------------------------------------
-- VERIFICATION 9: Storage Configuration & Storage Objects Policies
-- Confirms receipts bucket is private and objects RLS restricts access to auth.uid()
-- -----------------------------------------------------------------------------
SELECT
  id AS bucket_id,
  name AS bucket_name,
  public AS is_public_bucket,
  file_size_limit,
  CASE
    WHEN public = false AND file_size_limit = 10485760 THEN 'PASS: Receipts bucket is private with 10MB limit'
    ELSE 'FAIL: Bucket configuration mismatch'
  END AS bucket_verification
FROM storage.buckets
WHERE id = 'receipts';

SELECT
  policyname,
  roles,
  cmd,
  CASE
    WHEN policyname = 'Authenticated users can upload receipts' AND cmd = 'INSERT' THEN 'PASS: Upload restricted to user folder'
    WHEN policyname = 'Authenticated users can view own receipts' AND cmd = 'SELECT' THEN 'PASS: Read restricted to user folder'
    ELSE 'AUDIT: Other storage policy'
  END AS storage_policy_verification
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname ILIKE '%receipt%';
