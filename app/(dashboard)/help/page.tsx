"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useLanguage } from "@/components/LanguageProvider";

interface SubmittedReport {
  id: string;
  title: string;
  severity: string;
  status: string;
  createdAt: string;
}

export default function HelpCenterPage() {
  const { t } = useLanguage();
  const [openFAQIndex, setOpenFAQIndex] = useState<number | null>(null);

  const FAQ_ITEMS = [
    {
      question: t("faq_q1"),
      answer: t("faq_a1"),
    },
    {
      question: t("faq_q2"),
      answer: t("faq_a2"),
    },
    {
      question: t("faq_q3"),
      answer: t("faq_a3"),
    },
    {
      question: t("faq_q4"),
      answer: t("faq_a4"),
    },
  ];

  // Bug Report Form State
  const [bugTitle, setBugTitle] = useState("");
  const [bugDescription, setBugDescription] = useState("");
  const [bugSeverity, setBugSeverity] = useState("Medium");
  const [submitting, setSubmitting] = useState(false);
  const [lastReportId, setLastReportId] = useState<string | null>(null);
  const [recentReports, setRecentReports] = useState<SubmittedReport[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("expensely_bug_reports");
        if (stored) return JSON.parse(stored);
      } catch {
        // ignore
      }
    }
    return [];
  });

  const toggleFAQ = (index: number) => {
    setOpenFAQIndex(openFAQIndex === index ? null : index);
  };

  const handleBugReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bugTitle.trim() || !bugDescription.trim()) return;

    setSubmitting(true);
    const reportId = `EXP-${Date.now().toString().slice(-5)}`;

    const newReport: SubmittedReport = {
      id: reportId,
      title: bugTitle.trim(),
      severity: bugSeverity,
      status: "open",
      createdAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    };

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      await supabase.from("bug_reports").insert([
        {
          id: reportId,
          user_id: user?.id || null,
          title: bugTitle.trim(),
          description: bugDescription.trim(),
          severity: bugSeverity.toLowerCase(),
          status: "open",
        },
      ]);
    } catch {
      // Local fallback
    }

    const updated = [newReport, ...recentReports].slice(0, 5);
    setRecentReports(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem("expensely_bug_reports", JSON.stringify(updated));
    }

    setSubmitting(false);
    setLastReportId(reportId);

    // Reset fields
    setBugTitle("");
    setBugDescription("");
    setBugSeverity("Medium");
  };

  return (
    <main className="flex-1 p-4 md:p-margin-page max-w-[1200px] mx-auto w-full relative">
      {/* Page Header */}
      <div className="mb-8">
        <h2 className="font-headline-lg text-[28px] md:text-[32px] leading-[36px] md:leading-[40px] font-semibold text-on-surface mb-2">
          {t("help_title")}
        </h2>
        <p className="font-body-md text-[16px] leading-[24px] text-on-surface-variant">
          {t("help_subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* FAQs (Left 7 Columns) */}
        <div className="lg:col-span-7 space-y-6">
          <section className="glass-panel p-6 rounded-xl border border-outline-variant/30">
            <h3 className="font-headline-sm text-[20px] font-semibold text-on-surface mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">quiz</span>
              {t("help_faq_title")}
            </h3>

            <div className="space-y-4">
              {FAQ_ITEMS.map((faq, index) => {
                const isOpen = openFAQIndex === index;
                return (
                  <div
                    key={index}
                    className="border border-outline-variant/20 rounded-lg overflow-hidden transition-all duration-200"
                  >
                    <button
                      onClick={() => toggleFAQ(index)}
                      className="w-full flex justify-between items-center px-4 py-4 bg-surface-container-low hover:bg-surface-container transition-colors text-left focus:outline-none cursor-pointer"
                    >
                      <span className="font-label-md text-[14px] font-semibold text-on-surface">
                        {faq.question}
                      </span>
                      <span
                        className={`material-symbols-outlined transition-transform text-on-surface-variant ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      >
                        expand_more
                      </span>
                    </button>
                    {isOpen && (
                      <div className="px-4 py-4 bg-surface border-t border-outline-variant/10 font-body-sm text-[13px] leading-[20px] text-on-surface-variant">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Submitted Reports History */}
          {recentReports.length > 0 && (
            <section className="glass-panel p-6 rounded-xl border border-outline-variant/30">
              <h3 className="font-headline-sm text-[18px] font-semibold text-on-surface mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">history</span>
                {t("help_recent_reports")}
              </h3>
              <div className="space-y-3">
                {recentReports.map((r) => (
                  <div
                    key={r.id}
                    className="p-3 bg-surface-container-low border border-outline-variant/20 rounded-lg flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-primary">{r.id}</span>
                        <span className="font-label-md text-sm text-on-surface font-medium">{r.title}</span>
                      </div>
                      <span className="font-body-xs text-xs text-on-surface-variant">
                        {r.createdAt} • {t("help_severity_label")}: {r.severity}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary capitalize">
                      {r.status}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Support & Bug Reports (Right 5 Columns) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Contact Card */}
          <section className="glass-panel p-6 rounded-xl border border-outline-variant/30">
            <h3 className="font-headline-sm text-[20px] font-semibold text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">contact_support</span>
              {t("pricing_contact_support")}
            </h3>
            <p className="font-body-sm text-[13px] text-on-surface-variant mb-4 leading-[20px]">
              Need help with your account, custom billing setups, or business inquiries? Drop us an email.
            </p>
            <a
              href="mailto:support@expensely.app"
              className="flex items-center gap-3 px-4 py-3 bg-surface-container hover:bg-surface-container-high rounded-lg border border-outline-variant/35 text-primary hover:text-primary font-label-md text-[14px] font-bold transition-all"
            >
              <span className="material-symbols-outlined text-[20px]">mail</span>
              support@expensely.app
            </a>
          </section>

          {/* Bug Reporting Form */}
          <section className="glass-panel p-6 rounded-xl border border-outline-variant/30 relative overflow-hidden">
            <h3 className="font-headline-sm text-[20px] font-semibold text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-error">bug_report</span>
              {t("help_report_title")}
            </h3>

            {lastReportId ? (
              <div className="p-4 bg-primary/10 border border-primary/30 text-primary rounded-lg text-center animate-fade-in">
                <span className="material-symbols-outlined text-[40px] mb-2 text-primary">task_alt</span>
                <h4 className="font-semibold text-sm mb-1 text-on-surface">Bug Report Filed!</h4>
                <p className="text-xs mb-3 text-on-surface-variant">
                  {t("help_report_success", { id: lastReportId })}
                </p>
                <button
                  onClick={() => setLastReportId(null)}
                  className="px-3 py-1.5 bg-surface-container border border-outline-variant text-on-surface rounded-lg text-xs font-semibold hover:bg-surface-container-high transition-colors cursor-pointer"
                >
                  Report Another
                </button>
              </div>
            ) : (
              <form onSubmit={handleBugReport} className="space-y-4">
                <div>
                  <label className="block font-label-sm text-[12px] text-on-surface-variant mb-1" htmlFor="bug-title">
                    {t("help_issue_title_label")}
                  </label>
                  <input
                    required
                    id="bug-title"
                    type="text"
                    placeholder={t("help_issue_title_placeholder")}
                    className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent font-body-sm text-body-sm"
                    value={bugTitle}
                    onChange={(e) => setBugTitle(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block font-label-sm text-[12px] text-on-surface-variant mb-1" htmlFor="bug-desc">
                    {t("help_issue_desc_label")}
                  </label>
                  <textarea
                    required
                    id="bug-desc"
                    rows={3}
                    placeholder={t("help_issue_desc_placeholder")}
                    className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent font-body-sm text-body-sm resize-none"
                    value={bugDescription}
                    onChange={(e) => setBugDescription(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block font-label-sm text-[12px] text-on-surface-variant mb-1" htmlFor="bug-sev">
                    {t("help_severity_label")}
                  </label>
                  <select
                    id="bug-sev"
                    className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent font-body-sm text-body-sm"
                    value={bugSeverity}
                    onChange={(e) => setBugSeverity(e.target.value)}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 bg-primary text-on-primary font-label-md text-label-md rounded-lg shadow-sm hover:opacity-95 transition-opacity font-bold flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>
                      {t("help_submitting")}
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">send</span>
                      {t("help_submit_report")}
                    </>
                  )}
                </button>
              </form>
            )}
          </section>
        </div>
      </div>

      {/* App Version Footer */}
      <footer className="mt-12 pt-6 border-t border-outline-variant/20 flex flex-col sm:flex-row justify-between items-center gap-4 text-on-surface-variant">
        <span className="font-label-sm text-[12px]">Expensely Desktop Client v1.2.0</span>
        <span className="font-label-sm text-[12px] text-outline">Build 2026.06.11</span>
      </footer>
    </main>
  );
}
