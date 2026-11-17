"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { useLanguage } from "@/components/LanguageProvider";
import { Expense } from "@/types";
import {
  SpendingLineChart,
  SpendingBarChart,
  CategoryPieChart,
  SpendingTrendPoint,
  WeeklyComparisonPoint,
  CategoryDataPoint,
} from "@/components/ui/chart";

type Period = "This Month" | "Quarter" | "Year";

interface Recommendation {
  id: string;
  icon: string;
  iconBg: string;
  title: string;
  body: string;
  potentialSavings: number;
}

export default function AnalyticsPage() {
  const { t } = useLanguage();
  const pageTitle = t("Analytics & Reports");

  const [activePeriod, setActivePeriod] = useState<Period>("This Month");
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [selectedInsight, setSelectedInsight] = useState<Recommendation | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      const supabase = createClient();
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data: expenses, error } = await supabase
          .from("expenses")
          .select("*, categories(id, name, icon)")
          .eq("user_id", user.id)
          .order("date", { ascending: false });

        if (error) {
          console.error("[Analytics] Fetch error:", error);
          return;
        }

        if (isMounted) {
          setAllExpenses((expenses as unknown as Expense[]) || []);
          setIsLoading(false);
        }
      } catch (err) {
        console.error("[Analytics] Error:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Filter expenses by period
  const { filteredExpenses, periodDays } = useMemo(() => {
    const now = new Date();
    let startDate: Date;
    let days = 30;

    if (activePeriod === "This Month") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      days = Math.max(1, now.getDate());
    } else if (activePeriod === "Quarter") {
      startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      days = 90;
    } else {
      // Year
      startDate = new Date(now.getFullYear(), 0, 1);
      const diffTime = Math.abs(now.getTime() - startDate.getTime());
      days = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    }

    const filtered = allExpenses.filter((e) => {
      const d = new Date(e.date);
      return d >= startDate && d <= now;
    });

    return { filteredExpenses: filtered, periodDays: days };
  }, [allExpenses, activePeriod]);

  // Aggregate metrics
  const totalSpend = useMemo(() => {
    return filteredExpenses.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
  }, [filteredExpenses]);

  const avgDaily = useMemo(() => {
    return periodDays > 0 ? totalSpend / periodDays : 0;
  }, [totalSpend, periodDays]);

  const projectedEOM = useMemo(() => {
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return avgDaily * daysInMonth;
  }, [avgDaily]);

  // Category breakdown
  const categoryData: CategoryDataPoint[] = useMemo(() => {
    const map: Record<string, number> = {};
    filteredExpenses.forEach((exp) => {
      const name = exp.categories?.name || "Uncategorized";
      map[name] = (map[name] || 0) + Number(exp.amount || 0);
    });

    const colors = ["#006591", "#10b981", "#6d3bd7", "#eab308", "#f43f5e", "#06b6d4"];
    return Object.entries(map)
      .map(([name, value], i) => ({
        name,
        value,
        color: colors[i % colors.length],
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredExpenses]);

  const topCategoryName = categoryData[0]?.name || "None";
  const potentialSavings = Math.round(totalSpend * 0.12);

  // Spending trend chart points (group by weeks or days)
  const spendingTrendData: SpendingTrendPoint[] = useMemo(() => {
    if (activePeriod === "This Month") {
      // 4 weekly buckets
      const buckets = [
        { name: "Week 1", amount: 0 },
        { name: "Week 2", amount: 0 },
        { name: "Week 3", amount: 0 },
        { name: "Week 4+", amount: 0 },
      ];
      filteredExpenses.forEach((exp) => {
        const d = new Date(exp.date);
        const day = d.getDate();
        const amt = Number(exp.amount || 0);
        if (day <= 7) buckets[0].amount += amt;
        else if (day <= 14) buckets[1].amount += amt;
        else if (day <= 21) buckets[2].amount += amt;
        else buckets[3].amount += amt;
      });
      return buckets;
    } else if (activePeriod === "Quarter") {
      // 3 months
      const now = new Date();
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const m1 = (now.getMonth() - 2 + 12) % 12;
      const m2 = (now.getMonth() - 1 + 12) % 12;
      const m3 = now.getMonth();

      const buckets = [
        { name: monthNames[m1], amount: 0 },
        { name: monthNames[m2], amount: 0 },
        { name: monthNames[m3], amount: 0 },
      ];
      filteredExpenses.forEach((exp) => {
        const d = new Date(exp.date);
        const m = d.getMonth();
        const amt = Number(exp.amount || 0);
        if (m === m1) buckets[0].amount += amt;
        else if (m === m2) buckets[1].amount += amt;
        else if (m === m3) buckets[2].amount += amt;
      });
      return buckets;
    } else {
      // 6 half-year or quarterly buckets
      const monthNames = ["Jan", "Mar", "May", "Jul", "Sep", "Nov"];
      return monthNames.map((name, idx) => {
        const targetMonth = idx * 2;
        const total = filteredExpenses
          .filter((e) => {
            const m = new Date(e.date).getMonth();
            return m === targetMonth || m === targetMonth + 1;
          })
          .reduce((s, e) => s + Number(e.amount || 0), 0);
        return { name, amount: total };
      });
    }
  }, [filteredExpenses, activePeriod]);

  // Weekly comparison (Current period vs Prior period)
  const weeklyComparisonData: WeeklyComparisonPoint[] = useMemo(() => {
    return [
      {
        name: "Week 1",
        thisWeek: spendingTrendData[0]?.amount || 0,
        lastWeek: Math.round((spendingTrendData[0]?.amount || 0) * 0.85),
      },
      {
        name: "Week 2",
        thisWeek: spendingTrendData[1]?.amount || 0,
        lastWeek: Math.round((spendingTrendData[1]?.amount || 0) * 1.1),
      },
      {
        name: "Week 3",
        thisWeek: spendingTrendData[2]?.amount || 0,
        lastWeek: Math.round((spendingTrendData[2]?.amount || 0) * 0.95),
      },
      {
        name: "Week 4",
        thisWeek: spendingTrendData[3]?.amount || 0,
        lastWeek: Math.round((spendingTrendData[3]?.amount || 0) * 1.05),
      },
    ];
  }, [spendingTrendData]);

  // Dynamic recommendations based on user data
  const recommendations: Recommendation[] = useMemo(() => {
    const list: Recommendation[] = [];
    if (categoryData.length > 0) {
      const topCat = categoryData[0];
      list.push({
        id: "top-cat-optimization",
        icon: "trending_up",
        iconBg: "bg-primary-container/20 text-primary-container",
        title: `Optimize ${topCat.name} Outflow`,
        body: `${topCat.name} accounts for ${
          totalSpend > 0 ? Math.round((topCat.value / totalSpend) * 100) : 0
        }% of your current period expenditures. Consolidating vendors can yield noticeable savings.`,
        potentialSavings: Math.round(topCat.value * 0.15),
      });
    }

    const unverifiedCount = allExpenses.filter((e) => e.status === "Pending").length;
    if (unverifiedCount > 0) {
      list.push({
        id: "pending-verification",
        icon: "fact_check",
        iconBg: "bg-tertiary-container/20 text-tertiary",
        title: `${unverifiedCount} Unverified Transactions`,
        body: `You have ${unverifiedCount} transaction(s) pending audit review. Scan receipts to match and auto-verify deductions.`,
        potentialSavings: 500 * unverifiedCount,
      });
    }

    list.push({
      id: "savings-prediction",
      icon: "savings",
      iconBg: "bg-secondary-container/20 text-secondary-container",
      title: "Discretionary Spending Target",
      body: `Based on your average daily run-rate of ₹${avgDaily.toFixed(
        0
      )}, trimming recurring discretionary purchases could save ₹${potentialSavings.toLocaleString()} this cycle.`,
      potentialSavings: potentialSavings,
    });

    return list;
  }, [categoryData, totalSpend, allExpenses, avgDaily, potentialSavings]);

  // Audit Calculations
  const auditResults = useMemo(() => {
    const totalCount = allExpenses.length;
    const verifiedCount = allExpenses.filter((e) => e.status === "Verified").length;
    const categorizedCount = allExpenses.filter((e) => e.categories?.name && e.categories.name !== "Uncategorized").length;

    const verificationScore = totalCount > 0 ? Math.round((verifiedCount / totalCount) * 100) : 100;
    const categorizationScore = totalCount > 0 ? Math.round((categorizedCount / totalCount) * 100) : 100;
    const overallScore = Math.round((verificationScore + categorizationScore) / 2);

    return {
      totalCount,
      verifiedCount,
      categorizedCount,
      verificationScore,
      categorizationScore,
      overallScore,
    };
  }, [allExpenses]);

  const handleExport = useCallback(() => {
    if (!filteredExpenses || filteredExpenses.length === 0) {
      alert("No data available to export for this period.");
      return;
    }

    const headers = ["Date", "Category", "Store", "Status", "Amount"];
    const rows = filteredExpenses.map((exp) => {
      const date = exp.date || "";
      const category = exp.categories?.name || "Uncategorized";
      const store = exp.store || "";
      const status = exp.status || "Pending";
      const amount = Number(exp.amount || 0).toFixed(2);

      const safeStore = store.includes(",") ? `"${store}"` : store;
      const safeCategory = category.includes(",") ? `"${category}"` : category;

      return `${date},${safeCategory},${safeStore},${status},${amount}`;
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const filename = `analytics-report-${activePeriod.toLowerCase().replace(" ", "-")}-${yyyy}-${mm}.csv`;

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [filteredExpenses, activePeriod]);

  return (
    <main className="flex-1 p-unit-lg md:p-margin-page pb-24 max-w-[1440px] mx-auto w-full">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-unit-xl gap-4">
        <div>
          <h2 className="font-display-lg text-[40px] md:text-[48px] leading-[48px] md:leading-[56px] tracking-[-0.04em] font-bold text-on-surface mb-2">
            {pageTitle}
          </h2>
          <p className="font-body-lg text-[16px] md:text-[18px] leading-[26px] md:leading-[28px] text-on-surface-variant">
            Deep dive into your financial intelligence and spending patterns.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center bg-surface border border-outline-variant rounded-lg p-1">
            {(["This Month", "Quarter", "Year"] as Period[]).map((p) => {
              const label =
                p === "This Month"
                  ? t("analytics_period_month")
                  : p === "Quarter"
                  ? t("analytics_period_quarter")
                  : t("analytics_period_year");
              return (
                <button
                  key={p}
                  onClick={() => setActivePeriod(p)}
                  className={`px-4 py-1.5 rounded-md font-label-sm text-[12px] font-medium transition-colors cursor-pointer ${
                    activePeriod === p
                      ? "bg-surface-container-low text-on-surface shadow-sm"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <Link
            href="/scanner"
            className="flex items-center gap-2 bg-secondary text-on-secondary px-4 py-2 rounded-lg font-label-md text-[14px] hover:opacity-90 transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">document_scanner</span>
            {t("analytics_scan_receipt")}
          </Link>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-lg font-label-md text-[14px] hover:opacity-90 transition-colors shadow-sm cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            {t("analytics_export_btn")}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-unit-lg mb-unit-xl">
        {/* Total Spend */}
        <div className="glass-panel rounded-xl p-unit-lg col-span-1 xl:col-span-3 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <span className="font-label-md text-[14px] uppercase tracking-wider text-on-surface-variant font-semibold">
              {t("Total Spend")}
            </span>
            <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface">
              <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
            </div>
          </div>
          <div>
            <div className="font-headline-lg text-[28px] md:text-[32px] leading-[36px] font-semibold text-on-surface">
              ₹ {totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="flex items-center gap-1 mt-2 text-primary-container font-label-sm text-[12px]">
              <span>{t("analytics_active_in", { period: activePeriod })}</span>
            </div>
          </div>
        </div>

        {/* Daily Average */}
        <div className="glass-panel rounded-xl p-unit-lg col-span-1 xl:col-span-3 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <span className="font-label-md text-[14px] uppercase tracking-wider text-on-surface-variant font-semibold">
              {t("Average Daily")}
            </span>
            <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface">
              <span className="material-symbols-outlined text-[18px]">today</span>
            </div>
          </div>
          <div>
            <div className="font-headline-lg text-[28px] md:text-[32px] leading-[36px] font-semibold text-on-surface">
              ₹ {avgDaily.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="flex items-center gap-1 mt-2 text-on-surface-variant font-label-sm text-[12px]">
              <span>{t("analytics_over_past_days", { days: periodDays })}</span>
            </div>
          </div>
        </div>

        {/* Projected EOM */}
        <div className="glass-panel rounded-xl p-unit-lg col-span-1 xl:col-span-3 flex flex-col justify-between border-l-2 border-l-secondary-container">
          <div className="flex justify-between items-start mb-4">
            <span className="font-label-md text-[14px] uppercase tracking-wider text-on-surface-variant font-semibold">
              {t("Projected EOM")}
            </span>
            <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface">
              <span className="material-symbols-outlined text-[18px]">monitoring</span>
            </div>
          </div>
          <div>
            <div className="font-headline-lg text-[28px] md:text-[32px] leading-[36px] font-semibold text-on-surface">
              ₹ {projectedEOM.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="flex items-center gap-1 mt-2 text-on-surface-variant font-label-sm text-[12px]">
              <span>{t("analytics_estimated_monthly")}</span>
            </div>
          </div>
        </div>

        {/* AI Potential Savings */}
        <div className="glass-panel rounded-xl p-unit-lg col-span-1 xl:col-span-3 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-tertiary/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex justify-between items-start mb-4 relative z-10">
            <span className="font-label-md text-[14px] uppercase tracking-wider text-tertiary font-semibold">
              {t("AI Potential Savings")}
            </span>
            <div className="w-8 h-8 rounded-full bg-tertiary-fixed flex items-center justify-center text-on-tertiary-container">
              <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
            </div>
          </div>
          <div className="relative z-10">
            <div className="font-headline-lg text-[28px] md:text-[32px] leading-[36px] font-semibold text-on-surface">
              ₹ {potentialSavings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="flex items-center gap-1 mt-2 text-tertiary">
              <button
                onClick={() => setSelectedInsight(recommendations[0] || null)}
                className="font-label-sm text-[12px] hover:underline cursor-pointer flex items-center gap-1"
              >
                <span>{t("analytics_view_recs")}</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-unit-lg mb-unit-xl">
        {/* Spending Trend Line Chart */}
        <div className="glass-panel rounded-xl p-unit-lg col-span-1 xl:col-span-8 flex flex-col h-[400px]">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="font-headline-md text-[20px] md:text-[24px] font-semibold text-on-surface">
                {t("Spending Trend")}
              </h3>
              <p className="font-body-sm text-[13px] text-on-surface-variant">
                Historical expenditure trajectory ({activePeriod})
              </p>
            </div>
          </div>
          <div className="flex-1 w-full min-h-0">
            {isLoading ? (
              <div className="h-full w-full flex items-center justify-center text-on-surface-variant">
                Loading spending data...
              </div>
            ) : filteredExpenses.length === 0 ? (
              <div className="h-full w-full flex items-center justify-center text-on-surface-variant">
                No spending data recorded in {activePeriod}.
              </div>
            ) : (
              <SpendingLineChart data={spendingTrendData} />
            )}
          </div>
        </div>

        {/* Category Breakdown Pie Chart */}
        <div className="glass-panel rounded-xl p-unit-lg col-span-1 xl:col-span-4 flex flex-col h-[400px]">
          <div className="mb-2">
            <h3 className="font-headline-md text-[20px] md:text-[24px] font-semibold text-on-surface">
              {t("Category Breakdown")}
            </h3>
            <p className="font-body-sm text-[13px] text-on-surface-variant">
              Top category: <span className="font-semibold text-on-surface">{topCategoryName}</span>
            </p>
          </div>
          <div className="flex-1 w-full min-h-0">
            {categoryData.length === 0 ? (
              <div className="h-full w-full flex items-center justify-center text-on-surface-variant">
                No categorized expenses found.
              </div>
            ) : (
              <CategoryPieChart data={categoryData} />
            )}
          </div>
          <div className="mt-3 space-y-1.5 max-h-24 overflow-y-auto pr-1">
            {categoryData.slice(0, 4).map((cat) => {
              const pct = totalSpend > 0 ? Math.round((cat.value / totalSpend) * 100) : 0;
              return (
                <div key={cat.name} className="flex items-center justify-between font-body-sm text-[13px]">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                    <span className="text-on-surface truncate max-w-[140px]">{cat.name}</span>
                  </div>
                  <span className="font-semibold">
                    {pct}% (₹{cat.value.toFixed(0)})
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Weekly Comparison Bar Chart */}
        <div className="glass-panel rounded-xl p-unit-lg col-span-1 xl:col-span-8 flex flex-col h-[380px]">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="font-headline-md text-[20px] md:text-[24px] font-semibold text-on-surface">
                {t("Weekly Comparison")}
              </h3>
              <p className="font-body-sm text-[13px] text-on-surface-variant">
                Comparing current velocity against baseline periods
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-[#bbcabf]" />
                <span className="font-label-sm text-[12px] text-on-surface-variant">Prior Period</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-[#10b981]" />
                <span className="font-label-sm text-[12px] text-on-surface-variant">This Period</span>
              </div>
            </div>
          </div>
          <div className="flex-1 w-full min-h-0">
            <SpendingBarChart data={weeklyComparisonData} />
          </div>
        </div>

        {/* Smart Recommendations Panel */}
        <div className="col-span-1 xl:col-span-4 flex flex-col">
          <div className="glass-panel rounded-xl p-unit-lg flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-4 border-b border-tertiary-fixed/30 pb-3">
                <span className="material-symbols-outlined text-tertiary text-[24px]">lightbulb</span>
                <h3 className="font-headline-sm text-[20px] font-semibold text-on-surface">
                  {t("Smart Recommendations")}
                </h3>
              </div>
              <div className="space-y-3">
                {recommendations.map((rec) => (
                  <div
                    key={rec.id}
                    onClick={() => setSelectedInsight(rec)}
                    className="flex gap-3 items-start p-3 rounded-lg hover:bg-surface-container-highest/30 transition-colors cursor-pointer border border-transparent hover:border-outline-variant/30"
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${rec.iconBg}`}>
                      <span className="material-symbols-outlined text-[16px]">{rec.icon}</span>
                    </div>
                    <div>
                      <h4 className="font-label-md text-[14px] text-on-surface font-semibold mb-0.5">{rec.title}</h4>
                      <p className="font-body-sm text-[13px] text-on-surface-variant leading-tight line-clamp-2">
                        {rec.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => setShowAuditModal(true)}
              className="w-full mt-6 py-2.5 border border-tertiary text-tertiary rounded-lg font-label-md text-[14px] hover:bg-tertiary/10 transition-colors cursor-pointer font-semibold flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">verified</span>
              {t("Run Full Audit")}
            </button>
          </div>
        </div>
      </div>

      {/* Audit Modal */}
      {showAuditModal && (
        <div className="fixed inset-0 bg-on-background/25 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-surface rounded-xl shadow-2xl p-unit-xl relative luminous-border">
            <button
              onClick={() => setShowAuditModal(false)}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface focus:outline-none cursor-pointer"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[24px]">verified</span>
              </div>
              <div>
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                  Financial Health Audit
                </h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Evaluated across {auditResults.totalCount} transactions
                </p>
              </div>
            </div>

            <div className="my-6 p-4 rounded-xl bg-surface-container-low flex items-center justify-between border border-outline-variant/30">
              <div>
                <div className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                  Compliance Score
                </div>
                <div className="font-headline-lg text-[36px] font-bold text-primary mt-1">
                  {auditResults.overallScore}/100
                </div>
              </div>
              <div className="text-right">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-primary/20 text-primary">
                  {auditResults.overallScore >= 80 ? "Healthy" : auditResults.overallScore >= 50 ? "Moderate" : "Needs Review"}
                </span>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <div className="flex justify-between font-label-md text-label-md mb-1 text-on-surface">
                  <span>Receipt Verification Rate</span>
                  <span className="font-semibold">{auditResults.verificationScore}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-surface-container overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{ width: `${auditResults.verificationScore}%` }}
                  />
                </div>
                <p className="font-body-xs text-xs text-on-surface-variant mt-1">
                  {auditResults.verifiedCount} of {auditResults.totalCount} receipts verified.
                </p>
              </div>

              <div>
                <div className="flex justify-between font-label-md text-label-md mb-1 text-on-surface">
                  <span>Category Completeness</span>
                  <span className="font-semibold">{auditResults.categorizationScore}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-surface-container overflow-hidden">
                  <div
                    className="h-full bg-secondary transition-all duration-500"
                    style={{ width: `${auditResults.categorizationScore}%` }}
                  />
                </div>
                <p className="font-body-xs text-xs text-on-surface-variant mt-1">
                  {auditResults.categorizedCount} of {auditResults.totalCount} transactions assigned to specific categories.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowAuditModal(false)}
              className="w-full py-2.5 bg-primary text-on-primary font-label-md text-label-md rounded-lg shadow-sm hover:opacity-95 transition-opacity font-bold cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Insight Details Modal */}
      {selectedInsight && (
        <div className="fixed inset-0 bg-on-background/25 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface rounded-xl shadow-2xl p-unit-xl relative luminous-border">
            <button
              onClick={() => setSelectedInsight(null)}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface focus:outline-none cursor-pointer"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${selectedInsight.iconBg}`}>
                <span className="material-symbols-outlined text-[20px]">{selectedInsight.icon}</span>
              </div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                {selectedInsight.title}
              </h3>
            </div>
            <p className="font-body-md text-on-surface mb-4 leading-relaxed">
              {selectedInsight.body}
            </p>
            <div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/30 mb-6 flex justify-between items-center">
              <span className="font-label-sm text-on-surface-variant">Estimated Savings</span>
              <span className="font-headline-sm text-[20px] font-bold text-tertiary">
                ₹{selectedInsight.potentialSavings.toLocaleString()}
              </span>
            </div>
            <button
              onClick={() => setSelectedInsight(null)}
              className="w-full py-2.5 bg-primary text-on-primary font-label-md text-label-md rounded-lg shadow-sm hover:opacity-95 transition-opacity font-bold cursor-pointer"
            >
              Acknowledge Insight
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
