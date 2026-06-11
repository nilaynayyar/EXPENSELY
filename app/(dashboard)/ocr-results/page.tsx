"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

function OCRResultsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [categories, setCategories] = useState<{id: string, name: string}[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [fields, setFields] = useState({
    storeName: searchParams.get("store") || "Starbucks India",
    date: searchParams.get("date") || "20 Oct 2023",
    category: searchParams.get("category") || "Food",
    tax: "0.00",
    total: searchParams.get("total") || "450.00",
  });

  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const fetchSession = async () => {
      const supabase = createClient();
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        console.error("Session error:", sessionError);
        return;
      }
      setUserId(session.user.id);
      
      const { data, error: catError } = await supabase.from("categories").select("id, name").order("name");
      if (catError) {
        console.error('[OCR] Categories fetch error:', catError);
      } else {
        if (data) setCategories(data);
      }
    };
    fetchSession();
  }, [router]);

  const handleSave = async () => {
    if (!userId) {
      console.error('[OCR] No userId available — user may not be authenticated.');
      alert('You must be logged in to save an expense.');
      return;
    }
    setIsSaving(true);
    const supabase = createClient();
    
    const categoryObj = categories.find(c => c.name === fields.category) || categories.find(c => c.name === "Others");
    if (!categoryObj) {
      console.warn('[OCR] No matching category found for:', fields.category, '— inserting without category_id');
    }
    
    // Convert "20 Oct 2023" or similar into a valid YYYY-MM-DD
    let formattedDate = new Date().toISOString().split('T')[0];
    try {
      const parsed = new Date(fields.date);
      if (!isNaN(parsed.getTime())) {
        formattedDate = parsed.toISOString().split('T')[0];
      }
    } catch(e) { console.warn('[OCR] Could not parse date:', fields.date); }

    const payload = {
      user_id: userId,
      store: fields.storeName,
      amount: parseFloat(fields.total) || 0,
      category_id: categoryObj?.id ?? null,
      date: formattedDate,
      status: 'Pending'
    };
    console.log('[OCR] Inserting expense payload:', payload);

    const { error } = await supabase.from("expenses").insert([payload]);

    setIsSaving(false);
    if (error) {
      console.error('[OCR] Insert error:', error);
      alert("Failed to save: " + error.message);
    } else {
      setSaved(true);
      setTimeout(() => router.push("/expenses"), 1500);
    }
  };

  return (
    <main className="flex-1 p-unit-lg md:p-margin-page max-w-[1440px] mx-auto w-full">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-unit-xl gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link
              href="/scanner"
              className="text-on-surface-variant hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </Link>
            <h2 className="font-headline-lg-mobile md:font-headline-lg text-[28px] md:text-[32px] leading-[36px] md:leading-[40px] font-semibold text-on-surface">
              Review Receipt
            </h2>
          </div>
          <p className="font-body-md text-[16px] leading-[24px] text-on-surface-variant">
            Verify extracted details before saving.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-tertiary/10 border border-tertiary/20 px-4 py-2 rounded-full ai-glow">
          <span className="material-symbols-outlined text-tertiary">auto_awesome</span>
          <span className="font-label-md text-[14px] leading-[16px] text-tertiary font-semibold tracking-wide">
            AI Confidence: 98%
          </span>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-unit-lg">
        {/* Left Panel: Receipt Preview */}
        <div className="glass-panel rounded-xl p-unit-md flex flex-col relative overflow-hidden" style={{ height: "600px" }}>
          <div className="flex justify-between items-center mb-4">
            <span className="font-label-md text-[14px] leading-[16px] tracking-widest text-on-surface-variant uppercase">
              Original Document
            </span>
            <div className="flex gap-2">
              <button className="p-1 rounded hover:bg-surface-container transition-colors">
                <span className="material-symbols-outlined text-on-surface-variant">zoom_in</span>
              </button>
              <button className="p-1 rounded hover:bg-surface-container transition-colors">
                <span className="material-symbols-outlined text-on-surface-variant">zoom_out</span>
              </button>
            </div>
          </div>

          <div className="flex-1 bg-surface-container-lowest border border-outline-variant/30 rounded-lg relative overflow-hidden flex items-center justify-center p-4">
            <div className="relative w-full max-w-[300px] h-full flex items-center justify-center">
              {/* Simulated Receipt */}
              <div className="relative w-[200px] bg-surface border border-outline-variant/40 rounded shadow-md p-4 text-[11px] leading-relaxed font-mono">
                <div className="text-center font-bold mb-3 text-on-surface border-b border-outline-variant pb-2">
                  STARBUCKS
                  <div className="font-normal text-on-surface-variant text-[10px]">Store #4821 — MG Road</div>
                </div>
                <div className="space-y-1 text-on-surface-variant">
                  <div className="flex justify-between">
                    <span>Caramel Latte</span>
                    <span>₹280</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Blueberry Muffin</span>
                    <span>₹148</span>
                  </div>
                  <div className="border-t border-dashed border-outline-variant/50 my-2"></div>
                  <div className="flex justify-between text-on-surface-variant">
                    <span>Tax (5%)</span>
                    <span>₹22.50</span>
                  </div>
                  <div className="flex justify-between font-bold text-on-surface border-t border-outline-variant/50 pt-1">
                    <span>TOTAL</span>
                    <span>₹450</span>
                  </div>
                </div>
                <div className="text-center text-[9px] text-on-surface-variant mt-3 pt-2 border-t border-outline-variant">
                  20 Oct 2023 • 11:42 AM
                </div>

                {/* Bounding boxes overlaid */}
                <div
                  className="absolute border-2 border-primary-container rounded cursor-pointer transition-all hover:bg-primary-container/10"
                  style={{ top: "10%", left: "5%", width: "90%", height: "18%" }}
                  title="Store Name"
                />
                <div
                  className="absolute border-2 border-primary-container rounded cursor-pointer transition-all hover:bg-primary-container/10"
                  style={{ top: "82%", left: "50%", width: "45%", height: "14%" }}
                  title="Total Amount"
                />
                <div
                  className="absolute border-2 border-primary-container/70 rounded cursor-pointer transition-all hover:bg-primary-container/10"
                  style={{ top: "68%", left: "50%", width: "45%", height: "10%" }}
                  title="Tax"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel: Extracted Fields */}
        <div className="glass-panel rounded-xl p-unit-xl flex flex-col">
          <h3 className="font-headline-sm text-[20px] leading-[28px] font-semibold text-on-surface mb-6">
            Extracted Details
          </h3>
          <form className="space-y-6 flex-1" onSubmit={(e) => e.preventDefault()}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Store Name */}
              <div className="col-span-1 md:col-span-2">
                <label className="block font-label-md text-[14px] leading-[16px] text-on-surface-variant mb-2 tracking-wide">
                  Store Name
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-primary-container">
                    <span className="material-symbols-outlined text-[18px]">verified</span>
                  </span>
                  <input
                    className="w-full pl-10 pr-4 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary-container focus:border-primary-container text-on-surface font-body-md transition-all shadow-sm"
                    type="text"
                    value={fields.storeName}
                    onChange={(e) => setFields({ ...fields, storeName: e.target.value })}
                  />
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="block font-label-md text-[14px] leading-[16px] text-on-surface-variant mb-2 tracking-wide">
                  Date
                </label>
                <input
                  className="w-full px-4 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary-container focus:border-primary-container text-on-surface font-body-md transition-all shadow-sm"
                  type="text"
                  value={fields.date}
                  onChange={(e) => setFields({ ...fields, date: e.target.value })}
                />
              </div>

              {/* Category */}
              <div>
                <label className="block font-label-md text-[14px] leading-[16px] text-on-surface-variant mb-2 tracking-wide">
                  Category
                </label>
                <select
                  className="w-full px-4 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary-container focus:border-primary-container text-on-surface font-body-md transition-all shadow-sm appearance-none"
                  value={fields.category}
                  onChange={(e) => setFields({ ...fields, category: e.target.value })}
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                  ))}
                  {categories.length === 0 && <option>Food</option>}
                </select>
              </div>

              {/* Tax */}
              <div>
                <label className="block font-label-md text-[14px] leading-[16px] text-on-surface-variant mb-2 tracking-wide">
                  Tax
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-on-surface-variant font-label-md">
                    ₹
                  </span>
                  <input
                    className="w-full pl-8 pr-4 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary-container focus:border-primary-container text-on-surface font-body-md text-right transition-all shadow-sm"
                    type="text"
                    value={fields.tax}
                    onChange={(e) => setFields({ ...fields, tax: e.target.value })}
                  />
                </div>
              </div>

              {/* Total Amount */}
              <div>
                <label className="block font-label-md text-[14px] leading-[16px] font-bold text-on-surface mb-2 tracking-wide">
                  Total Amount
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-primary font-headline-sm text-[20px]">
                    ₹
                  </span>
                  <input
                    className="w-full pl-8 pr-4 py-3 bg-primary/5 border border-primary/30 rounded-lg focus:ring-2 focus:ring-primary-container focus:border-primary-container text-primary font-headline-sm text-[20px] text-right transition-all font-bold"
                    type="text"
                    value={fields.total}
                    onChange={(e) => setFields({ ...fields, total: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="mt-8 border-t border-outline-variant/30 pt-6 flex gap-4 justify-end">
              <button
                className="px-6 py-2 border border-outline-variant rounded-lg font-label-md text-[14px] text-on-surface hover:bg-surface-container transition-colors shadow-sm bg-surface-container-lowest"
                type="button"
              >
                Edit Fields
              </button>
              <button
                className="px-6 py-2 bg-primary-container text-on-primary rounded-lg font-label-md text-[14px] hover:opacity-90 transition-opacity shadow-sm flex items-center gap-2 disabled:opacity-50"
                type="button"
                onClick={handleSave}
                disabled={isSaving || saved}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {saved ? "check_circle" : "save"}
                </span>
                {saved ? "Saved!" : isSaving ? "Saving..." : "Save Expense"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}

export default function OCRResultsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-on-surface-variant">Loading results...</div>}>
      <OCRResultsContent />
    </Suspense>
  );
}
