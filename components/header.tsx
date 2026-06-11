"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useCallback, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";

// Unified handler for placeholder actions
const handleAction = (action: string) => {
  const messages: Record<string, string> = {
    notifications: "Notification center is coming soon.",
    default: "This feature is coming soon.",
  };
  alert(messages[action] ?? messages.default);
};
// No fallback image URLs per requirements. Single source of truth is profiles.avatar_url.
export default function Header() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    // Single fetch on mount — updated via profileUpdated event when settings change
    const fetchProfile = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('id', session.user.id)
          .single();
        if (profile?.avatar_url) {
          setAvatarUrl(profile.avatar_url);
        }
      }
    };
    fetchProfile();

    // Listen for avatar updates from settings page (no duplicate fetches needed)
    const handleProfileUpdated = (e: Event) => {
      const detail = (e as CustomEvent<{ avatar_url?: string }>).detail;
      if (detail?.avatar_url) {
        setAvatarUrl(detail.avatar_url);
      }
    };
    window.addEventListener("profileUpdated", handleProfileUpdated);
    return () => window.removeEventListener("profileUpdated", handleProfileUpdated);
  }, []);

  // Click outside detection for notifications dropdown
  useEffect(() => {
    if (!showNotifications) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("#notification-dropdown") && !target.closest("#notification-bell")) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showNotifications]);

  const handleSearch = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && searchQuery.trim()) {
        router.push(`/expenses?q=${encodeURIComponent(searchQuery.trim())}`);
      }
    },
    [searchQuery, router]
  );

  return (
    <header className="hidden md:flex justify-between items-center w-full bg-surface/70 backdrop-blur-xl border-b border-outline-variant/30 sticky top-0 z-30 h-20 px-unit-xl">
      <div className="flex items-center space-x-6">
        <Link href="/dashboard" className="font-headline-md text-headline-md font-bold text-primary hover:opacity-90 transition-opacity">
          Expensely
        </Link>
        <div className="relative ml-6 w-64">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">
            search
          </span>
          <input
            type="text"
            placeholder="Search transactions..."
            className="w-full bg-surface-container-low border-none rounded-lg py-2 pl-10 pr-4 text-body-sm focus:ring-2 focus:ring-primary/20 transition-all focus:outline-none"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearch}
          />
        </div>
      </div>
      <div className="flex items-center space-x-4">
        <div className="relative">
          <button
            id="notification-bell"
            className="text-on-surface-variant hover:bg-surface-container/50 p-2 rounded-full transition-colors relative focus:outline-none flex items-center justify-center"
            onClick={() => setShowNotifications(!showNotifications)}
            title="Notifications"
          >
            <span className="material-symbols-outlined">notifications</span>
            <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full ring-2 ring-surface" />
          </button>

          {showNotifications && (
            <div
              id="notification-dropdown"
              className="absolute right-0 mt-2 w-80 bg-surface border border-outline-variant/30 rounded-xl shadow-lg p-4 z-50 animate-fade-in"
            >
              <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20 mb-3">
                <h4 className="font-label-md text-[14px] text-on-surface font-semibold">Notifications</h4>
                <button
                  onClick={() => setShowNotifications(false)}
                  className="text-on-surface-variant hover:text-on-surface p-1 rounded-full hover:bg-surface-container transition-colors flex items-center justify-center"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>

              <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-3">
                  <span className="material-symbols-outlined text-[24px]">notifications_off</span>
                </div>
                <h5 className="font-label-md text-[14px] text-on-surface font-semibold mb-1">All caught up!</h5>
                <p className="font-body-sm text-[12px] text-on-surface-variant max-w-[200px]">
                  You don't have any notifications right now.
                </p>
              </div>
            </div>
          )}
        </div>
        <Link href="/settings" className="focus:outline-none">
          {avatarUrl ? (
            <img
              alt="User Profile Avatar"
              className="w-8 h-8 rounded-full border border-outline-variant hover:border-primary/50 transition-colors object-cover"
              src={avatarUrl}
            />
          ) : (
            <div className="w-8 h-8 rounded-full border border-outline-variant hover:border-primary/50 transition-colors bg-surface-container-high flex items-center justify-center text-on-surface-variant">
              <span className="material-symbols-outlined text-[20px]">person</span>
            </div>
          )}
        </Link>
      </div>
    </header>
  );
}
