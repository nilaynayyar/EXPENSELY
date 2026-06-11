"use client";

import { useState } from "react";

interface FAQItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FAQItem[] = [
  {
    question: "How does the receipt scanner work?",
    answer: "Our receipt scanner uses Tesseract.js directly inside your browser to extract raw text, merchant details, dates, and amounts. Because this runs locally in your browser, your sensitive receipt images are never sent or stored on external OCR servers.",
  },
  {
    question: "How do I create and manage expenses?",
    answer: "You can create expenses manually by going to the 'Expenses' tab and clicking 'Add Expense'. Alternatively, upload a receipt photo on the 'Receipt Scanner' tab, verify the extracted details, and save. You can edit or delete expenses at any time.",
  },
  {
    question: "How do group splits work?",
    answer: "Navigate to the 'Groups' tab, create a group, and invite members. Once members are added, you can add shared expenses. The system automatically calculates who owes whom based on split logic and displays instant balances.",
  },
  {
    question: "Is my financial data secure?",
    answer: "Yes. Expensely leverages Supabase's secure PostgreSQL database, protected by row-level security (RLS) policies. This ensures that your private expense data and group expenses are strictly accessible only by you and authorized group members.",
  },
];

export default function HelpCenterPage() {
  const [openFAQIndex, setOpenFAQIndex] = useState<number | null>(null);

  // Bug Report Form State
  const [bugTitle, setBugTitle] = useState("");
  const [bugDescription, setBugDescription] = useState("");
  const [bugSeverity, setBugSeverity] = useState("Medium");
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const toggleFAQ = (index: number) => {
    setOpenFAQIndex(openFAQIndex === index ? null : index);
  };

  const handleBugReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bugTitle.trim() || !bugDescription.trim()) return;

    setSubmitting(true);
    // Simulate API request delay
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setSubmitting(false);
    setSubmitSuccess(true);

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
          Help Center &amp; Support
        </h2>
        <p className="font-body-md text-[16px] leading-[24px] text-on-surface-variant">
          Find answers, report issues, and connect with our support team.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* FAQs (Left 7 Columns) */}
        <div className="lg:col-span-7 space-y-6">
          <section className="glass-panel p-6 rounded-xl border border-outline-variant/30">
            <h3 className="font-headline-sm text-[20px] font-semibold text-on-surface mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">quiz</span>
              Frequently Asked Questions
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
                      className="w-full flex justify-between items-center px-4 py-4 bg-surface-container-low hover:bg-surface-container transition-colors text-left focus:outline-none"
                    >
                      <span className="font-label-md text-[14px] font-semibold text-on-surface">
                        {faq.question}
                      </span>
                      <span className={`material-symbols-outlined transition-transform text-on-surface-variant ${isOpen ? "rotate-180" : ""}`}>
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
        </div>

        {/* Support & Bug Reports (Right 5 Columns) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Contact Card */}
          <section className="glass-panel p-6 rounded-xl border border-outline-variant/30">
            <h3 className="font-headline-sm text-[20px] font-semibold text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">contact_support</span>
              Contact Support
            </h3>
            <p className="font-body-sm text-[13px] text-on-surface-variant mb-4 leading-[20px]">
              Need help with your account, custom billing setups, or business inquiries? Drop us an email.
            </p>
            <a
              href="mailto:support@expensely.app"
              className="flex items-center gap-3 px-4 py-3 bg-surface-container hover:bg-surface-container-high rounded-lg border border-outline-variant/35 text-primary hover:text-primary-hover font-label-md text-[14px] font-bold transition-all"
            >
              <span className="material-symbols-outlined text-[20px]">mail</span>
              support@expensely.app
            </a>
          </section>

          {/* Bug Reporting Form */}
          <section className="glass-panel p-6 rounded-xl border border-outline-variant/30 relative overflow-hidden">
            <h3 className="font-headline-sm text-[20px] font-semibold text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-error">bug_report</span>
              Report a Bug
            </h3>

            {submitSuccess ? (
              <div className="p-4 bg-green-500/10 border border-green-500/30 text-green-700 dark:text-green-400 rounded-lg text-center animate-fade-in">
                <span className="material-symbols-outlined text-[40px] mb-2 text-green-600 dark:text-green-500">task_alt</span>
                <h4 className="font-semibold text-sm mb-1">Bug Report Filed!</h4>
                <p className="text-xs mb-3 text-on-surface-variant">
                  Thank you. Report #EXP-{Math.floor(Math.random() * 90000) + 10000} has been created.
                </p>
                <button
                  onClick={() => setSubmitSuccess(false)}
                  className="px-3 py-1.5 bg-surface-container border border-outline-variant text-on-surface rounded-lg text-xs font-semibold hover:bg-surface-container-high transition-colors"
                >
                  Report Another
                </button>
              </div>
            ) : (
              <form onSubmit={handleBugReport} className="space-y-4">
                <div>
                  <label className="block font-label-sm text-[12px] text-on-surface-variant mb-1" htmlFor="bug-title">
                    Title / Quick Summary
                  </label>
                  <input
                    required
                    id="bug-title"
                    type="text"
                    placeholder="e.g. Receipt scanner cuts off amount"
                    className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent font-body-sm text-body-sm"
                    value={bugTitle}
                    onChange={(e) => setBugTitle(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block font-label-sm text-[12px] text-on-surface-variant mb-1" htmlFor="bug-desc">
                    Steps to Reproduce
                  </label>
                  <textarea
                    required
                    id="bug-desc"
                    rows={3}
                    placeholder="e.g. 1. Go to Scanner. 2. Drag a receipt. 3. Observe..."
                    className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent font-body-sm text-body-sm resize-none"
                    value={bugDescription}
                    onChange={(e) => setBugDescription(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block font-label-sm text-[12px] text-on-surface-variant mb-1" htmlFor="bug-sev">
                    Severity
                  </label>
                  <select
                    id="bug-sev"
                    className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent font-body-sm text-body-sm"
                    value={bugSeverity}
                    onChange={(e) => setBugSeverity(e.target.value)}
                  >
                    <option value="Low">Low (Visual glitch)</option>
                    <option value="Medium">Medium (Incorrect calculation / layout)</option>
                    <option value="High">High (Crash / blocked flow)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 bg-primary text-white font-label-md text-label-md rounded-lg shadow-sm hover:opacity-95 transition-opacity font-bold flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>
                      Submitting...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">send</span>
                      Submit Bug Report
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
        <span className="font-label-sm text-[12px]">
          Expensely Desktop Client v1.2.0-beta
        </span>
        <span className="font-label-sm text-[12px] text-outline">
          Build 2026.06.11
        </span>
      </footer>
    </main>
  );
}
