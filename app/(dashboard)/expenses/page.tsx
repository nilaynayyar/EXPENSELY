"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { useLanguage } from "@/components/LanguageProvider";

interface Category {
  id: string;
  name: string;
  icon: string;
}

interface Expense {
  id: string;
  date: string;
  store: string;
  category_id: string;
  categories: Category;
  status: "Verified" | "Pending";
  amount: number;
}

function ExpensesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language } = useLanguage();

  const translations: Record<string, string> = {
    "English (US)": "All Expenses",
    "English (UK)": "All Expenses",
    "Hindi": "सभी खर्च",
    "Spanish": "Todos los Gastos",
    "French": "Toutes les Dépenses",
  };
  const pageTitle = translations[language] || translations["English (US)"];
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [showAddModal, setShowAddModal] = useState(false);

  // State
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Form states
  const [newStore, setNewStore] = useState("");
  const [newCategoryId, setNewCategoryId] = useState("");
  const [newAmount, setNewAmount] = useState("");

  // Pre-seed search from header global search (?q=...)
  useEffect(() => {
    const q = searchParams.get("q");
    if (q) setSearch(q);
  }, [searchParams]);

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      const supabase = createClient();
      try {
        setIsLoading(true);
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('[Expenses] Session error:', sessionError);
          if (isMounted) setError('Session error. Please log in again.');
          return;
        }
        if (!session) {
          return;
        }

        const currentUserId = session.user.id;
        if (isMounted) setUserId(currentUserId);

        const [categoriesRes, expensesRes] = await Promise.all([
          supabase.from("categories").select("*").order("name"),
          supabase.from("expenses").select("*, categories(id, name, icon)").eq("user_id", currentUserId).order("date", { ascending: false })
        ]);

        if (categoriesRes.error) {
          console.error('[Expenses] Categories fetch error:', categoriesRes.error);
          throw categoriesRes.error;
        }
        if (expensesRes.error) {
          console.error('[Expenses] Expenses fetch error:', expensesRes.error);
          throw expensesRes.error;
        }

        if (isMounted) {
          setCategories(categoriesRes.data || []);
          setExpenses((expensesRes.data as any) || []);
        }
      } catch (err: any) {
        console.error('[Expenses] fetchData error:', err);
        if (isMounted) setError(err.message || "Failed to load data.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchData();

    return () => { isMounted = false; };
  }, [router]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newStore || !newStore.trim()) {
      alert("Please enter a store or vendor name.");
      return;
    }
    if (!newCategoryId || newCategoryId === "") {
      alert("Please select a category.");
      return;
    }
    const amount = parseFloat(newAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid positive amount.");
      return;
    }
    if (!userId) {
      alert("User session not found. Please log in again.");
      return;
    }

    const supabase = createClient();
    const newExpensePayload = {
      user_id: userId,
      store: newStore.trim(),
      category_id: newCategoryId,
      amount: amount,
      date: new Date().toISOString().split("T")[0],
      status: "Pending"
    };

    try {
      const { error: insertError } = await supabase
        .from("expenses")
        .insert([newExpensePayload]);

      if (insertError) {
        console.error("[Expenses] Insert error:", insertError);
        throw new Error(insertError.message || "Failed to insert into database.");
      }

      // Refetch completely to ensure exact DB state is shown
      const { data: refreshedExpenses, error: fetchError } = await supabase
        .from("expenses")
        .select("*, categories(id, name, icon)")
        .eq("user_id", userId)
        .order("date", { ascending: false });

      if (fetchError) {
        console.error("[Expenses] Refetch error after insert:", fetchError);
        throw fetchError;
      }

      setExpenses((refreshedExpenses as any) || []);
      setNewStore("");
      setNewAmount("");
      setNewCategoryId("");
      setShowAddModal(false);
    } catch (err: any) {
      alert("Failed to add expense: " + err.message);
    }
  };

  const handleDeleteExpense = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this expense?")) return;

    if (!userId) return;

    const supabase = createClient();
    try {
      const { error: deleteError } = await supabase.from("expenses").delete().eq("id", id).eq("user_id", userId);
      if (deleteError) throw deleteError;

      // Refetch completely to ensure exact DB state is shown
      const { data: refreshedExpenses, error: fetchError } = await supabase
        .from("expenses")
        .select("*, categories(id, name, icon)")
        .eq("user_id", userId)
        .order("date", { ascending: false });

      if (fetchError) throw fetchError;

      setExpenses((refreshedExpenses as any) || []);
    } catch (err: any) {
      alert("Failed to delete expense: " + err.message);
    }
  };

  const handleExport = useCallback(() => {
    if (!expenses || expenses.length === 0) {
      alert("No expenses to export.");
      return;
    }
    const headers = ["Date", "Store", "Category", "Status", "Amount"];
    const rows = expenses.map(exp => {
      const date = exp.date || "";
      const store = exp.store?.includes(",") ? `"${exp.store}"` : (exp.store || "");
      const category = exp.categories?.name?.includes(",") ? `"${exp.categories.name}"` : (exp.categories?.name || "Uncategorized");
      const status = exp.status || "";
      const amount = Number(exp.amount).toFixed(2);
      return `${date},${store},${category},${status},${amount}`;
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const now = new Date();
    const filename = `expenses-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}.csv`;
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [expenses]);

  const filteredExpenses = expenses.filter((exp) => {
    const categoryName = exp.categories?.name || "";
    const matchesSearch =
      exp.store.toLowerCase().includes(search.toLowerCase()) ||
      categoryName.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === "All" || categoryName === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="w-full relative">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-unit-xl">
        <div>
          <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface font-bold">
            {pageTitle}
          </h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
            Manage and track your recent transactions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface border border-outline-variant text-on-surface font-label-md text-label-md hover:bg-surface-container-low transition-colors shadow-sm focus:outline-none cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Export
          </button>
          <button
            onClick={() => router.push("/scanner")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface border border-outline-variant text-on-surface font-label-md text-label-md hover:bg-surface-container-low transition-colors shadow-sm focus:outline-none cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">document_scanner</span>
            Scan Receipt
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md hover:opacity-90 transition-opacity shadow-sm focus:outline-none cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Add Expense
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="glass-panel rounded-xl p-4 mb-unit-lg flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div className="flex-1 w-full lg:w-auto relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">
            search
          </span>
          <input
            className="w-full lg:max-w-md pl-10 pr-4 py-2.5 rounded-lg border border-outline-variant bg-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-body-sm text-body-sm"
            placeholder="Search by store, category..."
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Category Filter dropdown approximation using styled select */}
          <div className="relative">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="appearance-none flex items-center gap-1.5 pl-3 pr-8 py-1.5 rounded-full border border-outline-variant bg-surface text-on-surface font-label-sm text-label-sm hover:border-primary hover:text-primary transition-colors focus:outline-none"
            >
              <option value="All">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.name}>{cat.name}</option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-[16px] pointer-events-none">
              expand_more
            </span>
          </div>
          {(categoryFilter !== "All" || search) && (
            <button
              onClick={() => {
                setCategoryFilter("All");
                setSearch("");
              }}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-surface-container-low text-on-surface hover:bg-surface-container transition-colors focus:outline-none"
              title="Clear Filters"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Data Table */}
      <div className="glass-panel rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                <th className="py-4 px-6 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                  Date
                </th>
                <th className="py-4 px-6 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                  Store
                </th>
                <th className="py-4 px-6 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                  Category
                </th>
                <th className="py-4 px-6 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                  Status
                </th>
                <th className="py-4 px-6 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold text-right">
                  Amount
                </th>
                <th className="py-4 px-6 w-10" />
              </tr>
            </thead>
            <tbody className="font-body-sm text-body-sm text-on-surface divide-y divide-outline-variant/20 bg-surface">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-on-surface-variant">Loading expenses...</td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-red-500">{error}</td>
                </tr>
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-on-surface-variant">
                    No transactions found matching the filters.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="table-row-hover group cursor-pointer">
                    <td className="py-4 px-6 text-on-surface-variant">{new Date(exp.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                    <td className="py-4 px-6 font-semibold">{exp.store}</td>
                    <td className="py-4 px-6">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-label-sm text-label-sm border ${exp.categories?.name === "Food"
                            ? "bg-secondary-container/20 text-secondary border-secondary-container/30"
                            : exp.categories?.name === "Travel"
                              ? "bg-tertiary-container/20 text-tertiary border-tertiary-container/30"
                              : exp.categories?.name === "Shopping"
                                ? "bg-primary/10 text-primary border-primary/20"
                                : "bg-surface-dim text-on-surface border-outline-variant"
                          }`}
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          {exp.categories?.icon || "category"}
                        </span>
                        {exp.categories?.name}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`inline-flex items-center gap-1.5 font-semibold ${exp.status === "Verified" ? "text-primary" : "text-on-surface-variant"
                          }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          {exp.status === "Verified" ? "check_circle" : "schedule"}
                        </span>
                        {exp.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right font-semibold">₹{Number(exp.amount).toFixed(2)}</td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={(e) => handleDeleteExpense(exp.id, e)}
                        className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity focus:outline-none hover:text-red-700"
                        title="Delete Expense"
                      >
                        <span className="material-symbols-outlined">delete</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 border-t border-outline-variant/30 bg-surface-container-lowest flex items-center justify-between">
          <span className="font-body-sm text-body-sm text-on-surface-variant">
            Showing {filteredExpenses.length} of {expenses.length} entries
          </span>
          <div className="flex items-center gap-2">
            <button className="p-1 rounded hover:bg-surface-container transition-colors text-on-surface-variant disabled:opacity-50">
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            <button className="w-8 h-8 rounded bg-primary/10 text-primary font-label-sm text-label-sm font-bold flex items-center justify-center">
              1
            </button>
            <button className="p-1 rounded hover:bg-surface-container transition-colors text-on-surface-variant">
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {/* Add Expense Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-on-background/25 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface rounded-xl shadow-2xl p-unit-xl relative luminous-border">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface focus:outline-none"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold mb-4">Add Manual Expense</h3>
            <form onSubmit={handleAddExpense} className="space-y-4">
              <div>
                <label className="block font-label-md text-label-md text-on-surface mb-1" htmlFor="store">
                  Store / Vendor Name
                </label>
                <input
                  required
                  id="store"
                  type="text"
                  placeholder="e.g. Starbucks"
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent font-body-sm text-body-sm"
                  value={newStore}
                  onChange={(e) => setNewStore(e.target.value)}
                />
              </div>
              <div>
                <label className="block font-label-md text-label-md text-on-surface mb-1" htmlFor="category">
                  Category
                </label>
                <select
                  required
                  id="category"
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent font-body-sm text-body-sm"
                  value={newCategoryId}
                  onChange={(e) => setNewCategoryId(e.target.value)}
                >
                  <option value="" disabled>Select a category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-label-md text-label-md text-on-surface mb-1" htmlFor="amount">
                  Amount (₹)
                </label>
                <input
                  required
                  id="amount"
                  type="number"
                  placeholder="e.g. 450"
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent font-body-sm text-body-sm"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-primary text-on-primary font-label-md text-label-md rounded-lg shadow-sm hover:opacity-95 transition-opacity mt-4 font-bold"
              >
                Save Expense
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ExpensesPage() {
  return (
    <Suspense fallback={<div className="w-full p-8 text-center text-on-surface-variant">Loading...</div>}>
      <ExpensesContent />
    </Suspense>
  );
}
