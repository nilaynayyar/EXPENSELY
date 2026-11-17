"use client";

import { useState, useEffect, useRef, Suspense, useCallback } from "react";
import { useLanguage } from "@/components/LanguageProvider";

interface AccountInfo {
  id: string;
  email: string | null;
  name: string | null;
}

interface ExpenseItem {
  id: string;
  store: string;
  amount: number;
  date: string;
  status: string;
  categories?: { name: string; icon: string } | null;
}

function UploadForm() {
  const { t, formatCurrency, formatDate } = useLanguage();

  // Session parameters derived from URL
  const [sessionId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("id");
    }
    return null;
  });

  const [token] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("token");
    }
    return null;
  });

  // Account context
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [recentExpenses, setRecentExpenses] = useState<ExpenseItem[]>([]);
  const [activeTab, setActiveTab] = useState<"camera" | "account">("camera");

  // File & Upload state
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [success, setSuccess] = useState(false);
  const [savedExpense, setSavedExpense] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string>("");

  // Optional quick expense fields
  const [storeName, setStoreName] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [categoryName, setCategoryName] = useState("Food");
  const [saveToAccount, setSaveToAccount] = useState(true);

  // Live Camera state
  const [isLiveCameraActive, setIsLiveCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<"environment" | "user">("environment");
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  // Session validation state
  const [sessionStatus, setSessionStatus] = useState<"checking" | "valid" | "expired">(() => {
    if (typeof window !== "undefined") {
      const id = new URLSearchParams(window.location.search).get("id");
      return id ? "checking" : "expired";
    }
    return "checking";
  });

  // ── 1. Validate session & fetch account context ─────────────────────────────
  useEffect(() => {
    if (!sessionId) return;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    let mounted = true;

    (async () => {
      let nextStatus: "valid" | "expired" = "expired";
      const url = token
        ? `/api/scan-session?id=${sessionId}&token=${encodeURIComponent(token)}`
        : `/api/scan-session?id=${sessionId}`;

      try {
        const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data.status === "pending" || data.status === "uploaded") {
            nextStatus = "valid";
            if (data.account) {
              setAccount(data.account);
            }

            // Also load recent expenses for paired account
            if (token) {
              try {
                const expRes = await fetch(`/api/scan-session/expenses?id=${sessionId}&token=${encodeURIComponent(token)}`, {
                  signal: controller.signal,
                  cache: "no-store",
                });
                if (expRes.ok) {
                  const expData = await expRes.json();
                  if (Array.isArray(expData.expenses)) {
                    setRecentExpenses(expData.expenses);
                  }
                }
              } catch {
                // ignore
              }
            }
          }
        }
      } catch {
        nextStatus = "expired";
      } finally {
        clearTimeout(timeoutId);
      }

      if (mounted) {
        setSessionStatus(nextStatus);
      }
    })();

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [sessionId, token]);

  // ── 2. Helper to refresh recent expenses on demand ─────────────────────────
  const fetchAccountExpenses = useCallback(async () => {
    if (!sessionId || !token) return;
    try {
      const res = await fetch(`/api/scan-session/expenses?id=${sessionId}&token=${encodeURIComponent(token)}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.expenses)) {
          setRecentExpenses(data.expenses);
        }
        if (data.account) {
          setAccount(data.account);
        }
      }
    } catch {
      // ignore
    }
  }, [sessionId, token]);

  // ── 3. Live Camera Management ───────────────────────────────────────────────
  const stopLiveCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsLiveCameraActive(false);
    setIsTorchOn(false);
    setHasTorch(false);
  }, []);

  const startLiveCamera = useCallback(async (facing: "environment" | "user" = cameraFacingMode) => {
    setError("");
    setCameraLoading(true);

    // Stop any existing stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Live camera is not supported by this browser. Please use the System Camera option.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsLiveCameraActive(true);
      setCameraFacingMode(facing);

      // Check flashlight support
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities = (videoTrack.getCapabilities ? videoTrack.getCapabilities() : {}) as { torch?: boolean };
        setHasTorch(Boolean(capabilities.torch));
      }
    } catch (err: unknown) {
      console.warn("[LiveCamera] Error starting live camera:", err);
      const msg = err instanceof Error ? err.message : "Could not open camera";
      setError(`${msg}. You can tap 'Launch Camera App' below to use your native phone camera.`);
      setIsLiveCameraActive(false);
    } finally {
      setCameraLoading(false);
    }
  }, [cameraFacingMode]);

  // Toggle flashlight / torch
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const nextTorch = !isTorchOn;
      await (track as unknown as { applyConstraints: (c: unknown) => Promise<void> }).applyConstraints({
        advanced: [{ torch: nextTorch }],
      });
      setIsTorchOn(nextTorch);
    } catch (e) {
      console.warn("Failed to toggle flashlight:", e);
    }
  };

  // Flip between rear and front camera
  const flipCamera = () => {
    const nextFacing = cameraFacingMode === "environment" ? "user" : "environment";
    startLiveCamera(nextFacing);
  };

  // Capture frame from live camera
  const captureFrame = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Haptic feedback if available
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(40);
      } catch {
        // ignore
      }
    }

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("Failed to capture image from camera.");
          return;
        }

        const capturedFile = new File([blob], `receipt_${Date.now()}.jpg`, { type: "image/jpeg" });
        setFile(capturedFile);
        setPreviewUrl(URL.createObjectURL(capturedFile));
        stopLiveCamera();
      },
      "image/jpeg",
      0.92
    );
  };

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      stopLiveCamera();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [stopLiveCamera, previewUrl]);

  // ── 4. Fallback File Handlers ───────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      setError("");
      setPreviewUrl(URL.createObjectURL(selected));
      stopLiveCamera();
    }
  };

  // ── 5. Upload Handler ───────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!file) {
      setError("Please capture or select a receipt photo first.");
      return;
    }
    if (!sessionId) {
      setError("Session ID is missing. Please scan the QR code again.");
      return;
    }

    setUploading(true);
    setError("");
    setUploadProgress(15);

    try {
      const formData = new FormData();
      formData.append("id", sessionId);
      if (token) formData.append("token", token);
      formData.append("file", file);
      formData.append("createExpense", saveToAccount ? "true" : "false");
      if (storeName.trim()) formData.append("store", storeName.trim());
      if (amount.trim()) formData.append("amount", amount.trim());
      if (expenseDate) formData.append("date", expenseDate);
      if (categoryName) formData.append("category", categoryName);

      const progressTimer = setInterval(() => {
        setUploadProgress((p) => (p < 85 ? p + 12 : p));
      }, 150);

      const res = await fetch("/api/scan-session/upload", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressTimer);
      setUploadProgress(100);

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to upload receipt.");
      }

      setSavedExpense(data.expense || null);
      setSuccess(true);
      fetchAccountExpenses();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(msg);
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  };

  // ── Render: Session Validation Gate ────────────────────────────────────────
  if (sessionStatus === "checking") {
    return (
      <div className="glass-panel p-8 rounded-2xl max-w-md w-full text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-body-md text-on-surface-variant font-medium">Connecting to Expensely…</p>
      </div>
    );
  }

  if (sessionStatus === "expired") {
    return (
      <div className="glass-panel p-8 rounded-2xl max-w-md w-full border border-error/20 bg-error/5 text-center">
        <div className="w-16 h-16 bg-error/10 text-error rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="material-symbols-outlined text-[36px]">timer_off</span>
        </div>
        <h2 className="text-headline-sm font-bold text-on-surface mb-3">{t("upload_session_expired")}</h2>
        <p className="text-body-sm text-on-surface-variant mb-4">
          {t("upload_expired_desc")}
        </p>
      </div>
    );
  }

  // ── Render: Success Screen ─────────────────────────────────────────────────
  if (success) {
    return (
      <div className="glass-panel p-8 rounded-2xl max-w-md w-full text-center border-t-4 border-t-primary animate-fade-in space-y-6">
        <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto shadow-inner">
          <span className="material-symbols-outlined text-[36px]">task_alt</span>
        </div>
        <div>
          <h2 className="text-headline-sm font-bold text-on-surface mb-2">{t("upload_success_title")}</h2>
          <p className="text-body-sm text-on-surface-variant">
            {account?.email
              ? `Receipt saved directly to your Expensely account (${account.email}) and synced with your desktop screen.`
              : t("upload_success_desc")}
          </p>
        </div>

        {savedExpense && (
          <div className="bg-surface-container-low/70 border border-outline-variant/40 rounded-xl p-4 text-left space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-primary uppercase tracking-wider">Expense Created</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-500">
                Pending Review
              </span>
            </div>
            <p className="text-body-md font-bold text-on-surface">{String(savedExpense.store || "Receipt Scan")}</p>
            <div className="flex items-center justify-between text-xs text-on-surface-variant">
              <span>{String(savedExpense.date || expenseDate)}</span>
              <span className="font-semibold text-on-surface">
                {savedExpense.amount ? formatCurrency(Number(savedExpense.amount)) : "Amount to verify"}
              </span>
            </div>
          </div>
        )}

        <div className="space-y-3 pt-2">
          <button
            onClick={() => {
              setFile(null);
              setPreviewUrl("");
              setSuccess(false);
              setSavedExpense(null);
              setStoreName("");
              setAmount("");
            }}
            className="w-full py-3 px-5 rounded-xl bg-primary text-white font-semibold flex items-center justify-center gap-2 shadow hover:opacity-95 transition"
          >
            <span className="material-symbols-outlined text-xl">photo_camera</span>
            <span>Scan Another Receipt</span>
          </button>

          <a
            href={account?.email ? `/login?email=${encodeURIComponent(account.email)}` : "/login"}
            className="w-full py-3 px-5 rounded-xl border border-outline-variant/50 text-on-surface hover:bg-surface-container-low transition font-semibold flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-xl">dashboard</span>
            <span>Open Expensely Dashboard</span>
          </a>
        </div>
      </div>
    );
  }

  // ── Render: Active Mobile Companion UI ─────────────────────────────────────
  return (
    <div className="glass-panel p-6 sm:p-8 rounded-2xl max-w-md w-full border border-outline-variant/30 relative overflow-hidden shadow-xl">
      {/* Hidden system camera input (accessible via cameraInputRef) */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ position: "fixed", top: "-9999px", left: "-9999px", opacity: 0, width: "1px", height: "1px", pointerEvents: "none" }}
        onChange={handleFileChange}
      />
      {/* Hidden photo library input (accessible via galleryInputRef) */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/png, image/jpeg, image/webp, image/heic"
        style={{ position: "fixed", top: "-9999px", left: "-9999px", opacity: 0, width: "1px", height: "1px", pointerEvents: "none" }}
        onChange={handleFileChange}
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Account Pairing Header Badge */}
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-outline-variant/30">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-black text-sm">
            E
          </div>
          <div>
            <div className="text-xs font-bold text-on-surface flex items-center gap-1.5">
              <span>Expensely Mobile</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <div className="text-[11px] text-on-surface-variant truncate max-w-[200px]">
              {account?.email ? account.email : "Connected to Desktop Session"}
            </div>
          </div>
        </div>

        {/* Tab switch */}
        <div className="flex items-center bg-surface-container-low rounded-lg p-0.5 border border-outline-variant/30 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("camera")}
            className={`px-2.5 py-1 rounded-md font-semibold transition ${
              activeTab === "camera" ? "bg-primary text-white shadow-xs" : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Scan
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("account")}
            className={`px-2.5 py-1 rounded-md font-semibold transition flex items-center gap-1 ${
              activeTab === "account" ? "bg-primary text-white shadow-xs" : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <span>Expenses</span>
            {recentExpenses.length > 0 && (
              <span className="text-[10px] px-1 py-0.2 rounded-full bg-surface/40">
                {recentExpenses.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-error/10 border border-error/20 text-error text-xs flex items-center gap-2">
          <span className="material-symbols-outlined text-base">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* TAB 1: RECEIPT CAMERA & UPLOAD */}
      {activeTab === "camera" && (
        <div className="space-y-4">
          {/* A. LIVE IN-PAGE CAMERA VIEW */}
          {isLiveCameraActive ? (
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-[3/4] w-full flex items-center justify-center shadow-lg border border-primary/30">
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="w-full h-full object-cover"
              />

              {/* Viewfinder Receipt Frame Overlay */}
              <div className="absolute inset-8 border-2 border-dashed border-white/60 rounded-xl pointer-events-none flex flex-col justify-between p-3">
                <div className="flex justify-between">
                  <div className="w-5 h-5 border-t-4 border-l-4 border-primary rounded-tl-sm" />
                  <div className="w-5 h-5 border-t-4 border-r-4 border-primary rounded-tr-sm" />
                </div>
                <div className="text-center text-[11px] text-white/80 font-medium bg-black/40 backdrop-blur-xs py-1 px-2.5 rounded-full mx-auto">
                  Align receipt inside frame
                </div>
                <div className="flex justify-between">
                  <div className="w-5 h-5 border-b-4 border-l-4 border-primary rounded-bl-sm" />
                  <div className="w-5 h-5 border-b-4 border-r-4 border-primary rounded-br-sm" />
                </div>
              </div>

              {/* Live Controls: Torch & Camera Switch */}
              <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
                {hasTorch && (
                  <button
                    type="button"
                    onClick={toggleTorch}
                    className={`p-2 rounded-full backdrop-blur-md transition ${
                      isTorchOn ? "bg-amber-400 text-black shadow-md" : "bg-black/40 text-white hover:bg-black/60"
                    }`}
                    title="Toggle Flashlight"
                  >
                    <span className="material-symbols-outlined text-lg">
                      {isTorchOn ? "flash_on" : "flash_off"}
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={flipCamera}
                  className="p-2 rounded-full bg-black/40 text-white backdrop-blur-md hover:bg-black/60 transition"
                  title="Switch Camera"
                >
                  <span className="material-symbols-outlined text-lg">flip_camera_ios</span>
                </button>
                <button
                  type="button"
                  onClick={stopLiveCamera}
                  className="p-2 rounded-full bg-black/40 text-white backdrop-blur-md hover:bg-black/60 transition"
                  title="Close Camera"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              {/* Circular Shutter Button */}
              <div className="absolute bottom-4 inset-x-0 flex items-center justify-center z-10">
                <button
                  type="button"
                  onClick={captureFrame}
                  className="w-18 h-18 rounded-full border-4 border-white flex items-center justify-center p-1 bg-white/20 active:scale-95 transition-transform shadow-xl"
                  title="Take Photo"
                >
                  <div className="w-full h-full rounded-full bg-white hover:bg-white/90" />
                </button>
              </div>
            </div>
          ) : previewUrl ? (
            /* B. CAPTURED PHOTO PREVIEW & CONFIRMATION */
            <div className="space-y-4">
              <div className="relative rounded-2xl overflow-hidden border border-outline-variant/40 bg-surface-container-low max-h-[300px] w-full flex items-center justify-center shadow-inner">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt="Receipt Preview" className="max-h-[300px] object-contain w-full" />
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setPreviewUrl("");
                  }}
                  className="absolute top-3 right-3 bg-black/75 hover:bg-black text-white px-3 py-1.5 rounded-full text-xs font-semibold shadow backdrop-blur-md transition flex items-center gap-1 cursor-pointer"
                  title="Retake photo"
                >
                  <span className="material-symbols-outlined text-sm">refresh</span>
                  <span>Retake</span>
                </button>
              </div>

              {/* Quick Expense Details (Auto-created directly on account) */}
              <div className="bg-surface-container-low/70 border border-outline-variant/40 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-lg">account_balance_wallet</span>
                    <span className="text-xs font-bold text-on-surface">Account Upload Details</span>
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-primary">
                    <input
                      type="checkbox"
                      checked={saveToAccount}
                      onChange={(e) => setSaveToAccount(e.target.checked)}
                      className="rounded text-primary focus:ring-primary"
                    />
                    <span>Save to My Expenses</span>
                  </label>
                </div>

                {saveToAccount && (
                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <div>
                      <label className="text-[11px] font-medium text-on-surface-variant block mb-1">
                        Store / Merchant
                      </label>
                      <input
                        type="text"
                        value={storeName}
                        onChange={(e) => setStoreName(e.target.value)}
                        placeholder="e.g. Chai Point"
                        className="w-full text-xs px-2.5 py-2 rounded-lg bg-surface border border-outline-variant/40 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-on-surface-variant block mb-1">
                        Amount ({formatCurrency(0).replace(/[\d.,\s]/g, "") || "₹"})
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="e.g. 210.00"
                        className="w-full text-xs px-2.5 py-2 rounded-lg bg-surface border border-outline-variant/40 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-on-surface-variant block mb-1">Date</label>
                      <input
                        type="date"
                        value={expenseDate}
                        onChange={(e) => setExpenseDate(e.target.value)}
                        className="w-full text-xs px-2.5 py-2 rounded-lg bg-surface border border-outline-variant/40 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-on-surface-variant block mb-1">Category</label>
                      <select
                        value={categoryName}
                        onChange={(e) => setCategoryName(e.target.value)}
                        className="w-full text-xs px-2.5 py-2 rounded-lg bg-surface border border-outline-variant/40 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="Food">Food & Dining</option>
                        <option value="Travel">Transportation</option>
                        <option value="Shopping">Shopping</option>
                        <option value="Software">Software</option>
                        <option value="Utilities">Utilities</option>
                        <option value="Health">Healthcare</option>
                        <option value="Others">Others</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Upload Button */}
              <button
                type="button"
                onClick={handleUpload}
                disabled={uploading}
                className="w-full py-4 px-6 bg-primary text-white font-bold rounded-2xl shadow-lg hover:opacity-95 active:scale-[0.99] transition flex items-center justify-center gap-2.5 disabled:opacity-60 cursor-pointer text-base"
              >
                {uploading ? (
                  <>
                    <span className="material-symbols-outlined text-xl animate-spin">sync</span>
                    <span>Uploading Receipt… {uploadProgress}%</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-xl">cloud_upload</span>
                    <span>Upload Receipt</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            /* C. CLEAR, UNAMBIGUOUS CAPTURE CHOICES */
            <div className="space-y-4">
              {/* Header Title & Subtitle */}
              <div className="flex flex-col items-center text-center pt-1 pb-2">
                <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-2.5 shadow-xs">
                  <span className="material-symbols-outlined text-[32px]">photo_camera</span>
                </div>
                <h2 className="text-title-lg font-bold text-on-surface">Scan Receipt</h2>
                <p className="text-body-sm text-on-surface-variant max-w-xs mt-0.5">
                  Capture with your phone camera or select from files
                </p>
              </div>

              {/* 1. Primary Action: Take Photo with Phone Camera */}
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="w-full py-4 px-5 rounded-2xl bg-primary text-white flex items-center justify-between font-bold shadow-md hover:opacity-95 active:scale-[0.99] transition cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-2xl text-white">photo_camera</span>
                  </div>
                  <div className="text-left">
                    <div className="text-base font-bold leading-tight">Take Photo with Camera</div>
                    <div className="text-xs font-normal text-white/80 mt-0.5">Launches phone camera app</div>
                  </div>
                </div>
                <span className="material-symbols-outlined text-white/80">chevron_right</span>
              </button>

              {/* 2. Secondary Options Grid */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                {/* Live Viewfinder */}
                <button
                  type="button"
                  onClick={() => startLiveCamera("environment")}
                  disabled={cameraLoading}
                  className="p-3.5 rounded-xl border border-outline-variant/50 bg-surface-container-low hover:bg-surface-container-high active:scale-[0.99] transition flex flex-col items-center justify-center text-center gap-1.5 cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    {cameraLoading ? (
                      <span className="material-symbols-outlined text-xl animate-spin">sync</span>
                    ) : (
                      <span className="material-symbols-outlined text-xl">center_focus_strong</span>
                    )}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-on-surface block">Live Viewfinder</span>
                    <span className="text-[10px] text-on-surface-variant block">In-screen framing</span>
                  </div>
                </button>

                {/* Choose from Files / Gallery */}
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="p-3.5 rounded-xl border border-outline-variant/50 bg-surface-container-low hover:bg-surface-container-high active:scale-[0.99] transition flex flex-col items-center justify-center text-center gap-1.5 cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center">
                    <span className="material-symbols-outlined text-xl">photo_library</span>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-on-surface block">Choose from Files</span>
                    <span className="text-[10px] text-on-surface-variant block">Gallery or files</span>
                  </div>
                </button>
              </div>

              {/* 3. Upload Receipt Standby Button */}
              <div className="pt-1">
                <button
                  type="button"
                  disabled
                  className="w-full py-3.5 px-4 rounded-xl bg-surface-container-high/60 text-on-surface-variant/50 font-bold border border-outline-variant/30 flex items-center justify-center gap-2 cursor-not-allowed text-xs"
                >
                  <span className="material-symbols-outlined text-base">cloud_upload</span>
                  <span>Upload Receipt (Take photo or select file first)</span>
                </button>
              </div>

              {/* Helpful tip */}
              <div className="p-3 rounded-xl bg-surface-container-low/50 border border-outline-variant/20 text-center">
                <p className="text-[11px] text-on-surface-variant">
                  Tip: Point camera steadily at the receipt with good lighting for highest OCR accuracy.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MY ACCOUNT & EXPENSES ON PHONE */}
      {activeTab === "account" && (
        <div className="space-y-4">
          <div className="bg-surface-container-low/70 border border-outline-variant/40 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-on-surface">Paired Account</span>
              <span className="text-[10px] font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                Live Synced
              </span>
            </div>
            <p className="text-sm font-semibold text-on-surface">{account?.email || "User Account"}</p>
            <p className="text-xs text-on-surface-variant">
              Receipts captured on this phone are directly recorded into this account runway ledger.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-on-surface">Recent Expenses</span>
              <button
                type="button"
                onClick={fetchAccountExpenses}
                className="text-[11px] text-primary hover:underline flex items-center gap-1 font-semibold"
              >
                <span className="material-symbols-outlined text-xs">refresh</span>
                <span>Refresh</span>
              </button>
            </div>

            {recentExpenses.length === 0 ? (
              <div className="text-center py-6 bg-surface-container-low/30 rounded-xl border border-outline-variant/20">
                <span className="material-symbols-outlined text-3xl text-on-surface-variant/40 mb-1">
                  receipt_long
                </span>
                <p className="text-xs text-on-surface-variant">No expenses recorded yet.</p>
                <p className="text-[11px] text-on-surface-variant/70 mt-0.5">
                  Snap your first receipt to add it directly!
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {recentExpenses.map((exp) => (
                  <div
                    key={exp.id}
                    className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/30 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-base">
                          {exp.categories?.icon || "receipt"}
                        </span>
                      </div>
                      <div className="truncate">
                        <p className="text-xs font-bold text-on-surface truncate">{exp.store}</p>
                        <p className="text-[10px] text-on-surface-variant">{formatDate(exp.date)}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-on-surface">{formatCurrency(exp.amount)}</p>
                      <span className="text-[9px] font-semibold text-emerald-500 uppercase tracking-wider">
                        {exp.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <a
            href={account?.email ? `/login?email=${encodeURIComponent(account.email)}` : "/login"}
            className="w-full py-3 px-4 rounded-xl border border-outline-variant/50 text-xs text-on-surface hover:bg-surface-container-low transition font-semibold flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-base">open_in_new</span>
            <span>Open Full Web Dashboard</span>
          </a>
        </div>
      )}
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
            <p className="text-body-md text-on-surface-variant font-medium">Loading Expensely mobile companion…</p>
          </div>
        }
      >
        <UploadForm />
      </Suspense>
    </div>
  );
}
