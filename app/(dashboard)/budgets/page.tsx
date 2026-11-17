"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { useLanguage } from "@/components/LanguageProvider";

interface BudgetRecord {
  id: string;
  category_id: string;
  limit_amount: number;
  month: string;
  categories?: {
    id: string;
    name: string;
    icon: string;
  };
}

interface BudgetCardItem {
  id: string;
  categoryId: string;
  icon: string;
  name: string;
  limit: number;
  spent: number;
  pct: number;
  iconBg: string;
  iconColor: string;
  barColor: string;
  pctColor: string;
}

export default function BudgetsPage() {
  const { t, formatCurrency } = useLanguage();
  const pageTitle = t("budgets_title") || "Budgets & Runway";

  const [categories, setCategories] = useState<BudgetCardItem[]>([]);
  const [totalLimit, setTotalLimit] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Set / Edit Limit Modal State
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [allCategories, setAllCategories] = useState<{ id: string; name: string }[]>([]);
  const [newLimitCatId, setNewLimitCatId] = useState("");
  const [newLimitAmount, setNewLimitAmount] = useState("");

  const fetchData = useCallback(async () => {
    const supabase = createClient();
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: catData } = await supabase.from("categories").select("id, name").order("name");
      if (catData) {
        setAllCategories(catData);
        if (catData.length > 0 && !newLimitCatId) setNewLimitCatId(catData[0].id);
      }

      const { data: budgets, error: budgetError } = await supabase
        .from("budgets")
        .select("*, categories(id, name, icon)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (budgetError) {
        console.error("[Budgets] Fetch error:", budgetError);
        return;
      }

      // Calculate current month bounds
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const endOfMonth = new Date(startOfMonth);
      endOfMonth.setMonth(endOfMonth.getMonth() + 1);

      // Fetch expenses for the current month
      const { data: expenses } = await supabase
        .from("expenses")
        .select("amount, category_id")
        .eq("user_id", user.id)
        .gte("date", startOfMonth.toISOString().split("T")[0])
        .lt("date", endOfMonth.toISOString().split("T")[0]);

      const spentByCategory: Record<string, number> = {};
      (expenses || []).forEach((e) => {
        const cat = e.category_id;
        if (cat) {
          spentByCategory[cat] = (spentByCategory[cat] || 0) + Number(e.amount);
        }
      });

      if (!budgets || budgets.length === 0) {
        setCategories([]);
        setTotalLimit(0);
        setTotalSpent(0);
        return;
      }

      let limitSum = 0;
      let spentSum = 0;

      const budgetRecords = budgets as unknown as BudgetRecord[];
      const newCategories: BudgetCardItem[] = budgetRecords.map((b, i) => {
        const spent = spentByCategory[b.category_id] || 0;
        const limit = Number(b.limit_amount);
        limitSum += limit;
        spentSum += spent;

        const rawPct = Math.round((spent / (limit || 1)) * 100);

        return {
          id: b.id,
          categoryId: b.category_id,
          icon: b.categories?.icon || "category",
          name: b.categories?.name || "Uncategorized",
          limit: limit,
          spent: spent,
          pct: rawPct,
          iconBg: [
            "bg-tertiary-container/30",
            "bg-secondary-container/30",
            "bg-error-container/30",
            "bg-primary-container/30",
          ][i % 4],
          iconColor: ["text-tertiary", "text-secondary", "text-error", "text-primary"][i % 4],
          barColor: rawPct >= 90 ? "bg-error" : rawPct >= 75 ? "bg-amber-500" : "bg-primary",
          pctColor:
            rawPct >= 90 ? "text-error font-bold" : rawPct >= 75 ? "text-amber-500 font-semibold" : "text-on-surface",
        };
      });

      setTotalLimit(limitSum);
      setTotalSpent(spentSum);
      setCategories(newCategories);
    } catch (err) {
      console.error("[Budgets] Error in fetchData:", err);
    } finally {
      setIsLoading(false);
    }
  }, [newLimitCatId]);

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

  // Find the highest risk category
  const riskCategory = useMemo(() => {
    if (categories.length === 0) return null;
    const sorted = [...categories].sort((a, b) => b.pct - a.pct);
    return sorted[0].pct >= 60 ? sorted[0] : null;
  }, [categories]);

  const handleOpenCreateModal = () => {
    setEditingBudgetId(null);
    setNewLimitAmount("");
    if (allCategories.length > 0) setNewLimitCatId(allCategories[0].id);
    setShowLimitModal(true);
  };

  const handleOpenEditModal = (cat: BudgetCardItem) => {
    setEditingBudgetId(cat.id);
    setNewLimitCatId(cat.categoryId);
    setNewLimitAmount(cat.limit.toString());
    setShowLimitModal(true);
  };

  const handleDeleteBudget = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this budget limit?")) return;

    const supabase = createClient();
    const { error } = await supabase.from("budgets").delete().eq("id", id);
    if (error) {
      alert("Failed to delete budget: " + error.message);
      return;
    }
    fetchData();
  };

  const handleSaveLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLimitCatId || !newLimitAmount) return;

    const amt = parseFloat(newLimitAmount);
    if (isNaN(amt) || amt <= 0) {
      alert("Please enter a valid positive limit.");
      return;
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    if (editingBudgetId) {
      const { error } = await supabase
        .from("budgets")
        .update({
          limit_amount: amt,
          category_id: newLimitCatId,
        })
        .eq("id", editingBudgetId)
        .eq("user_id", user.id);

      if (error) {
        alert("Failed to update limit: " + error.message);
        return;
      }
    } else {
      const { error } = await supabase.from("budgets").upsert(
        {
          user_id: user.id,
          category_id: newLimitCatId,
          limit_amount: amt,
          month: startOfMonth.toISOString().split("T")[0],
        },
        { onConflict: "user_id,category_id,month" }
      );

      if (error) {
        alert("Failed to set limit: " + error.message);
        return;
      }
    }

    setShowLimitModal(false);
    setEditingBudgetId(null);
    setNewLimitAmount("");
    fetchData();
  };

  const overallPct = totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 100) : 0;

  return (
    <main className="flex-1 p-6 md:p-unit-xl max-w-[1440px] mx-auto w-full space-y-unit-xl">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="font-display-lg text-[40px] md:text-[48px] leading-[48px] md:leading-[56px] tracking-[-0.04em] font-bold text-on-background">
            {pageTitle}
          </h2>
          <p className="font-body-md text-[16px] leading-[24px] text-on-surface-variant mt-2">
            {t("budgets_subtitle") || "Manage your monthly category spending limits and maintain control."}
          </p>
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="inline-flex items-center justify-center gap-2 bg-primary text-on-primary font-label-md text-[14px] py-3 px-6 rounded-lg hover:opacity-90 transition-opacity cursor-pointer font-bold shadow-sm"
        >
          <span className="material-symbols-outlined">add</span>
          {t("budgets_create_btn") || "Set New Limit"}
        </button>
      </div>

      {/* Top Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-unit-lg">
        {/* Total Budget Summary */}
        <div className="md:col-span-2 glass-panel rounded-xl p-unit-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
            <span
              className="material-symbols-outlined text-primary"
              style={{ fontSize: "96px", fontVariationSettings: "'FILL' 1" }}
            >
              account_balance_wallet
            </span>
          </div>
          <h3 className="font-label-sm text-[12px] uppercase text-on-surface-variant tracking-wider mb-2 font-semibold">
            {t("budgets_overall_health") || "Total Monthly Limit"}
          </h3>
          <div className="flex items-baseline gap-2 mb-6">
            <span className="font-display-lg text-[40px] md:text-[48px] leading-[48px] md:leading-[56px] font-bold text-on-background">
              {formatCurrency(totalLimit)}
            </span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between font-label-md text-[14px]">
              <span className="text-on-surface-variant">
                Spent: {formatCurrency(totalSpent)}
              </span>
              <span className="text-primary font-bold">
                Remaining: {formatCurrency(Math.max(0, totalLimit - totalSpent))}
              </span>
            </div>
            <div className="w-full bg-surface-container-high rounded-full h-3 overflow-hidden">
              <div
                className={`h-3 rounded-full transition-all ${
                  overallPct >= 90 ? "bg-error" : overallPct >= 75 ? "bg-amber-500" : "bg-primary"
                }`}
                style={{ width: `${Math.min(100, overallPct)}%` }}
              />
            </div>
            <p className="font-label-sm text-[12px] text-on-surface-variant text-right">
              {overallPct}% of limit reached
            </p>
          </div>
        </div>

        {/* Dynamic Risk Alert Card */}
        {riskCategory ? (
          <div className="glass-panel rounded-xl p-unit-lg flex flex-col justify-between bg-error-container/20 border border-error-container">
            <div>
              <div className="flex items-center gap-2 mb-4 text-error">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                  warning
                </span>
                <h3 className="font-label-md text-[14px] font-bold">Budget Risk Alert</h3>
              </div>
              <p className="font-body-sm text-[14px] text-on-surface">
                You have reached <strong className="font-bold text-error">{riskCategory.pct}%</strong> of your limit in{" "}
                <strong className="font-semibold">{riskCategory.name}</strong> (₹{riskCategory.spent.toLocaleString()} /
                ₹{riskCategory.limit.toLocaleString()}).
              </p>
            </div>
            <Link
              href="/expenses"
              className="mt-4 w-full py-2 border border-error text-error rounded-lg font-label-sm text-[12px] hover:bg-error-container transition-colors text-center cursor-pointer font-semibold block"
            >
              Review Expenses
            </Link>
          </div>
        ) : (
          <div className="glass-panel rounded-xl p-unit-lg flex flex-col justify-between bg-primary-container/10 border border-primary/20">
            <div>
              <div className="flex items-center gap-2 mb-4 text-primary">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                  check_circle
                </span>
                <h3 className="font-label-md text-[14px] font-bold">Budgets on Track</h3>
              </div>
              <p className="font-body-sm text-[14px] text-on-surface">
                All your tracked category spending limits are healthy. Continue tracking to maintain financial efficiency.
              </p>
            </div>
            <Link
              href="/expenses"
              className="mt-4 w-full py-2 border border-primary text-primary rounded-lg font-label-sm text-[12px] hover:bg-primary/10 transition-colors text-center cursor-pointer font-semibold block"
            >
              View Transactions
            </Link>
          </div>
        )}
      </div>

      {/* Category Budgets Grid */}
      <div>
        <div className="flex items-center justify-between mb-unit-md">
          <h3 className="font-headline-sm text-[20px] font-semibold text-on-background">
            Category Limits
          </h3>
          <span className="text-on-surface-variant font-body-sm text-[13px]">
            {categories.length} limit{categories.length === 1 ? "" : "s"} defined
          </span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-on-surface-variant glass-panel rounded-xl">
            Loading budget limits...
          </div>
        ) : categories.length === 0 ? (
          <div className="p-12 text-center text-on-surface-variant glass-panel rounded-xl">
            <span className="material-symbols-outlined text-[48px] text-on-surface-variant/50 mb-2">
              savings
            </span>
            <p className="font-label-md text-[16px] text-on-surface font-semibold mb-1">
              No budget limits created yet
            </p>
            <p className="font-body-sm text-body-sm text-on-surface-variant mb-4">
              Set monthly spending targets by category to track expenses effortlessly.
            </p>
            <button
              onClick={handleOpenCreateModal}
              className="px-4 py-2 bg-primary text-on-primary rounded-lg font-label-md text-label-md font-bold cursor-pointer"
            >
              Create First Limit
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-unit-lg">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="glass-panel rounded-xl p-unit-lg transition-all duration-200 hover:border-outline hover:bg-surface-container-highest group relative"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${cat.iconBg} ${cat.iconColor}`}
                    >
                      <span className="material-symbols-outlined">{cat.icon}</span>
                    </div>
                    <div>
                      <h4 className="font-label-md text-[14px] text-on-surface font-semibold">{cat.name}</h4>
                      <p className="font-label-sm text-[12px] text-on-surface-variant">
                        ₹{cat.limit.toLocaleString()} Limit
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleOpenEditModal(cat)}
                      className="p-1 text-on-surface-variant hover:text-primary rounded hover:bg-surface-container cursor-pointer"
                      title="Edit Limit"
                    >
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    <button
                      onClick={(e) => handleDeleteBudget(cat.id, e)}
                      className="p-1 text-on-surface-variant hover:text-red-500 rounded hover:bg-surface-container cursor-pointer"
                      title="Delete Limit"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </div>
                <div className="space-y-2 mt-6">
                  <div className="flex justify-between font-label-sm text-[12px]">
                    <span className="text-on-surface-variant">₹{cat.spent.toLocaleString()} spent</span>
                    <span className={cat.pctColor}>{cat.pct}%</span>
                  </div>
                  <div className="w-full bg-surface-container-highest rounded-full h-2 overflow-hidden">
                    <div
                      className={`${cat.barColor} h-2 rounded-full transition-all`}
                      style={{ width: `${Math.min(100, cat.pct)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Set / Edit Limit Modal */}
      {showLimitModal && (
        <div className="fixed inset-0 bg-on-background/25 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface rounded-xl shadow-2xl p-unit-xl relative luminous-border">
            <button
              onClick={() => setShowLimitModal(false)}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface focus:outline-none cursor-pointer"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold mb-4">
              {editingBudgetId ? (t("budgets_modal_title") || "Edit Budget Limit") : (t("budgets_modal_title") || "Set Budget Limit")}
            </h3>
            <form onSubmit={handleSaveLimit} className="space-y-4">
              <div>
                <label className="block font-label-md text-label-md text-on-surface mb-1" htmlFor="limitCat">
                  {t("budgets_modal_category") || "Category"}
                </label>
                <select
                  id="limitCat"
                  required
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent font-body-sm text-body-sm cursor-pointer"
                  value={newLimitCatId}
                  onChange={(e) => setNewLimitCatId(e.target.value)}
                >
                  <option value="" disabled>
                    Select Category
                  </option>
                  {allCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-label-md text-label-md text-on-surface mb-1" htmlFor="limitAmount">
                  {t("budgets_modal_limit") || "Monthly Limit Amount (₹)"}
                </label>
                <input
                  required
                  id="limitAmount"
                  type="number"
                  step="1"
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
                {t("expenses_modal_save") || "Save Limit"}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
