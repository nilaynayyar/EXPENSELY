"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { useLanguage } from "@/components/LanguageProvider";

type BudgetCategory = {
  icon: string;
  name: string;
  limit: string;
  spent: string;
  pct: number;
  iconBg: string;
  iconColor: string;
  barColor: string;
  pctColor: string;
};

export default function BudgetsPage() {
  const { language } = useLanguage();
  const translations: Record<string, string> = {
    "English (US)": "Budgets",
    "English (UK)": "Budgets",
    "Hindi": "बजट",
    "Spanish": "Presupuestos",
    "French": "Budgets",
  };
  const pageTitle = translations[language] || translations["English (US)"];

  const [categories, setCategories] = useState<BudgetCategory[]>([
    { icon: "restaurant", name: "Food & Dining", limit: "₹8,000 Limit", spent: "₹0 spent", pct: 0, iconBg: "bg-tertiary-container/30", iconColor: "text-tertiary", barColor: "bg-primary", pctColor: "text-on-surface" },
    { icon: "directions_car", name: "Transportation", limit: "₹5,000 Limit", spent: "₹0 spent", pct: 0, iconBg: "bg-secondary-container/30", iconColor: "text-secondary", barColor: "bg-primary", pctColor: "text-on-surface" },
    { icon: "movie", name: "Entertainment", limit: "₹4,000 Limit", spent: "₹0 spent", pct: 0, iconBg: "bg-error-container/30", iconColor: "text-error", barColor: "bg-primary", pctColor: "text-on-surface" },
  ]);
  const [totalLimit, setTotalLimit] = useState(17000);
  const [totalSpent, setTotalSpent] = useState(0);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [allCategories, setAllCategories] = useState<{id: string, name: string}[]>([]);
  const [newLimitCatId, setNewLimitCatId] = useState("");
  const [newLimitAmount, setNewLimitAmount] = useState("");

  const fetchData = async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: catData } = await supabase.from('categories').select('id, name').order('name');
    if (catData) {
      setAllCategories(catData);
      if (catData.length > 0 && !newLimitCatId) setNewLimitCatId(catData[0].id);
    }

    const { data: budgets } = await supabase
      .from('budgets')
      .select('*, categories(name, icon)')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (!budgets || budgets.length === 0) {
      setCategories([]);
      setTotalLimit(0);
      setTotalSpent(0);
      return;
    }

    // Calculate current month bounds
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const endOfMonth = new Date(startOfMonth);
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);

    // Fetch expenses for the current month to calculate spent amount dynamically
    const { data: expenses } = await supabase
      .from('expenses')
      .select('amount, category_id')
      .eq('user_id', session.user.id)
      .gte('date', startOfMonth.toISOString())
      .lt('date', endOfMonth.toISOString());

    // TODO: Move heavy client-side expense aggregation to a Supabase RPC or Postgres View for production scalability.
    const spentByCategory: Record<string, number> = {};
    (expenses || []).forEach(e => {
       const cat = e.category_id;
       if (cat) {
         spentByCategory[cat] = (spentByCategory[cat] || 0) + Number(e.amount);
       }
    });

    let limitSum = 0;
    let spentSum = 0;

    const newCategories = budgets.map((b: any, i: number) => {
      const spent = spentByCategory[b.category_id] || 0;
      const limit = Number(b.limit_amount);
      limitSum += limit;
      spentSum += spent;
      
      const pct = Math.round((spent / (limit || 1)) * 100);
      
      return {
        icon: b.categories?.icon || 'category',
        name: b.categories?.name || 'Uncategorized',
        limit: `₹${limit.toLocaleString()} Limit`,
        spent: `₹${spent.toLocaleString()} spent`,
        pct: pct > 100 ? 100 : pct,
        iconBg: ['bg-tertiary-container/30', 'bg-secondary-container/30', 'bg-error-container/30', 'bg-primary-container/30'][i % 4],
        iconColor: ['text-tertiary', 'text-secondary', 'text-error', 'text-primary'][i % 4],
        barColor: pct >= 90 ? 'bg-error' : pct >= 75 ? 'bg-secondary' : 'bg-primary',
        pctColor: pct >= 90 ? 'text-error font-bold' : pct >= 75 ? 'text-error font-medium' : 'text-on-surface'
      };
    });

    setTotalLimit(limitSum);
    setTotalSpent(spentSum);
    setCategories(newCategories);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSetLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLimitCatId || !newLimitAmount) return;
    
    const amt = parseFloat(newLimitAmount);
    if (isNaN(amt) || amt < 0) return;

    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { error } = await supabase
      .from('budgets')
      .upsert({
        user_id: session.user.id,
        category_id: newLimitCatId,
        limit_amount: amt,
        month: startOfMonth.toISOString().split("T")[0]
      }, { onConflict: 'user_id,category_id,month' });
      
    if (error) {
      alert("Failed to set limit: " + error.message);
      return;
    }
    
    setShowLimitModal(false);
    setNewLimitAmount("");
    fetchData();
  };
  return (
    <main className="flex-1 p-6 md:p-unit-xl max-w-[1440px] mx-auto w-full space-y-unit-xl">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="font-display-lg text-[48px] leading-[56px] tracking-[-0.04em] font-bold text-on-background">
            {pageTitle}
          </h2>
          <p className="font-body-md text-[16px] leading-[24px] text-on-surface-variant mt-2">
            Manage your spending limits and track progress.
          </p>
        </div>
        <button 
          onClick={() => setShowLimitModal(true)}
          className="inline-flex items-center justify-center gap-2 bg-primary-container text-on-primary-container font-label-md text-[14px] py-3 px-6 rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
        >
          <span className="material-symbols-outlined">add</span>
          Set New Limit
        </button>
      </div>

      {/* Top Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-unit-lg">
        {/* Total Budget Summary */}
        <div className="md:col-span-2 glass-panel rounded-xl p-unit-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
            <span
              className="material-symbols-outlined text-primary"
              style={{ fontSize: "96px", fontVariationSettings: "'FILL' 1" }}
            >
              account_balance_wallet
            </span>
          </div>
          <h3 className="font-label-sm text-[12px] uppercase text-on-surface-variant tracking-wider mb-2">
            Total Monthly Limit
          </h3>
          <div className="flex items-baseline gap-2 mb-6">
            <span className="font-display-lg text-[48px] leading-[56px] font-bold text-on-background">
              ₹{totalLimit.toLocaleString()}
            </span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between font-label-md text-[14px]">
              <span className="text-on-surface-variant">Spent: ₹{totalSpent.toLocaleString()}</span>
              <span className="text-primary font-bold">Remaining: ₹{Math.max(0, totalLimit - totalSpent).toLocaleString()}</span>
            </div>
            <div className="w-full bg-surface-container-high rounded-full h-3 overflow-hidden">
              <div className="bg-primary h-3 rounded-full transition-all" style={{ width: `${Math.min(100, (totalSpent / (totalLimit || 1)) * 100)}%` }} />
            </div>
            <p className="font-label-sm text-[12px] text-on-surface-variant text-right">
              {Math.round((totalSpent / (totalLimit || 1)) * 100)}% of limit reached
            </p>
          </div>
        </div>

        {/* Risk Alert Card */}
        <div className="glass-panel rounded-xl p-unit-lg flex flex-col justify-between bg-error-container/20 border border-error-container">
          <div>
            <div className="flex items-center gap-2 mb-4 text-error">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                warning
              </span>
              <h3 className="font-label-md text-[14px] font-bold">Budget Risk Alert</h3>
            </div>
            <p className="font-body-sm text-[14px] text-on-surface">
              You are approaching your limit in{" "}
              <strong className="font-semibold">Entertainment</strong>. Consider reducing non-essential
              spending this week.
            </p>
          </div>
          <Link href="/expenses" className="mt-4 w-full py-2 border border-error text-error rounded-lg font-label-sm text-[12px] hover:bg-error-container transition-colors text-center cursor-pointer">
            Review Expenses
          </Link>
        </div>

        {/* Quick Scan Card */}
        <div className="glass-panel rounded-xl p-unit-lg flex flex-col justify-between bg-surface-container-low border-outline-variant/30 hidden md:flex">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined">receipt_long</span>
            </div>
            <h3 className="font-label-md text-[14px] font-bold">Quick Scan</h3>
          </div>
          <p className="font-body-sm text-[14px] text-on-surface-variant">
            Scan a receipt to automatically add expenses to your budget.
          </p>
          <Link
            href="/scanner"
            className="mt-4 w-full py-2 bg-primary text-on-primary rounded-lg font-label-sm text-[12px] hover:opacity-90 transition-opacity text-center block"
          >
            Scan Now
          </Link>
        </div>
      </div>

      {/* Category Budgets Bento */}
      <div>
        <h3 className="font-headline-sm text-[20px] font-semibold text-on-background mb-unit-md">
          Category Limits
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-unit-lg">
          {categories.map((cat) => (
            <div
              key={cat.name}
              className="glass-panel rounded-xl p-unit-lg transition-all duration-200 hover:border-outline hover:bg-surface-container-highest"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${cat.iconBg} ${cat.iconColor}`}
                  >
                    <span className="material-symbols-outlined">{cat.icon}</span>
                  </div>
                  <div>
                    <h4 className="font-label-md text-[14px] text-on-surface">{cat.name}</h4>
                    <p className="font-label-sm text-[12px] text-on-surface-variant">{cat.limit}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-2 mt-6">
                <div className="flex justify-between font-label-sm text-[12px]">
                  <span className="text-on-surface-variant">{cat.spent}</span>
                  <span className={cat.pctColor}>{cat.pct}%</span>
                </div>
                <div className="w-full bg-surface-container-highest rounded-full h-2">
                  <div
                    className={`${cat.barColor} h-2 rounded-full transition-all`}
                    style={{ width: `${cat.pct}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Set Limit Modal */}
      {showLimitModal && (
        <div className="fixed inset-0 bg-on-background/25 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface rounded-xl shadow-2xl p-unit-xl relative">
            <button
              onClick={() => setShowLimitModal(false)}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface focus:outline-none cursor-pointer"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold mb-4">Set Budget Limit</h3>
            <form onSubmit={handleSetLimit} className="space-y-4">
              <div>
                <label className="block font-label-md text-label-md text-on-surface mb-1" htmlFor="limitCat">
                  Category
                </label>
                <select
                  id="limitCat"
                  required
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent font-body-sm text-body-sm"
                  value={newLimitCatId}
                  onChange={(e) => setNewLimitCatId(e.target.value)}
                >
                  <option value="" disabled>Select Category</option>
                  {allCategories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-label-md text-label-md text-on-surface mb-1" htmlFor="limitAmount">
                  Monthly Limit Amount (₹)
                </label>
                <input
                  required
                  id="limitAmount"
                  type="number"
                  placeholder="e.g. 5000"
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent font-body-sm text-body-sm"
                  value={newLimitAmount}
                  onChange={(e) => setNewLimitAmount(e.target.value)}
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-primary text-on-primary font-label-md text-label-md rounded-lg shadow-sm hover:opacity-95 transition-opacity mt-4 font-bold cursor-pointer"
              >
                Save Limit
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
