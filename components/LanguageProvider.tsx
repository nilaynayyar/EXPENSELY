"use client";

import { createContext, useContext, useSyncExternalStore, useCallback } from "react";
import {
  TRANSLATIONS,
  SUPPORTED_LANGUAGES,
  LOCALE_MAP,
  type SupportedLanguage,
} from "@/lib/i18n/translations";

type TranslationParams = Record<string, string | number>;

export type LanguageContextType = {
  language: SupportedLanguage;
  setLanguage: (lang: string) => void;
  t: (key: string, params?: TranslationParams) => string;
  formatCurrency: (amount: number, currency?: string) => string;
  formatDate: (date: string | Date | number, options?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  supportedLanguages: SupportedLanguage[];
};

// Legacy key aliases map to guarantee zero regressions for pre-existing components
const LEGACY_ALIASES: Record<string, string> = {
  "Dashboard": "nav_dashboard",
  "Expenses": "nav_expenses",
  "Receipt Scanner": "nav_scanner",
  "Analytics": "nav_analytics",
  "Groups": "nav_groups",
  "Budgets": "nav_budgets",
  "Settings": "nav_settings",
  "Help Center": "nav_help",
  "Logout": "nav_logout",
  "Overview": "dashboard_overview",
  "Add Expense": "dashboard_add_expense",
  "Total Spending": "dashboard_total_spending",
  "Monthly Budget": "dashboard_monthly_budget",
  "Remaining": "dashboard_remaining",
  "Recent Receipt": "dashboard_recent_receipt",
  "Spending Trends": "dashboard_spending_trends",
  "Categories": "dashboard_categories",
  "Recent": "dashboard_recent_transactions",
  "Recent Transactions": "dashboard_recent_transactions",
  "View All": "dashboard_view_all",
  "Analytics & Reports": "analytics_title",
  "Total Spend": "analytics_total_spend",
  "Average Daily": "analytics_avg_daily",
  "Projected EOM": "analytics_projected_eom",
  "AI Potential Savings": "analytics_ai_savings",
  "Spending Trend": "analytics_spending_trend",
  "Category Breakdown": "analytics_category_breakdown",
  "Weekly Comparison": "analytics_weekly_comparison",
  "Smart Recommendations": "analytics_recommendations",
  "Run Full Audit": "analytics_audit_btn",
  "Scan New Receipt": "scanner_rescan_btn",
  "Export Report": "analytics_export_btn",
};

const LanguageContext = createContext<LanguageContextType>({
  language: "English (US)",
  setLanguage: () => {},
  t: (key: string) => key,
  formatCurrency: (amt: number) => `₹${amt.toFixed(2)}`,
  formatDate: (d: string | Date | number) => new Date(d).toLocaleDateString(),
  formatNumber: (n: number) => String(n),
  supportedLanguages: SUPPORTED_LANGUAGES,
});

const subscribeLang = (callback: () => void) => {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("languagechange", callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener("languagechange", callback);
    window.removeEventListener("storage", callback);
  };
};

const getLangSnapshot = (): SupportedLanguage => {
  if (typeof window === "undefined") return "English (US)";
  const stored = localStorage.getItem("language");
  if (stored && SUPPORTED_LANGUAGES.includes(stored as SupportedLanguage)) {
    return stored as SupportedLanguage;
  }
  return "English (US)";
};

const getServerLangSnapshot = (): SupportedLanguage => "English (US)";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const currentLanguage = useSyncExternalStore(subscribeLang, getLangSnapshot, getServerLangSnapshot);

  const setLanguage = useCallback((lang: string) => {
    if (SUPPORTED_LANGUAGES.includes(lang as SupportedLanguage)) {
      localStorage.setItem("language", lang);
      window.dispatchEvent(new Event("languagechange"));
    }
  }, []);

  const t = useCallback(
    (key: string, params?: TranslationParams): string => {
      const resolvedKey = LEGACY_ALIASES[key] || key;
      const dict = TRANSLATIONS[currentLanguage] || TRANSLATIONS["English (US)"];
      const fallbackDict = TRANSLATIONS["English (US)"];

      // Handle pluralization if count parameter is present
      let text = dict[resolvedKey] || fallbackDict[resolvedKey] || key;
      if (params && typeof params.count === "number" && params.count !== 1) {
        const pluralKey = `${resolvedKey}_plural`;
        if (dict[pluralKey]) text = dict[pluralKey];
        else if (fallbackDict[pluralKey]) text = fallbackDict[pluralKey];
      }

      // Interpolate parameters {var}
      if (params) {
        for (const [pKey, pVal] of Object.entries(params)) {
          text = text.replace(new RegExp(`\\{${pKey}\\}`, "g"), String(pVal));
        }
      }

      return text;
    },
    [currentLanguage]
  );

  const formatCurrency = useCallback(
    (amount: number, currency: string = "INR"): string => {
      const locale = LOCALE_MAP[currentLanguage] || "en-IN";
      try {
        return new Intl.NumberFormat(locale, {
          style: "currency",
          currency: currency === "₹" ? "INR" : currency === "$" ? "USD" : currency,
          maximumFractionDigits: 2,
        }).format(amount);
      } catch {
        return `₹${amount.toLocaleString(locale)}`;
      }
    },
    [currentLanguage]
  );

  const formatDate = useCallback(
    (date: string | Date | number, options?: Intl.DateTimeFormatOptions): string => {
      const locale = LOCALE_MAP[currentLanguage] || "en-US";
      try {
        const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
        return new Intl.DateTimeFormat(locale, options || { dateStyle: "medium" }).format(d);
      } catch {
        return String(date);
      }
    },
    [currentLanguage]
  );

  const formatNumber = useCallback(
    (value: number, options?: Intl.NumberFormatOptions): string => {
      const locale = LOCALE_MAP[currentLanguage] || "en-US";
      try {
        return new Intl.NumberFormat(locale, options).format(value);
      } catch {
        return String(value);
      }
    },
    [currentLanguage]
  );

  return (
    <LanguageContext.Provider
      value={{
        language: currentLanguage,
        setLanguage,
        t,
        formatCurrency,
        formatDate,
        formatNumber,
        supportedLanguages: SUPPORTED_LANGUAGES,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
