import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

interface ScanSession {
  id: string;
  createdAt: number;
  image: string | null;
  fileName: string | null;
  fileType: string | null;
}

// In Next.js, API routes can run concurrently. A global variable will hold the map.
const globalAny = global as any;
if (!globalAny.scanSessions) {
  globalAny.scanSessions = new Map<string, ScanSession>();
}
const sessions = globalAny.scanSessions as Map<string, ScanSession>;

// Helper to clean up sessions older than 15 minutes
function cleanupOldSessions() {
  const now = Date.now();
  const fifteenMinutes = 15 * 60 * 1000;
  for (const [id, session] of sessions.entries()) {
    if (now - session.createdAt > fifteenMinutes) {
      sessions.delete(id);
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    cleanupOldSessions();
    const id = crypto.randomUUID();
    const newSession: ScanSession = {
      id,
      createdAt: Date.now(),
      image: null,
      fileName: null,
      fileType: null,
    };
    sessions.set(id, newSession);
    return NextResponse.json({ id });
  } catch (err) {
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    cleanupOldSessions();
    const id = req.nextUrl.searchParams.get("id");
    console.log("[AUDIT API GET] Received request for ID:", id);
    console.log("[AUDIT API GET] sessions.has(id):", id ? sessions.has(id) : false);
    console.log("[AUDIT API GET] sessions.size:", sessions.size);
    if (!id) {
      console.log("[AUDIT API GET] Missing ID in searchParams");
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }
    const session = sessions.get(id);
    if (!session) {
      console.log("[AUDIT API GET] Session not found in memory map:", id);
      return NextResponse.json({ status: "expired", error: "Session has expired or does not exist" }, { status: 404 });
    }

    if (session.image) {
      console.log("[AUDIT API GET] Session has image. Returning status: uploaded");
      return NextResponse.json({
        status: "uploaded",
        image: session.image,
        fileName: session.fileName,
        fileType: session.fileType,
      });
    }

    console.log("[AUDIT API GET] Returning status: pending");
    return NextResponse.json({ status: "pending" });
  } catch (err) {
    console.error("[AUDIT API GET] Exception:", err);
    return NextResponse.json({ error: "Failed to check session" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }
    sessions.delete(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: "Failed to delete session" }, { status: 500 });
  }
}
