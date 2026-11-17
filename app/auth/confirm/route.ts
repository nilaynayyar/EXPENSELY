import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createSafeRedirectUrl, sanitizeRedirectPath } from "@/lib/auth-url";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const token_hash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const code = requestUrl.searchParams.get("code");
  const rawNext = requestUrl.searchParams.get("next");

  let defaultNext = "/dashboard";
  if (type === "recovery") {
    defaultNext = "/settings?mode=change_password";
  }
  const safeNext = sanitizeRedirectPath(rawNext, defaultNext);

  const supabase = await createClient();

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });
    if (!error) {
      return NextResponse.redirect(createSafeRedirectUrl(safeNext, request));
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      return NextResponse.redirect(createSafeRedirectUrl(safeNext, request));
    }
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(createSafeRedirectUrl(safeNext, request));
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      return NextResponse.redirect(createSafeRedirectUrl(safeNext, request));
    }
  }

  return NextResponse.redirect(
    createSafeRedirectUrl("/login?error=token_verification_failed", request)
  );
}
