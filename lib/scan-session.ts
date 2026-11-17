import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getAdminClient } from "./supabase-admin";

export interface ScanSessionRecord {
  id: string;
  userId?: string | null;
  userEmail?: string | null;
  userName?: string | null;
  tokenHash: string;
  status: "pending" | "uploaded" | "expired" | "completed";
  image: string | null;
  fileName: string | null;
  fileType: string | null;
  createdAt: number;
  expiresAt: number;
  expenseId?: string | null;
}

const SESSION_TTL_MS = 15 * 60 * 1000; // 15 minutes
const SESSIONS_DIR = path.join(process.cwd(), ".scan_sessions");

function ensureDirectory() {
  if (!fs.existsSync(SESSIONS_DIR)) {
    try {
      fs.mkdirSync(SESSIONS_DIR, { recursive: true });
    } catch {
      // directory might already exist
    }
  }
}

export function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export function isValidToken(token: string): boolean {
  return typeof token === "string" && /^[0-9a-f]{64}$/i.test(token);
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function verifySessionToken(session: ScanSessionRecord, token: string): boolean {
  if (!token || !session.tokenHash) return false;
  try {
    const incomingHash = hashToken(token);
    const expectedBuffer = Buffer.from(session.tokenHash, "hex");
    const actualBuffer = Buffer.from(incomingHash, "hex");
    if (expectedBuffer.length !== actualBuffer.length) return false;
    return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
  } catch {
    return false;
  }
}

function getFilePath(id: string): string {
  // Prevent directory traversal by strictly sanitizing id
  const sanitizedId = path.basename(id);
  return path.join(SESSIONS_DIR, `${sanitizedId}.json`);
}

function cleanupExpiredDiskSessions() {
  ensureDirectory();
  try {
    const files = fs.readdirSync(SESSIONS_DIR);
    const now = Date.now();
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const fullPath = path.join(SESSIONS_DIR, file);
      try {
        const raw = fs.readFileSync(fullPath, "utf8");
        const session: ScanSessionRecord = JSON.parse(raw);
        if (now > session.expiresAt) {
          fs.unlinkSync(fullPath);
        }
      } catch {
        // file corrupt or unreadable
      }
    }
  } catch {
    // ignore readdir errors
  }
}

export async function createScanSession(
  userId?: string | null,
  userEmail?: string | null,
  userName?: string | null
): Promise<{ session: ScanSessionRecord; token: string }> {
  const isProduction = process.env.NODE_ENV === "production";
  if (!isProduction) {
    cleanupExpiredDiskSessions();
  }

  const id = crypto.randomUUID();
  // Generate 256-bit cryptographically secure unguessable pairing token
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);

  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS;

  const session: ScanSessionRecord = {
    id,
    userId: userId || null,
    userEmail: userEmail || null,
    userName: userName || null,
    tokenHash,
    status: "pending",
    image: null,
    fileName: null,
    fileType: null,
    createdAt: now,
    expiresAt,
    expenseId: null,
  };

  // In production, strictly persist to Supabase; NEVER fall back to local disk persistence
  if (isProduction) {
    const admin = getAdminClient();
    const { error: insertErr } = await admin.from("scan_sessions").insert([
      {
        id,
        user_id: userId || null,
        token_hash: tokenHash,
        status: "pending",
        created_at: new Date(now).toISOString(),
        expires_at: new Date(expiresAt).toISOString(),
      },
    ]);

    if (insertErr) {
      throw new Error(`[ScanSession] Production database session insertion failed: ${insertErr.message}`);
    }

    return { session, token };
  }

  // Development / test fallback: Persist to local disk store
  ensureDirectory();
  try {
    fs.writeFileSync(getFilePath(id), JSON.stringify(session, null, 2), "utf8");
  } catch (err) {
    console.error("[ScanSession] Failed to persist session to disk in dev mode:", err);
  }

  // Also attempt Supabase in dev mode if configured
  try {
    const admin = getAdminClient();
    await admin.from("scan_sessions").insert([
      {
        id,
        user_id: userId || null,
        token_hash: tokenHash,
        status: "pending",
        created_at: new Date(now).toISOString(),
        expires_at: new Date(expiresAt).toISOString(),
      },
    ]);
  } catch {
    // Disk persistence covers dev mode
  }

  return { session, token };
}

export async function getScanSession(id: string): Promise<ScanSessionRecord | null> {
  if (!isValidUUID(id)) return null;
  const isProduction = process.env.NODE_ENV === "production";

  // In production, strictly query Supabase database
  if (isProduction) {
    try {
      const admin = getAdminClient();
      const { data, error } = await admin
        .from("scan_sessions")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !data) {
        return null;
      }

      const expiresAt = new Date(data.expires_at).getTime();
      if (Date.now() > expiresAt) {
        return null;
      }

      return {
        id: data.id,
        userId: data.user_id,
        tokenHash: data.token_hash,
        status: data.status,
        image: data.image_url,
        fileName: data.file_name,
        fileType: data.file_type,
        createdAt: new Date(data.created_at).getTime(),
        expiresAt,
      };
    } catch (err) {
      console.error("[ScanSession] Production database query failed:", err);
      return null;
    }
  }

  // Development / test fallback: Try reading from disk first
  cleanupExpiredDiskSessions();
  const filePath = getFilePath(id);
  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, "utf8");
      const session: ScanSessionRecord = JSON.parse(raw);
      if (Date.now() > session.expiresAt) {
        fs.unlinkSync(filePath);
        return null;
      }
      return session;
    } catch {
      // fallback to Supabase
    }
  }

  try {
    const admin = getAdminClient();
    const { data, error } = await admin
      .from("scan_sessions")
      .select("*")
      .eq("id", id)
      .single();

    if (!error && data) {
      const expiresAt = new Date(data.expires_at).getTime();
      if (Date.now() > expiresAt) {
        return null;
      }
      return {
        id: data.id,
        userId: data.user_id,
        tokenHash: data.token_hash,
        status: data.status,
        image: data.image_url,
        fileName: data.file_name,
        fileType: data.file_type,
        createdAt: new Date(data.created_at).getTime(),
        expiresAt,
      };
    }
  } catch {
    // ignore
  }

  return null;
}

export async function updateScanSessionImage(
  id: string,
  token: string,
  image: string,
  fileName: string,
  fileType: string,
  expenseId?: string | null
): Promise<{ success: boolean; error?: string; status?: number }> {
  if (!isValidUUID(id)) {
    return { success: false, error: "Invalid session UUID format", status: 400 };
  }
  if (!isValidToken(token)) {
    return { success: false, error: "Invalid pairing token format", status: 400 };
  }

  const session = await getScanSession(id);
  if (!session) {
    return { success: false, error: "Session has expired or does not exist", status: 404 };
  }

  // Verify pairing token cryptographic authenticity
  if (!verifySessionToken(session, token)) {
    return { success: false, error: "Unauthorized: Invalid pairing token", status: 403 };
  }

  // One-time upload condition: session must currently be pending
  if (session.status !== "pending") {
    return {
      success: false,
      error: "Conflict: This session has already received an upload or is no longer pending",
      status: 409,
    };
  }

  // In production, strictly perform atomic update in Supabase; NEVER write to local disk
  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction) {
    try {
      const admin = getAdminClient();
      const tokenHash = hashToken(token);

      // Try calling atomic stored function complete_scan_session_upload
      let rpcSuccess = false;
      try {
        const { data: rpcResult, error: rpcErr } = await admin.rpc(
          "complete_scan_session_upload",
          {
            p_session_id: id,
            p_token_hash: tokenHash,
            p_image_url: image.startsWith("data:") ? null : image,
            p_file_name: fileName,
            p_file_type: fileType,
          }
        );
        if (!rpcErr && typeof rpcResult === "boolean") {
          rpcSuccess = true;
          if (!rpcResult) {
            return {
              success: false,
              error: "Conflict: Atomic state transition failed or session expired",
              status: 409,
            };
          }
        }
      } catch {
        // RPC function not yet deployed; fall back to direct update
      }

      if (!rpcSuccess) {
        const { data: updatedRows, error: dbErr } = await admin
          .from("scan_sessions")
          .update({
            status: "uploaded",
            image_url: image.startsWith("data:") ? null : image,
            file_name: fileName,
            file_type: fileType,
          })
          .eq("id", id)
          .eq("token_hash", tokenHash)
          .eq("status", "pending")
          .gt("expires_at", new Date().toISOString())
          .select("id");

        if (dbErr || (updatedRows && updatedRows.length === 0)) {
          return {
            success: false,
            error: "Conflict: Atomic state transition failed or session expired",
            status: 409,
          };
        }
      }

      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Database error";
      return {
        success: false,
        error: `Production database update failed: ${msg}`,
        status: 500,
      };
    }
  }

  // Development / test fallback: Atomic check-and-set on disk
  ensureDirectory();
  const filePath = getFilePath(id);
  try {
    if (fs.existsSync(filePath)) {
      const currentRaw = fs.readFileSync(filePath, "utf8");
      const currentDiskSession: ScanSessionRecord = JSON.parse(currentRaw);
      if (currentDiskSession.status !== "pending") {
        return {
          success: false,
          error: "Conflict: Concurrency guard - session already uploaded",
          status: 409,
        };
      }
      currentDiskSession.status = "uploaded";
      currentDiskSession.image = image;
      currentDiskSession.fileName = fileName;
      currentDiskSession.fileType = fileType;
      if (expenseId) {
        currentDiskSession.expenseId = expenseId;
      }
      fs.writeFileSync(filePath, JSON.stringify(currentDiskSession, null, 2), "utf8");
    }
  } catch (err) {
    console.error("[ScanSession] Failed to update session on disk in dev mode:", err);
  }

  // Also attempt Supabase in dev mode if available
  try {
    const admin = getAdminClient();
    const tokenHash = hashToken(token);
    let rpcSuccess = false;
    try {
      const { data: rpcResult, error: rpcErr } = await admin.rpc(
        "complete_scan_session_upload",
        {
          p_session_id: id,
          p_token_hash: tokenHash,
          p_image_url: image.startsWith("data:") ? null : image,
          p_file_name: fileName,
          p_file_type: fileType,
        }
      );
      if (!rpcErr && typeof rpcResult === "boolean") {
        rpcSuccess = true;
        if (!rpcResult) {
          return {
            success: false,
            error: "Conflict: Atomic state transition failed or session expired",
            status: 409,
          };
        }
      }
    } catch {
      // RPC fallback
    }

    if (!rpcSuccess) {
      const { data: updatedRows, error: dbErr } = await admin
        .from("scan_sessions")
        .update({
          status: "uploaded",
          image_url: image.startsWith("data:") ? null : image,
          file_name: fileName,
          file_type: fileType,
        })
        .eq("id", id)
        .eq("token_hash", tokenHash)
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString())
        .select("id");

      if (!dbErr && updatedRows && updatedRows.length === 0) {
        return {
          success: false,
          error: "Conflict: Atomic state transition failed or session expired",
          status: 409,
        };
      }
    }
  } catch {
    // Disk persistence handles dev fallback
  }

  return { success: true };
}

export async function deleteScanSession(
  id: string,
  token?: string | null,
  userId?: string | null
): Promise<{ success: boolean; status: number; error?: string }> {
  if (!isValidUUID(id)) {
    return { success: false, status: 400, error: "Invalid session UUID" };
  }

  const isProduction = process.env.NODE_ENV === "production";
  const session = await getScanSession(id);
  if (!session) {
    return { success: true, status: 200 }; // Idempotent deletion
  }

  // Authorization check: Must provide valid pairing token OR be the authenticated session creator
  const hasValidToken = token ? verifySessionToken(session, token) : false;
  const isOwner = userId && session.userId && session.userId === userId;

  if (!hasValidToken && !isOwner) {
    return { success: false, status: 403, error: "Unauthorized to delete this scan session" };
  }

  if (isProduction) {
    try {
      const admin = getAdminClient();
      const { error } = await admin.from("scan_sessions").delete().eq("id", id);
      if (error) {
        return { success: false, status: 500, error: error.message };
      }
      return { success: true, status: 200 };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Database error";
      return { success: false, status: 500, error: `Production delete failed: ${msg}` };
    }
  }

  // Development / test fallback: Remove from disk
  const filePath = getFilePath(id);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch {
      // ignore
    }
  }

  // Also attempt Supabase removal in dev mode
  try {
    const admin = getAdminClient();
    await admin.from("scan_sessions").delete().eq("id", id);
  } catch {
    // ignore
  }

  return { success: true, status: 200 };
}
