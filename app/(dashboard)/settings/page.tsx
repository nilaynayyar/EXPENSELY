"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/utils/supabase/client";

import { useLanguage } from "@/components/LanguageProvider";
import { useTheme } from "@/components/ThemeProvider";

type SettingsSection = "User Information" | "Preferences" | "Data & Sync" | "Security" | "Notifications";

const navItems: { label: SettingsSection; icon: string; iconColor?: string }[] = [
  { label: "User Information", icon: "person", iconColor: "text-primary" },
  { label: "Preferences", icon: "tune" },
  { label: "Data & Sync", icon: "sync" },
  { label: "Security", icon: "security" },
  { label: "Notifications", icon: "notifications_active" },
];

export default function SettingsPage() {
  const { language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const [activeSection, setActiveSection] = useState<SettingsSection>("User Information");
  const [offlineSync, setOfflineSync] = useState(true);
  const [saved, setSaved] = useState(false);
  const [userProfile, setUserProfile] = useState<{full_name: string, email: string, avatar_url?: string} | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Password Modal State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Avatar and Export State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const sync = localStorage.getItem("offlineSync");
    if (sync !== null) setOfflineSync(sync === "true");

    const fetchProfile = async () => {
      const supabase = createClient();
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.error("Session error:", sessionError);
        return;
      }
      if (session) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('full_name, avatar_url')
          .eq('id', session.user.id)
          .single();
        
        if (profileError) {
          console.error("Profile fetch error:", profileError);
        }
        
        setUserProfile({
          full_name: profile?.full_name || '',
          email: session.user.email || '',
          avatar_url: profile?.avatar_url,
        });
      }
    };
    fetchProfile();
  }, []);



  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLanguage(e.target.value);
  };

  const handleSave = async () => {
    setIsSaving(true);
    const supabase = createClient();
    try {
      if (userProfile?.full_name !== undefined) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { error } = await supabase
            .from('profiles')
            .update({ full_name: userProfile.full_name })
            .eq('id', session.user.id);
          
          if (error) throw error;
        }
      }
      
      localStorage.setItem("offlineSync", offlineSync ? "true" : "false");
      
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      alert("Failed to save settings: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      alert("Password must be at least 6 characters long.");
      return;
    }
    
    setIsUpdatingPassword(true);
    const supabase = createClient();
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      
      alert("Password updated successfully.");
      setShowPasswordModal(false);
      setNewPassword("");
    } catch (err: any) {
      console.error("Password update error:", err);
      alert("Failed to update password: " + err.message);
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    setIsUploadingAvatar(true);
    const supabase = createClient();
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session");
      
      const fileExt = file.name.split('.').pop();
      const filePath = `${session.user.id}-${Date.now()}.${fileExt}`;
      
      // Upload image
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);
        
      if (uploadError) throw uploadError;
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);
        
      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', session.user.id);
        
      if (updateError) throw updateError;
      
      setUserProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : null);
      // Notify header (and any other listeners) to update avatar without re-fetching
      window.dispatchEvent(new CustomEvent("profileUpdated", { detail: { avatar_url: publicUrl } }));
      
    } catch (err: any) {
      console.error("Avatar upload error:", err);
      alert("Failed to upload avatar: " + err.message);
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleExportData = async () => {
    setIsExporting(true);
    const supabase = createClient();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session");
      
      const [expensesRes, budgetsRes, groupsRes] = await Promise.all([
        supabase.from('expenses').select('*').eq('user_id', session.user.id),
        supabase.from('budgets').select('*').eq('user_id', session.user.id),
        supabase.from('groups').select('*') // Depending on RLS this fetches accessible groups
      ]);
      
      if (expensesRes.error) console.error("Expenses export error:", expensesRes.error);
      if (budgetsRes.error) console.error("Budgets export error:", budgetsRes.error);
      if (groupsRes.error) console.error("Groups export error:", groupsRes.error);
      
      const exportData = {
        expenses: expensesRes.data || [],
        budgets: budgetsRes.data || [],
        groups: groupsRes.data || []
      };
      
      const dataStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = url;
      link.download = `expensely_export_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
    } catch (err: any) {
      console.error("Export error:", err);
      alert("Failed to export data: " + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleAction = (action: string) => {
    // Unified placeholder handler — replace each case with real implementation
    const messages: Record<string, string> = {
      "email-change": "Email change is not yet supported. Please contact support.",
      "two-factor": "Two-Factor Authentication setup is coming soon.",
      default: "This feature is coming soon.",
    };
    alert(messages[action] ?? messages.default);
  };

  const translations: Record<string, string> = {
    "English (US)": "Profile & Settings",
    "English (UK)": "Profile & Settings",
    "Hindi": "प्रोफ़ाइल और सेटिंग्स",
    "Spanish": "Perfil y Configuración",
    "French": "Profil et Paramètres",
  };
  const pageTitle = translations[language] || translations["English (US)"];

  return (
    <main className="flex-1 p-4 md:p-margin-page max-w-[1440px] mx-auto w-full relative">
      {/* Page Header */}
      <div className="mb-unit-lg">
        <h2 className="font-headline-lg-mobile md:font-headline-lg text-[28px] md:text-[32px] leading-[36px] md:leading-[40px] font-semibold text-on-surface mb-2">
          {pageTitle}
        </h2>
        <p className="font-body-md text-[16px] leading-[24px] text-on-surface-variant">
          Manage your account details and application preferences.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-unit-lg">
        {/* Settings Navigation (Left Column) */}
        <div className="lg:col-span-3 space-y-2 hidden md:block">
          <div className="glass-panel rounded-xl p-2 sticky top-[100px]">
            {navItems.map((item) => (
              <button
                key={item.label}
                onClick={() => setActiveSection(item.label)}
                className={`w-full text-left px-4 py-3 rounded-lg font-label-md text-[14px] flex items-center gap-3 transition-colors ${
                  activeSection === item.label
                    ? "bg-surface-container-high text-on-surface border-l-2 border-primary"
                    : "text-on-surface-variant hover:bg-surface-container-low"
                }`}
              >
                <span
                  className={`material-symbols-outlined ${
                    activeSection === item.label && item.iconColor ? item.iconColor : ""
                  }`}
                  style={
                    activeSection === item.label ? { fontVariationSettings: "'FILL' 1" } : undefined
                  }
                >
                  {item.icon}
                </span>
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Settings Content (Right Column) */}
        <div className="lg:col-span-9 space-y-unit-lg">
          {/* User Information Card */}
          <section className="glass-panel rounded-xl p-6 md:p-8" id="user-information">
            <h3 className="font-headline-sm text-[20px] font-semibold text-on-surface mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">person</span>
              User Information
            </h3>
            <div className="flex flex-col md:flex-row gap-8 items-start">
              {/* Avatar */}
              <div className="relative group">
                <div className="w-24 h-24 rounded-full bg-primary-container overflow-hidden flex items-center justify-center text-on-primary-container font-bold text-[32px] border-2 border-surface-container-high shadow-sm">
                  {userProfile?.avatar_url ? (
                    <img src={userProfile.avatar_url} alt="User Avatar" className="w-full h-full object-cover" />
                  ) : (
                    userProfile?.full_name?.charAt(0)?.toUpperCase() || 'U'
                  )}
                  {isUploadingAvatar && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="material-symbols-outlined animate-spin text-white">sync</span>
                    </div>
                  )}
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*"
                  onChange={handleAvatarUpload} 
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                  className="absolute bottom-0 right-0 bg-surface rounded-full p-1.5 shadow-sm border border-outline-variant hover:bg-surface-container transition-colors group-hover:text-primary cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-sm">edit</span>
                </button>
              </div>

              {/* Fields */}
              <div className="flex-1 w-full space-y-4">
                <div className="flex justify-between items-center mb-2">
                  <div className="w-full mr-4">
                    <h4 className="font-label-md text-[14px] text-on-surface-variant mb-1">Full Name</h4>
                    <input 
                      type="text"
                      className="w-full bg-transparent border-b border-outline-variant/50 focus:border-primary outline-none font-body-lg text-[18px] text-on-surface font-medium pb-1 transition-colors"
                      value={userProfile?.full_name || ''}
                      onChange={(e) => setUserProfile(prev => prev ? {...prev, full_name: e.target.value} : {full_name: e.target.value, email: ''})}
                      placeholder="Enter your name"
                    />
                  </div>
                  <span className="inline-flex items-center gap-1 bg-tertiary-fixed text-on-tertiary-fixed px-3 py-1 rounded-full font-label-sm text-[12px] shadow-sm border border-tertiary/20">
                    <span className="material-symbols-outlined text-[14px]">workspace_premium</span>
                    Premium
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-outline-variant/30">
                  <div>
                    <label className="block font-label-md text-[14px] text-on-surface-variant mb-1">
                      Email Address
                    </label>
                    <div className="relative">
                      <input
                        className="w-full bg-surface border border-outline-variant rounded-lg px-3 py-2 font-body-sm text-[14px] text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all disabled:bg-surface-container-lowest disabled:text-on-surface-variant"
                        disabled
                        type="email"
                        value={userProfile?.email || 'Loading...'}
                      />
                      <button 
                        onClick={() => handleAction("email-change")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-primary font-label-sm text-[12px] hover:underline cursor-pointer"
                      >
                        Change
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block font-label-md text-[14px] text-on-surface-variant mb-1">
                      Role
                    </label>
                    <input
                      className="w-full bg-surface-container-lowest border border-outline-variant/50 rounded-lg px-3 py-2 font-body-sm text-[14px] text-on-surface-variant cursor-not-allowed"
                      disabled
                      type="text"
                      defaultValue="Administrator"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Preferences Card */}
          <section className="glass-panel rounded-xl p-6 md:p-8" id="preferences">
            <h3 className="font-headline-sm text-[20px] font-semibold text-on-surface mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">tune</span>
              Preferences
            </h3>
            <div className="space-y-6">
              {/* Appearance */}
              <div className="flex items-center justify-between py-2 border-b border-outline-variant/20">
                <div>
                  <p className="font-body-md text-[16px] text-on-surface font-medium">Appearance</p>
                  <p className="font-body-sm text-[14px] text-on-surface-variant">
                    Toggle between light and dark mode
                  </p>
                </div>
                <button
                  onClick={toggleTheme}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 cursor-pointer ${
                    theme === "dark" ? "bg-primary" : "bg-outline-variant"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-on-primary transition-transform ${
                      theme === "dark" ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Base Currency */}
              <div className="flex items-center justify-between py-2 border-b border-outline-variant/20">
                <div>
                  <p className="font-body-md text-[16px] text-on-surface font-medium">Base Currency</p>
                  <p className="font-body-sm text-[14px] text-on-surface-variant">
                    Used for all aggregate reports
                  </p>
                </div>
                <div className="bg-surface-container-low px-4 py-2 rounded-lg border border-outline-variant/50 font-body-md text-[16px] text-on-surface flex items-center gap-2 cursor-not-allowed opacity-80">
                  <span className="font-medium">INR (₹)</span>
                  <span className="material-symbols-outlined text-sm text-on-surface-variant">lock</span>
                </div>
              </div>

              {/* Language */}
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-body-md text-[16px] text-on-surface font-medium">Language</p>
                  <p className="font-body-sm text-[14px] text-on-surface-variant">Interface language</p>
                </div>
                <select
                  value={language}
                  onChange={handleLanguageChange}
                  className="bg-surface border border-outline-variant rounded-lg px-4 py-2 font-body-sm text-[14px] text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary appearance-none pr-8 cursor-pointer"
                >
                  <option value="English (US)">English (US)</option>
                  <option value="English (UK)">English (UK)</option>
                  <option value="Hindi">Hindi</option>
                  <option value="Spanish">Spanish</option>
                  <option value="French">French</option>
                </select>
              </div>
            </div>
          </section>

          {/* Data & Sync / Security Split */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-unit-lg">
            {/* Data & Sync */}
            <section className="glass-panel rounded-xl p-6" id="data-sync">
              <h3 className="font-headline-sm text-[20px] font-semibold text-on-surface mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-tertiary">sync</span>
                Data &amp; Sync
              </h3>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-body-md text-[16px] text-on-surface font-medium">Offline Sync</p>
                    <p className="font-body-sm text-[14px] text-on-surface-variant">Save changes locally</p>
                  </div>
                  <button
                    onClick={() => setOfflineSync(!offlineSync)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 cursor-pointer ${
                      offlineSync ? "bg-primary" : "bg-outline-variant"
                    }`}
                  >
                    <span
                    className={`inline-block h-4 w-4 rounded-full bg-on-primary transition-transform ${
                        offlineSync ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
                <div className="pt-4 border-t border-outline-variant/20">
                  <button 
                    onClick={handleExportData}
                    disabled={isExporting}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-outline-variant rounded-lg font-label-md text-[14px] text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-sm">
                      {isExporting ? "sync" : "download"}
                    </span>
                    {isExporting ? "Exporting Data..." : "Export All Data"}
                  </button>
                  <p className="font-body-sm text-[11px] text-on-surface-variant text-center mt-2">
                    Downloads a JSON of all transactions and data.
                  </p>
                </div>
              </div>
            </section>

            {/* Security */}
            <section className="glass-panel rounded-xl p-6 border-l-[3px] border-l-error/70" id="security">
              <h3 className="font-headline-sm text-[20px] font-semibold text-on-surface mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-error">security</span>
                Security
              </h3>
              <div className="space-y-4">
                <button 
                  onClick={() => setShowPasswordModal(true)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-surface-container-low rounded-lg border border-outline-variant/50 hover:bg-surface-container transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary">
                      password
                    </span>
                    <span className="font-label-md text-[14px] text-on-surface">Change Password</span>
                  </div>
                  <span className="material-symbols-outlined text-sm text-on-surface-variant">
                    chevron_right
                  </span>
                </button>
                <div className="flex items-center justify-between p-3 bg-surface-container-low rounded-lg border border-outline-variant/50">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-on-surface-variant">phonelink_lock</span>
                    <div>
                      <p className="font-label-md text-[14px] text-on-surface">Two-Factor Auth</p>
                      <p className="font-body-sm text-[11px] text-on-surface-variant">Currently disabled</p>
                    </div>
                  </div>
                  <span className="bg-surface-container-high text-on-surface-variant px-2.5 py-1 rounded-full font-label-sm text-[11px] font-semibold border border-outline-variant/35 select-none">
                    Coming Soon
                  </span>
                </div>
              </div>
            </section>
          </div>

          {/* Save Actions */}
          <div className="flex justify-end gap-4 pt-4 pb-8">
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2 border border-outline-variant text-on-surface rounded-lg font-label-md text-[14px] hover:bg-surface-container-low transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2 bg-primary text-on-primary rounded-lg font-label-md text-[14px] shadow-sm hover:opacity-90 transition-opacity flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                "Saving..."
              ) : saved ? (
                <>
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  Saved!
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-on-background/25 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface rounded-xl shadow-2xl p-unit-xl relative border border-outline-variant/30">
            <button
              onClick={() => setShowPasswordModal(false)}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface focus:outline-none"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold mb-4">Change Password</h3>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block font-label-md text-label-md text-on-surface mb-1" htmlFor="newPassword">
                  New Password
                </label>
                <input
                  required
                  id="newPassword"
                  type="password"
                  placeholder="Enter new password (min 6 chars)"
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent font-body-sm text-body-sm"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={6}
                />
              </div>
              <button
                type="submit"
                disabled={isUpdatingPassword}
                className="w-full py-3 bg-primary text-on-primary font-label-md text-label-md rounded-lg shadow-sm hover:opacity-95 transition-opacity mt-4 font-bold disabled:opacity-50"
              >
                {isUpdatingPassword ? "Updating..." : "Update Password"}
              </button>
            </form>
          </div>
        </div>
      )}

    </main>
  );
}
