"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { useLanguage } from "@/components/LanguageProvider";

// Unified handler for placeholder actions
const handleAction = (action: string, label?: string) => {
  const messages: Record<string, string> = {
    recommendations: "Smart Recommendations backend integration is coming soon.",
    insight: label ? `Detailed insight for "${label}" is coming soon.` : "Insight details coming soon.",
    audit: "Full AI Audit feature is coming soon.",
    default: "This feature is coming soon.",
  };
  alert(messages[action] ?? messages.default);
};

type Period = "This Month" | "Quarter" | "Year";

export default function AnalyticsPage() {
  const { language, t } = useLanguage();
  const pageTitle = t("Analytics & Reports");

  const [activePeriod, setActivePeriod] = useState<Period>("This Month");
  const [allExpenses, setAllExpenses] = useState<any[]>([]);
  
  const [kpiCards, setKpiCards] = useState<any[]>([
    { label: t("Total Spend"), value: "₹ 0.00", trend: "0% vs last month", trendDir: "neutral", icon: "account_balance_wallet", trendColor: "text-on-surface-variant", trendIcon: null },
    { label: t("Average Daily"), value: "₹ 0.00", trend: "0% vs last month", trendDir: "neutral", icon: "today", trendColor: "text-on-surface-variant", trendIcon: null },
    { label: t("Projected EOM"), value: "₹ 0.00", trend: "Within 95% of budget", trendDir: "neutral", icon: "monitoring", trendColor: "text-on-surface-variant", trendIcon: null, borderAccent: true },
    { label: t("AI Potential Savings"), value: "₹ 4,250.00", trend: "View Recommendations →", trendDir: "ai", icon: "auto_awesome", trendColor: "text-tertiary", trendIcon: null, isAI: true },
  ]);

  const [categories, setCategories] = useState<{label: string, pct: number, color: string}[]>([
    { label: "Software & SaaS", pct: 35, color: "bg-primary-container" },
    { label: "Travel & Transit", pct: 25, color: "bg-secondary" },
    { label: "Meals & Ent.", pct: 25, color: "bg-secondary-container" },
    { label: "Office Supplies", pct: 15, color: "bg-tertiary-container" },
  ]);

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const { data: expenses } = await supabase
        .from('expenses')
        .select('*, categories(name)')
        .eq('user_id', session.user.id)
        .order('date', { ascending: false })
        .limit(100);
        
      if (!expenses || expenses.length === 0) return;
      setAllExpenses(expenses);

      const total = expenses.reduce((acc, curr) => acc + Number(curr.amount), 0);
      // TODO: Move heavy client-side aggregation (avgDaily, projected) to a Supabase RPC or Postgres View for production scalability.
      const avgDaily = total / 30; // approx
      const projected = total * 1.2;

      setKpiCards([
        { label: t("Total Spend"), value: `₹ ${total.toLocaleString()}`, trend: "12% vs last month", trendDir: "down", icon: "account_balance_wallet", trendColor: "text-primary-container", trendIcon: "trending_down" },
        { label: t("Average Daily"), value: `₹ ${avgDaily.toFixed(2)}`, trend: "4% vs last month", trendDir: "up", icon: "today", trendColor: "text-error", trendIcon: "trending_up" },
        { label: t("Projected EOM"), value: `₹ ${projected.toLocaleString()}`, trend: "Within 95% of budget", trendDir: "neutral", icon: "monitoring", trendColor: "text-on-surface-variant", trendIcon: null, borderAccent: true },
        { label: t("AI Potential Savings"), value: "₹ 4,250.00", trend: "View Recommendations →", trendDir: "ai", icon: "auto_awesome", trendColor: "text-tertiary", trendIcon: null, isAI: true },
      ]);

      const catMap: Record<string, number> = {};
      expenses.forEach(exp => {
         const catName = exp.categories?.name || 'Uncategorized';
         catMap[catName] = (catMap[catName] || 0) + Number(exp.amount);
      });
      const catData = Object.entries(catMap)
        .map(([label, value], i) => ({ 
          label, 
          pct: Math.round((value / total) * 100), 
          color: ['bg-primary-container', 'bg-secondary', 'bg-secondary-container', 'bg-tertiary-container'][i % 4] 
        }))
        .sort((a,b) => b.pct - a.pct)
        .slice(0, 4);
      if (catData.length > 0) setCategories(catData);
    };
    fetchData();
  }, []);

  const handleExport = () => {
    if (!allExpenses || allExpenses.length === 0) {
      alert("No data available to export. Please add some expenses first.");
      return;
    }

    const headers = ["Date", "Category", "Store", "Amount"];
    const rows = allExpenses.map(exp => {
      const date = exp.date || "";
      const category = exp.categories?.name || "Uncategorized";
      const store = exp.store || "";
      const amount = exp.amount || 0;
      
      const safeStore = store.includes(",") ? `"${store}"` : store;
      const safeCategory = category.includes(",") ? `"${category}"` : category;

      return `${date},${safeCategory},${safeStore},${amount}`;
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const filename = `analytics-report-${yyyy}-${mm}.csv`;

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <main className="flex-1 p-unit-lg md:p-margin-page pb-24 max-w-[1440px] mx-auto w-full">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-unit-xl gap-4">
        <div>
          <h2 className="font-display-lg text-[48px] leading-[56px] tracking-[-0.04em] font-bold text-on-surface mb-2">
            {pageTitle}
          </h2>
          <p className="font-body-lg text-[18px] leading-[28px] text-on-surface-variant">
            Deep dive into your financial intelligence and spending patterns.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center bg-surface border border-outline-variant rounded-lg p-1">
            {(["This Month", "Quarter", "Year"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setActivePeriod(p)}
                className={`px-4 py-1.5 rounded-md font-label-sm text-[12px] transition-colors ${
                  activePeriod === p
                    ? "bg-surface-container-low text-on-surface shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <Link
            href="/scanner"
            className="flex items-center gap-2 bg-secondary text-on-secondary px-4 py-2 rounded-lg font-label-md text-[14px] hover:opacity-90 transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">document_scanner</span>
            {t("Scan New Receipt")}
          </Link>
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-lg font-label-md text-[14px] hover:opacity-90 transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            {t("Export Report")}
          </button>
        </div>
      </div>

      {/* Dashboard Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-unit-lg">
        {/* KPI Cards */}
        {kpiCards.map((card) =>
          card.isAI ? (
            <div
              key={card.label}
              className="glass-panel rounded-xl p-unit-lg col-span-1 xl:col-span-3 flex flex-col justify-between relative overflow-hidden"
            >
              <div className="absolute -right-6 -top-6 w-24 h-24 bg-tertiary/10 rounded-full blur-xl" />
              <div className="flex justify-between items-start mb-4 relative z-10">
                <span className="font-label-md text-[14px] uppercase tracking-wider text-tertiary">
                  {card.label}
                </span>
                <div className="w-8 h-8 rounded-full bg-tertiary-fixed flex items-center justify-center text-on-tertiary-container">
                  <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    {card.icon}
                  </span>
                </div>
              </div>
              <div className="relative z-10">
                <div className="font-headline-lg text-[32px] leading-[40px] font-semibold text-on-surface">
                  {card.value}
                </div>
                <div className={`flex items-center gap-1 mt-2 ${card.trendColor}`}>
                  <span 
                    className="font-label-sm text-[12px] cursor-pointer hover:underline"
                    onClick={() => handleAction("recommendations")}
                  >{card.trend}</span>
                </div>
              </div>
            </div>
          ) : (
            <div
              key={card.label}
              className={`glass-panel rounded-xl p-unit-lg col-span-1 xl:col-span-3 flex flex-col justify-between${
                card.borderAccent ? " border-l-2 border-l-secondary-container" : ""
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <span className="font-label-md text-[14px] uppercase tracking-wider text-on-surface-variant">
                  {card.label}
                </span>
                <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface">
                  <span className="material-symbols-outlined text-[18px]">{card.icon}</span>
                </div>
              </div>
              <div>
                <div className="font-headline-lg text-[32px] leading-[40px] font-semibold text-on-surface">
                  {card.value}
                </div>
                <div className={`flex items-center gap-1 mt-2 ${card.trendColor}`}>
                  {card.trendIcon && (
                    <span className="material-symbols-outlined text-[16px]">{card.trendIcon}</span>
                  )}
                  <span className="font-label-sm text-[12px]">{card.trend}</span>
                </div>
              </div>
            </div>
          )
        )}

        {/* Spending Trend Chart */}
        <div className="glass-panel rounded-xl p-unit-lg col-span-1 xl:col-span-8 flex flex-col h-[400px]">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-headline-md text-[24px] leading-[32px] font-semibold text-on-surface">
              {t("Spending Trend")}
            </h3>
            <button className="p-2 rounded-lg hover:bg-surface-container transition-colors text-on-surface-variant">
              <span className="material-symbols-outlined">more_horiz</span>
            </button>
          </div>
          <div
            className="flex-1 relative rounded-lg border border-outline-variant/20 pt-4"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(187,202,191,0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(187,202,191,0.1) 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
          >
            {/* Y-Axis Labels */}
            <div className="absolute left-0 top-4 bottom-8 w-12 flex flex-col justify-between text-right pr-2 font-label-sm text-[12px] text-on-surface-variant">
              <span>10k</span>
              <span>7.5k</span>
              <span>5k</span>
              <span>2.5k</span>
              <span>0</span>
            </div>
            {/* SVG Line Chart */}
            <div className="absolute left-12 right-4 top-4 bottom-8">
              <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" className="overflow-visible">
                <defs>
                  <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M0,80 C10,75 20,90 30,60 C40,30 50,45 60,20 C70,-5 80,40 90,15 L100,25 L100,100 L0,100 Z"
                  fill="url(#chartGradient)"
                />
                <path
                  d="M0,80 C10,75 20,90 30,60 C40,30 50,45 60,20 C70,-5 80,40 90,15 L100,25"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="30" cy="60" r="2.5" fill="#ffffff" stroke="#10b981" strokeWidth="1.5" />
                <circle cx="60" cy="20" r="2.5" fill="#ffffff" stroke="#10b981" strokeWidth="1.5" />
                <circle cx="90" cy="15" r="3.5" fill="#10b981" stroke="#ffffff" strokeWidth="2" />
                <line x1="90" x2="90" y1="0" y2="100" stroke="#bbcabf" strokeWidth="1" strokeDasharray="4" />
              </svg>
            </div>
            {/* X-Axis Labels */}
            <div className="absolute left-12 right-4 bottom-0 h-8 flex justify-between items-end font-label-sm text-[12px] text-on-surface-variant pb-1">
              <span>Week 1</span>
              <span>Week 2</span>
              <span>Week 3</span>
              <span>Week 4</span>
            </div>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="glass-panel rounded-xl p-unit-lg col-span-1 xl:col-span-4 flex flex-col h-[400px]">
          <h3 className="font-headline-md text-[24px] leading-[32px] font-semibold text-on-surface mb-6">
            {t("Category Breakdown")}
          </h3>
          <div className="flex-1 flex flex-col items-center justify-center relative">
            <div
              className="w-48 h-48 rounded-full relative shadow-sm"
              style={{
                background:
                  "conic-gradient(#10b981 0% 35%, #006591 35% 60%, #39b8fd 60% 85%, #b090ff 85% 100%)",
              }}
            >
              <div className="absolute inset-4 bg-surface rounded-full flex flex-col items-center justify-center">
                <span className="font-label-sm text-[12px] text-on-surface-variant">Top Category</span>
                <span className="font-headline-sm text-[20px] font-semibold text-on-surface">{categories[0]?.label || "N/A"}</span>
              </div>
            </div>
          </div>
          <div className="mt-6 space-y-3">
            {categories.map((cat) => (
              <div key={cat.label} className="flex items-center justify-between font-body-sm text-[14px]">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${cat.color}`} />
                  <span className="text-on-surface">{cat.label}</span>
                </div>
                <span className="font-medium">{cat.pct}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Weekly Comparison (Bar Chart) */}
        <div className="glass-panel rounded-xl p-unit-lg col-span-1 xl:col-span-8 flex flex-col h-[360px]">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-headline-md text-[24px] leading-[32px] font-semibold text-on-surface">
              {t("Weekly Comparison")}
            </h3>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-outline-variant/40" />
                <span className="font-label-sm text-[12px] text-on-surface-variant">Last Month</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-primary-container" />
                <span className="font-label-sm text-[12px] text-on-surface-variant">This Month</span>
              </div>
            </div>
          </div>
          <div className="flex-1 flex items-end justify-around pt-4 border-b border-outline-variant/30 pb-2">
            {[
              { last: 40, curr: 65, label: "Mon-Sun (W1)", val: "₹ 5,200" },
              { last: 55, curr: 45, label: "Mon-Sun (W2)", val: "₹ 3,800" },
              { last: 80, curr: 95, label: "Mon-Sun (W3)", val: "₹ 8,100" },
              { last: 60, curr: 30, label: "Mon-Sun (W4)", val: "₹ 2,400" },
            ].map((bar, i) => (
              <div key={i} className="flex gap-1 h-full items-end group">
                <div
                  className="w-8 bg-outline-variant/30 rounded-t-md transition-all"
                  style={{ height: `${bar.last}%` }}
                />
                <div
                  className="w-8 bg-primary-container rounded-t-md shadow-sm hover:opacity-80 transition-all cursor-pointer relative"
                  style={{ height: `${bar.curr}%` }}
                >
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-inverse-surface text-inverse-on-surface px-2 py-1 rounded text-[11px] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {bar.val}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-around mt-2 font-label-sm text-[12px] text-on-surface-variant">
            {["Mon-Sun (W1)", "Mon-Sun (W2)", "Mon-Sun (W3)", "Mon-Sun (W4)"].map((l) => (
              <span key={l}>{l}</span>
            ))}
          </div>
        </div>

        {/* AI Insights Panel */}
        <div className="col-span-1 xl:col-span-4 flex flex-col gap-unit-md">
          <div className="glass-panel rounded-xl p-unit-lg flex-1">
            <div className="flex items-center gap-3 mb-6 border-b border-tertiary-fixed/30 pb-4">
              <span className="material-symbols-outlined text-tertiary text-[24px]">lightbulb</span>
              <h3 className="font-headline-sm text-[20px] font-semibold text-on-surface">
                {t("Smart Recommendations")}
              </h3>
            </div>
            <div className="space-y-4">
              {[
                {
                  icon: "flight_takeoff",
                  iconBg: "bg-secondary-container/20 text-secondary-container",
                  title: "High Travel Variance",
                  body: "Flight expenses for the engineering team are 22% higher than average this month. Consider booking 14 days in advance.",
                },
                {
                  icon: "subscriptions",
                  iconBg: "bg-primary-container/20 text-primary-container",
                  title: "Duplicate Subscriptions",
                  body: "We detected 3 overlapping Adobe Creative Cloud licenses. Consolidating could save ₹4,500 annually.",
                },
                {
                  icon: "update",
                  iconBg: "bg-tertiary-container/20 text-tertiary",
                  title: "Savings Prediction",
                  body: "If current weekend meal spending trends continue, you will miss your quarterly target by 4%.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  onClick={() => handleAction("insight", item.title)}
                  className="flex gap-3 items-start p-3 rounded-lg hover:bg-surface-container-highest/30 transition-colors cursor-pointer border border-transparent hover:border-outline-variant/20"
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${item.iconBg}`}
                  >
                    <span className="material-symbols-outlined text-[16px]">{item.icon}</span>
                  </div>
                  <div>
                    <h4 className="font-label-md text-[14px] text-on-surface mb-1">{item.title}</h4>
                    <p className="font-body-sm text-[14px] text-on-surface-variant leading-tight">
                      {item.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <button 
              onClick={() => handleAction("audit")}
              className="w-full mt-6 py-2 border border-tertiary text-tertiary rounded-lg font-label-md text-[14px] hover:bg-tertiary/5 transition-colors cursor-pointer"
            >
              {t("Run Full Audit")}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
