"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="bg-background text-on-surface font-body-md antialiased overflow-x-hidden selection:bg-primary-container selection:text-on-primary-container min-h-screen flex flex-col justify-between">
      {/* TopNavBar */}
      <nav
        className={`bg-surface/70 backdrop-blur-xl fixed w-full top-0 sticky z-50 border-b border-outline-variant/30 transition-all duration-300 ${
          scrolled ? "shadow-md" : "shadow-sm"
        }`}
      >
        <div className="flex justify-between items-center w-full max-w-container-max px-margin-page mx-auto h-16">
          {/* Brand */}
          <div className="flex items-center gap-unit-md">
            <Link href="/" className="font-headline-md text-headline-md font-bold text-primary tracking-tight">
              Expensely
            </Link>
          </div>
          {/* Web Navigation */}
          <div className="hidden md:flex items-center gap-unit-lg">
            <a className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors" href="#features">Features</a>
            <a className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors" href="#analytics">Analytics</a>
            <a className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors" href="#testimonials">Stories</a>
            <a className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors" href="#pricing">Pricing</a>
          </div>
          {/* Actions */}
          <div className="flex items-center gap-unit-md">
            <Link href="/login" className="hidden md:block font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors px-unit-md py-unit-sm">
              Sign In
            </Link>
            <Link href="/login" className="font-label-md text-label-md bg-primary-container text-on-primary-container px-unit-lg py-unit-sm rounded-full hover:bg-primary hover:text-on-primary transition-all duration-200 shadow-sm flex items-center gap-2">
              Get Started
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="w-full relative flex-1">
        {/* Background Grid */}
        <div className="absolute inset-0 bg-grid-pattern opacity-40 z-0 pointer-events-none" />

        {/* Hero Section */}
        <section className="relative z-10 pt-32 pb-24 px-margin-page max-w-container-max mx-auto overflow-hidden">
          {/* Ambient Glow */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary-fixed/20 rounded-full blur-[100px] -z-10 pointer-events-none" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-center">
            {/* Hero Text */}
            <div className="lg:col-span-6 flex flex-col gap-unit-lg">
              <div className="inline-flex items-center gap-2 px-unit-md py-unit-xs rounded-full bg-surface-container-high border border-outline-variant/30 w-fit">
                <span className="material-symbols-outlined text-[16px] text-primary">verified</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant tracking-wider uppercase">V2.0 Now Live</span>
              </div>
              <h1 className="font-display-lg text-display-lg md:text-[64px] md:leading-[72px] font-bold text-on-surface tracking-tight">
                Snap Receipts,<br />
                <span className="gradient-text">Track Smarter.</span>
              </h1>
              <p className="font-body-lg text-body-lg text-on-surface-variant max-w-[480px]">
                The hyper-clean expense intelligence platform for modern Indian startups. Automate OCR parsing, split group bills instantly, and gain absolute control over your runway.
              </p>
              <div className="flex flex-col sm:flex-row gap-unit-md pt-unit-sm">
                <Link href="/login" className="font-label-md text-label-md bg-primary-container text-on-primary-container px-8 py-4 rounded-full hover:bg-primary hover:text-on-primary transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5 flex justify-center items-center gap-2 w-full sm:w-auto">
                  Start Tracking for Free
                  <span className="material-symbols-outlined">rocket_launch</span>
                </Link>
                <button className="font-label-md text-label-md bg-surface text-on-surface border border-outline-variant px-8 py-4 rounded-full hover:border-primary/50 hover:bg-surface-container-lowest transition-all duration-300 flex justify-center items-center gap-2 w-full sm:w-auto">
                  <span className="material-symbols-outlined">play_circle</span>
                  Watch Demo
                </button>
              </div>
              <div className="flex items-center gap-unit-md pt-unit-lg border-t border-outline-variant/20 mt-unit-sm">
                <div className="flex -space-x-3">
                  <img
                    alt="User Avatar"
                    className="w-10 h-10 rounded-full border-2 border-surface-container-lowest"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuD4Ha99vnEV3EC13ZlxWSVOy8c_S_aypseNFHA_AS_ox9OmAKnhE4kV5MG4Ojpdfk0S0N6nxhEuG6GcVn5PIIhwnlmWQD5ggKooBhmNfLV8QDkSqd6xZg1I9nX5VTzk21p-NYvR-pTFJPPNegyCqFIiXKwiAbze_yGqB8X31OALsibpxe8d3WtwA5sqb4FhTYf-TmDoPFzd7qBzXRKnpTmPxgK8mN5gXD6njpbMoNaQ3hpLuaXRFqGIRnQQDkpVj_3dskp974E5uczy"
                  />
                  <img
                    alt="User Avatar"
                    className="w-10 h-10 rounded-full border-2 border-surface-container-lowest"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuCDlnKCU0YWRgxJq5KJ6eHOcBpbXq3XlFpxUWR6SnUyU6g_6W8AtUrcbrmZIE_wkW8f_IZAkKGz_PjXeM6K9_-Mxswcf42mOLwh97kYP3i_nNGl9aNj2AykBJIKGL3NdgVOXZuo98Jqg3UjJy3rBo5eYAcxaqs4GxvvN-4B7T5LIM01j_i8QGSgOKrb-T9AJlzIxKx8WUfl3bL804G0PYjh_0SY-pQILuBvkVcSkyv_BoBFIzuc9ngZS2QX7Dp1MggGVhNlLgP2V2sw"
                  />
                  <img
                    alt="User Avatar"
                    className="w-10 h-10 rounded-full border-2 border-surface-container-lowest"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuAZ3ikUqENfc2lignznfsNzT1sDpQBrMpGbHPaFLS87xTSPHWxKVXBLv47fVOpPvHrOjpe501soIxJCBmFdrBxBFp1Rhvtc4QhwQidiM5sxn0tPv88TfdhGW_x_myNg0OuQKU_4LXIMW8RgYtKpxeY2Fpf4w7x-1ozfacgnQt773sEYmxmSJkHQ5QFTY8GIhENBkAs5Hbv8H4i-2RZy-kP3ATUo-50gMvM640nN4V1jUZcNPFfNhpPHbVxTEH80KfsY_XXDswrS4rgT"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="font-label-md text-label-md text-on-surface font-semibold">Trusted by 2,000+ Founders</span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">Rated 4.9/5 on G2</span>
                </div>
              </div>
            </div>
            {/* Hero Visual (Bento-style preview) */}
            <div className="lg:col-span-6 relative mt-12 lg:mt-0">
              {/* Main App Card */}
              <div className="glass-panel rounded-2xl p-6 ambient-shadow relative z-20 transform transition-transform duration-700 hover:scale-[1.01] border border-white/40">
                {/* Top Bar Mock */}
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-surface-container-lowest shadow-sm flex items-center justify-center p-1">
                      <img
                        alt="Expensely Logo"
                        className="w-full h-full object-contain rounded-lg"
                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuDfBzS6H0L9gz--Gsg1GCHXTCO8TeuK2d5mv6a1jyIZaivOJfmvS18wzKgqIIJnYMca_HBkXno2j5nKVhX1uUGL04k-kpceQoaOtwzXjbCofBiISOZ3EYI1E_LkFLCUaf7IjlJ_mdfbAf-4LlASOqEsemPGxEfkZIR_xNlzBnS7lc-a4k_uxU_y-7qlrl9XliaghifmcIK6-GikE6mAldvskTV0p9lWLItkR1D49Rz55iKrtroxi_6waQoHjp0lSKYDEHJomyGdW24c"
                      />
                    </div>
                    <div>
                      <div className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Total Balance</div>
                      <div className="font-headline-sm text-headline-sm text-on-surface">₹ 12,45,000</div>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-outline-variant cursor-pointer">more_horiz</span>
                </div>
                {/* Data Table Mock */}
                <div className="space-y-3">
                  {/* Row 1 */}
                  <div className="flex justify-between items-center p-3 rounded-lg hover:bg-surface-container-lowest transition-colors border border-transparent hover:border-outline-variant/30">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-secondary-container/20 flex items-center justify-center text-secondary">
                        <span className="material-symbols-outlined text-[20px]">flight</span>
                      </div>
                      <div>
                        <div className="font-label-md text-label-md text-on-surface">IndiGo Airlines</div>
                        <div className="font-label-sm text-label-sm text-on-surface-variant">Delhi to Blr • Business</div>
                      </div>
                    </div>
                    <div className="font-label-md text-label-md text-on-surface text-right font-semibold">₹ 8,450</div>
                  </div>
                  {/* Row 2 */}
                  <div className="flex justify-between items-center p-3 rounded-lg hover:bg-surface-container-lowest transition-colors border border-transparent hover:border-outline-variant/30">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-tertiary-container/20 flex items-center justify-center text-tertiary">
                        <span className="material-symbols-outlined text-[20px]">computer</span>
                      </div>
                      <div>
                        <div className="font-label-md text-label-md text-on-surface">AWS Cloud</div>
                        <div className="font-label-sm text-label-sm text-on-surface-variant">Infrastructure • Monthly</div>
                      </div>
                    </div>
                    <div className="font-label-md text-label-md text-on-surface text-right font-semibold">₹ 42,100</div>
                  </div>
                  {/* Row 3 */}
                  <div className="flex justify-between items-center p-3 rounded-lg hover:bg-surface-container-lowest transition-colors border border-transparent hover:border-outline-variant/30">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-error-container/30 flex items-center justify-center text-error">
                        <span className="material-symbols-outlined text-[20px]">restaurant</span>
                      </div>
                      <div>
                        <div className="font-label-md text-label-md text-on-surface">Bombay Canteen</div>
                        <div className="font-label-sm text-label-sm text-on-surface-variant">Team Lunch • 6 Pax</div>
                      </div>
                    </div>
                    <div className="font-label-md text-label-md text-on-surface text-right font-semibold">₹ 14,200</div>
                  </div>
                </div>
              </div>
              {/* Floating AI Widget */}
              <div className="absolute -right-8 -bottom-8 glass-panel rounded-xl p-5 w-[240px] z-30 ambient-shadow border-t-2 border-t-tertiary/50 hidden md:block">
                <div className="flex items-center gap-3 mb-2">
                  <span className="material-symbols-outlined text-tertiary">auto_awesome</span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">AI Insight</span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface">SaaS spend increased by 14% this month. Review unused licenses.</p>
              </div>
              {/* Floating Scan Widget */}
              <div className="absolute -left-6 top-12 glass-panel rounded-xl p-3 z-30 ambient-shadow flex items-center gap-3 hidden md:flex border-l-2 border-l-primary-container">
                <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container">
                  <span className="material-symbols-outlined text-[16px]">document_scanner</span>
                </div>
                <div className="font-label-md text-label-md text-on-surface">Receipt Parsed <br /><span className="text-primary text-[12px]">0.4s</span></div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 px-margin-page relative overflow-hidden">
          <div className="max-w-container-max mx-auto">
            <div className="glass-panel rounded-[32px] p-12 md:p-20 text-center relative overflow-hidden ambient-shadow border-primary/20">
              <div className="absolute inset-0 bg-gradient-to-br from-surface to-surface-container-high opacity-50 -z-10" />
              <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-[80px] -z-10" />
              <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-secondary/10 rounded-full blur-[80px] -z-10" />
              <h2 className="font-headline-lg text-headline-lg md:text-display-lg md:leading-tight font-bold text-on-surface mb-6">
                Ready to achieve absolute <br />financial clarity?
              </h2>
              <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl mx-auto mb-10">
                Join thousands of modern founders who have upgraded their expense intelligence. Setup takes less than 2 minutes.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-unit-md">
                <Link href="/login" className="font-label-md text-label-md bg-primary-container text-on-primary-container px-10 py-5 rounded-full hover:bg-primary hover:text-on-primary transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1 flex justify-center items-center gap-2">
                  Start Tracking for Free
                  <span className="material-symbols-outlined">arrow_forward</span>
                </Link>
              </div>
              <p className="font-label-sm text-label-sm text-on-surface-variant mt-6">No credit card required. 14-day free trial on Pro.</p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-surface-container-lowest border-t border-outline-variant/30 mt-20">
        <div className="max-w-container-max mx-auto px-margin-page py-unit-xl flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <span className="font-headline-sm text-headline-sm font-bold text-on-surface">Expensely</span>
            <span className="text-outline-variant">|</span>
            <span className="font-body-sm text-body-sm text-on-surface-variant">© 2024 Expensely Inc. All rights reserved.</span>
          </div>
          <nav className="flex gap-6">
            <a className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors cursor-pointer" onClick={(e) => { e.preventDefault(); alert("Privacy Policy coming soon"); }}>Privacy Policy</a>
            <a className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors cursor-pointer" onClick={(e) => { e.preventDefault(); alert("Terms of Service coming soon"); }}>Terms of Service</a>
            <a className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors cursor-pointer" onClick={(e) => { e.preventDefault(); alert("Security coming soon"); }}>Security</a>
            <a className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors cursor-pointer" onClick={(e) => { e.preventDefault(); alert("Status coming soon"); }}>Status</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
