import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { createSafeRedirectUrl } from "@/lib/auth-url";

export async function POST() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch (err) {
    console.error("[Signout API] Error during server sign out:", err);
  }

  const response = NextResponse.json({ success: true });
  response.headers.set("Cache-Control", "no-store, max-age=0, must-revalidate");
  return response;
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch (err) {
    console.error("[Signout API] Error during server sign out:", err);
  }

  const redirectUrl = createSafeRedirectUrl("/login", request);
  const response = NextResponse.redirect(redirectUrl);
  response.headers.set("Cache-Control", "no-store, max-age=0, must-revalidate");
  return response;
}
