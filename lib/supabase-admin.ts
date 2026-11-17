import { createClient } from "@supabase/supabase-js";

// This file is strictly for server-side trusted operations.
// It must NEVER be imported into Client Components ('use client').

export function hasServiceRoleKey(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const isProduction = process.env.NODE_ENV === "production";

  // In production, missing SUPABASE_SERVICE_ROLE_KEY causes a controlled error
  if (isProduction && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "[SupabaseAdmin] SUPABASE_SERVICE_ROLE_KEY is required in production environment. Refusing to operate with unprivileged credentials."
    );
  }

  // Use service role key if configured, otherwise fall back to anon key in development
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error("[SupabaseAdmin] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
