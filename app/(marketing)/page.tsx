"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [footerModal, setFooterModal] = useState<{ title: string; body: string } | null>(null);
  const { t, language, setLanguage, supportedLanguages } = useLanguage();

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
              {t("app_name")}
            </Link>
          </div>

          {/* Web Navigation */}
          <div className="hidden md:flex items-center gap-unit-lg">
            <a className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors" href="#features">
              {t("nav_features")}
            </a>
            <a className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors" href="#analytics">
              {t("nav_analytics")}
            </a>
            <a className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors" href="#testimonials">
              {t("nav_stories")}
            </a>
            <a className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors" href="#pricing">
              {t("nav_pricing")}
            </a>
          </div>

          {/* Actions & Language Selector */}
          <div className="flex items-center gap-unit-md">
            {/* Language Picker */}
            <div className="relative">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                aria-label={t("settings_language_label")}
                className="bg-surface border border-outline-variant/40 rounded-full px-3 py-1.5 text-xs text-on-surface font-medium focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                {supportedLanguages.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
            </div>

            <Link
              href="/login"
              className="hidden md:block font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors px-unit-md py-unit-sm"
            >
              {t("nav_sign_in")}
            </Link>
            <Link
              href="/login"
              className="font-label-md text-label-md bg-primary-container text-on-primary-container px-unit-lg py-unit-sm rounded-full hover:bg-primary hover:text-on-primary transition-all duration-200 shadow-sm flex items-center gap-2 font-bold"
            >
              {t("hero_cta_primary")}
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
                <span className="font-label-sm text-label-sm text-on-surface-variant tracking-wider uppercase">
                  {t("hero_badge")}
                </span>
              </div>
              <h1 className="font-display-lg text-display-lg md:text-[64px] md:leading-[72px] font-bold text-on-surface tracking-tight">
                {t("hero_title_1")}<br />
                <span className="gradient-text">{t("hero_title_highlight")}</span>
              </h1>
              <p className="font-body-lg text-body-lg text-on-surface-variant max-w-[480px]">
                {t("hero_description")}
              </p>
              <div className="flex flex-col sm:flex-row gap-unit-md pt-unit-sm">
                <Link
                  href="/login"
                  className="font-label-md text-label-md bg-primary-container text-on-primary-container px-8 py-4 rounded-full hover:bg-primary hover:text-on-primary transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5 flex justify-center items-center gap-2 w-full sm:w-auto font-bold text-center"
                >
                  {t("hero_cta_primary")}
                  <span className="material-symbols-outlined">rocket_launch</span>
                </Link>
              </div>
              <div className="flex items-center gap-unit-md pt-unit-lg border-t border-outline-variant/20 mt-unit-sm">
                <div className="flex -space-x-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 border-2 border-surface flex items-center justify-center font-bold text-xs text-primary">
                    JD
                  </div>
                  <div className="w-10 h-10 rounded-full bg-secondary/20 border-2 border-surface flex items-center justify-center font-bold text-xs text-secondary">
                    AM
                  </div>
                  <div className="w-10 h-10 rounded-full bg-tertiary/20 border-2 border-surface flex items-center justify-center font-bold text-xs text-tertiary">
                    SK
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="font-label-md text-label-md text-on-surface font-semibold">
                    {t("hero_trusted_by")}
                  </span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">{t("hero_rating")}</span>
                </div>
              </div>
            </div>

            {/* Hero Visual (Bento-style preview) */}
            <div className="lg:col-span-6 relative mt-12 lg:mt-0">
              <div className="glass-panel rounded-2xl p-6 ambient-shadow relative z-20 transform transition-transform duration-700 hover:scale-[1.01] border border-white/40">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-surface-container-lowest shadow-sm flex items-center justify-center p-1">
                      <Image
                        alt="Expensely Logo"
                        width={36}
                        height={36}
                        className="object-contain rounded-lg"
                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuDfBzS6H0L9gz--Gsg1GCHXTCO8TeuK2d5mv6a1jyIZaivOJfmvS18wzKgqIIJnYMca_HBkXno2j5nKVhX1uUGL04k-kpceQoaOtwzXjbCofBiISOZ3EYI1E_LkFLCUaf7IjlJ_mdfbAf-4LlASOqEsemPGxEfkZIR_xNlzBnS7lc-a4k_uxU_y-7qlrl9XliaghifmcIK6-GikE6mAldvskTV0p9lWLItkR1D49Rz55iKrtroxi_6waQoHjp0lSKYDEHJomyGdW24c"
                        unoptimized
                      />
                    </div>
                    <div>
                      <div className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                        {t("hero_live_runway")}
                      </div>
                      <div className="font-headline-sm text-headline-sm text-on-surface font-bold">{t("hero_runway_months")}</div>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-outline-variant">more_horiz</span>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 rounded-lg hover:bg-surface-container-lowest transition-colors border border-transparent hover:border-outline-variant/30">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-secondary-container/20 flex items-center justify-center text-secondary">
                        <span className="material-symbols-outlined text-[20px]">flight</span>
                      </div>
                      <div>
                        <div className="font-label-md text-label-md text-on-surface font-semibold">IndiGo Airlines</div>
                        <div className="font-label-sm text-label-sm text-on-surface-variant">Delhi to Blr • Business</div>
                      </div>
                    </div>
                    <div className="font-label-md text-label-md text-on-surface text-right font-semibold">₹ 8,450</div>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg hover:bg-surface-container-lowest transition-colors border border-transparent hover:border-outline-variant/30">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-tertiary-container/20 flex items-center justify-center text-tertiary">
                        <span className="material-symbols-outlined text-[20px]">computer</span>
                      </div>
                      <div>
                        <div className="font-label-md text-label-md text-on-surface font-semibold">AWS Cloud</div>
                        <div className="font-label-sm text-label-sm text-on-surface-variant">Infrastructure • Monthly</div>
                      </div>
                    </div>
                    <div className="font-label-md text-label-md text-on-surface text-right font-semibold">₹ 42,100</div>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg hover:bg-surface-container-lowest transition-colors border border-transparent hover:border-outline-variant/30">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-error-container/30 flex items-center justify-center text-error">
                        <span className="material-symbols-outlined text-[20px]">restaurant</span>
                      </div>
                      <div>
                        <div className="font-label-md text-label-md text-on-surface font-semibold">Bombay Canteen</div>
                        <div className="font-label-sm text-label-sm text-on-surface-variant">Team Lunch • 6 Pax</div>
                      </div>
                    </div>
                    <div className="font-label-md text-label-md text-on-surface text-right font-semibold">₹ 14,200</div>
                  </div>
                </div>
              </div>
              <div className="absolute -right-8 -bottom-8 glass-panel rounded-xl p-5 w-[240px] z-30 ambient-shadow border-t-2 border-t-tertiary/50 hidden md:block">
                <div className="flex items-center gap-3 mb-2">
                  <span className="material-symbols-outlined text-tertiary">auto_awesome</span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                    {t("hero_verified_ocr")}
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface">
                  {t("hero_ocr_status")}
                </p>
              </div>
              <div className="absolute -left-6 top-12 glass-panel rounded-xl p-3 z-30 ambient-shadow flex items-center gap-3 hidden md:flex border-l-2 border-l-primary-container">
                <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container">
                  <span className="material-symbols-outlined text-[16px]">document_scanner</span>
                </div>
                <div className="font-label-md text-label-md text-on-surface">
                  {t("hero_ocr_accuracy")} <br />
                  <span className="text-primary text-[12px] font-bold">0.4s</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-24 px-margin-page max-w-container-max mx-auto border-t border-outline-variant/20">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="font-label-sm text-xs uppercase tracking-wider text-primary font-bold bg-primary/10 px-3 py-1 rounded-full">
              {t("features_badge")}
            </span>
            <h2 className="font-headline-lg text-[36px] font-bold text-on-surface mt-4 mb-4">
              {t("features_title")}
            </h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant">
              {t("features_subtitle")}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="glass-panel p-8 rounded-2xl border border-outline-variant/30 hover:border-primary/50 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-6">
                <span className="material-symbols-outlined text-[28px]">document_scanner</span>
              </div>
              <h3 className="font-headline-sm text-[20px] font-bold text-on-surface mb-2">{t("feature_ocr_title")}</h3>
              <p className="font-body-sm text-on-surface-variant leading-relaxed">
                {t("feature_ocr_desc")}
              </p>
            </div>
            <div className="glass-panel p-8 rounded-2xl border border-outline-variant/30 hover:border-primary/50 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary mb-6">
                <span className="material-symbols-outlined text-[28px]">group</span>
              </div>
              <h3 className="font-headline-sm text-[20px] font-bold text-on-surface mb-2">{t("feature_groups_title")}</h3>
              <p className="font-body-sm text-on-surface-variant leading-relaxed">
                {t("feature_groups_desc")}
              </p>
            </div>
            <div className="glass-panel p-8 rounded-2xl border border-outline-variant/30 hover:border-primary/50 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-tertiary/10 flex items-center justify-center text-tertiary mb-6">
                <span className="material-symbols-outlined text-[28px]">monitoring</span>
              </div>
              <h3 className="font-headline-sm text-[20px] font-bold text-on-surface mb-2">{t("feature_budgets_title")}</h3>
              <p className="font-body-sm text-on-surface-variant leading-relaxed">
                {t("feature_budgets_desc")}
              </p>
            </div>
          </div>
        </section>

        {/* Analytics Section */}
        <section id="analytics" className="py-24 px-margin-page max-w-container-max mx-auto border-t border-outline-variant/20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="font-label-sm text-xs uppercase tracking-wider text-tertiary font-bold bg-tertiary/10 px-3 py-1 rounded-full">
                {t("analytics_title")}
              </span>
              <h2 className="font-headline-lg text-[36px] font-bold text-on-surface mt-4 mb-4">
                {t("feature_analytics_title")}
              </h2>
              <p className="font-body-lg text-body-lg text-on-surface-variant mb-6 leading-relaxed">
                {t("feature_analytics_desc")}
              </p>
              <ul className="space-y-3 font-body-sm text-on-surface-variant">
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[18px]">check_circle</span>
                  {t("analytics_spending_trend")}
                </li>
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[18px]">check_circle</span>
                  {t("analytics_recommendations")}
                </li>
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[18px]">check_circle</span>
                  {t("analytics_export_btn")}
                </li>
              </ul>
            </div>
            <div className="glass-panel p-8 rounded-2xl border border-outline-variant/30">
              <div className="flex justify-between items-center mb-6">
                <span className="font-label-md font-bold text-on-surface">{t("hero_budget_utilization")}</span>
                <span className="text-primary font-bold text-lg">94/100</span>
              </div>
              <div className="w-full bg-surface-container rounded-full h-3 mb-6 overflow-hidden">
                <div className="bg-primary h-3 rounded-full w-[94%]" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/20">
                  <span className="font-label-sm text-xs text-on-surface-variant">{t("hero_verified_ocr")}</span>
                  <p className="font-headline-md text-xl font-bold text-on-surface mt-1">98.2%</p>
                </div>
                <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/20">
                  <span className="font-label-sm text-xs text-on-surface-variant">{t("hero_active_budgets")}</span>
                  <p className="font-headline-md text-xl font-bold text-on-surface mt-1">100%</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stories / Testimonials Section */}
        <section id="testimonials" className="py-24 px-margin-page max-w-container-max mx-auto border-t border-outline-variant/20">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="font-label-sm text-xs uppercase tracking-wider text-secondary font-bold bg-secondary/10 px-3 py-1 rounded-full">
              {t("nav_stories")}
            </span>
            <h2 className="font-headline-lg text-[36px] font-bold text-on-surface mt-4 mb-4">
              {t("hero_trusted_by")}
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="glass-panel p-8 rounded-2xl border border-outline-variant/30">
              <p className="font-body-md text-on-surface-variant italic mb-6">
                &quot;Expensely completely eliminated receipt collection chaos for our 18-person remote team. The QR camera upload workflow makes mobile receipts effortless.&quot;
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-sm">
                  RK
                </div>
                <div>
                  <h4 className="font-label-md font-bold text-on-surface">Rohan Kapoor</h4>
                  <p className="font-label-sm text-xs text-on-surface-variant">Founder, VectorPay</p>
                </div>
              </div>
            </div>
            <div className="glass-panel p-8 rounded-2xl border border-outline-variant/30">
              <p className="font-body-md text-on-surface-variant italic mb-6">
                &quot;The instant settlement math saved us hours after our offsite. Seeing exact transfer pairs rather than messy spreadsheets is pure relief.&quot;
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold text-sm">
                  PS
                </div>
                <div>
                  <h4 className="font-label-md font-bold text-on-surface">Pooja Sharma</h4>
                  <p className="font-label-sm text-xs text-on-surface-variant">COO, HyperScale Media</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-24 px-margin-page max-w-container-max mx-auto border-t border-outline-variant/20">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="font-label-sm text-xs uppercase tracking-wider text-primary font-bold bg-primary/10 px-3 py-1 rounded-full">
              {t("pricing_badge")}
            </span>
            <h2 className="font-headline-lg text-[36px] font-bold text-on-surface mt-4 mb-4">
              {t("pricing_title")}
            </h2>
            <p className="text-on-surface-variant text-sm">{t("pricing_subtitle")}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="glass-panel p-8 rounded-2xl border border-outline-variant/35 flex flex-col justify-between">
              <div>
                <h3 className="font-headline-sm text-2xl font-bold text-on-surface">{t("plan_starter_name")}</h3>
                <p className="text-sm text-on-surface-variant mt-1 mb-4">{t("plan_starter_desc")}</p>
                <div className="text-4xl font-extrabold text-on-surface mb-6">{t("plan_starter_price")}</div>
                <ul className="space-y-3 font-body-sm text-on-surface-variant mb-8">
                  <li className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[18px]">check</span> {t("expenses_title")}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[18px]">check</span> {t("scanner_title")}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[18px]">check</span> {t("groups_title")}
                  </li>
                </ul>
              </div>
              <Link href="/login" className="w-full py-3 bg-surface border border-outline-variant rounded-lg text-center font-bold text-on-surface hover:bg-surface-container transition-colors">
                {t("plan_starter_cta")}
              </Link>
            </div>
            <div className="glass-panel p-8 rounded-2xl border-2 border-primary flex flex-col justify-between relative shadow-lg">
              <span className="absolute top-0 right-0 bg-primary text-on-primary text-xs font-bold px-3 py-1 rounded-bl-lg uppercase">
                Pro
              </span>
              <div>
                <h3 className="font-headline-sm text-2xl font-bold text-on-surface">{t("plan_pro_name")}</h3>
                <p className="text-sm text-on-surface-variant mt-1 mb-4">{t("plan_pro_desc")}</p>
                <div className="text-4xl font-extrabold text-on-surface mb-6">
                  {t("plan_pro_price")} <span className="text-sm font-normal text-on-surface-variant">{t("plan_pro_period")}</span>
                </div>
                <ul className="space-y-3 font-body-sm text-on-surface-variant mb-8">
                  <li className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[18px]">check</span> {t("analytics_title")}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[18px]">check</span> {t("budgets_title")}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[18px]">check</span> {t("analytics_recommendations")}
                  </li>
                </ul>
              </div>
              <Link href="/login" className="w-full py-3 bg-primary text-on-primary rounded-lg text-center font-bold hover:opacity-90 transition-opacity">
                {t("plan_pro_cta")}
              </Link>
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
                {t("hero_title_1")} <br />{t("hero_title_highlight")}
              </h2>
              <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl mx-auto mb-10">
                {t("hero_description")}
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Link
                  href="/login"
                  className="font-label-md text-label-md bg-primary text-on-primary px-8 py-4 rounded-full hover:bg-primary-container hover:text-on-primary-container transition-all shadow-md font-bold text-center"
                >
                  {t("hero_cta_primary")}
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-surface border-t border-outline-variant/30 py-12 px-margin-page transition-colors">
        <div className="max-w-container-max mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-col items-center md:items-start gap-1">
            <span className="font-headline-md text-headline-md font-bold text-primary tracking-tight">
              {t("app_name")}
            </span>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              {t("footer_tagline")}
            </p>
            <p className="font-label-sm text-xs text-on-surface-variant/70 mt-2">
              {t("footer_copyright")}
            </p>
          </div>
          <nav className="flex flex-wrap justify-center gap-6 font-label-md text-label-md text-on-surface-variant">
            <button
              onClick={() =>
                setFooterModal({
                  title: t("footer_privacy"),
                  body: "Expensely enforces zero-knowledge client-side encryption for receipts and sensitive company financial data. We never sell or train public models on your confidential corporate expenses.",
                })
              }
              className="hover:text-primary transition-colors cursor-pointer"
            >
              {t("footer_privacy")}
            </button>
            <button
              onClick={() =>
                setFooterModal({
                  title: t("footer_terms"),
                  body: "By accessing Expensely, you agree to our standard SaaS service terms including 99.9% uptime commitments and strict adherence to enterprise data protection protocols.",
                })
              }
              className="hover:text-primary transition-colors cursor-pointer"
            >
              {t("footer_terms")}
            </button>
            <button
              onClick={() =>
                setFooterModal({
                  title: t("footer_security"),
                  body: "All network traffic is encrypted with TLS 1.3. Receipts are saved in isolated private storage buckets guarded by PostgreSQL Row-Level Security policies.",
                })
              }
              className="hover:text-primary transition-colors cursor-pointer"
            >
              {t("footer_security")}
            </button>
            <button
              onClick={() =>
                setFooterModal({
                  title: t("footer_status"),
                  body: "All Systems Operational. Supabase Auth, PostgreSQL Engine, and Tesseract OCR Pipelines running normally.",
                })
              }
              className="hover:text-primary transition-colors cursor-pointer"
            >
              {t("footer_status")}
            </button>
          </nav>
        </div>
      </footer>

      {/* Footer Info Modal */}
      {footerModal && (
        <div className="fixed inset-0 bg-on-background/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface rounded-2xl shadow-2xl p-6 relative luminous-border">
            <button
              onClick={() => setFooterModal(null)}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface cursor-pointer"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <h3 className="font-headline-sm text-lg font-bold text-on-surface mb-3">{footerModal.title}</h3>
            <p className="font-body-sm text-sm text-on-surface-variant leading-relaxed mb-6">{footerModal.body}</p>
            <button
              onClick={() => setFooterModal(null)}
              className="w-full py-2 bg-primary text-on-primary rounded-lg font-bold cursor-pointer"
            >
              {t("common_dismiss")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
