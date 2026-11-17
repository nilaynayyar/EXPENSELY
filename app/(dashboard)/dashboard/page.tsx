"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";
import { SpendingLineChart, CategoryPieChart, SpendingTrendPoint, CategoryDataPoint } from "@/components/ui/chart";
import { createClient } from "@/utils/supabase/client";
import { Expense } from "@/types";

interface InsightInfo {
  type: "savings" | "risk" | "info";
  title: string;
  description: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const pageTitle = t("Overview");

  const [loading, setLoading] = useState(true);
  const [totalSpending, setTotalSpending] = useState(0);
  const [currentMonthTotal, setCurrentMonthTotal] = useState(0);
  const [prevMonthTotal, setPrevMonthTotal] = useState(0);
  const [monthlyBudget, setMonthlyBudget] = useState<number | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Expense[]>([]);
  const [latestReceiptExpense, setLatestReceiptExpense] = useState<Expense | null>(null);
  const [spendingData, setSpendingData] = useState<SpendingTrendPoint[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryDataPoint[]>([]);
  const [insights, setInsights] = useState<InsightInfo[]>([]);

  const fetchData = useCallback(async () => {
    const supabase = createClient();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const userId = user.id;

      // Current month dates
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      const startOfMonthStr = new Date(currentYear, currentMonth, 1).toISOString().split("T")[0];
      const startOfNextMonthStr = new Date(currentYear, currentMonth + 1, 1).toISOString().split("T")[0];
      const startOfPrevMonthStr = new Date(currentYear, currentMonth - 1, 1).toISOString().split("T")[0];

      // Fetch expenses and budgets in parallel
      const [expensesRes, budgetsRes] = await Promise.all([
        supabase
          .from("expenses")
          .select("*, categories(id, name, icon)")
          .eq("user_id", userId)
          .order("date", { ascending: false }),
        supabase
          .from("budgets")
          .select("*, categories(name)")
          .eq("user_id", userId)
          .gte("month", startOfMonthStr)
          .lt("month", startOfNextMonthStr)
      ]);

      const expenses: Expense[] = expensesRes.data || [];
      const budgets = budgetsRes.data || [];

      // 1. Total Spending
      const allTimeTotal = expenses.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
      setTotalSpending(allTimeTotal);

      // 2. Current Month & Previous Month Spending
      let curMonthSum = 0;
      let prevMonthSum = 0;
      expenses.forEach((e) => {
        const amt = Number(e.amount || 0);
        if (e.date >= startOfMonthStr && e.date < startOfNextMonthStr) {
          curMonthSum += amt;
        } else if (e.date >= startOfPrevMonthStr && e.date < startOfMonthStr) {
          prevMonthSum += amt;
        }
      });
      setCurrentMonthTotal(curMonthSum);
      setPrevMonthTotal(prevMonthSum);

      // 3. Monthly Budget Total
      if (budgets.length > 0) {
        const budgetSum = budgets.reduce((acc, b) => acc + Number(b.limit_amount || 0), 0);
        setMonthlyBudget(budgetSum);
      } else {
        setMonthlyBudget(null);
      }

      // 4. Recent Transactions
      setRecentTransactions(expenses.slice(0, 5));

      // 5. Recent Receipt Item
      const withReceipt = expenses.find((e) => Boolean(e.receipt_url)) || expenses[0] || null;
      setLatestReceiptExpense(withReceipt);

      // 6. Category Breakdown
      const catMap: Record<string, number> = {};
      expenses.forEach((exp) => {
        const catName = exp.categories?.name || "Uncategorized";
        catMap[catName] = (catMap[catName] || 0) + Number(exp.amount || 0);
      });
      const catData: CategoryDataPoint[] = Object.entries(catMap)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
      setCategoryData(catData);

      // 7. Monthly Trend (Past 6 months)
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const monthlyBuckets: Record<string, number> = {};
      for (let i = 5; i >= 0; i--) {
        const d = new Date(currentYear, currentMonth - i, 1);
        const key = `${monthNames[d.getMonth()]} ${d.getFullYear().toString().slice(-2)}`;
        monthlyBuckets[key] = 0;
      }
      expenses.forEach((exp) => {
        const d = new Date(exp.date);
        const key = `${monthNames[d.getMonth()]} ${d.getFullYear().toString().slice(-2)}`;
        if (monthlyBuckets[key] !== undefined) {
          monthlyBuckets[key] += Number(exp.amount || 0);
        }
      });
      const spendPoints: SpendingTrendPoint[] = Object.entries(monthlyBuckets).map(([name, amount]) => ({
        name,
        amount,
      }));
      setSpendingData(spendPoints);

      // 8. Derived Rule-Based Insights
      const calculatedInsights: InsightInfo[] = [];
      if (catData.length > 0) {
        const topCat = catData[0];
        const topPct = allTimeTotal > 0 ? Math.round((topCat.value / allTimeTotal) * 100) : 0;
        calculatedInsights.push({
          type: "info",
          title: "Top Spending Area",
          description: `Your highest expense category is ${topCat.name}, representing ${topPct}% (₹${topCat.value.toLocaleString()}) of overall tracked spending.`,
        });
      }
      if (curMonthSum < prevMonthSum && prevMonthSum > 0) {
        const diff = prevMonthSum - curMonthSum;
        calculatedInsights.push({
          type: "savings",
          title: "Spending Velocity",
          description: `Your spending this month is ₹${diff.toLocaleString()} lower than the same period last month. Keep up the disciplined runway!`,
        });
      } else if (curMonthSum > prevMonthSum && prevMonthSum > 0) {
        const diff = curMonthSum - prevMonthSum;
        calculatedInsights.push({
          type: "risk",
          title: "Increased Spend Notice",
          description: `Your spending this month is ₹${diff.toLocaleString()} higher than last month. Review active subscriptions and non-essential expenses.`,
        });
      } else {
        calculatedInsights.push({
          type: "savings",
          title: "Runway Health",
          description: "All expenses are synchronized in real-time. Set monthly category limits in Budgets to keep runway on target.",
        });
      }
      setInsights(calculatedInsights);
    } catch (err) {
      console.error("[Dashboard] Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      if (isMounted) {
        await fetchData();
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [fetchData]);

  const momChange = prevMonthTotal > 0 ? Math.round(((currentMonthTotal - prevMonthTotal) / prevMonthTotal) * 100) : 0;
  const currentMonthName = new Date().toLocaleDateString("en-US", { month: "long" });

  const remainingBudget = monthlyBudget !== null ? Math.max(0, monthlyBudget - currentMonthTotal) : null;
  const budgetUtilization = monthlyBudget && monthlyBudget > 0 ? Math.min(100, Math.round((currentMonthTotal / monthlyBudget) * 100)) : 0;

  return (
    <div className="w-full">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-unit-xl">
        <div>
          <h2 className="font-headline-lg text-headline-lg font-bold text-on-surface mb-1">{pageTitle}</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Here&apos;s an up-to-date summary of your finances for {currentMonthName}.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/scanner"
            className="bg-surface border border-outline-variant text-on-surface px-4 py-2 rounded-lg font-label-md text-label-md shadow-sm hover:bg-surface-container-low transition-colors flex items-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">document_scanner</span>
            Scan Receipt
          </Link>
          <button
            onClick={() => router.push("/expenses")}
            className="bg-primary-container text-on-primary-container px-4 py-2 rounded-lg font-label-md text-label-md shadow-sm hover:opacity-90 transition-opacity flex items-center gap-2 cursor-pointer focus:outline-none"
          >
            <span className="material-symbols-outlined text-sm font-semibold">add</span> {t("Add Expense")}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-on-surface-variant">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
          <p className="font-body-sm">Loading your financial intelligence dashboard...</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter mb-unit-xl">
            {/* Total Spending */}
            <div className="glass-card rounded-xl p-unit-lg">
              <div className="flex justify-between items-start mb-4">
                <span className="font-label-md text-label-md text-on-surface-variant">{t("Total Spending")}</span>
                <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>
                  account_balance_wallet
                </span>
              </div>
              <div className="font-display-lg text-display-lg text-on-surface mb-2 font-bold">
                ₹{totalSpending.toLocaleString()}
              </div>
              <div className="font-label-sm text-label-sm flex items-center gap-1 font-semibold">
                {prevMonthTotal > 0 ? (
                  <span className={momChange >= 0 ? "text-error flex items-center gap-1" : "text-primary flex items-center gap-1"}>
                    <span className="material-symbols-outlined text-[14px]">
                      {momChange >= 0 ? "trending_up" : "trending_down"}
                    </span>
                    {momChange >= 0 ? `+${momChange}%` : `${momChange}%`} vs last month
                  </span>
                ) : (
                  <span className="text-on-surface-variant">All time recorded</span>
                )}
              </div>
            </div>

            {/* Monthly Budget */}
            <div className="glass-card rounded-xl p-unit-lg">
              <div className="flex justify-between items-start mb-4">
                <span className="font-label-md text-label-md text-on-surface-variant">{t("Monthly Budget")}</span>
                <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                  track_changes
                </span>
              </div>
              <div className="font-display-lg text-display-lg text-on-surface mb-2 font-bold">
                {monthlyBudget !== null ? `₹${monthlyBudget.toLocaleString()}` : "Not set"}
              </div>
              <div className="font-label-sm text-label-sm text-on-surface-variant flex items-center justify-between font-semibold">
                <span>Spent: ₹{currentMonthTotal.toLocaleString()}</span>
                {monthlyBudget === null && (
                  <Link href="/budgets" className="text-primary hover:underline">
                    Set budget
                  </Link>
                )}
              </div>
            </div>

            {/* Remaining */}
            <div className="glass-card rounded-xl p-unit-lg">
              <div className="flex justify-between items-start mb-4">
                <span className="font-label-md text-label-md text-on-surface-variant">{t("Remaining")}</span>
                <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>
                  pie_chart
                </span>
              </div>
              <div className="font-display-lg text-display-lg text-on-surface mb-4 font-bold">
                {remainingBudget !== null ? `₹${remainingBudget.toLocaleString()}` : "—"}
              </div>
              <div className="w-full bg-surface-container-high rounded-full h-2 mb-1 overflow-hidden">
                <div
                  className="progress-bar-fill h-2 rounded-full transition-all"
                  style={{ width: `${budgetUtilization}%` }}
                />
              </div>
              <div className="font-label-sm text-label-sm text-on-surface-variant text-right font-semibold">
                {monthlyBudget ? `${budgetUtilization}% utilized` : "No limit defined"}
              </div>
            </div>

            {/* Recent Receipt / Scanner Status */}
            <div className="glass-card rounded-xl p-unit-lg border-primary/30 ai-glow">
              <div className="flex justify-between items-start mb-4">
                <span className="font-label-md text-label-md text-on-surface-variant">{t("Recent Receipt")}</span>
                <span className="material-symbols-outlined text-primary">receipt_long</span>
              </div>
              {latestReceiptExpense ? (
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-primary/10 text-primary rounded-lg flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[20px]">
                      {latestReceiptExpense.categories?.icon || "receipt"}
                    </span>
                  </div>
                  <div className="overflow-hidden">
                    <div className="font-label-md text-label-md text-on-surface font-semibold truncate max-w-[140px]">
                      {latestReceiptExpense.store}
                    </div>
                    <div className="font-label-sm text-label-sm text-primary font-semibold">
                      ₹{Number(latestReceiptExpense.amount).toLocaleString()} • {latestReceiptExpense.status}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-on-surface-variant font-label-sm py-2">
                  No receipts scanned yet.
                </div>
              )}
              <Link
                href="/scanner"
                className="mt-4 block text-center py-2 bg-primary/10 text-primary rounded-lg font-label-sm text-label-sm hover:bg-primary/20 transition-colors font-semibold"
              >
                Open Receipt Scanner
              </Link>
            </div>
          </div>

          {/* Main Dashboard Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
            {/* Left Column (Charts) */}
            <div className="lg:col-span-2 space-y-gutter">
              {/* Spending Trends */}
              <div className="glass-card rounded-xl p-unit-lg">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">{t("Spending Trends")}</h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">Monthly spending history from verified transactions</p>
                  </div>
                  <Link
                    href="/analytics"
                    className="text-primary hover:underline font-label-sm text-label-sm font-semibold flex items-center gap-1"
                  >
                    View Analytics <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </Link>
                </div>
                <div className="h-64 w-full bg-surface-container-lowest rounded-lg border border-outline-variant/30 relative p-4">
                  {spendingData.some((p) => p.amount > 0) ? (
                    <SpendingLineChart data={spendingData} />
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-on-surface-variant font-body-sm">
                      <span className="material-symbols-outlined text-4xl mb-2 text-outline-variant">show_chart</span>
                      No transaction history to plot yet. Add your first expense to view trends.
                    </div>
                  )}
                </div>
              </div>

              {/* Rule-Based Financial Insights */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
                {insights.map((ins, idx) => (
                  <div key={idx} className="glass-card rounded-xl p-unit-lg ai-glow relative overflow-hidden group">
                    <div
                      className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl transition-all pointer-events-none ${
                        ins.type === "risk" ? "bg-error/10 group-hover:bg-error/20" : "bg-primary-container/10 group-hover:bg-primary-container/20"
                      }`}
                    />
                    <div className="flex items-start mb-2 relative z-10">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 backdrop-blur-sm shrink-0 ${
                          ins.type === "risk" ? "bg-error/10 text-error" : "bg-primary/10 text-primary"
                        }`}
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {ins.type === "risk" ? "warning" : "insights"}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-label-md text-label-md text-on-surface font-bold">{ins.title}</h4>
                        <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 leading-relaxed">
                          {ins.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-gutter">
              {/* Expense Categories */}
              <div className="glass-card rounded-xl p-unit-lg">
                <h3 className="font-headline-sm text-headline-sm text-on-surface mb-6 font-bold">{t("Categories")}</h3>
                {categoryData.length > 0 ? (
                  <>
                    <div className="flex justify-center mb-6 relative">
                      <div className="w-40 h-40 relative">
                        <CategoryPieChart data={categoryData} />
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="font-headline-sm text-headline-sm font-bold text-on-surface">
                            ₹{totalSpending > 1000 ? `${(totalSpending / 1000).toFixed(1)}k` : totalSpending}
                          </span>
                          <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
                            Total
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {categoryData.map((cat, i) => (
                        <div key={cat.name} className="flex justify-between items-center">
                          <div className="flex items-center">
                            <div
                              className={`w-3 h-3 rounded-full mr-2 ${
                                ["bg-secondary", "bg-primary", "bg-tertiary", "bg-error", "bg-secondary-container"][
                                  i % 5
                                ]
                              }`}
                            />
                            <span className="font-label-md text-label-md">{cat.name}</span>
                          </div>
                          <span className="font-label-md text-label-md font-bold">₹{cat.value.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="py-12 text-center text-on-surface-variant font-body-sm">
                    <span className="material-symbols-outlined text-4xl mb-2 text-outline-variant">donut_large</span>
                    <p>No category breakdown available yet.</p>
                  </div>
                )}
              </div>

              {/* Recent Transactions */}
              <div className="glass-card rounded-xl p-unit-lg">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">{t("Recent")}</h3>
                  <Link className="font-label-sm text-label-sm text-primary hover:underline font-semibold" href="/expenses">
                    {t("View All")}
                  </Link>
                </div>
                <div className="space-y-0">
                  {recentTransactions.length > 0 ? (
                    recentTransactions.map((tx) => (
                      <div
                        key={tx.id}
                        onClick={() => router.push("/expenses")}
                        className="flex justify-between items-center py-3 border-b border-outline-variant/10 hover:bg-surface-container-lowest/50 transition-colors px-2 -mx-2 rounded-lg cursor-pointer"
                      >
                        <div className="flex items-center">
                          <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center mr-3 shrink-0">
                            <span className="material-symbols-outlined text-on-surface-variant text-[20px]">
                              {tx.categories?.icon || "receipt"}
                            </span>
                          </div>
                          <div>
                            <div className="font-label-md text-label-md text-on-surface font-semibold">{tx.store}</div>
                            <div className="font-label-sm text-label-sm text-on-surface-variant mt-0.5">
                              {new Date(tx.date).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <div className="font-label-md text-label-md font-bold text-on-surface">
                          ₹{Number(tx.amount).toFixed(2)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-6 text-on-surface-variant font-label-sm text-center">
                      No recent transactions recorded.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Floating Action Button */}
      <button
        onClick={() => router.push("/scanner")}
        aria-label="Scan Receipt"
        className="fixed bottom-8 right-8 w-16 h-16 bg-primary text-on-primary rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform z-40 focus:outline-none cursor-pointer"
      >
        <span className="material-symbols-outlined text-[32px]">photo_camera</span>
      </button>
    </div>
  );
}
