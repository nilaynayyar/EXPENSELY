"use client";

import Link from "next/link";

export default function PricingPage() {
  return (
    <main className="flex-1 p-4 md:p-margin-page max-w-[1200px] mx-auto w-full relative">
      {/* Page Header */}
      <div className="text-center mb-12 max-w-2xl mx-auto">
        <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary px-3.5 py-1.5 rounded-full font-label-md text-[13px] font-bold mb-4">
          <span className="material-symbols-outlined text-[16px]">workspace_premium</span>
          Membership Plans
        </span>
        <h2 className="font-headline-lg text-[32px] md:text-[40px] leading-[40px] md:leading-[48px] font-black text-on-surface mb-4">
          Supercharge your runway tracking.
        </h2>
        <p className="font-body-md text-[16px] leading-[24px] text-on-surface-variant">
          Upgrade from basic manual entry to premium receipt intelligence. Free forever for developers, scalable for modern startups.
        </p>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-16">
        {/* Free Plan */}
        <div className="glass-panel p-8 rounded-2xl border border-outline-variant/35 relative overflow-hidden flex flex-col justify-between group hover:border-outline-variant transition-all duration-300">
          <div>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="font-headline-sm text-[22px] font-bold text-on-surface">Starter</h3>
                <p className="font-body-sm text-[13px] text-on-surface-variant mt-1">Manual logging & splitting</p>
              </div>
            </div>

            <div className="mb-6 flex items-baseline gap-1">
              <span className="text-[40px] font-black text-on-surface">₹0</span>
              <span className="text-[14px] text-on-surface-variant font-medium">/ user / month</span>
            </div>

            <hr className="border-outline-variant/20 my-6" />

            <ul className="space-y-4 mb-8">
              <li className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-[20px]">check_circle</span>
                <span className="font-body-sm text-[14px] text-on-surface-variant">Unlimited manual expenses</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-[20px]">check_circle</span>
                <span className="font-body-sm text-[14px] text-on-surface-variant">Basic budgeting goals (up to 3 categories)</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-[20px]">check_circle</span>
                <span className="font-body-sm text-[14px] text-on-surface-variant">Shared billing groups (up to 2 groups)</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-[20px]">check_circle</span>
                <span className="font-body-sm text-[14px] text-on-surface-variant">Standard transactions search & export</span>
              </li>
            </ul>
          </div>

          <button
            disabled
            className="w-full py-3 bg-surface-container-high text-on-surface-variant font-label-md text-[14px] font-bold rounded-lg border border-outline-variant/30 cursor-not-allowed text-center"
          >
            Current Plan
          </button>
        </div>

        {/* Pro Plan */}
        <div className="glass-panel p-8 rounded-2xl border-2 border-primary relative overflow-hidden flex flex-col justify-between group shadow-lg">
          {/* Popular Badge */}
          <div className="absolute top-0 right-0 bg-primary text-on-primary font-label-sm text-[11px] font-bold px-4 py-1.5 rounded-bl-xl uppercase tracking-wider">
            Premium
          </div>

          <div>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="font-headline-sm text-[22px] font-bold text-on-surface">Expensely Pro</h3>
                <p className="font-body-sm text-[13px] text-on-surface-variant mt-1">Autonomous expense collection</p>
              </div>
            </div>

            <div className="mb-6 flex items-baseline gap-1">
              <span className="text-[40px] font-black text-on-surface">₹799</span>
              <span className="text-[14px] text-on-surface-variant font-medium">/ user / month</span>
            </div>

            <hr className="border-primary/20 my-6" />

            <ul className="space-y-4 mb-8">
              <li className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-[20px]">check_circle</span>
                <span className="font-body-sm text-[14px] text-on-surface-variant font-semibold">Unlimited browser OCR receipt scans</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-[20px]">check_circle</span>
                <span className="font-body-sm text-[14px] text-on-surface-variant">Unauthenticated Mobile QR uploads</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-[20px]">check_circle</span>
                <span className="font-body-sm text-[14px] text-on-surface-variant">Unlimited shared billing groups</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-[20px]">check_circle</span>
                <span className="font-body-sm text-[14px] text-on-surface-variant">Multi-currency conversions & sync</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-[20px]">check_circle</span>
                <span className="font-body-sm text-[14px] text-on-surface-variant">Advanced runways & analytics graphs</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-[20px]">check_circle</span>
                <span className="font-body-sm text-[14px] text-on-surface-variant">Priority email support (under 12h)</span>
              </li>
            </ul>
          </div>

          <button
            disabled
            className="w-full py-3 bg-surface-container-high text-on-surface-variant font-label-md text-[14px] font-bold rounded-lg border border-outline-variant/30 cursor-not-allowed flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">lock</span>
            Coming Soon (Beta)
          </button>
        </div>
      </div>

      {/* Guarantee Section */}
      <div className="text-center py-6 border-t border-outline-variant/20 text-on-surface-variant max-w-xl mx-auto">
        <p className="font-body-sm text-[13px]">
          Have questions about startup licenses, educational discounts, or enterprise volume pricing?{" "}
          <Link href="/help" className="text-primary hover:underline font-semibold">
            Contact support
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
