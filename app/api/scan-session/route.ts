import { NextRequest, NextResponse } from "next/server";
import {
  createScanSession,
  getScanSession,
  deleteScanSession,
  isValidUUID,
  verifySessionToken,
} from "@/lib/scan-session";
import { createClient } from "@/utils/supabase/server";

export async function POST() {
  try {
    let userId: string | null = null;
    let userEmail: string | null = null;
    let userName: string | null = null;
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        userId = user.id;
        userEmail = user.email || null;
        userName = user.user_metadata?.full_name || (user.email ? user.email.split("@")[0] : null);
      }
    } catch {
      // unauthenticated sessions allowed for guest QR scanning
    }

    const { session, token } = await createScanSession(userId, userEmail, userName);
    return NextResponse.json({
      id: session.id,
      token,
      expiresAt: session.expiresAt,
      account: userId ? { id: userId, email: userEmail, name: userName } : null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    const token = req.nextUrl.searchParams.get("token");

    if (!id || !isValidUUID(id)) {
      return NextResponse.json({ error: "A valid UUID session ID is required" }, { status: 400 });
    }

    const session = await getScanSession(id);
    if (!session) {
      return NextResponse.json({ status: "expired", error: "Session has expired or does not exist" }, { status: 404 });
    }

    // Access control check: Must supply valid pairing token OR be the authenticated session owner
    let isAuthorized = false;
    if (token && verifySessionToken(session, token)) {
      isAuthorized = true;
    } else {
      try {
        const supabase = await createClient();
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();
        if (authUser && session.userId && authUser.id === session.userId) {
          isAuthorized = true;
        }
      } catch {
        // unauthorized
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: "Access denied. A valid pairing token or authenticated session ownership is required." },
        { status: 403 }
      );
    }

    const account = session.userId
      ? {
          id: session.userId,
          email: session.userEmail || "user@expensely.com",
          name: session.userName || "Expensely User",
        }
      : null;

    if (session.status === "uploaded" && session.image) {
      return NextResponse.json({
        status: "uploaded",
        image: session.image,
        fileName: session.fileName,
        fileType: session.fileType,
        expenseId: session.expenseId || null,
        account,
      });
    }

    return NextResponse.json({
      status: session.status || "pending",
      expiresAt: session.expiresAt,
      account,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to check session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    const token = req.nextUrl.searchParams.get("token");

    if (!id || !isValidUUID(id)) {
      return NextResponse.json({ error: "A valid UUID session ID is required" }, { status: 400 });
    }

    let userId: string | null = null;
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) userId = user.id;
    } catch {
      // ignore
    }

    const result = await deleteScanSession(id, token, userId);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
