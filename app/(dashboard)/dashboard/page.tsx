"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";
import { SpendingLineChart, CategoryPieChart } from "@/components/ui/chart";
import { createClient } from "@/utils/supabase/client";

export default function DashboardPage() {
  const router = useRouter();
  const { language } = useLanguage();

  const { t } = useLanguage();
  const pageTitle = t("Overview");

  const [spendingData, setSpendingData] = useState<{name: string, amount: number}[]>([
    { name: "Jul", amount: 8200 },
    { name: "Aug", amount: 9500 },
    { name: "Sep", amount: 11000 },
    { name: "Oct", amount: 12500 },
    { name: "Nov", amount: 14500 },
  ]);
  const [categoryData, setCategoryData] = useState<{name: string, value: number}[]>([
    { name: "Dining & Delivery", value: 4500 },
    { name: "Shopping", value: 3798 },
    { name: "Transport", value: 1200 },
    { name: "Software", value: 5002 },
  ]);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [totalSpending, setTotalSpending] = useState(14500);

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const { data: expenses } = await supabase
        .from('expenses')
        .select('*, categories(name, icon, id)')
        .eq('user_id', session.user.id)
        .order('date', { ascending: false });
        
      if (!expenses || expenses.length === 0) return;

      const total = expenses.reduce((acc, curr) => acc + Number(curr.amount), 0);
      setTotalSpending(total);

      setRecentTransactions(expenses.slice(0, 5));

      const catMap: Record<string, number> = {};
      expenses.forEach(exp => {
         const catName = exp.categories?.name || 'Uncategorized';
         catMap[catName] = (catMap[catName] || 0) + Number(exp.amount);
      });
      const catData = Object.entries(catMap)
        .map(([name, value]) => ({ name, value }))
        .sort((a,b) => b.value - a.value)
        .slice(0, 4);
      if (catData.length > 0) setCategoryData(catData);

      const monthMap: Record<string, number> = {};
      expenses.forEach(exp => {
         const month = new Date(exp.date).toLocaleDateString('en-US', { month: 'short' });
         monthMap[month] = (monthMap[month] || 0) + Number(exp.amount);
      });
      const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const spendData = Object.entries(monthMap)
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => monthOrder.indexOf(a.name) - monthOrder.indexOf(b.name));
      if (spendData.length > 0) setSpendingData(spendData);
    };
    fetchData();
  }, []);

  return (
    <div className="w-full">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-unit-xl">
        <div>
          <h2 className="font-headline-lg text-headline-lg font-bold text-on-surface mb-1">{pageTitle}</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">Here's what's happening with your finances today.</p>
        </div>
        <button
          onClick={() => router.push("/expenses")}
          className="bg-primary-container text-on-primary-container px-4 py-2 rounded-lg font-label-md text-label-md shadow-sm hover:opacity-90 transition-opacity flex items-center gap-2 cursor-pointer focus:outline-none"
        >
          <span className="material-symbols-outlined text-sm font-semibold">add</span> {t("Add Expense")}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter mb-unit-xl">
        <div className="glass-card rounded-xl p-unit-lg">
          <div className="flex justify-between items-start mb-4">
            <span className="font-label-md text-label-md text-on-surface-variant">{t("Total Spending")}</span>
            <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>
              account_balance_wallet
            </span>
          </div>
          <div className="font-display-lg text-display-lg text-on-surface mb-2 font-bold">₹{totalSpending.toLocaleString()}</div>
          <div className="font-label-sm text-label-sm text-error flex items-center gap-1 font-semibold">
            <span className="material-symbols-outlined text-[14px]">trending_up</span>
            +12% from last month
          </div>
        </div>

        <div className="glass-card rounded-xl p-unit-lg">
          <div className="flex justify-between items-start mb-4">
            <span className="font-label-md text-label-md text-on-surface-variant">{t("Monthly Budget")}</span>
            <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
              track_changes
            </span>
          </div>
          <div className="font-display-lg text-display-lg text-on-surface mb-2 font-bold">₹25,000</div>
          <div className="font-label-sm text-label-sm text-on-surface-variant flex items-center font-semibold">
            Active for November
          </div>
        </div>

        <div className="glass-card rounded-xl p-unit-lg">
          <div className="flex justify-between items-start mb-4">
            <span className="font-label-md text-label-md text-on-surface-variant">{t("Remaining")}</span>
            <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>
              pie_chart
            </span>
          </div>
          <div className="font-display-lg text-display-lg text-on-surface mb-4 font-bold">₹10,500</div>
          <div className="w-full bg-surface-container-high rounded-full h-2 mb-1 overflow-hidden">
            <div className="progress-bar-fill h-2 rounded-full" style={{ width: "58%" }} />
          </div>
          <div className="font-label-sm text-label-sm text-on-surface-variant text-right font-semibold">58% utilized</div>
        </div>

        <div className="glass-card rounded-xl p-unit-lg border-primary/30 ai-glow">
          <div className="flex justify-between items-start mb-4">
            <span className="font-label-md text-label-md text-on-surface-variant">{t("Recent Receipt")}</span>
            <span className="material-symbols-outlined text-primary">receipt_long</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-surface-container-high rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-on-surface-variant">image</span>
            </div>
            <div>
              <div className="font-label-md text-label-md text-on-surface font-semibold truncate max-w-[120px]">
                Starbucks_Nov15.jpg
              </div>
              <div className="font-label-sm text-label-sm text-primary font-semibold">OCR Processing...</div>
            </div>
          </div>
          <Link
            href="/ocr-results"
            className="mt-4 block text-center py-2 bg-primary/10 text-primary rounded-lg font-label-sm text-label-sm hover:bg-primary/20 transition-colors font-semibold"
          >
            View Results
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
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">{t("Spending Trends")}</h3>
              <button className="text-on-surface-variant hover:text-on-surface focus:outline-none">
                <span className="material-symbols-outlined">more_horiz</span>
              </button>
            </div>
            <div className="h-64 w-full bg-surface-container-lowest rounded-lg border border-outline-variant/30 relative p-4">
              <SpendingLineChart data={spendingData} />
            </div>
          </div>

          {/* AI Insights */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
            <div className="glass-card rounded-xl p-unit-lg ai-glow relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-tertiary/10 rounded-full blur-2xl group-hover:bg-tertiary/20 transition-all pointer-events-none" />
              <div className="flex items-start mb-2 relative z-10">
                <div className="w-8 h-8 rounded-lg bg-tertiary/10 flex items-center justify-center text-tertiary mr-3 backdrop-blur-sm shrink-0">
                  <span className="material-symbols-outlined text-[18px]">savings</span>
                </div>
                <div>
                  <h4 className="font-label-md text-label-md text-on-surface font-bold">Savings Insight</h4>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 leading-relaxed">
                    You are on track to save <span className="font-semibold text-primary">₹2,000</span> this month based
                    on your current spending velocity.
                  </p>
                </div>
              </div>
            </div>

            <div className="glass-card rounded-xl p-unit-lg ai-glow relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-error/10 rounded-full blur-2xl group-hover:bg-error/20 transition-all pointer-events-none" />
              <div className="flex items-start mb-2 relative z-10">
                <div className="w-8 h-8 rounded-lg bg-error/10 flex items-center justify-center text-error mr-3 backdrop-blur-sm shrink-0">
                  <span className="material-symbols-outlined text-[18px]">warning</span>
                </div>
                <div>
                  <h4 className="font-label-md text-label-md text-on-surface font-bold">Budget Risk</h4>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 leading-relaxed">
                    Dining out is <span className="font-semibold text-error">15% higher</span> than last week. Consider
                    reducing restaurant expenses.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-gutter">
          {/* Expense Categories */}
          <div className="glass-card rounded-xl p-unit-lg">
            <h3 className="font-headline-sm text-headline-sm text-on-surface mb-6 font-bold">{t("Categories")}</h3>
            <div className="flex justify-center mb-6 relative">
              <div className="w-40 h-40 relative">
                <CategoryPieChart data={categoryData} />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="font-headline-sm text-headline-sm font-bold text-on-surface">₹{totalSpending > 1000 ? (totalSpending/1000).toFixed(1) + 'k' : totalSpending}</span>
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
                    <div className={`w-3 h-3 rounded-full mr-2 ${['bg-secondary', 'bg-primary', 'bg-surface-dim', 'bg-tertiary'][i % 4]}`} />
                    <span className="font-label-md text-label-md">{cat.name}</span>
                  </div>
                  <span className="font-label-md text-label-md font-bold">₹{cat.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
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
                recentTransactions.map((tx: any) => (
                  <div key={tx.id} className="flex justify-between items-center py-3 border-b border-outline-variant/10 hover:bg-surface-container-lowest/50 transition-colors px-2 -mx-2 rounded-lg">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center mr-3 shrink-0">
                        <span className="material-symbols-outlined text-on-surface-variant text-[20px]">{tx.categories?.icon || 'receipt'}</span>
                      </div>
                      <div>
                        <div className="font-label-md text-label-md text-on-surface font-semibold">{tx.store}</div>
                        <div className="font-label-sm text-label-sm text-on-surface-variant mt-0.5">{new Date(tx.date).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div className="font-label-md text-label-md font-bold text-on-surface">₹{tx.amount}</div>
                  </div>
                ))
              ) : (
                <div className="py-4 text-on-surface-variant font-label-sm text-center">No recent transactions.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Action Button */}
      <button
        onClick={() => router.push("/scanner")}
        className="fixed bottom-8 right-8 w-16 h-16 bg-primary text-on-primary rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform z-40 focus:outline-none cursor-pointer"
      >
        <span className="material-symbols-outlined text-[32px]">photo_camera</span>
      </button>
    </div>
  );
}
