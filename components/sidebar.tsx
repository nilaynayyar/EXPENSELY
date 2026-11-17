"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useLanguage } from "./LanguageProvider";

export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { t, language, setLanguage, supportedLanguages } = useLanguage();

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    setIsOpen(false);

    try {
      // 1. Client-side sign out through Supabase client
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch (err) {
      console.error("[Logout] Client sign-out error:", err);
    }

    try {
      // 2. Server-side cookie cleanup through API route
      await fetch("/auth/signout", { method: "POST" });
    } catch (err) {
      console.error("[Logout] Server sign-out error:", err);
    }

    // 3. Clear transient storage keys
    if (typeof window !== "undefined") {
      try {
        sessionStorage.removeItem("lastReceiptImage");
      } catch {}

      // 4. Critical: Full window replacement to purge in-memory React state,
      // Router caches, and prevent browser Back button from displaying cached data
      window.location.replace("/login");
    }
  };

  const menuItems = [
    { name: "Dashboard", href: "/dashboard", icon: "dashboard" },
    { name: "Expenses", href: "/expenses", icon: "payments" },
    { name: "Receipt Scanner", href: "/scanner", icon: "document_scanner" },
    { name: "Analytics", href: "/analytics", icon: "insights" },
    { name: "Groups", href: "/groups", icon: "group" },
    { name: "Budgets", href: "/budgets", icon: "account_balance_wallet" },
    { name: "Settings", href: "/settings", icon: "settings" },
  ];

  const bottomItems = [
    { name: "Help Center", href: "/help", icon: "help" },
    { name: "Logout", href: "/login", icon: "logout" },
  ];

  const getLinkClass = (href: string) => {
    const isActive = pathname === href;
    return `flex items-center px-3 py-2 rounded-lg font-label-md text-label-md transition-all duration-150 ${
      isActive
        ? "bg-primary/5 text-primary border-l-4 border-primary scale-[0.98]"
        : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
    }`;
  };

  return (
    <>
      {/* Mobile Header Toggle */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-surface/80 backdrop-blur-md border-b border-outline-variant/20 z-40 px-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-primary-container flex items-center justify-center text-on-primary-container">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>account_balance</span>
          </div>
          <span className="font-headline-sm text-headline-sm font-black text-on-surface">Expensely</span>
        </div>
        <div className="flex items-center space-x-2">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            aria-label={t("settings_language_label") || "Language"}
            className="text-xs bg-surface-container-low border border-outline-variant/30 rounded-lg py-1 px-1.5 text-on-surface font-medium focus:outline-none cursor-pointer"
          >
            {supportedLanguages.map((lang) => (
              <option key={lang} value={lang}>
                {lang.split(" ")[0]}
              </option>
            ))}
          </select>
          <Link href="/settings" className="p-2 text-on-surface-variant hover:text-on-surface" aria-label="Settings">
            <span className="material-symbols-outlined text-xl">settings</span>
          </Link>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 text-on-surface-variant hover:text-on-surface focus:outline-none"
            aria-label="Toggle Menu"
          >
            <span className="material-symbols-outlined text-2xl">{isOpen ? "close" : "menu"}</span>
          </button>
        </div>
      </div>

      {/* Sidebar Navigation */}
      <nav
        className={`fixed left-0 top-0 h-full w-[260px] bg-surface border-r border-outline-variant/20 py-unit-lg flex flex-col space-y-unit-sm z-40 transition-transform duration-300 md:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-unit-lg mb-unit-xl flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-primary-container flex items-center justify-center text-on-primary-container">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>account_balance</span>
            </div>
            <div>
              <h1 className="font-headline-sm text-headline-sm font-black text-on-surface leading-tight">Expensely</h1>
              <p className="font-label-sm text-label-sm text-on-surface-variant">Expense Intelligence</p>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} className="md:hidden p-1 text-on-surface-variant hover:text-on-surface">
            <span className="material-symbols-outlined">chevron_left</span>
          </button>
        </div>

        <div className="flex-1 px-unit-md space-y-1 overflow-y-auto">
          {menuItems.map((item) => (
            <Link key={item.name} href={item.href} className={getLinkClass(item.href)} onClick={() => setIsOpen(false)}>
              <span className="material-symbols-outlined mr-3">{item.icon}</span>
              {t(item.name)}
            </Link>
          ))}
        </div>

        <div className="px-unit-md mt-auto pt-4">
          <Link
            href="/pricing"
            onClick={() => setIsOpen(false)}
            className="block w-full py-2 px-4 bg-surface-container-low text-primary font-label-md text-label-md rounded-lg border border-outline-variant hover:bg-surface-container-high transition-colors mb-4 cursor-pointer text-left"
          >
            {t("pricing_upgrade_pro") || "Upgrade to Pro"}
          </Link>
          <div className="space-y-1">
            {bottomItems.map((item) => {
              if (item.name === "Logout") {
                return (
                  <button
                    key={item.name}
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className={`${getLinkClass(item.href)} w-full text-left cursor-pointer flex items-center disabled:opacity-50`}
                  >
                    <span className={`material-symbols-outlined mr-3 ${isLoggingOut ? "animate-spin" : ""}`}>
                      {isLoggingOut ? "sync" : item.icon}
                    </span>
                    {isLoggingOut ? "Logging out..." : t(item.name)}
                  </button>
                );
              }
              return (
                <Link key={item.name} href={item.href} className={getLinkClass(item.href)} onClick={() => setIsOpen(false)}>
                  <span className="material-symbols-outlined mr-3">{item.icon}</span>
                  {t(item.name)}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Overlay for Mobile */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-on-background/25 backdrop-blur-sm z-30 md:hidden"
        />
      )}
    </>
  );
}
