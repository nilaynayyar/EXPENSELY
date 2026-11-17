import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { createSafeRedirectUrl, sanitizeRedirectPath } from "@/lib/auth-url";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const token_hash = requestUrl.searchParams.get("token_hash");
  const type = (requestUrl.searchParams.get("type") || "signup") as EmailOtpType;
  const rawNext = requestUrl.searchParams.get("next");

  // Determine safe destination path based on OTP type
  let defaultNext = "/dashboard";
  if (type === "recovery") {
    defaultNext = "/settings?mode=change_password";
  }
  const safeNext = sanitizeRedirectPath(rawNext, defaultNext);

  const supabase = await createClient();

  // 1. Handle PKCE code exchange
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(createSafeRedirectUrl(safeNext, request));
    }

    // Safety fallback for link prefetch / repeated click:
    // If code was already exchanged by a mail scanner or browser preview,
    // verify if a valid session already exists for this user.
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      return NextResponse.redirect(createSafeRedirectUrl(safeNext, request));
    }
  }

  // 2. Handle OTP token_hash verification
  if (token_hash) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });
    if (!error) {
      return NextResponse.redirect(createSafeRedirectUrl(safeNext, request));
    }

    // Safety check for existing session
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      return NextResponse.redirect(createSafeRedirectUrl(safeNext, request));
    }
  }

  // Verification failed or link expired
  return NextResponse.redirect(
    createSafeRedirectUrl("/login?error=auth_callback_failed", request)
  );
}
