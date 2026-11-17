"use client";

import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";

export default function PricingPage() {
  const { t } = useLanguage();

  return (
    <main className="flex-1 p-4 md:p-margin-page max-w-[1200px] mx-auto w-full relative">
      {/* Page Header */}
      <div className="text-center mb-12 max-w-2xl mx-auto">
        <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary px-3.5 py-1.5 rounded-full font-label-md text-[13px] font-bold mb-4">
          <span className="material-symbols-outlined text-[16px]">workspace_premium</span>
          {t("pricing_page_badge")}
        </span>
        <h2 className="font-headline-lg text-[32px] md:text-[40px] leading-[40px] md:leading-[48px] font-black text-on-surface mb-4">
          {t("pricing_page_title")}
        </h2>
        <p className="font-body-md text-[16px] leading-[24px] text-on-surface-variant">
          {t("pricing_page_subtitle")}
        </p>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-16">
        {/* Free Plan */}
        <div className="glass-panel p-8 rounded-2xl border border-outline-variant/35 relative overflow-hidden flex flex-col justify-between group hover:border-outline-variant transition-all duration-300">
          <div>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="font-headline-sm text-[22px] font-bold text-on-surface">{t("plan_starter_name")}</h3>
                <p className="font-body-sm text-[13px] text-on-surface-variant mt-1">{t("pricing_starter_desc")}</p>
              </div>
            </div>

            <div className="mb-6 flex items-baseline gap-1">
              <span className="text-[40px] font-black text-on-surface">₹0</span>
              <span className="text-[14px] text-on-surface-variant font-medium">{t("pricing_per_user_month")}</span>
            </div>

            <hr className="border-outline-variant/20 my-6" />

            <ul className="space-y-4 mb-8">
              <li className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-[20px]">check_circle</span>
                <span className="font-body-sm text-[14px] text-on-surface-variant">{t("pricing_free_feat1")}</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-[20px]">check_circle</span>
                <span className="font-body-sm text-[14px] text-on-surface-variant">{t("pricing_free_feat2")}</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-[20px]">check_circle</span>
                <span className="font-body-sm text-[14px] text-on-surface-variant">{t("pricing_free_feat3")}</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-[20px]">check_circle</span>
                <span className="font-body-sm text-[14px] text-on-surface-variant">{t("pricing_free_feat4")}</span>
              </li>
            </ul>
          </div>

          <button
            disabled
            className="w-full py-3 bg-surface-container-high text-on-surface-variant font-label-md text-[14px] font-bold rounded-lg border border-outline-variant/30 cursor-not-allowed text-center"
          >
            {t("pricing_current_plan")}
          </button>
        </div>

        {/* Pro Plan */}
        <div className="glass-panel p-8 rounded-2xl border-2 border-primary relative overflow-hidden flex flex-col justify-between group shadow-lg">
          {/* Popular Badge */}
          <div className="absolute top-0 right-0 bg-primary text-on-primary font-label-sm text-[11px] font-bold px-4 py-1.5 rounded-bl-xl uppercase tracking-wider">
            {t("pricing_pro_badge")}
          </div>

          <div>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="font-headline-sm text-[22px] font-bold text-on-surface">{t("plan_pro_name")}</h3>
                <p className="font-body-sm text-[13px] text-on-surface-variant mt-1">{t("pricing_pro_subtitle")}</p>
              </div>
            </div>

            <div className="mb-6 flex items-baseline gap-1">
              <span className="text-[40px] font-black text-on-surface">₹799</span>
              <span className="text-[14px] text-on-surface-variant font-medium">{t("pricing_per_user_month")}</span>
            </div>

            <hr className="border-primary/20 my-6" />

            <ul className="space-y-4 mb-8">
              <li className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-[20px]">check_circle</span>
                <span className="font-body-sm text-[14px] text-on-surface-variant font-semibold">{t("pricing_pro_feat1")}</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-[20px]">check_circle</span>
                <span className="font-body-sm text-[14px] text-on-surface-variant">{t("pricing_pro_feat2")}</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-[20px]">check_circle</span>
                <span className="font-body-sm text-[14px] text-on-surface-variant">{t("pricing_pro_feat3")}</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-[20px]">check_circle</span>
                <span className="font-body-sm text-[14px] text-on-surface-variant">{t("pricing_pro_feat4")}</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-[20px]">check_circle</span>
                <span className="font-body-sm text-[14px] text-on-surface-variant">{t("pricing_pro_feat5")}</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-[20px]">check_circle</span>
                <span className="font-body-sm text-[14px] text-on-surface-variant">{t("pricing_pro_feat6")}</span>
              </li>
            </ul>
          </div>

          <button
            disabled
            className="w-full py-3 bg-surface-container-high text-on-surface-variant font-label-md text-[14px] font-bold rounded-lg border border-outline-variant/30 cursor-not-allowed flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">lock</span>
            {t("pricing_coming_soon")}
          </button>
        </div>
      </div>

      {/* Guarantee Section */}
      <div className="text-center py-6 border-t border-outline-variant/20 text-on-surface-variant max-w-xl mx-auto">
        <p className="font-body-sm text-[13px]">
          {t("pricing_faq_footer")}{" "}
          <Link href="/help" className="text-primary hover:underline font-semibold">
            {t("pricing_contact_support")}
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
