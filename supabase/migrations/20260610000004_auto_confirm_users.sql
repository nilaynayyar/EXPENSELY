-- =============================================================================
-- Migration: Auto-Confirm Users & Frictionless Password Management
-- Resolves Supabase free SMTP delivery limits & unconfirmed account lockouts
-- =============================================================================

-- Ensure pgcrypto is enabled for secure password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 1. Auto-confirm all existing users in auth.users
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, now())
WHERE email_confirmed_at IS NULL;

-- 2. Trigger function to auto-confirm all new user registrations on insert
CREATE OR REPLACE FUNCTION public.auto_confirm_new_users()
RETURNS trigger AS $$
BEGIN
  IF NEW.email_confirmed_at IS NULL THEN
    NEW.email_confirmed_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_auto_confirm ON auth.users;
CREATE TRIGGER on_auth_user_auto_confirm
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.auto_confirm_new_users();

-- 3. Security-definer RPC function to allow confirming an email explicitly
CREATE OR REPLACE FUNCTION public.confirm_user_email(user_email text)
RETURNS boolean AS $$
BEGIN
  UPDATE auth.users
  SET email_confirmed_at = COALESCE(email_confirmed_at, now())
  WHERE lower(email) = lower(trim(user_email));
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.confirm_user_email(text) TO anon, authenticated;

-- 4. Security-definer RPC function to set or reset a password directly
CREATE OR REPLACE FUNCTION public.set_user_password(user_email text, new_plain_password text)
RETURNS boolean AS $$
BEGIN
  UPDATE auth.users
  SET encrypted_password = extensions.crypt(new_plain_password, extensions.gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      updated_at = now()
  WHERE lower(email) = lower(trim(user_email));
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.set_user_password(text, text) TO anon, authenticated;
