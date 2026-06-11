-- =============================================================================
-- EXPENSELY - FULL DATABASE REPAIR MIGRATION
-- Run this entire script in Supabase SQL Editor:
-- Dashboard → SQL Editor → New Query → Paste → Run
-- =============================================================================
-- This script is IDEMPOTENT — safe to run multiple times.
-- It uses IF NOT EXISTS and ON CONFLICT DO NOTHING to avoid duplicate errors.
-- =============================================================================

-- Step 1: Create categories table
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  icon text,
  created_at timestamp with time zone DEFAULT now()
);

-- Step 2: Seed default categories (idempotent)
INSERT INTO public.categories (name, icon) VALUES
  ('Food', 'restaurant'),
  ('Travel', 'directions_car'),
  ('Shopping', 'shopping_bag'),
  ('Software', 'code'),
  ('Utilities', 'lightbulb'),
  ('Entertainment', 'movie'),
  ('Health', 'medical_services'),
  ('Others', 'more_horiz')
ON CONFLICT (name) DO NOTHING;

-- Step 3: Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  avatar_url text,
  role text DEFAULT 'User',
  updated_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- Step 4: Create expenses table
CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  date date NOT NULL DEFAULT current_date,
  store text NOT NULL,
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Verified', 'Pending')),
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  receipt_url text,
  created_at timestamp with time zone DEFAULT now()
);

-- Step 5: Create groups table
CREATE TABLE IF NOT EXISTS public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon text,
  icon_bg text,
  icon_color text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Step 6: Create group_members table
-- NOTE: column is profile_id (NOT user_id)
CREATE TABLE IF NOT EXISTS public.group_members (
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (group_id, profile_id)
);

-- Step 7: Create group_expenses table
-- NOTE: payer column is payer_id (NOT paid_by)
CREATE TABLE IF NOT EXISTS public.group_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  payer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  description text NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  date date NOT NULL DEFAULT current_date,
  created_at timestamp with time zone DEFAULT now()
);

-- Step 8: Create budgets table
CREATE TABLE IF NOT EXISTS public.budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  limit_amount numeric(12,2) NOT NULL CHECK (limit_amount >= 0),
  spent_amount numeric(12,2) NOT NULL DEFAULT 0.0 CHECK (spent_amount >= 0),
  month date NOT NULL DEFAULT date_trunc('month', current_date)::date,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (user_id, category_id, month)
);

-- Step 9: Create indexes
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON public.expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category_id ON public.expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_group_members_profile_id ON public.group_members(profile_id);
CREATE INDEX IF NOT EXISTS idx_group_expenses_group_id ON public.group_expenses(group_id);
CREATE INDEX IF NOT EXISTS idx_group_expenses_payer_id ON public.group_expenses(payer_id);
CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON public.budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_category_id ON public.budgets(category_id);

-- Step 10: Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

-- Step 11: Security helper function for group membership
CREATE OR REPLACE FUNCTION public.is_group_member(gid uuid, uid uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = gid AND profile_id = uid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 12: RLS Policies (drop before recreate to avoid conflicts)

-- Profiles policies
DROP POLICY IF EXISTS "Allow profile select for authenticated users" ON public.profiles;
CREATE POLICY "Allow profile select for authenticated users"
  ON public.profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow profile update for owners" ON public.profiles;
CREATE POLICY "Allow profile update for owners"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Allow profile insert for owners" ON public.profiles;
CREATE POLICY "Allow profile insert for owners"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- Categories policies (read-only for authenticated users)
DROP POLICY IF EXISTS "Allow categories select for authenticated users" ON public.categories;
CREATE POLICY "Allow categories select for authenticated users"
  ON public.categories FOR SELECT TO authenticated USING (true);

-- Expenses policies (owner-only CRUD)
DROP POLICY IF EXISTS "Allow expenses access for owners" ON public.expenses;
CREATE POLICY "Allow expenses access for owners"
  ON public.expenses FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Groups policies
DROP POLICY IF EXISTS "Allow groups access for members" ON public.groups;
CREATE POLICY "Allow groups access for members"
  ON public.groups FOR SELECT TO authenticated
  USING (public.is_group_member(id, auth.uid()));

DROP POLICY IF EXISTS "Allow group creation for authenticated users" ON public.groups;
CREATE POLICY "Allow group creation for authenticated users"
  ON public.groups FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow group update for creators" ON public.groups;
CREATE POLICY "Allow group update for creators"
  ON public.groups FOR UPDATE TO authenticated
  USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);

-- Group Members policies
DROP POLICY IF EXISTS "Allow group members access for members" ON public.group_members;
CREATE POLICY "Allow group members access for members"
  ON public.group_members FOR ALL TO authenticated
  USING (public.is_group_member(group_id, auth.uid()))
  WITH CHECK (public.is_group_member(group_id, auth.uid()));

-- Group Expenses policies
DROP POLICY IF EXISTS "Allow group expenses access for members" ON public.group_expenses;
CREATE POLICY "Allow group expenses access for members"
  ON public.group_expenses FOR ALL TO authenticated
  USING (public.is_group_member(group_id, auth.uid()))
  WITH CHECK (public.is_group_member(group_id, auth.uid()));

-- Budgets policies (owner-only CRUD)
DROP POLICY IF EXISTS "Allow budgets access for owners" ON public.budgets;
CREATE POLICY "Allow budgets access for owners"
  ON public.budgets FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Step 13: Auto-create profile on user signup trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    COALESCE(new.raw_user_meta_data->>'avatar_url', '')
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- =============================================================================
-- VERIFICATION: Run these SELECT statements to confirm setup worked.
-- =============================================================================
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
-- SELECT name, icon FROM public.categories ORDER BY name;
-- =============================================================================
