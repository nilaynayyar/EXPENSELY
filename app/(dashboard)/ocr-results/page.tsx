"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useRef, useMemo, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { useLanguage } from "@/components/LanguageProvider";

function OCRResultsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storeInputRef = useRef<HTMLInputElement>(null);
  const { t } = useLanguage();

  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [zoomScale, setZoomScale] = useState<number>(1.0);

  const [uploadedReceiptImage] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("lastReceiptImage");
    }
    return null;
  });

  // Purely extracted fields — ZERO hardcoded fake defaults
  const [fields, setFields] = useState({
    storeName: searchParams.get("store") || "",
    date: searchParams.get("date") || new Date().toISOString().split("T")[0],
    category: searchParams.get("category") || "",
    tax: searchParams.get("tax") || "",
    total: searchParams.get("total") || "",
  });

  const [saved, setSaved] = useState(false);

  const validationWarning = useMemo(() => {
    if (!fields.total || parseFloat(fields.total) <= 0) {
      return "The total amount could not be automatically confirmed. Please enter the amount before saving.";
    }
    if (!fields.storeName) {
      return "Merchant name could not be automatically identified. Please enter the vendor name.";
    }
    return null;
  }, [fields.total, fields.storeName]);

  useEffect(() => {
    const fetchSession = async () => {
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        return;
      }
      setUserId(user.id);

      const { data, error: catError } = await supabase.from("categories").select("id, name").order("name");
      if (!catError && data) {
        setCategories(data);
        if (!fields.category && data.length > 0) {
          setFields((prev) => ({ ...prev, category: data[0].name }));
        }
      }
    };
    fetchSession();
  }, [fields.category]);

  const handleZoomIn = () => {
    setZoomScale((prev) => Math.min(2.0, Math.round((prev + 0.2) * 10) / 10));
  };

  const handleZoomOut = () => {
    setZoomScale((prev) => Math.max(0.6, Math.round((prev - 0.2) * 10) / 10));
  };

  const handleEditFields = () => {
    if (storeInputRef.current) {
      storeInputRef.current.focus();
      storeInputRef.current.select();
    }
  };

  const handleSave = async () => {
    if (!userId) {
      alert("You must be logged in to save an expense.");
      return;
    }

    const parsedTotal = parseFloat(fields.total);
    if (isNaN(parsedTotal) || parsedTotal <= 0) {
      alert("Please enter a valid positive total amount.");
      return;
    }

    setIsSaving(true);
    const supabase = createClient();

    const categoryObj =
      categories.find((c) => c.name.toLowerCase() === fields.category.toLowerCase()) ||
      categories.find((c) => c.name.toLowerCase() === "other") ||
      categories[0];

    // Convert into valid ISO YYYY-MM-DD
    let formattedDate = new Date().toISOString().split("T")[0];
    try {
      const parsed = new Date(fields.date);
      if (!isNaN(parsed.getTime())) {
        formattedDate = parsed.toISOString().split("T")[0];
      }
    } catch {
      // fallback to today
    }

    // Status determination: if merchant is unspecified or values were altered, status is Pending
    const initialTotal = searchParams.get("total") || "";
    const initialStore = searchParams.get("store") || "";
    const wasAltered = fields.total !== initialTotal || fields.storeName !== initialStore;
    const isUnspecified = !fields.storeName.trim() || fields.storeName.trim().toLowerCase() === "unspecified merchant";
    const status = (!wasAltered && !isUnspecified && initialTotal) ? ("Verified" as const) : ("Pending" as const);

    const payload = {
      user_id: userId,
      store: fields.storeName.trim() || "Unspecified Merchant",
      amount: parsedTotal,
      category_id: categoryObj?.id ?? null,
      date: formattedDate,
      status,
    };

    const { error } = await supabase.from("expenses").insert([payload]);

    setIsSaving(false);
    if (error) {
      alert("Failed to save: " + error.message);
    } else {
      setSaved(true);
      setTimeout(() => router.push("/expenses"), 1200);
    }
  };

  const parsedTotal = parseFloat(fields.total);
  const isTotalInvalid = !fields.total || isNaN(parsedTotal) || parsedTotal <= 0;

  return (
    <main className="flex-1 p-unit-lg md:p-margin-page max-w-[1440px] mx-auto w-full">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-unit-xl gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link href="/scanner" className="text-on-surface-variant hover:text-primary transition-colors">
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </Link>
            <h2 className="font-headline-lg-mobile md:font-headline-lg text-[28px] md:text-[32px] leading-[36px] md:leading-[40px] font-semibold text-on-surface">
              {t("ocr_review_title")}
            </h2>
          </div>
          <p className="font-body-md text-[16px] leading-[24px] text-on-surface-variant">
            {t("ocr_review_subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 px-4 py-2 rounded-full">
          <span className="material-symbols-outlined text-primary text-[18px]">verified</span>
          <span className="font-label-md text-[14px] text-primary font-semibold">
            {t("scanner_extracted_details")}
          </span>
        </div>
      </div>

      {/* Validation Warning Alert */}
      {validationWarning && (
        <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-sm flex items-center gap-3">
          <span className="material-symbols-outlined text-[20px]">warning</span>
          <span>{validationWarning}</span>
        </div>
      )}

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-unit-lg">
        {/* Left Panel: Receipt Preview */}
        <div className="glass-panel rounded-xl p-unit-md flex flex-col relative overflow-hidden" style={{ minHeight: "560px" }}>
          <div className="flex justify-between items-center mb-4">
            <span className="font-label-md text-[14px] leading-[16px] tracking-widest text-on-surface-variant uppercase font-semibold">
              {t("ocr_original_doc")} ({Math.round(zoomScale * 100)}%)
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleZoomIn}
                disabled={zoomScale >= 2.0}
                className="p-1.5 rounded hover:bg-surface-container transition-colors disabled:opacity-30 cursor-pointer"
                title={t("ocr_zoom_in")}
              >
                <span className="material-symbols-outlined text-on-surface-variant text-[20px]">zoom_in</span>
              </button>
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoomScale <= 0.6}
                className="p-1.5 rounded hover:bg-surface-container transition-colors disabled:opacity-30 cursor-pointer"
                title={t("ocr_zoom_out")}
              >
                <span className="material-symbols-outlined text-on-surface-variant text-[20px]">zoom_out</span>
              </button>
            </div>
          </div>

          <div className="flex-1 bg-surface-container-lowest border border-outline-variant/30 rounded-lg relative overflow-auto flex items-center justify-center p-4">
            <div
              className="transition-transform duration-200 origin-center flex items-center justify-center w-full"
              style={{ transform: `scale(${zoomScale})` }}
            >
              {uploadedReceiptImage ? (
                <div className="relative max-w-[340px] rounded shadow-lg overflow-hidden border border-outline-variant/40">
                  <Image
                    src={uploadedReceiptImage}
                    alt="Uploaded Receipt"
                    width={340}
                    height={500}
                    unoptimized
                    className="w-full h-auto object-contain max-h-[480px]"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center text-on-surface-variant">
                  <span className="material-symbols-outlined text-[48px] mb-2 opacity-40">receipt_long</span>
                  <p className="font-headline-sm text-sm font-semibold text-on-surface">No Image Preview</p>
                  <p className="text-xs text-on-surface-variant mt-1 max-w-xs">
                    Review and verify the extracted details below. No simulated documents or fake values are rendered.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel: Extracted Fields */}
        <div className="glass-panel rounded-xl p-unit-xl flex flex-col justify-between">
          <div>
            <h3 className="font-headline-sm text-[20px] leading-[28px] font-semibold text-on-surface mb-6">
              {t("scanner_extracted_details")}
            </h3>
            <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Store Name */}
                <div className="col-span-1 md:col-span-2">
                  <label className="block font-label-md text-[14px] leading-[16px] text-on-surface-variant mb-2 tracking-wide font-semibold">
                    {t("ocr_field_merchant")}
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-primary">
                      <span className="material-symbols-outlined text-[18px]">storefront</span>
                    </span>
                    <input
                      ref={storeInputRef}
                      className="w-full pl-10 pr-4 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-on-surface font-body-md transition-all shadow-sm"
                      type="text"
                      placeholder="e.g., Starbucks or IndiGo Airlines"
                      value={fields.storeName}
                      onChange={(e) => setFields({ ...fields, storeName: e.target.value })}
                    />
                  </div>
                </div>

                {/* Date */}
                <div>
                  <label className="block font-label-md text-[14px] leading-[16px] text-on-surface-variant mb-2 tracking-wide font-semibold">
                    {t("ocr_field_date")}
                  </label>
                  <input
                    className="w-full px-4 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-on-surface font-body-md transition-all shadow-sm"
                    type="date"
                    value={fields.date}
                    onChange={(e) => setFields({ ...fields, date: e.target.value })}
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block font-label-md text-[14px] leading-[16px] text-on-surface-variant mb-2 tracking-wide font-semibold">
                    {t("ocr_field_category")}
                  </label>
                  <select
                    className="w-full px-4 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-on-surface font-body-md transition-all shadow-sm cursor-pointer"
                    value={fields.category}
                    onChange={(e) => setFields({ ...fields, category: e.target.value })}
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.name}>
                        {cat.name}
                      </option>
                    ))}
                    {categories.length === 0 && <option value="Other">Other</option>}
                  </select>
                </div>

                {/* Tax (Optional) */}
                <div>
                  <label className="block font-label-md text-[14px] leading-[16px] text-on-surface-variant mb-2 tracking-wide font-semibold">
                    {t("ocr_field_tax")}
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-on-surface-variant font-label-md">
                      ₹
                    </span>
                    <input
                      className="w-full pl-8 pr-4 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-on-surface font-body-md text-right transition-all shadow-sm"
                      type="text"
                      placeholder="0.00"
                      value={fields.tax}
                      onChange={(e) => setFields({ ...fields, tax: e.target.value })}
                    />
                  </div>
                </div>

                {/* Total Amount */}
                <div>
                  <label className="block font-label-md text-[14px] leading-[16px] font-bold text-on-surface mb-2 tracking-wide">
                    {t("ocr_field_total")} *
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-primary font-headline-sm text-[20px]">
                      ₹
                    </span>
                    <input
                      className="w-full pl-8 pr-4 py-2.5 bg-primary/5 border border-primary/40 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-primary font-headline-sm text-[20px] text-right transition-all font-bold"
                      type="number"
                      step="0.01"
                      required
                      placeholder="0.00"
                      value={fields.total}
                      onChange={(e) => setFields({ ...fields, total: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </form>
          </div>

          <div className="mt-8 border-t border-outline-variant/30 pt-6 flex gap-4 justify-end">
            <button
              className="px-6 py-2.5 border border-outline-variant rounded-lg font-label-md text-[14px] text-on-surface hover:bg-surface-container transition-colors shadow-sm bg-surface-container-lowest cursor-pointer font-medium"
              type="button"
              onClick={handleEditFields}
            >
              {t("common_edit")}
            </button>
            <button
              className="px-6 py-2.5 bg-primary text-on-primary rounded-lg font-label-md text-[14px] hover:opacity-90 transition-opacity shadow-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed font-bold"
              type="button"
              onClick={handleSave}
              disabled={isSaving || saved || isTotalInvalid}
              title={isTotalInvalid ? "Total amount must be entered before saving" : ""}
            >
              <span className="material-symbols-outlined text-[18px]">
                {saved ? "check_circle" : "save"}
              </span>
              {saved ? t("ocr_saved_success") : isSaving ? t("common_loading") : t("ocr_save_expense")}
            </button>
          </div>
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
