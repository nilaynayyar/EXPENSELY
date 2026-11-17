import { NextRequest, NextResponse } from "next/server";
import { getScanSession, verifySessionToken, isValidUUID } from "@/lib/scan-session";
import { getAdminClient } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    const token = req.nextUrl.searchParams.get("token");

    if (!id || !isValidUUID(id) || !token) {
      return NextResponse.json({ error: "Valid id and token required" }, { status: 400 });
    }

    const session = await getScanSession(id);
    if (!session || !verifySessionToken(session, token)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (!session.userId) {
      return NextResponse.json({ expenses: [], account: null });
    }

    const admin = getAdminClient();
    const { data: expenses } = await admin
      .from("expenses")
      .select("id, store, amount, date, status, receipt_url, categories(id, name, icon)")
      .eq("user_id", session.userId)
      .order("date", { ascending: false })
      .limit(10);

    return NextResponse.json({
      expenses: expenses || [],
      account: {
        id: session.userId,
        email: session.userEmail,
        name: session.userName,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load expenses";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
