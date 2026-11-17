-- =============================================================================
-- Migration: Secure Scan Session RPC Functions
-- Allows server-side scanner session management with or without service-role key
-- =============================================================================

-- 1. Create scan session
CREATE OR REPLACE FUNCTION public.rpc_create_scan_session(
  p_id uuid,
  p_user_id uuid,
  p_token_hash text,
  p_expires_at timestamptz
)
RETURNS boolean AS $$
BEGIN
  INSERT INTO public.scan_sessions (id, user_id, token_hash, status, created_at, expires_at)
  VALUES (p_id, p_user_id, p_token_hash, 'pending', now(), p_expires_at);
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.rpc_create_scan_session(uuid, uuid, text, timestamptz) TO anon, authenticated;

-- 2. Get scan session
CREATE OR REPLACE FUNCTION public.rpc_get_scan_session(p_id uuid)
RETURNS jsonb AS $$
DECLARE
  s record;
BEGIN
  SELECT id, user_id, token_hash, status, image_url, file_name, file_type, created_at, expires_at
  INTO s
  FROM public.scan_sessions
  WHERE id = p_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'id', s.id,
    'userId', s.user_id,
    'tokenHash', s.token_hash,
    'status', s.status,
    'image', s.image_url,
    'fileName', s.file_name,
    'fileType', s.file_type,
    'createdAt', extract(epoch from s.created_at) * 1000,
    'expiresAt', extract(epoch from s.expires_at) * 1000
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.rpc_get_scan_session(uuid) TO anon, authenticated;

-- 3. Update scan session image
CREATE OR REPLACE FUNCTION public.rpc_update_scan_session_image(
  p_id uuid,
  p_token_hash text,
  p_image_url text,
  p_file_name text,
  p_file_type text
)
RETURNS boolean AS $$
DECLARE
  v_updated int;
BEGIN
  UPDATE public.scan_sessions
  SET image_url = p_image_url,
      file_name = p_file_name,
      file_type = p_file_type,
      status = 'uploaded'
  WHERE id = p_id
    AND (token_hash = p_token_hash OR p_token_hash IS NULL)
    AND status = 'pending'
    AND expires_at > now();
    
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.rpc_update_scan_session_image(uuid, text, text, text, text) TO anon, authenticated;

-- 4. Delete scan session
CREATE OR REPLACE FUNCTION public.rpc_delete_scan_session(
  p_id uuid,
  p_token_hash text
)
RETURNS boolean AS $$
BEGIN
  DELETE FROM public.scan_sessions
  WHERE id = p_id
    AND (token_hash = p_token_hash OR p_token_hash IS NULL);
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.rpc_delete_scan_session(uuid, text) TO anon, authenticated;
