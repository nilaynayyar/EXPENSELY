import { NextRequest, NextResponse } from "next/server";
import {
  getScanSession,
  verifySessionToken,
  updateScanSessionImage,
  isValidUUID,
  isValidToken,
} from "@/lib/scan-session";
import { getAdminClient } from "@/lib/supabase-admin";
import { createClient } from "@/utils/supabase/server";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const id = (formData.get("id") || formData.get("sessionId")) as string;
    const token = ((formData.get("token") || formData.get("pairingToken") || req.nextUrl.searchParams.get("token")) as string) || "";
    const file = formData.get("file") as File;

    if (!id || !isValidUUID(id)) {
      return NextResponse.json({ error: "A valid UUID session ID is required" }, { status: 400 });
    }

    if (!token || !isValidToken(token)) {
      return NextResponse.json({ error: "A valid pairing token is required" }, { status: 400 });
    }

    if (!file) {
      return NextResponse.json({ error: "No file was uploaded" }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Invalid file format. Please upload a JPEG, PNG, WebP, HEIC, or PDF receipt." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File exceeds 10MB limit. Please upload a smaller image." },
        { status: 400 }
      );
    }

    // 1. INDEPENDENT AUTHORIZATION BEFORE STORAGE UPLOAD
    // Service-role client bypasses Storage RLS, so session existence, cryptographic pairing token,
    // expiration, and pending status MUST be strictly verified BEFORE writing any bytes to storage.
    const session = await getScanSession(id);
    if (!session) {
      return NextResponse.json({ error: "Session has expired or does not exist" }, { status: 404 });
    }

    if (!verifySessionToken(session, token)) {
      return NextResponse.json({ error: "Unauthorized: Invalid pairing token" }, { status: 403 });
    }

    if (session.status !== "pending") {
      return NextResponse.json(
        { error: "Conflict: This session has already received an upload or is no longer pending" },
        { status: 409 }
      );
    }

    // 2. Safely process and sanitize upload
    const buffer = Buffer.from(await file.arrayBuffer());
    let imageUrl = `data:${file.type};base64,${buffer.toString("base64")}`;
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const storagePath = `scan-sessions/${id}/${Date.now()}-${sanitizedFileName}`;
    let uploadedToStorage = false;

    // Attempt to upload to Supabase storage bucket 'receipts' if available
    try {
      const admin = getAdminClient();
      const { data: uploadData, error: uploadErr } = await admin.storage
        .from("receipts")
        .upload(storagePath, buffer, { contentType: file.type, upsert: true });

      if (uploadErr) {
        console.warn("[Upload API] Supabase storage upload notice (falling back to inline data URL):", uploadErr.message);
      } else if (uploadData) {
        uploadedToStorage = true;
        // Generate short-lived (15 minute / 900 second) signed URL
        const { data: signedData, error: signedErr } = await admin.storage
          .from("receipts")
          .createSignedUrl(storagePath, 900);

        if (!signedErr && signedData?.signedUrl) {
          imageUrl = signedData.signedUrl;
        }
      }
    } catch (err: unknown) {
      console.warn("[Upload API] Storage operation notice (using data URL fallback):", err);
    }

    // 3. Optional Direct Account Expense Creation
    let createdExpenseId: string | null = null;
    let createdExpenseData: Record<string, unknown> | null = null;

    const shouldCreateExpense = formData.get("createExpense") !== "false";
    let targetUserId = session.userId;
    if (!targetUserId) {
      try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) targetUserId = user.id;
      } catch {
        // ignore
      }
    }

    if (shouldCreateExpense && targetUserId) {
      try {
        const admin = getAdminClient();
        const storeName = (formData.get("store") as string)?.trim() || "Receipt Scan";
        const rawAmount = formData.get("amount") as string;
        const parsedAmount = rawAmount ? parseFloat(rawAmount) : 0;
        const expenseDate = (formData.get("date") as string) || new Date().toISOString().split("T")[0];
        let resolvedCategoryId = (formData.get("categoryId") as string) || null;
        const categoryNameInput = (formData.get("category") as string)?.trim();
        if (!resolvedCategoryId && categoryNameInput) {
          try {
            const { data: matchedCat } = await admin
              .from("categories")
              .select("id")
              .ilike("name", categoryNameInput)
              .maybeSingle();
            if (matchedCat?.id) {
              resolvedCategoryId = matchedCat.id;
            }
          } catch {
            // ignore
          }
        }

        const { data: newExpense, error: expErr } = await admin
          .from("expenses")
          .insert([
            {
              user_id: targetUserId,
              store: storeName,
              amount: isNaN(parsedAmount) ? 0 : parsedAmount,
              date: expenseDate,
              category_id: resolvedCategoryId || null,
              status: "Pending",
              receipt_url: imageUrl.startsWith("data:") ? null : imageUrl,
            },
          ])
          .select("id, store, amount, date, status, receipt_url")
          .single();

        if (!expErr && newExpense) {
          createdExpenseId = newExpense.id;
          createdExpenseData = newExpense;
        } else if (expErr) {
          console.warn("[Upload API] Direct expense creation notice:", expErr.message);
        }
      } catch (expInsertErr) {
        console.warn("[Upload API] Direct expense insert error:", expInsertErr);
      }
    }

    // 4. Perform atomic state transition
    const updateResult = await updateScanSessionImage(id, token, imageUrl, file.name, file.type, createdExpenseId);
    if (!updateResult.success) {
      // If atomic DB transition failed (e.g. concurrent race condition), clean up uploaded storage object
      if (uploadedToStorage) {
        try {
          const admin = getAdminClient();
          await admin.storage.from("receipts").remove([storagePath]);
        } catch {
          // ignore cleanup error
        }
      }
      return NextResponse.json(
        { error: updateResult.error },
        { status: updateResult.status || 500 }
      );
    }

    return NextResponse.json({
      success: true,
      fileName: file.name,
      expenseId: createdExpenseId,
      expense: createdExpenseData,
      account: session.userId
        ? {
            id: session.userId,
            email: session.userEmail,
            name: session.userName,
          }
        : null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to upload file";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
