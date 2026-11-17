"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";
import { createClient } from "@/utils/supabase/client";
import Tesseract from "tesseract.js";
import { extractReceiptData } from "@/lib/receipt-extraction";
import { preprocessReceiptImage } from "@/lib/image-processing";

// ---------------------------------------------------------------------------
// Category mapping — keyword-based heuristic
// ---------------------------------------------------------------------------

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "Transportation": ["uber", "ola", "metro", "rapido", "lyft", "grab", "taxi", "cab", "bus", "train", "flight", "airways"],
  "Food & Dining": ["swiggy", "zomato", "restaurant", "cafe", "coffee", "pizza", "burger", "mcdonald", "starbucks", "domino", "kfc", "subway", "food", "dining", "bistro", "bakery"],
  "Shopping": ["amazon", "flipkart", "myntra", "ajio", "walmart", "target", "mall", "mart", "store", "retail"],
  "Healthcare": ["pharmacy", "hospital", "medical", "clinic", "apollo", "medplus", "doctor", "health", "diagnostic", "lab"],
};

function inferCategoryName(merchant: string, rawText: string): string {
  const combined = `${merchant} ${rawText}`.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (combined.includes(kw)) return category;
    }
  }
  return "Other";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface CategoryRow {
  id: string;
  name: string;
  icon: string;
}

export default function ScannerPage() {
  const router = useRouter();
  const { language } = useLanguage();
  const translations: Record<string, string> = {
    "English (US)": "Receipt Scanner",
    "English (UK)": "Receipt Scanner",
    "Hindi": "रसीद स्कैनर",
    "Spanish": "Escáner de Recibos",
    "French": "Scanner de Reçus",
  };
  const pageTitle = translations[language] || translations["English (US)"];

  // --- state ---------------------------------------------------------------
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [, setFile] = useState<File | null>(null);
  const [qrUrl, setQrUrl] = useState<string>("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pairingToken, setPairingToken] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(900); // 15 minutes

  // Initialize scan session
  useEffect(() => {
    const createSession = async () => {
      try {
        const res = await fetch("/api/scan-session", { method: "POST" });
        const data = await res.json();
        if (data.id) setSessionId(data.id);
        if (data.token) setPairingToken(data.token);
      } catch (err) {
        console.error("Failed to create scan session:", err);
      }
    };
    createSession();
  }, []);

  // OCR results
  const [ocrText, setOcrText] = useState<string>("");
  const [ocrDone, setOcrDone] = useState(false);
  const [ocrError, setOcrError] = useState<string>("");
  const [ocrConfidence, setOcrConfidence] = useState<number>(0);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [parsedFields, setParsedFields] = useState<{
    merchant: string | null;
    amount: string | null;
    date: string | null;
  }>({ merchant: null, amount: null, date: null });

  // Expense creation
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [editMerchant, setEditMerchant] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState("");

  // --- Fetch categories & user on mount ------------------------------------
  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);

      const { data: cats } = await supabase.from("categories").select("*").order("name");
      if (cats) setCategories(cats);
    };
    init();
  }, []);

  // --- QR generation -------------------------------------------------------
  // Automatically resolves LAN IP if on localhost, ensuring mobile devices on the same Wi-Fi can open the upload page.
  useEffect(() => {
    if (!sessionId || !pairingToken) return;
    let isCancelled = false;

    const resolveQrUrl = async () => {
      let baseOrigin = window.location.origin;
      if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
        try {
          const res = await fetch("/api/network-info");
          if (res.ok) {
            const data = await res.json();
            if (data.ip && data.ip !== "localhost") {
              const port = window.location.port ? `:${window.location.port}` : "";
              baseOrigin = `http://${data.ip}${port}`;
            }
          }
        } catch {
          // fallback to origin
        }
      }
      if (isCancelled) return;
      const uploadUrl = `${baseOrigin}/scan-upload?id=${sessionId}&token=${pairingToken}`;
      console.log("[scanner] QR URL:", uploadUrl);
      setQrUrl(
        `https://api.qrserver.com/v1/create-qr-code/?size=250x250&ecc=H&margin=2&data=${encodeURIComponent(uploadUrl)}`
      );
    };

    resolveQrUrl();
    return () => {
      isCancelled = true;
    };
  }, [sessionId, pairingToken]);

  // --- QR countdown + auto-refresh -----------------------------------------
  useEffect(() => {
    if (!sessionId) return;

    const tick = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Timer hit zero: rotate session
          clearInterval(tick);
          // Invalidate old session securely with pairing token, then create fresh one
          if (sessionId && pairingToken) {
            fetch(`/api/scan-session?id=${sessionId}&token=${pairingToken}`, { method: "DELETE" }).catch(() => {});
          }
          fetch("/api/scan-session", { method: "POST" })
            .then((res) => res.json())
            .then((data) => {
              if (data.id) setSessionId(data.id);
              if (data.token) setPairingToken(data.token);
            })
            .catch((err) => console.error("Failed to refresh scan session:", err));
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(tick);
  }, [sessionId, pairingToken]);

  // --- Clean up object URL on unmount / new file ---------------------------
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // --- Find category ID by name -------------------------------------------
  const findCategoryId = useCallback(
    (name: string): string => {
      // Exact match
      const exact = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
      if (exact) return exact.id;
      // Partial match
      const partial = categories.find((c) => c.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(c.name.toLowerCase()));
      if (partial) return partial.id;
      // Fallback to "Other" or first category
      const other = categories.find((c) => c.name.toLowerCase() === "other");
      return other?.id || categories[0]?.id || "";
    },
    [categories]
  );

  // --- Real OCR pipeline with Preprocessing & Multi-Field Extraction ---
  const processReceipt = useCallback(async (selectedFile: File) => {
    // Reset everything
    setOcrText("");
    setOcrDone(false);
    setOcrError("");
    setOcrConfidence(0);
    setParsedFields({ merchant: null, amount: null, date: null });
    setFile(selectedFile);
    setUploading(true);
    setProgress(0);
    setShowConfirm(false);
    setSaveSuccess(false);
    setSaveError("");
    setDuplicateWarning("");

    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);

    // Save image to sessionStorage for review page
    if (typeof window !== "undefined") {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          try {
            sessionStorage.setItem("lastReceiptImage", reader.result);
          } catch {
            // sessionStorage might exceed quota for large raw images
          }
        }
      };
      reader.readAsDataURL(selectedFile);
    }

    try {
      // 1. Image Preprocessing (orientation, contrast enhancement, denoising)
      let fileToOcr: File | Blob = selectedFile;
      try {
        const { processedBlob } = await preprocessReceiptImage(selectedFile, {
          grayscale: true,
          enhanceContrast: true,
          denoise: true,
        });
        fileToOcr = processedBlob;
      } catch (prepErr) {
        console.warn("Preprocessing skipped, processing original image:", prepErr);
      }

      // 2. Client-side OCR via Tesseract.js
      const result = await Tesseract.recognize(fileToOcr, "eng", {
        logger: (info) => {
          if (info.status === "recognizing text" && typeof info.progress === "number") {
            setProgress(Math.round(info.progress * 100));
          }
        },
      });

      const rawText = result.data.text;
      setOcrText(rawText);

      // 3. High-precision extraction and arithmetic cross-validation
      const extracted = extractReceiptData(rawText);
      setOcrConfidence(extracted.confidence.overall);

      setParsedFields({
        merchant: extracted.merchant,
        amount: extracted.total !== null ? String(extracted.total) : null,
        date: extracted.date,
      });
      setOcrDone(true);

      // Pre-fill the confirmation form
      setEditMerchant(extracted.merchant || "");
      setEditAmount(extracted.total !== null ? String(extracted.total) : "");
      setEditDate(extracted.date || new Date().toISOString().split("T")[0]);

      // Auto-detect category
      const catName = inferCategoryName(extracted.merchant || "", rawText);
      setTimeout(() => {
        setEditCategoryId((prev) => {
          if (prev) return prev;
          return findCategoryId(catName);
        });
      }, 0);

      // Show confirmation dialog for verification
      setShowConfirm(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "OCR processing failed.";
      setOcrError(message);
    } finally {
      setUploading(false);
    }
  }, [findCategoryId]);

  // --- Poll for scan session upload ----------------------------------------
  useEffect(() => {
    if (!sessionId || !pairingToken || ocrDone || uploading) return;

    const interval = setInterval(async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      try {
        const res = await fetch(`/api/scan-session?id=${sessionId}&token=${pairingToken}`, {
          signal: controller.signal,
          cache: "no-store",
        });

        clearTimeout(timeout);

        if (!res.ok) return;

        const data = await res.json();

        if (data.status === "uploaded" && data.image) {
          clearInterval(interval);

          const dataUrl: string = data.image;
          let file: File;

          if (dataUrl.startsWith("http://") || dataUrl.startsWith("https://")) {
            const resp = await fetch(dataUrl);
            const blob = await resp.blob();
            file = new File([blob], data.fileName || "receipt.jpg", {
              type: blob.type || "image/jpeg",
            });
          } else {
            const mimeMatch = dataUrl.match(/^data:([^;]+);base64,/);
            const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";

            const base64 = dataUrl.replace(/^data:[^;]+;base64,/, "");
            const binary = atob(base64);

            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
              bytes[i] = binary.charCodeAt(i);
            }

            const blob = new Blob([bytes], { type: mimeType });
            file = new File([blob], data.fileName || "receipt.jpg", { type: mimeType });
          }

          processReceipt(file);
        }
      } catch (err) {
        console.error("Polling failed or timed out:", err);
      } finally {
        clearTimeout(timeout);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [sessionId, pairingToken, ocrDone, uploading, processReceipt]);

  // --- Duplicate detection -------------------------------------------------
  const checkDuplicate = useCallback(async (): Promise<boolean> => {
    if (!userId || !editAmount) return false;
    const supabase = createClient();
    const amount = parseFloat(editAmount);
    if (isNaN(amount)) return false;

    const { data } = await supabase
      .from("expenses")
      .select("id")
      .eq("user_id", userId)
      .eq("amount", amount)
      .eq("store", editMerchant.trim())
      .eq("date", editDate)
      .limit(1);

    return !!(data && data.length > 0);
  }, [userId, editAmount, editMerchant, editDate]);

  // --- Save expense --------------------------------------------------------
  const handleSaveExpense = async () => {
    setSaveError("");
    setDuplicateWarning("");

    if (!editMerchant.trim()) {
      setSaveError("Please enter a merchant name.");
      return;
    }
    const amount = parseFloat(editAmount);
    if (isNaN(amount) || amount <= 0) {
      setSaveError("Please enter a valid positive amount.");
      return;
    }
    if (!editDate) {
      setSaveError("Please enter a date.");
      return;
    }
    if (!editCategoryId) {
      setSaveError("Please select a category.");
      return;
    }
    if (!userId) {
      setSaveError("User session not found. Please log in again.");
      return;
    }

    setSaving(true);

    try {
      // Check for duplicates
      const isDuplicate = await checkDuplicate();
      if (isDuplicate) {
        setDuplicateWarning(`An expense with the same merchant ("${editMerchant.trim()}"), amount (₹${amount.toFixed(2)}), and date (${editDate}) already exists. Save again to create anyway.`);
        setSaving(false);
        return;
      }

      await insertExpense(amount);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save expense.";
      setSaveError(msg);
      setSaving(false);
    }
  };

  // Force save (bypass duplicate warning)
  const handleForceSave = async () => {
    setSaveError("");
    setDuplicateWarning("");
    const amount = parseFloat(editAmount);
    if (isNaN(amount) || amount <= 0 || !userId || !editCategoryId) return;
    setSaving(true);
    try {
      await insertExpense(amount);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save expense.";
      setSaveError(msg);
      setSaving(false);
    }
  };

  const insertExpense = async (amount: number) => {
    const supabase = createClient();
    const wasAltered = parsedFields.amount !== editAmount || parsedFields.merchant !== editMerchant.trim();
    const isUnspecified = !editMerchant.trim() || editMerchant.trim().toLowerCase() === "unspecified merchant";
    const status = (ocrConfidence >= 65 && !wasAltered && !isUnspecified) ? "Verified" : "Pending";

    const { error: insertError } = await supabase.from("expenses").insert([
      {
        user_id: userId,
        store: editMerchant.trim() || "Unspecified Merchant",
        category_id: editCategoryId,
        amount,
        date: editDate,
        status,
      },
    ]);

    if (insertError) throw new Error(insertError.message);

    setSaving(false);
    setSaveSuccess(true);

    // Redirect to /expenses after a brief delay so user sees the success message
    setTimeout(() => {
      router.push("/expenses");
    }, 1500);
  };

  // --- Drag & drop handler -------------------------------------------------
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        processReceipt(e.dataTransfer.files[0]);
      }
    },
    [processReceipt]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // --- Reset handler -------------------------------------------------------
  const resetScanner = () => {
    setFile(null);
    setUploading(false);
    setProgress(0);
    setOcrText("");
    setOcrDone(false);
    setOcrError("");
    setOcrConfidence(0);
    setParsedFields({ merchant: null, amount: null, date: null });
    setShowConfirm(false);
    setSaveSuccess(false);
    setSaveError("");
    setDuplicateWarning("");
    setEditMerchant("");
    setEditAmount("");
    setEditDate("");
    setEditCategoryId("");
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    // Fetch a new session ID for subsequent uploads
    setSessionId(null);
    fetch("/api/scan-session", { method: "POST" })
      .then((res) => res.json())
      .then((data) => {
        if (data.id) setSessionId(data.id);
      })
      .catch((err) => console.error("Failed to create new scan session:", err));
  };

  // --- Get category name for display ---------------------------------------
  const getCategoryName = (id: string) => categories.find((c) => c.id === id)?.name || "";

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div className="w-full">
      <div className="mb-8">
        <h2 className="font-headline-lg text-headline-lg font-bold text-on-surface mb-2">{pageTitle}</h2>
        <p className="font-body-md text-body-md text-on-surface-variant">AI-powered extraction for instant expense creation.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
        {/* Left Column: Scanner Area */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Drag & Drop Zone */}
          <div
            className="glass-panel dashed-gradient-border p-12 flex flex-col items-center justify-center text-center hover:bg-surface-container-low/50 transition-colors min-h-[400px] relative group overflow-hidden"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            {/* Decorative background element */}
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary-container/10 rounded-full blur-3xl group-hover:bg-primary-container/20 transition-all duration-500 pointer-events-none" />

            <div className="w-20 h-20 bg-surface rounded-full shadow-sm flex items-center justify-center mb-6 relative z-10 text-primary">
              <span className="material-symbols-outlined text-[40px]" style={{ fontVariationSettings: "'wght' 300" }}>
                document_scanner
              </span>
            </div>

            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold mb-2 relative z-10">
              Drag &amp; Drop receipt here
            </h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant mb-8 max-w-md relative z-10">
              Supports JPG, PNG, WebP up to 10MB. Tesseract.js extracts text locally in your browser — nothing is uploaded to a server.
            </p>

            <div className="flex gap-4 relative z-10">
              <label className="bg-primary text-white font-label-md text-label-md py-3 px-6 rounded-lg hover:bg-on-primary-fixed-variant transition-colors shadow-sm flex items-center gap-2 cursor-pointer focus:outline-none">
                <span className="material-symbols-outlined text-[18px]">upload_file</span>
                Upload File
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      processReceipt(e.target.files[0]);
                      e.target.value = "";
                    }
                  }}
                />
              </label>
              <label className="bg-surface border border-outline-variant text-on-surface font-label-md text-label-md py-3 px-6 rounded-lg hover:bg-surface-container-low transition-colors flex items-center gap-2 cursor-pointer focus:outline-none">
                <span className="material-symbols-outlined text-[18px]">photo_camera</span>
                Take Photo
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      processReceipt(e.target.files[0]);
                      e.target.value = "";
                    }
                  }}
                />
              </label>
            </div>
          </div>

          {/* OCR Processing Status */}
          <div className="glass-panel p-6 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-4 w-full">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${uploading ? "bg-primary/10 text-primary animate-spin" : ocrDone ? "bg-tertiary/10 text-tertiary" : ocrError ? "bg-error/10 text-error" : "bg-surface-container text-on-surface-variant"}`}>
                <span className="material-symbols-outlined">
                  {uploading ? "sync" : ocrDone ? "check_circle" : ocrError ? "error" : "hourglass_empty"}
                </span>
              </div>
              <div className="flex-1">
                <h4 className="font-label-md text-label-md text-on-surface font-semibold">
                  {uploading
                    ? `Extracting text… ${progress}%`
                    : ocrDone
                      ? `Extraction complete — ${ocrConfidence}% confidence`
                      : ocrError
                        ? "Extraction failed"
                        : "Ready to process"}
                </h4>
                {uploading ? (
                  <div className="w-full bg-surface-container-high h-1.5 rounded-full mt-2 overflow-hidden">
                    <div className="bg-primary h-1.5 transition-all duration-150" style={{ width: `${progress}%` }} />
                  </div>
                ) : ocrError ? (
                  <p className="font-label-sm text-label-sm text-error mt-1">{ocrError}</p>
                ) : !ocrDone ? (
                  <p className="font-label-sm text-label-sm text-on-surface-variant">
                    Upload a document to begin AI extraction.
                  </p>
                ) : null}
              </div>
              {ocrDone && (
                <button
                  onClick={resetScanner}
                  className="shrink-0 bg-surface border border-outline-variant text-on-surface font-label-md text-label-md py-2 px-4 rounded-lg hover:bg-surface-container-low transition-colors flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">restart_alt</span>
                  Scan Another
                </button>
              )}
            </div>
          </div>

          {/* ---- Success Banner ---- */}
          {saveSuccess && (
            <div className="glass-panel p-6 rounded-xl border-l-4 border-l-primary bg-primary/5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined">task_alt</span>
              </div>
              <div>
                <h4 className="font-label-md text-label-md text-on-surface font-semibold">Expense saved successfully!</h4>
                <p className="font-label-sm text-label-sm text-on-surface-variant">Redirecting to expenses…</p>
              </div>
            </div>
          )}

          {/* ---- OCR Results + Confirmation Form ---- */}
          {ocrDone && !saveSuccess && (
            <div className="glass-panel p-6 rounded-xl flex flex-col gap-6">
              {/* Extracted Fields (read-only summary) */}
              <div>
                <h3 className="font-label-md text-label-md font-semibold text-on-surface mb-4 uppercase tracking-wider flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-primary">auto_awesome</span>
                  Extracted Fields
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-surface-container-low rounded-lg p-4">
                    <p className="font-label-sm text-label-sm text-on-surface-variant mb-1">Merchant</p>
                    <p className="font-label-md text-label-md text-on-surface font-semibold truncate">
                      {parsedFields.merchant ?? <span className="text-on-surface-variant italic font-normal">Not detected</span>}
                    </p>
                  </div>
                  <div className="bg-surface-container-low rounded-lg p-4">
                    <p className="font-label-sm text-label-sm text-on-surface-variant mb-1">Total Amount</p>
                    <p className="font-label-md text-label-md text-on-surface font-semibold">
                      {parsedFields.amount ? `₹${parsedFields.amount}` : <span className="text-on-surface-variant italic font-normal">Not detected</span>}
                    </p>
                  </div>
                  <div className="bg-surface-container-low rounded-lg p-4">
                    <p className="font-label-sm text-label-sm text-on-surface-variant mb-1">Date</p>
                    <p className="font-label-md text-label-md text-on-surface font-semibold">
                      {parsedFields.date ?? <span className="text-on-surface-variant italic font-normal">Not detected</span>}
                    </p>
                  </div>
                </div>
              </div>

              {/* Confirmation / Edit Form */}
              {showConfirm && (
                <div className="border-t border-outline-variant/30 pt-6">
                  <h3 className="font-label-md text-label-md font-semibold text-on-surface mb-1 uppercase tracking-wider flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-tertiary">edit_note</span>
                    {ocrConfidence < 50 ? "Low Confidence — Please Verify" : "Confirm & Save Expense"}
                  </h3>
                  {ocrConfidence < 50 && (
                    <p className="font-label-sm text-label-sm text-on-surface-variant mb-4">
                      OCR confidence is {ocrConfidence}%. Please review and correct the fields below before saving.
                    </p>
                  )}

                  {/* Duplicate warning */}
                  {duplicateWarning && (
                    <div className="mb-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-700 dark:text-yellow-400 text-sm flex items-start gap-3">
                      <span className="material-symbols-outlined text-[20px] mt-0.5 shrink-0">warning</span>
                      <div>
                        <p className="font-semibold mb-1">Possible duplicate detected</p>
                        <p>{duplicateWarning}</p>
                        <button
                          onClick={handleForceSave}
                          disabled={saving}
                          className="mt-2 text-sm font-semibold underline hover:no-underline"
                        >
                          {saving ? "Saving…" : "Save anyway"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Save error */}
                  {saveError && (
                    <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-sm">
                      {saveError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    {/* Merchant */}
                    <div>
                      <label className="block font-label-md text-label-md text-on-surface mb-1" htmlFor="edit-merchant">
                        Merchant / Store
                      </label>
                      <input
                        id="edit-merchant"
                        type="text"
                        placeholder="e.g. Starbucks"
                        className="w-full px-3 py-2.5 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent font-body-sm text-body-sm"
                        value={editMerchant}
                        onChange={(e) => setEditMerchant(e.target.value)}
                      />
                    </div>
                    {/* Amount */}
                    <div>
                      <label className="block font-label-md text-label-md text-on-surface mb-1" htmlFor="edit-amount">
                        Amount (₹)
                      </label>
                      <input
                        id="edit-amount"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="e.g. 450.00"
                        className="w-full px-3 py-2.5 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent font-body-sm text-body-sm"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                      />
                    </div>
                    {/* Date */}
                    <div>
                      <label className="block font-label-md text-label-md text-on-surface mb-1" htmlFor="edit-date">
                        Date
                      </label>
                      <input
                        id="edit-date"
                        type="date"
                        className="w-full px-3 py-2.5 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent font-body-sm text-body-sm"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                      />
                    </div>
                    {/* Category */}
                    <div>
                      <label className="block font-label-md text-label-md text-on-surface mb-1" htmlFor="edit-category">
                        Category
                        {editCategoryId && (
                          <span className="ml-2 text-on-surface-variant font-normal text-xs">
                            (auto: {getCategoryName(editCategoryId)})
                          </span>
                        )}
                      </label>
                      <select
                        id="edit-category"
                        className="w-full px-3 py-2.5 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent font-body-sm text-body-sm"
                        value={editCategoryId}
                        onChange={(e) => setEditCategoryId(e.target.value)}
                      >
                        <option value="" disabled>Select a category</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Save button */}
                  {!duplicateWarning && (
                    <button
                      onClick={handleSaveExpense}
                      disabled={saving || !editAmount || parseFloat(editAmount) <= 0}
                      title={!editAmount || parseFloat(editAmount) <= 0 ? "Total amount must be confirmed before saving" : ""}
                      className="w-full sm:w-auto py-3 px-8 bg-primary text-on-primary font-label-md text-label-md rounded-lg shadow-sm hover:opacity-95 transition-opacity font-bold flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
                    >
                      <span className="material-symbols-outlined text-[18px]">save</span>
                      {saving ? "Saving…" : "Save Expense"}
                    </button>
                  )}
                </div>
              )}

              {/* Image preview + Raw text side-by-side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {previewUrl && (
                  <div>
                    <p className="font-label-sm text-label-sm text-on-surface-variant mb-2">Uploaded Image</p>
                    <div className="rounded-lg overflow-hidden border border-outline-variant bg-surface-container-low">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={previewUrl} alt="Receipt preview" className="w-full h-auto max-h-[400px] object-contain" />
                    </div>
                  </div>
                )}
                <div>
                  <p className="font-label-sm text-label-sm text-on-surface-variant mb-2">Raw Extracted Text</p>
                  <pre className="bg-surface-container-low rounded-lg p-4 text-on-surface font-body-sm text-body-sm whitespace-pre-wrap break-words max-h-[400px] overflow-y-auto border border-outline-variant">
                    {ocrText || "No text was detected in this image."}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Sidebar */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Camera Upload / QR Code */}
          <div className="glass-panel p-6 rounded-xl flex flex-col items-center text-center border-t-4 border-t-tertiary">
            <div className="w-12 h-12 rounded-full bg-tertiary/10 text-tertiary flex items-center justify-center mb-4">
              <span className="material-symbols-outlined">qr_code_scanner</span>
            </div>
            <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface mb-2">Scan with Mobile</h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant mb-6">
              Point your phone camera here to securely upload receipts directly from your device.
            </p>
            <div className="bg-white p-2 rounded-lg mb-4 shadow-sm w-[250px] h-[250px] mx-auto flex items-center justify-center">
              {qrUrl ? (
                <Image
                  src={qrUrl}
                  alt="QR Code to upload receipt from mobile"
                  width={234}
                  height={234}
                  unoptimized
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full bg-surface-container-high animate-pulse rounded" />
              )}
            </div>
            <p className="font-label-sm text-label-sm text-on-surface-variant">
              Session valid for{" "}
              <span className={timeLeft <= 60 ? "text-error font-semibold" : ""}>
                {String(Math.floor(timeLeft / 60)).padStart(2, "0")}:{String(timeLeft % 60).padStart(2, "0")}
              </span>
            </p>
          </div>

          {/* Tips */}
          <div className="glass-panel p-6 rounded-xl">
            <h3 className="font-label-md text-label-md font-semibold text-on-surface mb-4 uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-primary">lightbulb</span>
              Scanning Tips
            </h3>
            <ul className="space-y-4 text-left">
              <li className="flex gap-3">
                <span className="material-symbols-outlined text-primary mt-0.5 text-[20px]">check_circle</span>
                <div>
                  <h4 className="font-label-md text-label-md text-on-surface font-semibold">Ensure Good Lighting</h4>
                  <p className="font-label-sm text-label-sm text-on-surface-variant">
                    Avoid shadows and glare on the receipt.
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="material-symbols-outlined text-primary mt-0.5 text-[20px]">check_circle</span>
                <div>
                  <h4 className="font-label-md text-label-md text-on-surface font-semibold">Flatten Document</h4>
                  <p className="font-label-sm text-label-sm text-on-surface-variant">
                    Smooth out wrinkles for accurate OCR reading.
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="material-symbols-outlined text-primary mt-0.5 text-[20px]">check_circle</span>
                <div>
                  <h4 className="font-label-md text-label-md text-on-surface font-semibold">Dark Background</h4>
                  <p className="font-label-sm text-label-sm text-on-surface-variant">
                    Place white receipts on a dark surface for contrast.
                  </p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
