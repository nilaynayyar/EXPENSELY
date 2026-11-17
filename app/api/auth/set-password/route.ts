import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = body.email ? String(body.email).trim().toLowerCase() : "";
    const password = body.password ? String(body.password) : "";

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "A valid email address is required" }, { status: 400 });
    }

    if (!password || password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters long" }, { status: 400 });
    }

    const admin = getAdminClient();

    // 1. Guarantee email is confirmed
    try {
      await admin.rpc("confirm_user_email", { user_email: email });
    } catch (confErr) {
      console.warn("[Auth API] confirm_user_email notice:", confErr);
    }

    // 2. Set the password hash directly in auth.users
    const { data, error } = await admin.rpc("set_user_password", {
      user_email: email,
      new_plain_password: password,
    });

    if (error) {
      console.error("[Auth API] set_user_password error:", error);
      return NextResponse.json({ error: error.message || "Failed to update password" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data,
      message: "Password set successfully. You can now sign in immediately.",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
