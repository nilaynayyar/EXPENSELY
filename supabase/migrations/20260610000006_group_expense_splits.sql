-- =============================================================================
-- Migration: Group Expense Individual Splits & Backfill
-- Supports per-expense participant shares, Splitwise-style equal splitting,
-- and preserves all existing historical group expenses and settlements.
-- =============================================================================

-- 1. Create group_expense_splits table
CREATE TABLE IF NOT EXISTS public.group_expense_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_expense_id uuid NOT NULL REFERENCES public.group_expenses(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  share_amount numeric(12,2) NOT NULL CHECK (share_amount >= 0),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT unique_expense_participant UNIQUE (group_expense_id, profile_id)
);

-- 2. Performance indexes
CREATE INDEX IF NOT EXISTS idx_group_expense_splits_expense 
  ON public.group_expense_splits(group_expense_id);

CREATE INDEX IF NOT EXISTS idx_group_expense_splits_profile 
  ON public.group_expense_splits(profile_id);

-- 3. Privilege Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.group_expense_splits TO authenticated;
GRANT SELECT ON TABLE public.group_expense_splits TO anon;

-- 4. Enable Row Level Security & Define Access Policies
ALTER TABLE public.group_expense_splits ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- SELECT Policy: Active group members can view splits
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'group_expense_splits' 
      AND policyname = 'Group members can view expense splits'
  ) THEN
    CREATE POLICY "Group members can view expense splits" ON public.group_expense_splits
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.group_expenses ge
          JOIN public.group_members gm ON gm.group_id = ge.group_id
          WHERE ge.id = group_expense_splits.group_expense_id
            AND gm.profile_id = auth.uid()
        )
      );
  END IF;

  -- INSERT Policy: Active group members can insert expense splits
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'group_expense_splits' 
      AND policyname = 'Group members can insert expense splits'
  ) THEN
    CREATE POLICY "Group members can insert expense splits" ON public.group_expense_splits
      FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.group_expenses ge
          JOIN public.group_members gm ON gm.group_id = ge.group_id
          WHERE ge.id = group_expense_splits.group_expense_id
            AND gm.profile_id = auth.uid()
        )
      );
  END IF;

  -- DELETE Policy: Active group members can delete splits (e.g. on expense deletion)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'group_expense_splits' 
      AND policyname = 'Group members can delete expense splits'
  ) THEN
    CREATE POLICY "Group members can delete expense splits" ON public.group_expense_splits
      FOR DELETE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.group_expenses ge
          JOIN public.group_members gm ON gm.group_id = ge.group_id
          WHERE ge.id = group_expense_splits.group_expense_id
            AND gm.profile_id = auth.uid()
        )
      );
  END IF;
END $$;

-- 5. Safe Idempotent Backfill for Historical Expenses
-- Reconstructs equal shares for legacy group_expenses rows without altering amounts or payers
DO $$
DECLARE
  exp RECORD;
  m RECORD;
  v_member_count INT;
  v_total_cents BIGINT;
  v_base_cents BIGINT;
  v_remainder INT;
  v_idx INT;
  v_share NUMERIC(12,2);
BEGIN
  FOR exp IN 
    SELECT id, group_id, amount 
    FROM public.group_expenses 
    WHERE amount > 0 
      AND description NOT ILIKE '%all balances settled%'
  LOOP
    -- Only backfill if splits do not already exist for this expense
    IF NOT EXISTS (SELECT 1 FROM public.group_expense_splits WHERE group_expense_id = exp.id) THEN
      SELECT count(*) INTO v_member_count 
      FROM public.group_members 
      WHERE group_id = exp.group_id;

      IF v_member_count > 0 THEN
        v_total_cents := round(exp.amount * 100);
        v_base_cents := v_total_cents / v_member_count;
        v_remainder := v_total_cents % v_member_count;
        v_idx := 0;

        FOR m IN 
          SELECT profile_id 
          FROM public.group_members 
          WHERE group_id = exp.group_id 
          ORDER BY profile_id 
        LOOP
          IF v_idx < v_remainder THEN
            v_share := (v_base_cents + 1) / 100.0;
          ELSE
            v_share := v_base_cents / 100.0;
          END IF;

          INSERT INTO public.group_expense_splits (group_expense_id, profile_id, share_amount)
          VALUES (exp.id, m.profile_id, v_share)
          ON CONFLICT (group_expense_id, profile_id) DO NOTHING;

          v_idx := v_idx + 1;
        END LOOP;
      END IF;
    END IF;
  END LOOP;
END $$;

-- 6. Atomic RPC function to create group expense and splits in a single transaction
CREATE OR REPLACE FUNCTION public.rpc_create_group_expense(
  p_group_id uuid,
  p_payer_id uuid,
  p_description text,
  p_amount numeric,
  p_date date,
  p_splits jsonb
)
RETURNS jsonb AS $$
DECLARE
  v_exp_id uuid;
  v_item jsonb;
  v_pid uuid;
  v_amt numeric;
BEGIN
  -- Insert master expense record
  INSERT INTO public.group_expenses (group_id, payer_id, description, amount, date)
  VALUES (p_group_id, p_payer_id, p_description, p_amount, p_date)
  RETURNING id INTO v_exp_id;

  -- Insert split records
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_splits) LOOP
    v_pid := (v_item->>'profile_id')::uuid;
    v_amt := (v_item->>'share_amount')::numeric;

    INSERT INTO public.group_expense_splits (group_expense_id, profile_id, share_amount)
    VALUES (v_exp_id, v_pid, v_amt)
    ON CONFLICT (group_expense_id, profile_id) 
    DO UPDATE SET share_amount = EXCLUDED.share_amount;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'id', v_exp_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.rpc_create_group_expense(uuid, uuid, text, numeric, date, jsonb) TO anon, authenticated;
