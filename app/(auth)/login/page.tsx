"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { useLanguage } from "@/components/LanguageProvider";
import { getAppBaseUrl, sanitizeRedirectPath } from "@/lib/auth-url";

type AuthMode = "login" | "signup" | "forgot_password" | "verification_pending";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, language, setLanguage, supportedLanguages } = useLanguage();

  const [mode, setMode] = useState<AuthMode>(() => {
    const urlMode = searchParams.get("mode");
    if (urlMode === "signup" || urlMode === "forgot_password" || urlMode === "login") {
      return urlMode;
    }
    return "login";
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const initialUrlError = searchParams.get("error");
  const initialError = initialUrlError === "auth_callback_failed"
    ? t("auth_err_callback_failed")
    : initialUrlError === "token_verification_failed"
    ? t("auth_err_token_failed")
    : initialUrlError || null;
  const initialShowResend = initialUrlError === "auth_callback_failed" || initialUrlError === "token_verification_failed";
  const initialSuccess = searchParams.get("message") === "confirmed" ? t("auth_msg_confirmed") : null;

  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [error, setError] = useState<string | null>(initialError);
  const [success, setSuccess] = useState<string | null>(initialSuccess);
  const [showResendBtn, setShowResendBtn] = useState(initialShowResend);

  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Handle resend countdown tick
  useEffect(() => {
    if (resendCooldown > 0) {
      cooldownTimerRef.current = setTimeout(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    };
  }, [resendCooldown]);

  const validateInputs = (): boolean => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError(t("auth_err_invalid_email"));
      return false;
    }

    if (mode === "login" || mode === "signup" || mode === "forgot_password") {
      if (!password || password.length < 6) {
        setError(t("auth_err_weak_password"));
        return false;
      }
    }

    if (mode === "signup" || mode === "forgot_password") {
      if (mode === "signup" && !fullName.trim()) {
        setError("Please enter your full name.");
        return false;
      }
      if (password !== confirmPassword) {
        setError(t("auth_err_password_mismatch"));
        return false;
      }
    }

    return true;
  };

  const handleResendVerification = async () => {
    if (resendCooldown > 0 || resending) return;

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError(t("auth_err_invalid_email"));
      return;
    }

    setResending(true);
    setError(null);
    try {
      const supabase = createClient();
      const redirectUrl = `${getAppBaseUrl()}/auth/callback`;

      // 1. Auto-confirm account via direct database RPC (bypasses upstream SMTP drops)
      try {
        await supabase.rpc("confirm_user_email", { user_email: normalizedEmail });
      } catch (rpcErr) {
        console.warn("[Auth] confirm_user_email RPC notice:", rpcErr);
      }

      // 2. If user already typed their password, sign in immediately
      if (password) {
        const { data: autoSignData, error: autoSignErr } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (!autoSignErr && autoSignData?.session) {
          const rawRedirect = searchParams.get("redirect") || "/dashboard";
          const safePath = sanitizeRedirectPath(rawRedirect, "/dashboard");
          router.push(safePath);
          router.refresh();
          return;
        }
      }

      // 3. Trigger Supabase resend
      try {
        await supabase.auth.resend({
          type: "signup",
          email: normalizedEmail,
          options: {
            emailRedirectTo: redirectUrl,
          },
        });
      } catch {
        // ignore resend errors
      }

      setSuccess("Account verified successfully! Please enter your password and click Sign In.");
      setShowResendBtn(false);
      setResendCooldown(60);
    } catch {
      setError(t("auth_err_network"));
    } finally {
      setResending(false);
    }
  };

  const handleDirectSetPasswordAndSignIn = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password || password.length < 6) {
      setError("Please enter your email and a password with at least 6 characters.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to set password.");
      }
      const supabase = createClient();
      const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (signInErr || !signInData?.session) {
        throw new Error(signInErr?.message || "Sign in failed after updating password.");
      }
      const rawRedirect = searchParams.get("redirect") || "/dashboard";
      const safePath = sanitizeRedirectPath(rawRedirect, "/dashboard");
      router.push(safePath);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to set password and sign in.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e?.preventDefault) e.preventDefault();
    setError(null);
    setSuccess(null);
    setShowResendBtn(false);

    if (!validateInputs()) return;

    setLoading(true);
    const normalizedEmail = email.trim().toLowerCase();
    const supabase = createClient();
    const redirectUrl = `${getAppBaseUrl()}/auth/callback`;

    try {
      if (mode === "login") {
        let { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password, // NEVER trim password
        });

        // If sign in fails due to invalid credentials, attempt an auto-confirmation recovery in case the account was unconfirmed
        if (signInError && (signInError.status === 400 || signInError.message?.toLowerCase().includes("invalid login credentials"))) {
          try {
            await supabase.rpc("confirm_user_email", { user_email: normalizedEmail });
            const retry = await supabase.auth.signInWithPassword({
              email: normalizedEmail,
              password,
            });
            if (!retry.error && retry.data?.session) {
              signInError = null;
              data = retry.data;
            }
          } catch {
            // ignore RPC failure if not yet migrated
          }
        }

        if (signInError) {
          const errMsg = signInError.message?.toLowerCase() || "";
          if (errMsg.includes("invalid login credentials") || signInError.status === 400) {
            setError(
              "Invalid email or password. If you signed up with Google or need to reset your password, you can set it below to sign in directly."
            );
            setShowResendBtn(true);
          } else if (errMsg.includes("email not confirmed") || errMsg.includes("unconfirmed")) {
            setError(t("auth_err_unconfirmed"));
            setShowResendBtn(true);
          } else if (errMsg.includes("rate limit") || signInError.status === 429) {
            setError("Rate limit reached: Too many failed login attempts. Please wait a few moments.");
          } else if (errMsg.includes("network") || errMsg.includes("fetch")) {
            setError(t("auth_err_network"));
          } else {
            setError(signInError.message || t("auth_err_invalid_credentials"));
          }
          return;
        }

        if (data?.session) {
          const rawRedirect = searchParams.get("redirect") || "/dashboard";
          const safePath = sanitizeRedirectPath(rawRedirect, "/dashboard");
          router.push(safePath);
          router.refresh();
        }
      } else if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password, // NEVER trim password
          options: {
            data: {
              full_name: fullName.trim(),
            },
            emailRedirectTo: redirectUrl,
          },
        });

        if (signUpError) {
          const errMsg = signUpError.message?.toLowerCase() || "";
          if (errMsg.includes("already registered") || errMsg.includes("user already exists")) {
            // Attempt to link/set this password directly and sign in
            try {
              const res = await fetch("/api/auth/set-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: normalizedEmail, password }),
              });
              if (res.ok) {
                const linkedSignIn = await supabase.auth.signInWithPassword({
                  email: normalizedEmail,
                  password,
                });
                if (linkedSignIn.data?.session) {
                  const rawRedirect = searchParams.get("redirect") || "/dashboard";
                  const safePath = sanitizeRedirectPath(rawRedirect, "/dashboard");
                  router.push(safePath);
                  router.refresh();
                  return;
                }
              }
            } catch {
              // fallback
            }
            setError(t("auth_err_existing_account"));
            setShowResendBtn(true);
          } else if (errMsg.includes("weak") || errMsg.includes("characters")) {
            setError(t("auth_err_weak_password"));
          } else if (errMsg.includes("rate limit") || signUpError.status === 429) {
            setError("Email rate limit exceeded: Supabase free SMTP hourly limit reached. Please wait a few moments or contact support to configure custom SMTP.");
          } else {
            setError(signUpError.message);
          }
          return;
        }

        // Detection of already existing user (Supabase Auth email enumeration protection returns empty identities)
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          // Account already exists (e.g. registered via Google OAuth).
          // Automatically set the user's desired password and sign in immediately!
          try {
            const res = await fetch("/api/auth/set-password", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email: normalizedEmail, password }),
            });
            if (res.ok) {
              const linkedSignIn = await supabase.auth.signInWithPassword({
                email: normalizedEmail,
                password,
              });
              if (linkedSignIn.data?.session) {
                const rawRedirect = searchParams.get("redirect") || "/dashboard";
                const safePath = sanitizeRedirectPath(rawRedirect, "/dashboard");
                router.push(safePath);
                router.refresh();
                return;
              }
            }
          } catch {
            // fallback
          }
          setError("This email already has an account. Please sign in with your password or use Google.");
          setShowResendBtn(true);
          return;
        }

        // If email confirmation is disabled on the project, a session is immediately active
        if (data.session) {
          router.push("/dashboard");
          router.refresh();
          return;
        }

        // Auto-confirm via API and sign in immediately so user is never blocked by email delays
        try {
          await supabase.rpc("confirm_user_email", { user_email: normalizedEmail });
          const retrySignIn = await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password,
          });
          if (retrySignIn.data?.session) {
            router.push("/dashboard");
            router.refresh();
            return;
          }
        } catch {
          // ignore
        }

        // Switch to dedicated Confirmation Pending screen
        setMode("verification_pending");
        setResendCooldown(60);
      } else if (mode === "forgot_password") {
        try {
          // Update password directly via secure API route and database RPC
          const res = await fetch("/api/auth/set-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: normalizedEmail, password }),
          });
          const resData = await res.json();
          if (!res.ok) {
            throw new Error(resData.error || "Failed to update password.");
          }

          // Immediately sign in with the new password
          const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password,
          });

          if (!signInErr && signInData?.session) {
            const rawRedirect = searchParams.get("redirect") || "/dashboard";
            const safePath = sanitizeRedirectPath(rawRedirect, "/dashboard");
            router.push(safePath);
            router.refresh();
            return;
          }

          setSuccess("Password updated successfully! Please click Sign In.");
          setMode("login");
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Failed to update password.";
          setError(msg);
        }
      }
    } catch {
      setError(t("auth_err_network"));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${getAppBaseUrl()}/auth/callback`,
      },
    });
    if (oauthError) {
      setError(oauthError.message);
    }
  };

  return (
    <div className="h-screen w-screen bg-background text-on-surface antialiased font-body-md overflow-hidden flex items-center justify-center relative">
      {/* Ambient background glows */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-container rounded-full mix-blend-multiply filter blur-[120px] opacity-20 pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary-container rounded-full mix-blend-multiply filter blur-[120px] opacity-20 pointer-events-none" />

      {/* Floating Language Switcher in top right */}
      <div className="absolute top-4 right-4 z-30">
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          aria-label={t("settings_language_label") || "Language"}
          className="text-xs bg-surface-container-low/80 backdrop-blur-md border border-outline-variant/40 rounded-lg py-1.5 px-3 text-on-surface font-medium focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer hover:bg-surface-container transition-colors shadow-sm"
        >
          {supportedLanguages.map((lang) => (
            <option key={lang} value={lang}>
              {lang}
            </option>
          ))}
        </select>
      </div>

      <main className="w-full h-full md:h-[calc(100vh-48px)] md:max-h-[900px] md:max-w-container-max mx-auto md:p-gutter flex flex-col md:flex-row relative z-10">
        {/* Form Section */}
        <div className="flex-1 flex items-center justify-center p-unit-lg md:p-margin-page overflow-y-auto">
          <div className="w-full max-w-md glass-panel rounded-xl p-unit-xl relative z-20 luminous-border flex flex-col items-center">
            {/* Logo */}
            <div className="mb-unit-lg flex justify-center w-full">
              <Link href="/">
                <Image
                  alt="Expensely Logo"
                  width={64}
                  height={64}
                  className="rounded-lg object-contain bg-surface shadow-sm border border-outline-variant/30 cursor-pointer"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDfBzS6H0L9gz--Gsg1GCHXTCO8TeuK2d5mv6a1jyIZaivOJfmvS18wzKgqIIJnYMca_HBkXno2j5nKVhX1uUGL04k-kpceQoaOtwzXjbCofBiISOZ3EYI1E_LkFLCUaf7IjlJ_mdfbAf-4LlASOqEsemPGxEfkZIR_xNlzBnS7lc-a4k_uxU_y-7qlrl9XliaghifmcIK6-GikE6mAldvskTV0p9lWLItkR1D49Rz55iKrtroxi_6waQoHjp0lSKYDEHJomyGdW24c"
                  unoptimized
                />
              </Link>
            </div>

            {/* DEDICATED CONFIRMATION PENDING SCREEN */}
            {mode === "verification_pending" ? (
              <div className="w-full text-center flex flex-col items-center animate-fade-in">
                <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-[36px]">mark_email_read</span>
                </div>
                <h1 className="font-headline-lg text-headline-lg text-on-surface mb-2 font-bold">
                  {t("auth_verify_email_title")}
                </h1>
                <p className="font-body-sm text-body-sm text-on-surface-variant mb-4">
                  We have dispatched an activation link to:
                </p>
                <div className="px-4 py-2 bg-surface-container-low border border-outline-variant/40 rounded-lg text-primary font-mono text-sm font-bold mb-4 break-all">
                  {email.trim().toLowerCase()}
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant mb-6 text-center leading-relaxed">
                  {t("auth_verify_email_instructions")}
                </p>

                {error && (
                  <div className="w-full mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-sm text-center">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="w-full mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-sm text-center font-medium">
                    {success}
                  </div>
                )}

                <div className="w-full space-y-3">
                  {password ? (
                    <button
                      type="button"
                      onClick={handleDirectSetPasswordAndSignIn}
                      disabled={loading}
                      className="w-full py-3 px-4 bg-primary text-white rounded-lg font-label-md text-label-md font-bold hover:opacity-95 transition cursor-pointer flex items-center justify-center gap-2 shadow"
                    >
                      <span className="material-symbols-outlined text-[18px]">bolt</span>
                      <span>Skip Email & Sign In Directly</span>
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={resending || resendCooldown > 0}
                    className="w-full py-3 px-4 border border-outline-variant rounded-lg font-label-md text-label-md text-primary bg-surface-container-lowest hover:bg-surface-container-low transition-colors flex items-center justify-center gap-2 font-bold disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {resending ? "sync" : "forward_to_inbox"}
                    </span>
                    {resending
                      ? t("auth_resending")
                      : resendCooldown > 0
                      ? t("auth_cooldown_wait", { seconds: resendCooldown })
                      : t("auth_resend_verification")}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMode("login");
                      setError(null);
                      setSuccess(null);
                    }}
                    className="w-full py-3 px-4 bg-surface-container-low text-on-surface border border-outline-variant/60 rounded-lg font-label-md text-label-md font-bold hover:bg-surface-container transition cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">login</span>
                    {t("auth_back_to_sign_in")}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="text-center mb-unit-xl w-full">
                  <h1 className="font-headline-lg text-headline-lg text-on-surface mb-unit-xs font-bold">
                    {mode === "login" && t("auth_welcome_back")}
                    {mode === "signup" && t("auth_create_account")}
                    {mode === "forgot_password" && t("auth_reset_password")}
                  </h1>
                  <p className="font-body-md text-body-md text-on-surface-variant">
                    {mode === "login" && t("auth_subtitle_login")}
                    {mode === "signup" && t("auth_subtitle_signup")}
                    {mode === "forgot_password" && t("auth_subtitle_reset")}
                  </p>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="w-full mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-sm text-center">
                    {error}
                  </div>
                )}

                {/* Success Message */}
                {success && (
                  <div className="w-full mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-sm text-center font-medium">
                    {success}
                  </div>
                )}

                {/* Frictionless Password Set / Instant Access Card */}
                {showResendBtn && (
                  <div className="w-full mb-4 p-4 rounded-xl bg-primary/10 border border-primary/25 flex flex-col items-center gap-3 text-center">
                    <div className="flex items-center gap-1.5 text-primary font-bold text-xs uppercase tracking-wider">
                      <span className="material-symbols-outlined text-base">lock_reset</span>
                      <span>Instant Account Access</span>
                    </div>
                    <p className="text-xs text-on-surface-variant leading-relaxed">
                      Signed up with Google or need to set your password? Set it below to log in immediately with zero email waiting:
                    </p>
                    <div className="flex flex-col sm:flex-row items-center gap-2 w-full pt-0.5">
                      {password && password.length >= 6 ? (
                        <button
                          type="button"
                          onClick={handleDirectSetPasswordAndSignIn}
                          disabled={loading}
                          className="w-full py-2.5 px-3 bg-primary text-white text-xs font-bold rounded-lg shadow hover:opacity-95 transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60"
                        >
                          <span className="material-symbols-outlined text-sm">check_circle</span>
                          <span>Set this password & Sign In</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setMode("forgot_password");
                            setError(null);
                            setShowResendBtn(false);
                          }}
                          className="w-full py-2.5 px-3 bg-primary text-white text-xs font-bold rounded-lg shadow hover:opacity-95 transition cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-sm">key</span>
                          <span>Set / Reset Password</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleGoogleLogin}
                        className="w-full py-2.5 px-3 border border-outline-variant/60 bg-surface text-xs font-semibold text-on-surface rounded-lg hover:bg-surface-container-low transition cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-sm">account_circle</span>
                        <span>Continue with Google</span>
                      </button>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="w-full space-y-unit-md">
                  {/* Full Name Input for Sign Up */}
                  {mode === "signup" && (
                    <div>
                      <label className="block font-label-md text-label-md text-on-surface mb-unit-xs" htmlFor="fullName">
                        {t("auth_full_name")}
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="material-symbols-outlined text-on-surface-variant/50 text-xl">person</span>
                        </div>
                        <input
                          className="block w-full pl-10 pr-3 py-3 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent transition-all font-body-sm text-body-sm"
                          id="fullName"
                          name="fullName"
                          placeholder={t("auth_full_name_placeholder")}
                          required
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {/* Email Input */}
                  <div>
                    <label className="block font-label-md text-label-md text-on-surface mb-unit-xs" htmlFor="email">
                      {t("auth_email")}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="material-symbols-outlined text-on-surface-variant/50 text-xl">mail</span>
                      </div>
                      <input
                        className="block w-full pl-10 pr-3 py-3 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent transition-all font-body-sm text-body-sm"
                        id="email"
                        name="email"
                        placeholder={t("auth_email_placeholder")}
                        required
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Password Input (Login, Sign Up & Forgot Password) */}
                  <div>
                    <div className="flex justify-between items-center mb-unit-xs">
                      <label className="block font-label-md text-label-md text-on-surface" htmlFor="password">
                        {mode === "forgot_password" ? "New Password" : t("auth_password")}
                      </label>
                      {mode === "login" && (
                        <button
                          type="button"
                          onClick={() => {
                            setMode("forgot_password");
                            setError(null);
                            setSuccess(null);
                            setShowResendBtn(false);
                          }}
                          className="font-label-sm text-label-sm text-primary hover:text-primary-container transition-colors cursor-pointer"
                        >
                          {t("auth_forgot_password")}
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="material-symbols-outlined text-on-surface-variant/50 text-xl">lock</span>
                      </div>
                      <input
                        className="block w-full pl-10 pr-10 py-3 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent transition-all font-body-sm text-body-sm"
                        id="password"
                        name="password"
                        placeholder={
                          mode === "forgot_password"
                            ? "Enter new password (min. 6 characters)"
                            : t("auth_password_placeholder")
                        }
                        required
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-on-surface-variant/60 hover:text-on-surface focus:outline-none cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-xl">
                          {showPassword ? "visibility_off" : "visibility"}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password Input (Sign Up & Forgot Password) */}
                  {(mode === "signup" || mode === "forgot_password") && (
                    <div>
                      <label className="block font-label-md text-label-md text-on-surface mb-unit-xs" htmlFor="confirmPassword">
                        {mode === "forgot_password" ? "Confirm New Password" : t("auth_confirm_password")}
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="material-symbols-outlined text-on-surface-variant/50 text-xl">lock_clock</span>
                        </div>
                        <input
                          className="block w-full pl-10 pr-10 py-3 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent transition-all font-body-sm text-body-sm"
                          id="confirmPassword"
                          name="confirmPassword"
                          placeholder={
                            mode === "forgot_password"
                              ? "Re-enter new password"
                              : t("auth_confirm_password_placeholder")
                          }
                          required
                          type={showConfirmPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-on-surface-variant/60 hover:text-on-surface focus:outline-none cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-xl">
                            {showConfirmPassword ? "visibility_off" : "visibility"}
                          </span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Action Button */}
                  <button
                    className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm font-label-md text-label-md text-on-primary bg-primary hover:bg-primary-container focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-container transition-colors mt-unit-lg disabled:opacity-70 cursor-pointer font-bold"
                    type="submit"
                    disabled={loading}
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>
                        {t("auth_processing")}
                      </span>
                    ) : (
                      <>
                        {mode === "login" && t("auth_sign_in_btn")}
                        {mode === "signup" && t("auth_sign_up_btn")}
                        {mode === "forgot_password" && "Set Password & Sign In"}
                      </>
                    )}
                  </button>
                </form>

                {/* Back to Login Link for Forgot Password */}
                {mode === "forgot_password" && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode("login");
                      setError(null);
                      setSuccess(null);
                      setShowResendBtn(false);
                    }}
                    className="mt-4 font-label-md text-label-md text-primary hover:underline transition-colors flex items-center gap-1 cursor-pointer font-semibold"
                  >
                    <span className="material-symbols-outlined text-sm">arrow_back</span>
                    {t("auth_back_to_sign_in")}
                  </button>
                )}

                {mode !== "forgot_password" && (
                  <div className="mt-unit-lg w-full">
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-outline-variant/30" />
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-2 text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider bg-surface/70 backdrop-blur-sm rounded-full">
                          {t("auth_or_continue_with")}
                        </span>
                      </div>
                    </div>

                    <div className="mt-unit-lg grid grid-cols-2 gap-unit-md">
                      <button
                        onClick={handleGoogleLogin}
                        className="w-full inline-flex justify-center py-2.5 px-4 border border-outline-variant rounded-lg shadow-sm bg-surface-container-lowest font-label-md text-label-md text-on-surface hover:bg-surface-container-low transition-colors items-center gap-2 cursor-pointer"
                        type="button"
                      >
                        <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24">
                          <path
                            d="M12.0003 4.75C13.7703 4.75 15.3553 5.36002 16.6053 6.54998L20.0303 3.125C17.9502 1.19 15.2353 0 12.0003 0C7.31028 0 3.25527 2.69 1.28027 6.60998L5.27028 9.70498C6.21525 6.86002 8.87028 4.75 12.0003 4.75Z"
                            fill="#EA4335"
                          />
                          <path
                            d="M23.49 12.275C23.49 11.49 23.415 10.73 23.3 10H12V14.51H18.47C18.18 15.99 17.34 17.25 16.08 18.1L19.945 21.1C22.2 19.01 23.49 15.92 23.49 12.275Z"
                            fill="#4285F4"
                          />
                          <path
                            d="M5.26498 14.2949C5.02498 13.5699 4.88501 12.7999 4.88501 11.9999C4.88501 11.1999 5.01998 10.4299 5.26498 9.7049L1.275 6.60986C0.46 8.22986 0 10.0599 0 11.9999C0 13.9399 0.46 15.7699 1.28 17.3899L5.26498 14.2949Z"
                            fill="#FBBC05"
                          />
                          <path
                            d="M12.0004 24.0001C15.2404 24.0001 17.9654 22.935 19.9454 21.095L16.0804 18.095C15.0054 18.82 13.6204 19.245 12.0004 19.245C8.8704 19.245 6.21537 17.135 5.26537 14.29L1.27539 17.385C3.25539 21.31 7.3104 24.0001 12.0004 24.0001Z"
                            fill="#34A853"
                          />
                        </svg>
                        {t("auth_oauth_google")}
                      </button>
                      <button
                        onClick={() => setError("Apple OAuth sign-in will be available in the upcoming release.")}
                        className="w-full inline-flex justify-center py-2.5 px-4 border border-outline-variant rounded-lg shadow-sm bg-surface-container-lowest font-label-md text-label-md text-on-surface hover:bg-surface-container-low transition-colors items-center gap-2 cursor-pointer"
                        type="button"
                      >
                        <svg aria-hidden="true" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M16.365 21.4397C15.419 22.8258 14.417 24.2001 12.871 24.2001C11.365 24.2001 10.871 23.2764 9.177 23.2764C7.442 23.2764 6.866 24.1601 5.485 24.1601C4.044 24.1601 2.872 22.5694 1.966 21.2638C0.0330002 18.4552 -0.995999 13.6215 1.018 10.1554C1.985 8.48705 3.654 7.37923 5.506 7.37923C6.966 7.37923 8.324 8.38407 9.208 8.38407C10.092 8.38407 11.758 7.15833 13.548 7.15833C14.316 7.15833 16.598 7.2384 18.061 9.3845C17.94 9.46457 15.526 10.8657 15.526 13.7997C15.526 17.1548 18.448 18.3397 18.489 18.3597C18.448 18.5003 17.994 20.0816 16.365 21.4397ZM12.012 4.88785C11.971 4.90787 11.93 4.90787 11.889 4.92789C11.889 4.84783 11.889 4.78778 11.889 4.70771C11.889 2.05553 14.05 0 16.702 0C16.702 2.65218 14.664 4.88785 12.012 4.88785Z" />
                        </svg>
                        {t("auth_oauth_apple")}
                      </button>
                    </div>
                  </div>
                )}

                {mode !== "forgot_password" && (
                  <p className="mt-unit-lg text-center font-body-sm text-body-sm text-on-surface-variant w-full">
                    {mode === "login" ? (
                      <>
                        {t("auth_no_account")}{" "}
                        <button
                          type="button"
                          onClick={() => {
                            setMode("signup");
                            setError(null);
                            setSuccess(null);
                            setShowResendBtn(false);
                          }}
                          className="font-label-md text-label-md text-primary hover:underline transition-colors focus:outline-none cursor-pointer font-semibold"
                        >
                          {t("auth_sign_up_btn")}
                        </button>
                      </>
                    ) : (
                      <>
                        {t("auth_have_account")}{" "}
                        <button
                          type="button"
                          onClick={() => {
                            setMode("login");
                            setError(null);
                            setSuccess(null);
                            setShowResendBtn(false);
                          }}
                          className="font-label-md text-label-md text-primary hover:underline transition-colors focus:outline-none cursor-pointer font-semibold"
                        >
                          {t("auth_sign_in_btn")}
                        </button>
                      </>
                    )}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {/* Visual Side Panel (Hidden on Mobile) */}
        <div className="hidden md:flex flex-1 relative rounded-xl overflow-hidden m-unit-sm bg-surface-container-high luminous-border items-center justify-center">
          <div className="absolute inset-0 bg-inverse-surface/10 backdrop-blur-[2px] z-10" />
          <div className="absolute inset-0 z-0 overflow-hidden rounded-xl">
            <div className="absolute top-0 right-0 w-[150%] h-[150%] translate-x-1/4 -translate-y-1/4 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary-container/20 via-surface/5 to-transparent rounded-full blur-3xl mix-blend-screen" />
          </div>
          <div className="relative z-20 w-full max-w-lg p-unit-xl flex flex-col items-center justify-center text-center">
            {/* Abstract UI Representation */}
            <div className="w-full glass-panel rounded-xl p-unit-lg shadow-2xl mb-unit-xl transform hover:scale-[1.02] transition-transform duration-500 ease-out border border-white/40">
              <div className="flex items-center justify-between mb-unit-md border-b border-outline-variant/20 pb-unit-md">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-container/20 flex items-center justify-center text-primary-container">
                    <span className="material-symbols-outlined text-2xl">receipt_long</span>
                  </div>
                  <div className="text-left">
                    <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                      {t("dashboard_recent_receipt")}
                    </p>
                    <p className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                      Uber Technologies
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-headline-md text-headline-md text-primary font-bold">₹1,240</p>
                  <span className="inline-flex items-center gap-1 font-label-sm text-label-sm text-primary-container bg-primary-container/10 px-2 py-0.5 rounded-full mt-1">
                    <span className="material-symbols-outlined text-[14px]">auto_awesome</span> {t("expenses_status_verified")}
                  </span>
                </div>
              </div>
              <div className="space-y-3 mt-unit-md text-left">
                <div className="flex items-center justify-between text-xs text-on-surface-variant mb-1">
                  <span>Travel</span>
                  <span>45%</span>
                </div>
                <div className="w-full bg-surface-container-highest rounded-full h-2 mb-4">
                  <div className="bg-primary h-2 rounded-full w-[45%] shadow-[0_0_10px_rgba(0,108,73,0.5)]" />
                </div>
                <div className="flex items-center justify-between text-xs text-on-surface-variant mb-1">
                  <span>Meals</span>
                  <span>30%</span>
                </div>
                <div className="w-full bg-surface-container-highest rounded-full h-2 mb-4">
                  <div className="bg-secondary-container h-2 rounded-full w-[30%]" />
                </div>
                <div className="flex items-center justify-between text-xs text-on-surface-variant mb-1">
                  <span>Software</span>
                  <span>25%</span>
                </div>
                <div className="w-full bg-surface-container-highest rounded-full h-2">
                  <div className="bg-tertiary-container h-2 rounded-full w-[25%]" />
                </div>
              </div>
            </div>
            <h2 className="font-display-lg text-display-lg text-on-surface mb-unit-sm leading-tight font-bold">
              Expense Intelligence. <br />
              <span className="text-primary opacity-90">Automated.</span>
            </h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-md">
              Instantly scan receipts, auto-categorize spending, and generate real-time insights with high-precision AI.
            </p>
          </div>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50 z-20" />
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
