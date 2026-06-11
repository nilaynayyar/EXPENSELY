"use client";

import { useState, useEffect, Suspense } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// UploadForm — mounted inside <Suspense> so Next.js streaming SSR is satisfied.
// sessionId is derived ONCE from window.location.search on mount.
// No useSearchParams — eliminates hydration race conditions on mobile.
// ─────────────────────────────────────────────────────────────────────────────
function UploadForm() {
  // Single source of truth for the session identifier.
  const [sessionId, setSessionId] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string>("");

  // "checking" → API call in-flight
  // "valid"    → session confirmed by server, show upload UI
  // "expired"  → session missing / timed out / server error
  const [sessionStatus, setSessionStatus] = useState<"checking" | "valid" | "expired">("checking");

  // ── Step 1: extract sessionId from URL exactly once on mount ──────────────
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    console.log("[scan-upload] mount — id from URL:", id);
    if (!id) {
      setSessionStatus("expired");
      return;
    }
    setSessionId(id); // triggers Step 2
  }, []); // intentionally empty — runs once

  // ── Step 2: validate session against the API once sessionId is available ──
  useEffect(() => {
    if (!sessionId) return; // wait for Step 1

    setSessionStatus("checking");

    // ONE AbortController, ONE timeout — no Promise.race, no layered timers.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.warn("[scan-upload] Validation timed out (10 s) — aborting fetch.");
      controller.abort();
    }, 10000);

    // Mounted guard prevents state updates after unmount (React strict-mode safety).
    let mounted = true;

    (async () => {
      // Fail-safe default: if anything goes wrong → show expired UI.
      let nextStatus: "valid" | "expired" = "expired";

      const url = `/api/scan-session?id=${sessionId}`;
      console.log("[scan-upload] Fetching:", url);

      try {
        const res = await fetch(url, {
          signal: controller.signal,
          cache: "no-store",
        });

        console.log("[scan-upload] Response status:", res.status, "ok:", res.ok);

        if (!res.ok) {
          // 404 = session not found / expired; any non-2xx = expired
          nextStatus = "expired";
        } else {
          const raw = await res.text();
          console.log("[scan-upload] Response body:", raw);

          try {
            const data = JSON.parse(raw) as Record<string, unknown>;
            if (data.status === "pending" || data.status === "uploaded") {
              nextStatus = "valid";
            } else {
              console.warn("[scan-upload] Unexpected data.status:", data.status);
              nextStatus = "expired";
            }
          } catch (jsonErr) {
            console.error("[scan-upload] JSON parse error:", jsonErr, "| raw:", raw);
            nextStatus = "expired";
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          console.warn("[scan-upload] Fetch aborted (timeout or unmount).");
        } else {
          console.error("[scan-upload] Fetch threw:", err);
        }
        nextStatus = "expired";
      } finally {
        clearTimeout(timeoutId);
      }

      // Unconditional — every code path above has set nextStatus.
      if (mounted) {
        console.log("[scan-upload] → setSessionStatus:", nextStatus);
        setSessionStatus(nextStatus);
      }
    })();

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [sessionId]); // runs once after Step 1 sets sessionId

  // ── Revoke blob URL on cleanup ────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // ── Render gate ───────────────────────────────────────────────────────────
  if (sessionStatus === "checking") {
    return (
      <div className="glass-panel p-8 rounded-2xl max-w-md w-full text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-body-md text-on-surface-variant">Validating session…</p>
      </div>
    );
  }

  if (sessionStatus === "expired") {
    return (
      <div className="glass-panel p-8 rounded-2xl max-w-md w-full border border-error/20 bg-error/5 text-center">
        <div className="w-16 h-16 bg-error/10 text-error rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="material-symbols-outlined text-[36px]">timer_off</span>
        </div>
        <h2 className="text-headline-sm font-bold text-on-surface mb-3">Session Expired</h2>
        <p className="text-body-sm text-on-surface-variant mb-2">
          This QR code is no longer valid.
        </p>
        <p className="text-body-sm text-on-surface-variant">
          Please return to your computer and generate a new QR code.
        </p>
      </div>
    );
  }

  // ── sessionStatus === "valid" ─────────────────────────────────────────────
  // sessionId is guaranteed non-null here (Step 1 set it before Step 2 ran).

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      setError("");
      setPreviewUrl(URL.createObjectURL(selected));
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select or capture a receipt image first.");
      return;
    }
    if (!sessionId) {
      setError("Session ID is missing. Please rescan the QR code.");
      return;
    }

    setUploading(true);
    setError("");
    setUploadProgress(10);

    try {
      const formData = new FormData();
      formData.append("id", sessionId);
      formData.append("file", file);

      const interval = setInterval(() => {
        setUploadProgress((p) => (p < 80 ? p + 15 : p));
      }, 150);

      const res = await fetch("/api/scan-session/upload", {
        method: "POST",
        body: formData,
      });

      clearInterval(interval);
      setUploadProgress(100);

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to upload image");
      }

      setSuccess(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(msg);
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  };

  if (success) {
    return (
      <div className="glass-panel p-8 rounded-2xl max-w-md w-full text-center border-t-4 border-t-primary animate-fade-in">
        <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="material-symbols-outlined text-[36px]">task_alt</span>
        </div>
        <h2 className="text-headline-sm font-bold text-on-surface mb-2">Upload Complete!</h2>
        <p className="text-body-md text-on-surface-variant mb-6">
          Your receipt has been successfully uploaded to the desktop application.
        </p>
        <p className="text-label-sm text-on-surface-variant bg-surface-container-low py-3 px-4 rounded-lg inline-block border border-outline-variant/30">
          You can now verify the details and save the expense on your desktop screen.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-panel p-8 rounded-2xl max-w-md w-full border border-outline-variant/30 relative overflow-hidden">
      {/* Decorative gradient blob */}
      <div className="absolute -top-20 -right-20 w-48 h-48 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col items-center text-center mb-6">
        <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-3">
          <span className="material-symbols-outlined">photo_camera</span>
        </div>
        <h2 className="text-headline-sm font-bold text-on-surface mb-1">Upload Receipt</h2>
        <p className="text-body-sm text-on-surface-variant">
          Take a photo or choose an existing image of your receipt.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm">
          {error}
        </div>
      )}

      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center">
          {previewUrl ? (
            <div className="relative rounded-xl overflow-hidden border border-outline-variant bg-surface-container-low max-h-[250px] w-full flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Preview" className="max-h-[250px] object-contain w-full" />
              <button
                onClick={() => {
                  setFile(null);
                  setPreviewUrl("");
                }}
                className="absolute top-2 right-2 bg-surface/85 hover:bg-surface text-on-surface rounded-full p-2 shadow transition-colors flex items-center justify-center"
                title="Remove photo"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          ) : (
            <div className="w-full">
              <label
                htmlFor="mobile-file-input"
                className="dashed-gradient-border p-8 rounded-xl flex flex-col items-center justify-center text-center cursor-pointer hover:bg-surface-container-low/35 transition-colors min-h-[180px]"
              >
                <span className="material-symbols-outlined text-[36px] text-primary mb-2">add_a_photo</span>
                <span className="text-label-md font-semibold text-on-surface">Capture or Choose Image</span>
                <span className="text-label-sm text-on-surface-variant mt-1">Supports PNG, JPG, WebP</span>
                <input
                  id="mobile-file-input"
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
            </div>
          )}
        </div>

        {file && (
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="w-full py-3 px-6 bg-primary text-white font-label-md text-label-md rounded-lg shadow-sm hover:opacity-95 transition-opacity font-bold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {uploading ? (
              <>
                <span className="material-symbols-outlined animate-spin">sync</span>
                Uploading… {uploadProgress}%
              </>
            ) : (
              <>
                <span className="material-symbols-outlined">cloud_upload</span>
                Upload to Desktop
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export default function ScanUploadPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <Suspense
        fallback={
          <div className="glass-panel p-8 rounded-2xl max-w-md w-full text-center">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-body-md text-on-surface-variant">Loading scan session…</p>
          </div>
        }
      >
        <UploadForm />
      </Suspense>
    </div>
  );
}
