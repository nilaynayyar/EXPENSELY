"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { useLanguage } from "@/components/LanguageProvider";
import { Expense, Category } from "@/types";

const ITEMS_PER_PAGE = 10;

function ExpensesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, formatCurrency, formatDate } = useLanguage();
  const pageTitle = t("expenses_title") || "All Expenses";
  
  const initialQuery = searchParams.get("q") || "";
  const [search, setSearch] = useState(initialQuery);
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // State
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Add Form state
  const [newStore, setNewStore] = useState("");
  const [newCategoryId, setNewCategoryId] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newDate, setNewDate] = useState(() => new Date().toISOString().split("T")[0]);

  // Edit Form state
  const [editStore, setEditStore] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editStatus, setEditStatus] = useState<"Verified" | "Pending">("Pending");

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      const supabase = createClient();
      try {
        setIsLoading(true);
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError) {
          console.error('[Expenses] User error:', userError);
          if (isMounted) setError('Session error. Please log in again.');
          return;
        }
        if (!user) {
          return;
        }

        const currentUserId = user.id;
        if (isMounted) setUserId(currentUserId);

        const [categoriesRes, expensesRes] = await Promise.all([
          supabase.from("categories").select("*").order("name"),
          supabase
            .from("expenses")
            .select("*, categories(id, name, icon)")
            .eq("user_id", currentUserId)
            .order("date", { ascending: false })
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
          setCategories((categoriesRes.data as Category[]) || []);
          setExpenses((expensesRes.data as unknown as Expense[]) || []);
        }
      } catch (err: unknown) {
        console.error('[Expenses] fetchData error:', err);
        const message = err instanceof Error ? err.message : "Failed to load data.";
        if (isMounted) setError(message);
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
      date: newDate || new Date().toISOString().split("T")[0],
      status: "Pending" as const
    };

    try {
      const { error: insertError } = await supabase
        .from("expenses")
        .insert([newExpensePayload]);

      if (insertError) {
        console.error("[Expenses] Insert error:", insertError);
        throw new Error(insertError.message || "Failed to insert into database.");
      }

      const { data: refreshedExpenses, error: fetchError } = await supabase
        .from("expenses")
        .select("*, categories(id, name, icon)")
        .eq("user_id", userId)
        .order("date", { ascending: false });

      if (fetchError) {
        console.error("[Expenses] Refetch error after insert:", fetchError);
        throw fetchError;
      }

      setExpenses((refreshedExpenses as unknown as Expense[]) || []);
      setNewStore("");
      setNewAmount("");
      setNewCategoryId("");
      setShowAddModal(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to add expense";
      alert(message);
    }
  };

  const handleOpenEdit = (expense: Expense, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingExpense(expense);
    setEditStore(expense.store);
    setEditCategoryId(expense.category_id || (expense.categories ? expense.categories.id : ""));
    setEditAmount(expense.amount.toString());
    setEditDate(expense.date);
    setEditStatus(expense.status);
  };

  const handleUpdateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense || !userId) return;

    const amount = parseFloat(editAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid positive amount.");
      return;
    }

    const supabase = createClient();
    try {
      const { error: updateError } = await supabase
        .from("expenses")
        .update({
          store: editStore.trim(),
          category_id: editCategoryId,
          amount: amount,
          date: editDate,
          status: editStatus
        })
        .eq("id", editingExpense.id)
        .eq("user_id", userId);

      if (updateError) throw updateError;

      const { data: refreshedExpenses, error: fetchError } = await supabase
        .from("expenses")
        .select("*, categories(id, name, icon)")
        .eq("user_id", userId)
        .order("date", { ascending: false });

      if (fetchError) throw fetchError;

      setExpenses((refreshedExpenses as unknown as Expense[]) || []);
      setEditingExpense(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update expense";
      alert(message);
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

      const { data: refreshedExpenses, error: fetchError } = await supabase
        .from("expenses")
        .select("*, categories(id, name, icon)")
        .eq("user_id", userId)
        .order("date", { ascending: false });

      if (fetchError) throw fetchError;

      setExpenses((refreshedExpenses as unknown as Expense[]) || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete expense";
      alert(message);
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

  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      const categoryName = exp.categories?.name || "";
      const matchesSearch =
        exp.store.toLowerCase().includes(search.toLowerCase()) ||
        categoryName.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = categoryFilter === "All" || categoryName === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [expenses, search, categoryFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredExpenses.length / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedExpenses = useMemo(() => {
    const start = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
    return filteredExpenses.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredExpenses, safeCurrentPage]);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setCurrentPage(1);
  };

  const handleCategoryFilterChange = (val: string) => {
    setCategoryFilter(val);
    setCurrentPage(1);
  };

  return (
    <div className="w-full relative">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-unit-xl">
        <div>
          <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface font-bold">
            {pageTitle}
          </h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
            {t("expenses_subtitle") || "Manage, edit, and track your recent transactions."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-outline-variant text-on-surface font-label-md text-label-md hover:bg-surface-container-low transition-colors shadow-sm focus:outline-none cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            {t("analytics_export_btn") || "Export"}
          </button>
          <button
            onClick={() => router.push("/scanner")}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-outline-variant text-on-surface font-label-md text-label-md hover:bg-surface-container-low transition-colors shadow-sm focus:outline-none cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">document_scanner</span>
            {t("scanner_title") || "Scan Receipt"}
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md hover:opacity-90 transition-opacity shadow-sm focus:outline-none cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            {t("expenses_modal_add_title") || "Add Expense"}
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
            placeholder={t("expenses_search_placeholder") || "Search by store, category..."}
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="relative">
            <select
              value={categoryFilter}
              onChange={(e) => handleCategoryFilterChange(e.target.value)}
              className="appearance-none flex items-center gap-1.5 pl-3 pr-8 py-1.5 rounded-full border border-outline-variant bg-surface text-on-surface font-label-sm text-label-sm hover:border-primary hover:text-primary transition-colors focus:outline-none cursor-pointer"
            >
              <option value="All">{t("expenses_filter_category") || "All Categories"}</option>
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
                handleCategoryFilterChange("All");
                handleSearchChange("");
              }}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-surface-container-low text-on-surface hover:bg-surface-container transition-colors focus:outline-none"
              title="Clear Filters"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Data View: Table on md+, Responsive Cards on mobile */}
      <div className="glass-panel rounded-xl overflow-hidden">
        {/* Mobile View (Cards) */}
        <div className="md:hidden divide-y divide-outline-variant/20 bg-surface">
          {isLoading ? (
            <div className="py-8 text-center text-on-surface-variant font-body-sm">Loading expenses...</div>
          ) : error ? (
            <div className="py-8 text-center text-red-500 font-body-sm">{error}</div>
          ) : filteredExpenses.length === 0 ? (
            <div className="py-8 text-center text-on-surface-variant font-body-sm">
              No transactions found matching the filters.
            </div>
          ) : (
            paginatedExpenses.map((exp) => (
              <div
                key={exp.id}
                onClick={(e) => handleOpenEdit(exp, e)}
                className="p-4 flex items-center justify-between hover:bg-surface-container-low transition-colors cursor-pointer"
              >
                <div className="flex-1 pr-3 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-on-surface truncate">{exp.store}</span>
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        exp.status === "Verified"
                          ? "bg-primary/10 text-primary"
                          : "bg-surface-container-high text-on-surface-variant"
                      }`}
                    >
                      {exp.status === "Verified"
                        ? t("expenses_status_verified") || "Verified"
                        : t("expenses_status_pending") || "Pending"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                    <span>{formatDate(exp.date)}</span>
                    <span>•</span>
                    <span className="truncate">{exp.categories?.name || "Uncategorized"}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-semibold text-on-surface text-base">{formatCurrency(Number(exp.amount))}</div>
                  <div className="flex items-center justify-end gap-1 mt-1">
                    <button
                      onClick={(e) => handleOpenEdit(exp, e)}
                      className="text-on-surface-variant hover:text-primary p-1 rounded"
                      title="Edit"
                    >
                      <span className="material-symbols-outlined text-[16px]">edit</span>
                    </button>
                    <button
                      onClick={(e) => handleDeleteExpense(exp.id, e)}
                      className="text-on-surface-variant hover:text-red-500 p-1 rounded"
                      title="Delete"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-outline-variant/30 bg-surface-container-lowest">
                <th className="py-4 px-6 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                  {t("expenses_table_date") || "Date"}
                </th>
                <th className="py-4 px-6 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                  {t("expenses_table_merchant") || "Store"}
                </th>
                <th className="py-4 px-6 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                  {t("expenses_table_category") || "Category"}
                </th>
                <th className="py-4 px-6 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                  {t("expenses_table_status") || "Status"}
                </th>
                <th className="py-4 px-6 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold text-right">
                  {t("expenses_table_amount") || "Amount"}
                </th>
                <th className="py-4 px-6 w-24 text-right">{t("expenses_table_actions") || "Actions"}</th>
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
                paginatedExpenses.map((exp) => (
                  <tr
                    key={exp.id}
                    onClick={(e) => handleOpenEdit(exp, e)}
                    className="table-row-hover group cursor-pointer transition-colors"
                  >
                    <td className="py-4 px-6 text-on-surface-variant">
                      {formatDate(exp.date)}
                    </td>
                    <td className="py-4 px-6 font-semibold">{exp.store}</td>
                    <td className="py-4 px-6">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-label-sm text-label-sm border ${
                          exp.categories?.name === "Food"
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
                        {exp.categories?.name || "Uncategorized"}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`inline-flex items-center gap-1.5 font-semibold ${
                          exp.status === "Verified" ? "text-primary" : "text-on-surface-variant"
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          {exp.status === "Verified" ? "check_circle" : "schedule"}
                        </span>
                        {exp.status === "Verified"
                          ? t("expenses_status_verified") || "Verified"
                          : t("expenses_status_pending") || "Pending"}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right font-semibold">{formatCurrency(Number(exp.amount))}</td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => handleOpenEdit(exp, e)}
                          className="text-on-surface-variant hover:text-primary transition-colors focus:outline-none p-1 rounded hover:bg-surface-container"
                          title="Edit Expense"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button
                          onClick={(e) => handleDeleteExpense(exp.id, e)}
                          className="text-on-surface-variant hover:text-red-500 transition-colors focus:outline-none p-1 rounded hover:bg-surface-container"
                          title="Delete Expense"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Real Pagination */}
        <div className="px-6 py-4 border-t border-outline-variant/30 bg-surface-container-lowest flex items-center justify-between">
          <span className="font-body-sm text-body-sm text-on-surface-variant">
            {filteredExpenses.length > 0
              ? `Showing ${(safeCurrentPage - 1) * ITEMS_PER_PAGE + 1} - ${Math.min(
                  safeCurrentPage * ITEMS_PER_PAGE,
                  filteredExpenses.length
                )} of ${filteredExpenses.length} entries`
              : "Showing 0 entries"}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safeCurrentPage <= 1}
              className="p-1.5 rounded border border-outline-variant bg-surface hover:bg-surface-container transition-colors text-on-surface-variant disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="Previous Page"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            {Array.from({ length: totalPages }).map((_, idx) => {
              const pageNum = idx + 1;
              if (
                pageNum === 1 ||
                pageNum === totalPages ||
                Math.abs(pageNum - safeCurrentPage) <= 1
              ) {
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded font-label-sm text-label-sm font-bold flex items-center justify-center transition-colors cursor-pointer ${
                      safeCurrentPage === pageNum
                        ? "bg-primary text-on-primary shadow-sm"
                        : "bg-surface border border-outline-variant text-on-surface hover:bg-surface-container"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              }
              if (
                (pageNum === 2 && safeCurrentPage > 3) ||
                (pageNum === totalPages - 1 && safeCurrentPage < totalPages - 2)
              ) {
                return (
                  <span key={pageNum} className="text-on-surface-variant px-1">
                    ...
                  </span>
                );
              }
              return null;
            })}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safeCurrentPage >= totalPages}
              className="p-1.5 rounded border border-outline-variant bg-surface hover:bg-surface-container transition-colors text-on-surface-variant disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="Next Page"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
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
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold mb-4">
              {t("expenses_modal_add_title") || "Add Expense"}
            </h3>
            <form onSubmit={handleAddExpense} className="space-y-4">
              <div>
                <label className="block font-label-md text-label-md text-on-surface mb-1" htmlFor="store">
                  {t("expenses_modal_merchant_label") || "Store / Vendor Name"}
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
                  {t("expenses_modal_category_label") || "Category"}
                </label>
                <select
                  required
                  id="category"
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent font-body-sm text-body-sm cursor-pointer"
                  value={newCategoryId}
                  onChange={(e) => setNewCategoryId(e.target.value)}
                >
                  <option value="" disabled>Select a category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-label-md text-label-md text-on-surface mb-1" htmlFor="amount">
                    {t("expenses_modal_amount_label") || "Amount (₹)"}
                  </label>
                  <input
                    required
                    id="amount"
                    type="number"
                    step="0.01"
                    placeholder="e.g. 450"
                    className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent font-body-sm text-body-sm"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block font-label-md text-label-md text-on-surface mb-1" htmlFor="date">
                    {t("expenses_modal_date_label") || "Date"}
                  </label>
                  <input
                    required
                    id="date"
                    type="date"
                    className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent font-body-sm text-body-sm cursor-pointer"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-primary text-on-primary font-label-md text-label-md rounded-lg shadow-sm hover:opacity-95 transition-opacity mt-4 font-bold cursor-pointer"
              >
                {t("expenses_modal_save") || "Save Expense"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Expense Modal */}
      {editingExpense && (
        <div className="fixed inset-0 bg-on-background/25 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface rounded-xl shadow-2xl p-unit-xl relative luminous-border">
            <button
              onClick={() => setEditingExpense(null)}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface focus:outline-none"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold mb-4">
              {t("expenses_modal_edit_title") || "Edit Expense"}
            </h3>
            <form onSubmit={handleUpdateExpense} className="space-y-4">
              <div>
                <label className="block font-label-md text-label-md text-on-surface mb-1" htmlFor="edit-store">
                  {t("expenses_modal_merchant_label") || "Store / Vendor Name"}
                </label>
                <input
                  required
                  id="edit-store"
                  type="text"
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent font-body-sm text-body-sm"
                  value={editStore}
                  onChange={(e) => setEditStore(e.target.value)}
                />
              </div>
              <div>
                <label className="block font-label-md text-label-md text-on-surface mb-1" htmlFor="edit-category">
                  {t("expenses_modal_category_label") || "Category"}
                </label>
                <select
                  required
                  id="edit-category"
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent font-body-sm text-body-sm cursor-pointer"
                  value={editCategoryId}
                  onChange={(e) => setEditCategoryId(e.target.value)}
                >
                  <option value="" disabled>Select a category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-label-md text-label-md text-on-surface mb-1" htmlFor="edit-amount">
                    {t("expenses_modal_amount_label") || "Amount (₹)"}
                  </label>
                  <input
                    required
                    id="edit-amount"
                    type="number"
                    step="0.01"
                    className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent font-body-sm text-body-sm"
                    value={editAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block font-label-md text-label-md text-on-surface mb-1" htmlFor="edit-date">
                    {t("expenses_modal_date_label") || "Date"}
                  </label>
                  <input
                    required
                    id="edit-date"
                    type="date"
                    className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent font-body-sm text-body-sm cursor-pointer"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block font-label-md text-label-md text-on-surface mb-1" htmlFor="edit-status">
                  {t("expenses_table_status") || "Status"}
                </label>
                <select
                  id="edit-status"
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent font-body-sm text-body-sm cursor-pointer"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as "Verified" | "Pending")}
                >
                  <option value="Verified">{t("expenses_status_verified") || "Verified"}</option>
                  <option value="Pending">{t("expenses_status_pending") || "Pending"}</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingExpense(null)}
                  className="w-1/2 py-2.5 border border-outline-variant text-on-surface font-label-md text-label-md rounded-lg hover:bg-surface-container transition-colors cursor-pointer"
                >
                  {t("expenses_modal_cancel") || "Cancel"}
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 bg-primary text-on-primary font-label-md text-label-md rounded-lg shadow-sm hover:opacity-95 transition-opacity font-bold cursor-pointer"
                >
                  {t("expenses_modal_save") || "Update"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ExpensesPage() {
  return (
    <Suspense fallback={<div className="w-full p-8 text-center text-on-surface-variant">Loading expenses...</div>}>
      <ExpensesContent />
    </Suspense>
  );
}
