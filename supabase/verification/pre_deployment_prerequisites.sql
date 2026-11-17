-- =============================================================================
-- EXPENSELY - PRE-DEPLOYMENT PREREQUISITES VERIFICATION (READ-ONLY)
-- File: supabase/verification/pre_deployment_prerequisites.sql
-- PURPOSE: Safe, non-destructive inspection of database prerequisites
-- GUARANTEE: Contains ONLY SELECT queries. Zero DDL, zero DML, zero DO blocks.
-- Run this BEFORE executing migration 20260610000003.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- PREREQUISITE CHECK 1: Base Application Tables & Required Foreign Key Targets
-- Verifies that groups, profiles, group_members, and groups.created_by exist.
-- -----------------------------------------------------------------------------
SELECT
  c.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable,
  CASE
    WHEN c.table_name = 'groups' AND c.column_name = 'created_by' THEN 'CRITICAL PREREQUISITE: OK (Multi-party creator check)'
    WHEN c.table_name = 'group_members' AND c.column_name IN ('group_id', 'profile_id') THEN 'CRITICAL PREREQUISITE: OK (Group membership check)'
    WHEN c.table_name = 'profiles' AND c.column_name = 'id' THEN 'CRITICAL PREREQUISITE: OK (Foreign key target)'
    ELSE 'BASE TABLE VERIFIED'
  END AS dependency_status
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND (
    (c.table_name = 'groups' AND c.column_name IN ('id', 'name', 'created_by'))
    OR (c.table_name = 'group_members' AND c.column_name IN ('group_id', 'profile_id'))
    OR (c.table_name = 'profiles' AND c.column_name IN ('id', 'email', 'full_name'))
    OR (c.table_name = 'expenses' AND c.column_name IN ('id', 'user_id', 'amount'))
  )
ORDER BY c.table_name, c.column_name;


-- -----------------------------------------------------------------------------
-- PREREQUISITE CHECK 2: Migration Target Tables Pre-Existence Status
-- Reports whether scan_sessions, group_settlements, or bug_reports already exist.
-- -----------------------------------------------------------------------------
SELECT
  targets.target_table,
  CASE
    WHEN t.table_name IS NOT NULL THEN 'PRE-EXISTS (Migration will update idempotently)'
    ELSE 'NOT YET PRESENT (Clean install will create fresh table)'
  END AS pre_migration_status
FROM (
  SELECT 'scan_sessions' AS target_table
  UNION ALL SELECT 'group_settlements'
  UNION ALL SELECT 'bug_reports'
) targets
LEFT JOIN information_schema.tables t
  ON t.table_schema = 'public' AND t.table_name = targets.target_table
ORDER BY targets.target_table;


-- -----------------------------------------------------------------------------
-- PREREQUISITE CHECK 3: Pre-existing scan_sessions Structure (If Present)
-- Checks whether token_hash column exists and if it is already nullable.
-- -----------------------------------------------------------------------------
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'scan_sessions'
ORDER BY ordinal_position;


-- -----------------------------------------------------------------------------
-- PREREQUISITE CHECK 4: Pre-existing group_settlements Structure (If Present)
-- Inspects columns on group_settlements prior to applying constraints.
-- -----------------------------------------------------------------------------
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'group_settlements'
ORDER BY ordinal_position;


-- -----------------------------------------------------------------------------
-- PREREQUISITE CHECK 5: Storage Buckets Prerequisite
-- Verifies whether Supabase storage extension is present and checks 'receipts' bucket.
-- -----------------------------------------------------------------------------
SELECT
  b.id AS bucket_id,
  b.name AS bucket_name,
  b.public AS is_public_bucket,
  b.file_size_limit,
  b.allowed_mime_types
FROM storage.buckets b
WHERE b.id = 'receipts';


-- -----------------------------------------------------------------------------
-- PREREQUISITE CHECK 6: Existing RLS Policies That Migration Will Purge
-- Lists any legacy or overly permissive policies currently defined on target tables.
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
