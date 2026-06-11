"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { createClient } from "@/utils/supabase/client";

type AuthMode = "login" | "signup" | "forgot_password";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e?: any) => {
    if (e?.preventDefault) e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const supabase = createClient();

    try {
      if (mode === "login") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        router.push("/dashboard");
      } else if (mode === "signup") {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (signUpError) throw signUpError;
        setSuccess("Registration successful! Please check your email to verify your account.");
      } else if (mode === "forgot_password") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/confirm?type=recovery`,
        });
        if (resetError) throw resetError;
        setSuccess("Password reset link sent! Please check your email inbox.");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
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
        redirectTo: `${window.location.origin}/auth/callback`,
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

      <main className="w-full h-full md:h-[calc(100vh-48px)] md:max-h-[900px] md:max-w-container-max mx-auto md:p-gutter flex flex-col md:flex-row relative z-10">
        {/* Form Section */}
        <div className="flex-1 flex items-center justify-center p-unit-lg md:p-margin-page overflow-y-auto">
          <div className="w-full max-w-md glass-panel rounded-xl p-unit-xl relative z-20 luminous-border flex flex-col items-center">
            {/* Logo */}
            <div className="mb-unit-lg flex justify-center w-full">
              <Link href="/">
                <img
                  alt="Expensely Logo"
                  className="h-16 w-16 rounded-lg object-contain bg-surface shadow-sm border border-outline-variant/30 cursor-pointer"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDfBzS6H0L9gz--Gsg1GCHXTCO8TeuK2d5mv6a1jyIZaivOJfmvS18wzKgqIIJnYMca_HBkXno2j5nKVhX1uUGL04k-kpceQoaOtwzXjbCofBiISOZ3EYI1E_LkFLCUaf7IjlJ_mdfbAf-4LlASOqEsemPGxEfkZIR_xNlzBnS7lc-a4k_uxU_y-7qlrl9XliaghifmcIK6-GikE6mAldvskTV0p9lWLItkR1D49Rz55iKrtroxi_6waQoHjp0lSKYDEHJomyGdW24c"
                />
              </Link>
            </div>
            
            <div className="text-center mb-unit-xl w-full">
              <h1 className="font-headline-lg text-headline-lg text-on-surface mb-unit-xs">
                {mode === "login" && "Welcome back"}
                {mode === "signup" && "Create an account"}
                {mode === "forgot_password" && "Reset your password"}
              </h1>
              <p className="font-body-md text-body-md text-on-surface-variant">
                {mode === "login" && "Sign in to manage your expenses."}
                {mode === "signup" && "Get started with automated expense tracking."}
                {mode === "forgot_password" && "Enter your email to receive a recovery link."}
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

            <form action={handleSubmit} onSubmit={handleSubmit} className="w-full space-y-unit-md">
              {/* Full Name Input for Sign Up */}
              {mode === "signup" && (
                <div>
                  <label className="block font-label-md text-label-md text-on-surface mb-unit-xs" htmlFor="fullName">
                    Full Name
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="material-symbols-outlined text-on-surface-variant/50 text-xl">person</span>
                    </div>
                    <input
                      className="block w-full pl-10 pr-3 py-3 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent transition-all font-body-sm text-body-sm"
                      id="fullName"
                      name="fullName"
                      placeholder="Alex Morgan"
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
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="material-symbols-outlined text-on-surface-variant/50 text-xl">mail</span>
                  </div>
                  <input
                    className="block w-full pl-10 pr-3 py-3 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent transition-all font-body-sm text-body-sm"
                    id="email"
                    name="email"
                    placeholder="you@company.com"
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              {/* Password Input (Login & Sign Up only) */}
              {mode !== "forgot_password" && (
                <div>
                  <div className="flex justify-between items-center mb-unit-xs">
                    <label className="block font-label-md text-label-md text-on-surface" htmlFor="password">
                      Password
                    </label>
                    {mode === "login" && (
                      <button
                        type="button"
                        onClick={() => {
                          setMode("forgot_password");
                          setError(null);
                          setSuccess(null);
                        }}
                        className="font-label-sm text-label-sm text-primary hover:text-primary-container transition-colors"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="material-symbols-outlined text-on-surface-variant/50 text-xl">lock</span>
                    </div>
                    <input
                      className="block w-full pl-10 pr-3 py-3 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent transition-all font-body-sm text-body-sm"
                      id="password"
                      name="password"
                      placeholder="••••••••"
                      required
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Action Button */}
              <button
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm font-label-md text-label-md text-on-primary bg-primary hover:bg-primary-container focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-container transition-colors mt-unit-lg disabled:opacity-70"
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  <span>Processing...</span>
                ) : (
                  <>
                    {mode === "login" && "Sign In"}
                    {mode === "signup" && "Sign Up"}
                    {mode === "forgot_password" && "Send Reset Link"}
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
                }}
                className="mt-4 font-label-md text-label-md text-primary hover:underline transition-colors flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">arrow_back</span>
                Back to Sign In
              </button>
            )}

            {mode !== "forgot_password" && (
              <div className="mt-unit-lg w-full">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-outline-variant/30" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-transparent text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider bg-surface/70 backdrop-blur-sm rounded-full">
                      Or continue with
                    </span>
                  </div>
                </div>
                
                <div className="mt-unit-lg grid grid-cols-2 gap-unit-md">
                  <button
                    onClick={handleGoogleLogin}
                    className="w-full inline-flex justify-center py-2.5 px-4 border border-outline-variant rounded-lg shadow-sm bg-surface-container-lowest font-label-md text-label-md text-on-surface hover:bg-surface-container-low transition-colors items-center gap-2"
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
                    Google
                  </button>
                  <button
                    onClick={() => setError("Apple login is not configured yet.")}
                    className="w-full inline-flex justify-center py-2.5 px-4 border border-outline-variant rounded-lg shadow-sm bg-surface-container-lowest font-label-md text-label-md text-on-surface hover:bg-surface-container-low transition-colors items-center gap-2"
                    type="button"
                  >
                    <svg aria-hidden="true" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M16.365 21.4397C15.419 22.8258 14.417 24.2001 12.871 24.2001C11.365 24.2001 10.871 23.2764 9.177 23.2764C7.442 23.2764 6.866 24.1601 5.485 24.1601C4.044 24.1601 2.872 22.5694 1.966 21.2638C0.0330002 18.4552 -0.995999 13.6215 1.018 10.1554C1.985 8.48705 3.654 7.37923 5.506 7.37923C6.966 7.37923 8.324 8.38407 9.208 8.38407C10.092 8.38407 11.758 7.15833 13.548 7.15833C14.316 7.15833 16.598 7.2384 18.061 9.3845C17.94 9.46457 15.526 10.8657 15.526 13.7997C15.526 17.1548 18.448 18.3397 18.489 18.3597C18.448 18.5003 17.994 20.0816 16.365 21.4397ZM12.012 4.88785C11.971 4.90787 11.93 4.90787 11.889 4.92789C11.889 4.84783 11.889 4.78778 11.889 4.70771C11.889 2.05553 14.05 0 16.702 0C16.702 2.65218 14.664 4.88785 12.012 4.88785Z" />
                    </svg>
                    Apple
                  </button>
                </div>
              </div>
            )}

            {mode !== "forgot_password" && (
              <p className="mt-unit-lg text-center font-body-sm text-body-sm text-on-surface-variant w-full">
                {mode === "login" ? (
                  <>
                    Don't have an account?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setMode("signup");
                        setError(null);
                        setSuccess(null);
                      }}
                      className="font-label-md text-label-md text-primary hover:underline transition-colors focus:outline-none"
                    >
                      Sign up
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setMode("login");
                        setError(null);
                        setSuccess(null);
                      }}
                      className="font-label-md text-label-md text-primary hover:underline transition-colors focus:outline-none"
                    >
                      Sign in
                    </button>
                  </>
                )}
              </p>
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
                    <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Latest Scan</p>
                    <p className="font-headline-sm text-headline-sm text-on-surface">Uber Technologies</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-headline-md text-headline-md text-primary font-bold">₹1,240</p>
                  <span className="inline-flex items-center gap-1 font-label-sm text-label-sm text-primary-container bg-primary-container/10 px-2 py-0.5 rounded-full mt-1">
                    <span className="material-symbols-outlined text-[14px]">auto_awesome</span> Categorized
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
            <h2 className="font-display-lg text-display-lg text-on-surface mb-unit-sm leading-tight">
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
