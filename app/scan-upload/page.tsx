"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function UploadForm() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("id");

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string>("");

  // "checking" while the server probe is in-flight;
  // "valid"    if the session exists and is not expired;
  // "expired"  if the server returns 404 or status:"expired".
  const [sessionStatus, setSessionStatus] = useState<"checking" | "valid" | "expired">("checking");

  // Validate session against the server before rendering the upload UI.
  useEffect(() => {
    console.log("[AUDIT CLIENT] useEffect mounted/triggered. sessionId:", sessionId);
    if (!sessionId) {
      console.log("[AUDIT CLIENT] No sessionId found in URL query params. Setting expired.");
      setSessionStatus("expired");
      return;
    }
    console.log("[AUDIT CLIENT] Fetching: /api/scan-session?id=" + sessionId);
    fetch(`/api/scan-session?id=${sessionId}`)
      .then((res) => {
        console.log("[AUDIT CLIENT] Fetch responded. status:", res.status, "ok:", res.ok);
        if (!res.ok) {
          console.log("[AUDIT CLIENT] Response not ok. Setting expired.");
          setSessionStatus("expired");
          return;
        }
        return res.json();
      })
      .then((data) => {
        console.log("[AUDIT CLIENT] Parsed JSON data:", data);
        if (!data) {
          console.log("[AUDIT CLIENT] Early return: no data parsed.");
          return;
        }
        if (data.status === "expired" || data.error) {
          console.log("[AUDIT CLIENT] Data indicates expired status or error. Setting expired.");
          setSessionStatus("expired");
        } else {
          console.log("[AUDIT CLIENT] Session is valid. Setting valid.");
          setSessionStatus("valid");
        }
      })
      .catch((err) => {
        console.error("[AUDIT CLIENT] Fetch failed with exception:", err);
        setSessionStatus("expired");
      });
  }, [sessionId]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // --- Render gate: validate before showing any upload UI -----------------
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
          Please return to your computer and scan a new QR code.
        </p>
      </div>
    );
  }

  // sessionStatus === "valid" — original guard below is now unreachable for
  // missing IDs (handled above) but kept for type safety.
  if (!sessionId) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      setError("");

      const url = URL.createObjectURL(selected);
      setPreviewUrl(url);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select or capture a receipt image first.");
      return;
    }

    setUploading(true);
    setError("");
    setUploadProgress(10);

    try {
      const formData = new FormData();
      formData.append("id", sessionId);
      formData.append("file", file);

      // Smooth progress animation
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
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during upload.");
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
        {/* Upload Target Area */}
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

        {/* Action Button */}
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
      <Suspense fallback={
        <div className="glass-panel p-8 rounded-2xl max-w-md w-full text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-body-md text-on-surface-variant">Loading scan session…</p>
        </div>
      }>
        <UploadForm />
      </Suspense>
    </div>
  );
}
