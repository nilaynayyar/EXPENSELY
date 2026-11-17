-- =============================================================================
-- EXPENSELY - FINAL HARDENED SECURITY, SETTLEMENTS & STORAGE MIGRATION
-- Migration Version: 20260610000003
-- Idempotent, repeatable, and non-destructive.
-- Does NOT delete expenses, profiles, groups, budgets or other user data.
-- =============================================================================

-- =============================================================================
-- PART 1: DYNAMIC RLS POLICY AUDIT & PURGE
-- Dynamically drops any existing, obsolete, or overly permissive policies on
-- scan_sessions, group_settlements, and bug_reports before creating audited ones.
-- =============================================================================
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('scan_sessions', 'group_settlements', 'bug_reports')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;


-- =============================================================================
-- PART 2: scan_sessions TABLE & LEGACY COMPATIBILITY
-- Direct PostgREST client access is strictly revoked.
-- Server-side API mediates all session operations via service-role client.
-- =============================================================================

-- 2.1 Create table if not present
CREATE TABLE IF NOT EXISTS public.scan_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  token_hash text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'uploaded', 'expired', 'completed')),
  image_url text,
  file_name text,
  file_type text,
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone DEFAULT (now() + interval '15 minutes')
);

-- 2.2 Ensure token_hash column exists if table pre-existed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'scan_sessions'
      AND column_name = 'token_hash'
  ) THEN
    ALTER TABLE public.scan_sessions ADD COLUMN token_hash text;
  END IF;
END $$;

-- 2.3 Safely handle legacy rows without token_hash:
-- Mark legacy sessions without a token_hash as expired so they cannot be reused
UPDATE public.scan_sessions
SET status = 'expired'
WHERE token_hash IS NULL;

-- Populate a safe, non-reusable legacy token hash for those expired records
-- Uses guaranteed unique row UUID prefix to guarantee zero duplicate hash collisions
UPDATE public.scan_sessions
SET token_hash = 'LEGACY_EXPIRED_' || id::text || '_' || md5(random()::text || clock_timestamp()::text)
WHERE token_hash IS NULL;

-- 2.4 Enforce NOT NULL on token_hash
ALTER TABLE public.scan_sessions ALTER COLUMN token_hash SET NOT NULL;

-- 2.5 Unique index on token_hash
CREATE UNIQUE INDEX IF NOT EXISTS idx_scan_sessions_token_hash ON public.scan_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_scan_sessions_user ON public.scan_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_scan_sessions_expires ON public.scan_sessions(expires_at);

-- 2.6 Enable RLS and completely revoke direct PostgREST client access
ALTER TABLE public.scan_sessions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.scan_sessions FROM PUBLIC, anon, authenticated;
-- (No RLS policies created for anon/authenticated: default-deny blocks all direct client access)


-- =============================================================================
-- PART 3: group_settlements TABLE & MULTI-PARTY AUTHORIZATION
-- =============================================================================

-- 3.1 Create table if not present
CREATE TABLE IF NOT EXISTS public.group_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  from_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  settled_at timestamp with time zone DEFAULT now(),
  idempotency_key text NOT NULL DEFAULT ('settle_' || gen_random_uuid()::text)
);

-- 3.2 Ensure idempotency_key column exists, populate legacy rows, and enforce NOT NULL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'group_settlements'
      AND column_name = 'idempotency_key'
  ) THEN
    ALTER TABLE public.group_settlements ADD COLUMN idempotency_key text;
  END IF;
END $$;

UPDATE public.group_settlements
SET idempotency_key = 'settle_' || gen_random_uuid()::text
WHERE idempotency_key IS NULL;

ALTER TABLE public.group_settlements
  ALTER COLUMN idempotency_key SET DEFAULT ('settle_' || gen_random_uuid()::text),
  ALTER COLUMN idempotency_key SET NOT NULL;

-- 3.3 Validate and add different_settlement_participants constraint idempotently
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE c.conname = 'different_settlement_participants'
      AND t.relname = 'group_settlements'
      AND n.nspname = 'public'
  ) THEN
    -- Verify no pre-existing rows violate constraint
    IF EXISTS (
      SELECT 1 FROM public.group_settlements
      WHERE from_profile_id = to_profile_id
    ) THEN
      RAISE EXCEPTION 'Cannot add constraint different_settlement_participants: table contains rows where from_profile_id equals to_profile_id.';
    END IF;

    ALTER TABLE public.group_settlements
      ADD CONSTRAINT different_settlement_participants
      CHECK (from_profile_id <> to_profile_id);
  END IF;
END $$;

-- 3.4 Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_group_settlements_idempotency
  ON public.group_settlements(idempotency_key);

CREATE INDEX IF NOT EXISTS idx_group_settlements_group ON public.group_settlements(group_id);
CREATE INDEX IF NOT EXISTS idx_group_settlements_from ON public.group_settlements(from_profile_id);
CREATE INDEX IF NOT EXISTS idx_group_settlements_to ON public.group_settlements(to_profile_id);

-- 3.5 Privilege Hardening
REVOKE ALL ON TABLE public.group_settlements FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.group_settlements TO authenticated;

-- 3.6 Enable RLS & Define Audited Policies
ALTER TABLE public.group_settlements ENABLE ROW LEVEL SECURITY;

-- SELECT Policy: Only active group members can view settlements in their group
CREATE POLICY "Group members can view settlements" ON public.group_settlements
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_settlements.group_id
      AND gm.profile_id = auth.uid()
    )
  );

-- INSERT Policy: Only authorized participants or group creator can record settlements;
-- both participants must be active group members and different from each other.
CREATE POLICY "Authorized members can record settlements" ON public.group_settlements
  FOR INSERT TO authenticated
  WITH CHECK (
    -- 1. Caller must be an active member of this group
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_settlements.group_id
      AND gm.profile_id = auth.uid()
    )
    -- 2. Caller must be either payer, payee, OR group creator (prevents third-party forgery)
    AND (
      auth.uid() = from_profile_id
      OR auth.uid() = to_profile_id
      OR EXISTS (
        SELECT 1 FROM public.groups g
        WHERE g.id = group_settlements.group_id
        AND g.created_by = auth.uid()
      )
    )
    -- 3. Payer must be an active member of the group
    AND EXISTS (
      SELECT 1 FROM public.group_members gm_from
      WHERE gm_from.group_id = group_settlements.group_id
      AND gm_from.profile_id = group_settlements.from_profile_id
    )
    -- 4. Payee must be an active member of the group
    AND EXISTS (
      SELECT 1 FROM public.group_members gm_to
      WHERE gm_to.group_id = group_settlements.group_id
      AND gm_to.profile_id = group_settlements.to_profile_id
    )
    -- 5. Payer and Payee cannot be the same account
    AND (from_profile_id <> to_profile_id)
  );

-- Immutable: Zero UPDATE or DELETE policies granted.


-- =============================================================================
-- PART 4: bug_reports TABLE & INTEGRITY POLICIES
-- =============================================================================

-- 4.1 Create table if not present
CREATE TABLE IF NOT EXISTS public.bug_reports (
  id text PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text NOT NULL,
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved')),
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bug_reports_user ON public.bug_reports(user_id);

-- 4.2 Privilege Hardening
REVOKE ALL ON TABLE public.bug_reports FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.bug_reports TO authenticated;

-- 4.3 Enable RLS & Define Audited Policies
ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

-- SELECT Policy: Users can ONLY view their own bug reports
CREATE POLICY "Users can view own bug reports" ON public.bug_reports
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- INSERT Policy: Authenticated users can submit reports;
-- user_id must equal auth.uid() and status must strictly be 'open'
CREATE POLICY "Users can submit own bug reports" ON public.bug_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'open'
    AND length(trim(title)) > 0
    AND length(trim(description)) > 0
  );

-- Immutable: Zero UPDATE or DELETE policies granted.


-- =============================================================================
-- PART 5: ATOMIC CONDITIONAL UPLOAD TRANSITION FUNCTION
-- Guarantees race-condition-free and replay-proof session state transitions.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.complete_scan_session_upload(
  p_session_id uuid,
  p_token_hash text,
  p_image_url text,
  p_file_name text,
  p_file_type text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_rows_updated integer;
BEGIN
  -- Atomic conditional update: only transitions if ID matches, token_hash matches,
  -- status is currently 'pending', and session has not expired.
  UPDATE public.scan_sessions
  SET
    status = 'uploaded',
    image_url = p_image_url,
    file_name = p_file_name,
    file_type = p_file_type
  WHERE id = p_session_id
    AND token_hash = p_token_hash
    AND status = 'pending'
    AND expires_at > pg_catalog.now();

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  RETURN (v_rows_updated > 0);
END;
$$;

REVOKE ALL ON FUNCTION public.complete_scan_session_upload(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_scan_session_upload(uuid, text, text, text, text) TO service_role;


-- =============================================================================
-- PART 6: SUPABASE STORAGE CONFIGURATION & BUCKET RLS
-- Ensures 'receipts' bucket is private and strictly controlled.
-- =============================================================================
DO $$
BEGIN
  -- 6.1 Create private receipts bucket if storage schema exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'receipts',
      'receipts',
      false, -- Strictly PRIVATE
      10485760, -- 10MB limit
      ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
    )
    ON CONFLICT (id) DO UPDATE SET
      public = false,
      file_size_limit = 10485760,
      allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];
  END IF;

  -- 6.2 Storage Objects Policies for receipts bucket
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
    DROP POLICY IF EXISTS "Public receipts access" ON storage.objects;
    DROP POLICY IF EXISTS "Anyone can read receipts" ON storage.objects;

    DROP POLICY IF EXISTS "Authenticated users can upload receipts" ON storage.objects;
    CREATE POLICY "Authenticated users can upload receipts" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);

    DROP POLICY IF EXISTS "Authenticated users can view own receipts" ON storage.objects;
    CREATE POLICY "Authenticated users can view own receipts" ON storage.objects
      FOR SELECT TO authenticated
      USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
END $$;
