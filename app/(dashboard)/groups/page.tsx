"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import { useLanguage } from "@/components/LanguageProvider";
import {
  calculateEqualSplits,
  computeGroupBalances,
  simplifyDebts,
  MemberBalanceDetail,
  SettlementTransfer,
  GroupMemberInput,
  GroupExpenseInput,
  GroupSettlementInput,
} from "@/lib/group-calculations";

interface GroupItem {
  id: string;
  name: string;
  members: number;
  icon: string;
  iconBg: string;
  iconColor: string;
  created_by?: string;
}

interface GroupExpenseItem {
  id: string;
  date: string;
  description: string;
  paidBy: string;
  amount: number;
  isYou: boolean;
  splits?: { profile_id: string; share_amount: number }[];
}

interface RawGroupExpense {
  id: string;
  payer_id: string;
  amount: number | string;
  description: string;
  date: string;
  profiles?: { full_name?: string } | null;
  group_expense_splits?: { profile_id: string; share_amount: number | string }[];
}

// Stable logical settlement operation manager across page refreshes and network retries
function getOrCreateSettlementOperationId(groupId: string, transfers: SettlementTransfer[]): string {
  if (typeof window === "undefined") return crypto.randomUUID();
  const signature = `${groupId}:` + transfers
    .map((t) => `${t.fromId}->${t.toId}:${t.amount.toFixed(2)}`)
    .sort()
    .join("|");
  const storageKey = `expensely_settle_op_${groupId}`;
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const record = JSON.parse(raw);
      // If signature matches and operation was initiated within the last 1 hour, reuse the stable UUID
      if (record.signature === signature && Date.now() - record.createdAt < 60 * 60 * 1000) {
        return record.operationId;
      }
    }
  } catch {
    // ignore localStorage errors
  }

  const newOperationId = crypto.randomUUID();
  try {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        operationId: newOperationId,
        signature,
        createdAt: Date.now(),
      })
    );
  } catch {
    // ignore localStorage errors
  }
  return newOperationId;
}

function clearSettlementOperationId(groupId: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(`expensely_settle_op_${groupId}`);
  } catch {
    // ignore
  }
}

export default function GroupsPage() {
  const { t, formatCurrency } = useLanguage();
  const pageTitle = t("groups_title") || "Group Expenses & Splits";

  const [activeGroup, setActiveGroup] = useState<string>("");
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [expenses, setExpenses] = useState<GroupExpenseItem[]>([]);
  const [balances, setBalances] = useState<MemberBalanceDetail[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMemberInput[]>([]);
  const [, setSettlements] = useState<GroupSettlementInput[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Modal states
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [newExpenseDesc, setNewExpenseDesc] = useState("");
  const [newExpenseAmount, setNewExpenseAmount] = useState("");
  const [newExpensePayerId, setNewExpensePayerId] = useState<string>("");
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [settlementBatchId, setSettlementBatchId] = useState<string>("");
  const [isSettling, setIsSettling] = useState(false);
  const [settlementSuccessMsg, setSettlementSuccessMsg] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const supabase = createClient();
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) {
        console.error("[Groups] User error:", userError);
        setError("Authentication error. Please sign in again.");
        return;
      }
      if (!user) return;
      setUserId(user.id);

      // Fetch groups where user is a member
      const { data: memberGroups, error: memberError } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("profile_id", user.id);

      if (memberError) {
        console.error("[Groups] group_members fetch error:", memberError);
        setError("Failed to fetch group membership.");
        return;
      }
      if (!memberGroups || memberGroups.length === 0) {
        setGroups([]);
        return;
      }

      const groupIds = memberGroups.map((mg) => mg.group_id);

      // Fetch group details and count members properly
      const { data: groupsData, error: groupsError } = await supabase
        .from("groups")
        .select("*, group_members(profile_id)")
        .in("id", groupIds);

      if (groupsError) {
        console.error("[Groups] groups fetch error:", groupsError);
        setError("Failed to fetch group details.");
        return;
      }

      if (groupsData && groupsData.length > 0) {
        const formattedGroups: GroupItem[] = groupsData.map((g, i) => ({
          id: g.id,
          name: g.name,
          members: g.group_members?.length || 0,
          created_by: g.created_by,
          icon: g.icon || "group",
          iconBg:
            g.icon_bg ||
            ["bg-secondary-container", "bg-tertiary-container", "bg-surface-variant"][i % 3],
          iconColor:
            g.icon_color ||
            ["text-on-secondary-container", "text-on-tertiary-container", "text-on-surface"][i % 3],
        }));
        setGroups(formattedGroups);
        if (!activeGroup && formattedGroups.length > 0) {
          setActiveGroup(formattedGroups[0].id);
        }
      } else {
        setGroups([]);
      }
    } catch (err) {
      console.error("[Groups] Error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [activeGroup]);

  const fetchExpenses = useCallback(async () => {
    if (!activeGroup || !userId) return;
    const supabase = createClient();
    try {
      // 1. Fetch group members
      const { data: membersData, error: memError } = await supabase
        .from("group_members")
        .select("profile_id, profiles(full_name)")
        .eq("group_id", activeGroup);

      if (memError) {
        console.error("[Groups] group_members fetch error:", memError);
        setError("Failed to fetch group members.");
        return;
      }

      const activeMembers: GroupMemberInput[] = (membersData || []).map((m) => ({
        profileId: m.profile_id,
        name: (m.profiles as { full_name?: string })?.full_name || "Member",
      }));
      setGroupMembers(activeMembers);

      // Default selected participants and payer if unset
      setSelectedParticipantIds((prev) =>
        prev.length === 0 ? activeMembers.map((m) => m.profileId) : prev
      );
      setNewExpensePayerId((prev) => (!prev ? userId : prev));

      // 2. Fetch group expenses (attempt with group_expense_splits relation)
      let rawExps: RawGroupExpense[] = [];
      try {
        const { data: expsWithSplits, error: splitsErr } = await supabase
          .from("group_expenses")
          .select("*, profiles(full_name), group_expense_splits(profile_id, share_amount)")
          .eq("group_id", activeGroup)
          .order("date", { ascending: false });

        if (!splitsErr && expsWithSplits) {
          rawExps = expsWithSplits;
        } else {
          const { data: basicExps, error: basicErr } = await supabase
            .from("group_expenses")
            .select("*, profiles(full_name)")
            .eq("group_id", activeGroup)
            .order("date", { ascending: false });
          if (!basicErr && basicExps) rawExps = basicExps;
        }
      } catch {
        const { data: basicExps } = await supabase
          .from("group_expenses")
          .select("*, profiles(full_name)")
          .eq("group_id", activeGroup)
          .order("date", { ascending: false });
        if (basicExps) rawExps = basicExps;
      }

      // Filter out legacy dummy balancing entries from user-facing expense lists
      const filteredExps = (rawExps || []).filter(
        (e) => Number(e.amount) > 0 && !e.description?.toLowerCase().includes("all balances settled")
      );

      setExpenses(
        filteredExps.map((e) => ({
          id: e.id,
          date: new Date(e.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          description: e.description || "Expense",
          paidBy: (e.profiles as { full_name?: string })?.full_name || "Unknown",
          amount: Number(e.amount),
          isYou: e.payer_id === userId,
          splits: e.group_expense_splits?.map((s) => ({
            profile_id: s.profile_id,
            share_amount: Number(s.share_amount),
          })),
        }))
      );

      // 3. Fetch group settlements
      let settlementsData: GroupSettlementInput[] = [];
      try {
        const { data: sets, error: setsErr } = await supabase
          .from("group_settlements")
          .select("id, from_profile_id, to_profile_id, amount, settled_at")
          .eq("group_id", activeGroup);

        if (!setsErr && sets) {
          settlementsData = sets.map((s) => ({
            id: s.id,
            from_profile_id: s.from_profile_id,
            to_profile_id: s.to_profile_id,
            amount: Number(s.amount),
            settled_at: s.settled_at,
          }));
        }
      } catch {
        // settlements table not queried or empty
      }
      setSettlements(settlementsData);

      // 4. Compute accurate net balances using integer-paise Splitwise algorithm
      const expenseInputs: GroupExpenseInput[] = (rawExps || []).map((e) => ({
        id: e.id,
        payer_id: e.payer_id,
        amount: Number(e.amount),
        description: e.description,
        date: e.date,
        splits: e.group_expense_splits?.map((s: { profile_id: string; share_amount: number | string }) => ({
          profile_id: s.profile_id,
          share_amount: Number(s.share_amount),
        })),
      }));

      const computedBalances = computeGroupBalances(activeMembers, expenseInputs, settlementsData);
      setBalances(computedBalances);
    } catch (err) {
      console.error("[Groups] Error fetching expenses:", err);
    }
  }, [activeGroup, userId]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      if (isMounted) await fetchData();
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [fetchData]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      if (isMounted) await fetchExpenses();
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [fetchExpenses]);

  // Compute transfers needed to settle all balances using integer paise debt simplification
  const settlementTransfers: SettlementTransfer[] = useMemo(() => {
    return simplifyDebts(balances);
  }, [balances]);

  const toggleParticipant = (profileId: string) => {
    setSelectedParticipantIds((prev) => {
      if (prev.includes(profileId)) {
        if (prev.length <= 1) return prev; // keep at least 1
        return prev.filter((id) => id !== profileId);
      }
      return [...prev, profileId];
    });
  };

  const selectAllParticipants = () => {
    setSelectedParticipantIds(groupMembers.map((m) => m.profileId));
  };

  const currentExpenseAmount = parseFloat(newExpenseAmount) || 0;
  const currentSplits = useMemo(() => {
    if (currentExpenseAmount <= 0 || selectedParticipantIds.length === 0) return [];
    return calculateEqualSplits(currentExpenseAmount, selectedParticipantIds);
  }, [currentExpenseAmount, selectedParticipantIds]);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || !userId) return;

    const supabase = createClient();
    const { data: newGroup, error: insertError } = await supabase
      .from("groups")
      .insert([
        {
          name: newGroupName.trim(),
          created_by: userId,
          icon: "diversity_3",
          icon_bg: "bg-primary-container",
          icon_color: "text-on-primary-container",
        },
      ])
      .select()
      .single();

    if (insertError) {
      alert("Failed to create group: " + insertError.message);
      return;
    }

    const { error: memberError } = await supabase.from("group_members").insert([
      {
        group_id: newGroup.id,
        profile_id: userId,
      },
    ]);

    if (memberError) {
      alert("Failed to add membership: " + memberError.message);
      return;
    }

    setShowCreateGroupModal(false);
    setNewGroupName("");
    setActiveGroup(newGroup.id);
    fetchData();
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpenseDesc.trim() || !newExpenseAmount || !activeGroup || !userId) return;
    const amount = parseFloat(newExpenseAmount);
    if (isNaN(amount) || amount <= 0) return;

    const payer = newExpensePayerId || userId;
    const participants =
      selectedParticipantIds.length > 0
        ? selectedParticipantIds
        : groupMembers.map((m) => m.profileId);

    // Calculate exact equal shares in integer paise
    const splits = calculateEqualSplits(amount, participants);

    const supabase = createClient();
    const today = new Date().toISOString().split("T")[0];

    // 1. Try atomic RPC function
    let rpcSuccess = false;
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc("rpc_create_group_expense", {
        p_group_id: activeGroup,
        p_payer_id: payer,
        p_description: newExpenseDesc.trim(),
        p_amount: amount,
        p_date: today,
        p_splits: splits.map((s) => ({
          profile_id: s.profileId,
          share_amount: s.shareAmount,
        })),
      });
      if (!rpcErr && rpcData?.success) {
        rpcSuccess = true;
      }
    } catch {
      // RPC not yet deployed or error, fall back to direct insert
    }

    if (!rpcSuccess) {
      // 2. Direct insert fallback
      const { data: newExp, error: insertError } = await supabase
        .from("group_expenses")
        .insert([
          {
            group_id: activeGroup,
            payer_id: payer,
            description: newExpenseDesc.trim(),
            amount: amount,
            date: today,
          },
        ])
        .select("id")
        .single();

      if (insertError) {
        alert("Failed to add expense: " + insertError.message);
        return;
      }

      if (newExp?.id && splits.length > 0) {
        try {
          await supabase.from("group_expense_splits").insert(
            splits.map((s) => ({
              group_expense_id: newExp.id,
              profile_id: s.profileId,
              share_amount: s.shareAmount,
            }))
          );
        } catch {
          // Table may not yet be present; fallback will dynamically divide on read
        }
      }
    }

    setShowAddExpenseModal(false);
    setNewExpenseDesc("");
    setNewExpenseAmount("");
    setNewExpensePayerId(userId);
    setSelectedParticipantIds(groupMembers.map((m) => m.profileId));
    fetchExpenses();
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberEmail.trim() || !activeGroup) return;

    const supabase = createClient();
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", newMemberEmail.trim().toLowerCase());

    if (profileError || !profiles || profiles.length === 0) {
      alert("No user registered with that email address.");
      return;
    }

    const memberId = profiles[0].id;
    const { error: insertError } = await supabase.from("group_members").insert([
      {
        group_id: activeGroup,
        profile_id: memberId,
      },
    ]);

    if (insertError) {
      alert("Failed to add member. They might already belong to this group.");
      return;
    }

    setShowAddMemberModal(false);
    setNewMemberEmail("");
    fetchData();
    fetchExpenses();
  };

  const handleConfirmSettlement = async () => {
    if (!activeGroup || !userId || isSettling) return;
    setIsSettling(true);

    const batchId =
      settlementBatchId || getOrCreateSettlementOperationId(activeGroup, settlementTransfers);

    try {
      // 1. Primary: Use dedicated server API route with server-side idempotency enforcement
      let apiSucceeded = false;
      try {
        const res = await fetch("/api/groups/settle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            groupId: activeGroup,
            operationId: batchId,
            transfers: settlementTransfers.map((t) => ({
              fromId: t.fromId,
              toId: t.toId,
              amount: t.amount,
            })),
          }),
        });

        const data = await res.json();
        if (res.ok && data.success) {
          apiSucceeded = true;
          // Clear the pending operation from localStorage because settlement succeeded!
          clearSettlementOperationId(activeGroup);
          setSettlementSuccessMsg(
            data.alreadySettled
              ? "Settlement was already recorded and has been synchronized."
              : "All balances have been acknowledged as settled."
          );
          setTimeout(() => setSettlementSuccessMsg(null), 5000);
          setShowSettlementModal(false);
          fetchExpenses();
          return;
        } else if (res.status === 409) {
          alert(`Settlement conflict: ${data.error}`);
          return;
        } else {
          // Ambiguous server error: do NOT clear pending operation ID so retry reuses it
          console.error("[Groups] Settle API returned error:", data.error);
          alert(`Failed to record settlement: ${data.error || "Server error"}. Your operation has been preserved; please retry.`);
          return;
        }
      } catch (networkErr) {
        console.warn("[Groups] Network error calling /api/groups/settle, falling back to direct persistence:", networkErr);
      }

      if (!apiSucceeded) {
        // 2. Fallback: Client-side direct Supabase persistence with bound idempotency keys
        const supabase = createClient();
        const activeGroupObj = groups.find((g) => g.id === activeGroup);
        const isCreator = activeGroupObj?.created_by === userId;

        let insertErrors = 0;
        for (const t of settlementTransfers) {
          if (isCreator || userId === t.fromId || userId === t.toId) {
            const idempotencyKey = `settle_${batchId}_${activeGroup}_${t.fromId}_${t.toId}`;
            try {
              const { error } = await supabase.from("group_settlements").insert([
                {
                  group_id: activeGroup,
                  from_profile_id: t.fromId,
                  to_profile_id: t.toId,
                  amount: t.amount,
                  idempotency_key: idempotencyKey,
                },
              ]);
              if (error && error.code !== "23505" && !error.message?.includes("unique")) {
                insertErrors++;
              }
            } catch {
              insertErrors++;
            }
          }
        }

        if (insertErrors === 0) {
          // Clear pending operation ONLY after confirmed persistence
          clearSettlementOperationId(activeGroup);
          setSettlementSuccessMsg("All balances have been acknowledged as settled.");
          setTimeout(() => setSettlementSuccessMsg(null), 5000);
          setShowSettlementModal(false);
          fetchExpenses();
        } else {
          // Ambiguous failure: DO NOT CLEAR PENDING ID!
          alert("Failed to confirm settlement with the database. Your operation has been preserved; please retry.");
        }
      }
    } catch (err: unknown) {
      console.error("[Groups] Settlement error:", err);
      // Ambiguous failure: DO NOT CLEAR PENDING ID!
      alert("A network error occurred while processing the settlement. Please check your connection and retry.");
    } finally {
      setIsSettling(false);
    }
  };

  const activeGroupObj = groups.find((g) => g.id === activeGroup);

  return (
    <main className="flex-1 p-unit-lg md:p-margin-page pb-32 max-w-[1440px] mx-auto w-full relative">
      {error && (
        <div className="mb-4 p-4 bg-error-container text-on-error-container rounded-lg border border-error/50 flex items-center justify-between">
          <p className="font-body-md text-[14px] font-medium">{error}</p>
          <button onClick={() => setError(null)} className="material-symbols-outlined text-[20px] hover:opacity-80">
            close
          </button>
        </div>
      )}

      {settlementSuccessMsg && (
        <div className="mb-4 p-4 bg-primary/10 text-primary rounded-lg border border-primary/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined">check_circle</span>
            <p className="font-body-md text-[14px] font-semibold">{settlementSuccessMsg}</p>
          </div>
          <button onClick={() => setSettlementSuccessMsg(null)} className="material-symbols-outlined text-[20px]">
            close
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-unit-md mb-unit-xl">
        <div>
          <h2 className="font-headline-lg-mobile md:font-headline-lg text-[28px] md:text-[32px] leading-[36px] md:leading-[40px] font-semibold text-on-surface">
            {pageTitle}
          </h2>
          <p className="font-body-md text-[16px] leading-[24px] text-on-surface-variant mt-unit-xs">
            {t("groups_subtitle") || "Manage shared costs, split bills equally, and settle balances seamlessly."}
          </p>
        </div>
        <button
          onClick={() => setShowCreateGroupModal(true)}
          className="hidden md:flex items-center justify-center bg-primary text-on-primary px-unit-lg py-unit-sm rounded-lg font-label-md text-[14px] font-bold hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
        >
          <span className="material-symbols-outlined mr-2 text-sm">add</span>
          {t("groups_create_btn") || "Create New Group"}
        </button>
      </div>

      {/* Bento Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-unit-lg">
        {/* Left Column */}
        <div className="lg:col-span-4 space-y-unit-lg">
          {/* Active Groups */}
          <div className="glass-card rounded-xl p-unit-md ambient-shadow">
            <div className="flex items-center justify-between mb-unit-md">
              <h3 className="font-headline-sm text-[20px] font-semibold text-on-surface">
                {t("groups_active_title") || "Active Groups"}
              </h3>
              <button
                onClick={() => setShowCreateGroupModal(true)}
                className="text-primary hover:underline text-xs font-semibold cursor-pointer md:hidden"
              >
                + {t("groups_create_btn") || "New Group"}
              </button>
            </div>
            <div className="space-y-2">
              {groups.length === 0 && !isLoading && (
                <div className="text-sm text-on-surface-variant p-4 text-center">
                  {t("groups_no_groups") || "You are not a member of any group yet. Create one to begin splitting bills!"}
                </div>
              )}
              {groups.map((group) => (
                <div
                  key={group.id}
                  onClick={() => setActiveGroup(group.id)}
                  className={`flex items-center justify-between p-unit-sm rounded-lg cursor-pointer transition-all ${
                    activeGroup === group.id
                      ? "bg-surface-container border border-primary/20 shadow-sm"
                      : "hover:bg-surface-container-low"
                  }`}
                >
                  <div className="flex items-center space-x-unit-sm">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${group.iconBg} ${group.iconColor}`}
                    >
                      <span className="material-symbols-outlined">{group.icon}</span>
                    </div>
                    <div>
                      <div className="font-label-md text-[14px] font-semibold text-on-surface">{group.name}</div>
                      <div className="font-label-sm text-[12px] text-on-surface-variant">
                        {group.members} member{group.members === 1 ? "" : "s"}
                      </div>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-on-surface-variant text-sm">chevron_right</span>
                </div>
              ))}
            </div>
          </div>

          {/* Settlement Summary */}
          <div className="glass-card rounded-xl p-unit-lg relative overflow-hidden border-t-2 border-t-tertiary ambient-shadow">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-tertiary/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center space-x-unit-sm mb-unit-md">
              <span className="material-symbols-outlined text-tertiary">account_balance</span>
              <h3 className="font-headline-sm text-[20px] font-semibold text-on-surface">
                {t("groups_settlement_title") || "Settlement"}
              </h3>
            </div>
            <div className="space-y-3">
              {!activeGroup && (
                <div className="text-sm text-on-surface-variant">
                  {t("groups_select_to_view") || "Select a group to view settlements."}
                </div>
              )}
              {activeGroup && balances.length === 0 && (
                <div className="text-sm text-on-surface-variant">
                  {t("groups_no_members") || "No members found in this group."}
                </div>
              )}
              {balances.map((b) => (
                <div
                  key={b.profileId}
                  className="p-3 rounded-lg bg-surface-container-low/60 border border-outline-variant/20 flex justify-between items-center"
                >
                  <div className="flex items-center space-x-unit-sm">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-[12px] ${
                        b.netBalance > 0.009
                          ? "bg-emerald-500/15 text-emerald-600"
                          : b.netBalance < -0.009
                          ? "bg-rose-500/15 text-rose-600"
                          : "bg-surface-variant text-on-surface-variant"
                      }`}
                    >
                      {b.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-body-sm text-[14px] text-on-surface font-semibold flex items-center gap-1">
                        {b.name} {b.profileId === userId ? "(You)" : ""}
                      </span>
                      <div className="flex items-center gap-2 text-[11px] text-on-surface-variant">
                        <span>Paid: <strong className="text-on-surface">{formatCurrency(b.totalPaid)}</strong></span>
                        <span>•</span>
                        <span>Share: <strong className="text-on-surface">{formatCurrency(b.totalShare)}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end">
                    <span
                      className={`font-label-md text-[14px] font-bold ${
                        b.netBalance > 0.009
                          ? "text-emerald-600"
                          : b.netBalance < -0.009
                          ? "text-rose-600"
                          : "text-on-surface-variant"
                      }`}
                    >
                      {b.netBalance > 0.009 ? "+" : b.netBalance < -0.009 ? "-" : ""}
                      {formatCurrency(Math.abs(b.netBalance))}
                    </span>
                    <span className="text-[10px] font-medium uppercase tracking-wider text-on-surface-variant">
                      {b.netBalance > 0.009
                        ? "Gets back"
                        : b.netBalance < -0.009
                        ? "Owes"
                        : "Settled up"}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Outstanding Debts Breakdown */}
            {activeGroup && settlementTransfers.length > 0 && (
              <div className="mt-4 p-3 rounded-lg bg-surface-container border border-outline-variant/30 text-xs space-y-1.5">
                <span className="font-bold text-on-surface uppercase text-[10px] tracking-wider block mb-1">
                  Outstanding Debts:
                </span>
                {settlementTransfers.map((t, idx) => (
                  <div key={idx} className="flex items-center justify-between text-on-surface-variant">
                    <div className="flex items-center gap-1.5">
                      <strong className="text-on-surface">{t.fromName}</strong>
                      <span>owes</span>
                      <strong className="text-on-surface">{t.toName}</strong>
                    </div>
                    <span className="font-bold text-primary">{formatCurrency(t.amount)}</span>
                  </div>
                ))}
              </div>
            )}

            {activeGroup && balances.length > 0 && (
              <button
                disabled={settlementTransfers.length === 0}
                onClick={() => {
                  const opId = getOrCreateSettlementOperationId(activeGroup, settlementTransfers);
                  setSettlementBatchId(opId);
                  setShowSettlementModal(true);
                }}
                className={`w-full mt-unit-lg py-2.5 font-label-md text-[14px] rounded-lg transition-colors font-semibold flex items-center justify-center gap-2 ${
                  settlementTransfers.length === 0
                    ? "bg-surface-container text-on-surface-variant/50 cursor-not-allowed border border-outline-variant/20"
                    : "border border-primary text-primary hover:bg-primary/10 cursor-pointer shadow-xs"
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">handshake</span>
                {settlementTransfers.length === 0
                  ? "All Balances Settled"
                  : t("groups_settle_btn") || "Settle All Balances"}
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Shared Expenses Canvas */}
        <div
          className="lg:col-span-8 glass-card rounded-xl p-unit-lg flex flex-col ambient-shadow"
          style={{ minHeight: "500px" }}
        >
          {/* Group Header */}
          <div className="flex justify-between items-center border-b border-outline-variant/20 pb-unit-md mb-unit-md">
            <div>
              <h3 className="font-headline-md text-[24px] font-semibold text-on-surface">
                {activeGroupObj?.name || "Select a group"}
              </h3>
              {activeGroup && (
                <div className="flex items-center mt-1 space-x-2">
                  <span className="font-label-sm text-[12px] text-on-surface-variant">
                    {activeGroupObj?.members} members sharing expenses
                  </span>
                </div>
              )}
            </div>
            {activeGroup && (
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setShowAddMemberModal(true)}
                  className="flex items-center space-x-1 text-primary hover:text-primary-container transition-colors font-label-md text-[14px] cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">person_add</span>
                  <span className="hidden sm:inline">Add Member</span>
                </button>
                <button
                  onClick={() => setShowAddExpenseModal(true)}
                  className="flex items-center space-x-1 text-primary hover:text-primary-container transition-colors font-label-md text-[14px] cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">receipt_long</span>
                  <span className="hidden sm:inline">Add Expense</span>
                </button>
              </div>
            )}
          </div>

          {/* Expenses Table */}
          <div className="flex-1 overflow-y-auto pr-2">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-outline-variant/20">
                  <th className="font-label-sm text-[12px] text-on-surface-variant pb-unit-sm uppercase tracking-wider font-semibold">
                    Date
                  </th>
                  <th className="font-label-sm text-[12px] text-on-surface-variant pb-unit-sm uppercase tracking-wider font-semibold">
                    Description
                  </th>
                  <th className="font-label-sm text-[12px] text-on-surface-variant pb-unit-sm uppercase tracking-wider font-semibold hidden sm:table-cell">
                    Paid By
                  </th>
                  <th className="font-label-sm text-[12px] text-on-surface-variant pb-unit-sm uppercase tracking-wider font-semibold text-right">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {!activeGroup && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-sm text-on-surface-variant">
                      Select or create a group to view expenses.
                    </td>
                  </tr>
                )}
                {activeGroup && expenses.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-sm text-on-surface-variant">
                      No expenses logged yet in this group. Click &quot;Add Expense&quot; above to log the first bill.
                    </td>
                  </tr>
                )}
                {expenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-surface-container-lowest transition-colors group">
                    <td className="py-unit-md font-body-sm text-[14px] text-on-surface-variant">{expense.date}</td>
                    <td className="py-unit-md">
                      <div className="font-body-md text-[15px] font-medium text-on-surface">
                        {expense.description}
                      </div>
                      <div className="font-label-sm text-[12px] text-on-surface-variant flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="sm:hidden">Paid by {expense.paidBy} •</span>
                        <span className="inline-flex items-center text-[11px] text-primary bg-primary/10 px-1.5 py-0.2 rounded font-medium">
                          Equal Split ({formatCurrency(expense.amount / (expense.splits?.length || groupMembers.length || 1))}/person)
                        </span>
                      </div>
                    </td>
                    <td className="py-unit-md hidden sm:table-cell">
                      <div className="flex items-center space-x-2">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${
                            expense.isYou
                              ? "bg-primary-container text-on-primary-container"
                              : "bg-surface-container text-on-surface"
                          }`}
                        >
                          {expense.paidBy.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-body-sm text-[14px] text-on-surface">{expense.paidBy}</span>
                      </div>
                    </td>
                    <td className="py-unit-md text-right font-label-md text-[14px] font-semibold text-on-surface">
                      ₹{expense.amount.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* FAB (Mobile Only) */}
      <button
        onClick={() => setShowCreateGroupModal(true)}
        className="md:hidden fixed bottom-6 right-6 bg-primary text-on-primary w-14 h-14 rounded-full shadow-lg flex items-center justify-center hover:scale-105 transition-transform z-50 cursor-pointer"
      >
        <span className="material-symbols-outlined text-2xl">group_add</span>
      </button>

      {/* Settle All Balances Modal */}
      {showSettlementModal && (
        <div className="fixed inset-0 bg-on-background/25 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-surface rounded-xl shadow-2xl p-unit-xl relative luminous-border">
            <button
              onClick={() => setShowSettlementModal(false)}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface focus:outline-none cursor-pointer"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[24px]">handshake</span>
              </div>
              <div>
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                  Settle Group Balances
                </h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Optimized peer-to-peer settlement plan
                </p>
              </div>
            </div>

            {settlementTransfers.length === 0 ? (
              <div className="my-6 p-6 rounded-lg bg-surface-container-low text-center text-on-surface-variant">
                <span className="material-symbols-outlined text-[36px] text-primary mb-2">check_circle</span>
                <p className="font-label-md text-[15px] font-semibold text-on-surface">
                  All debts are already settled!
                </p>
                <p className="font-body-sm text-xs mt-1">
                  Everyone has contributed their equal share of group expenses.
                </p>
              </div>
            ) : (
              <div className="my-4 space-y-3">
                <p className="font-body-sm text-[13px] text-on-surface-variant">
                  To balance all debts with minimum transactions, execute the following transfers:
                </p>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {settlementTransfers.map((t, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/30 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-on-surface">{t.fromName}</span>
                        <span className="material-symbols-outlined text-primary text-[16px]">arrow_forward</span>
                        <span className="font-semibold text-on-surface">{t.toName}</span>
                      </div>
                      <span className="font-headline-sm text-[16px] font-bold text-primary">
                        {formatCurrency(t.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-3">
              <button
                type="button"
                onClick={() => setShowSettlementModal(false)}
                className="w-1/2 py-2.5 border border-outline-variant text-on-surface font-label-md text-label-md rounded-lg hover:bg-surface-container transition-colors cursor-pointer"
              >
                {t("expenses_modal_cancel") || "Close"}
              </button>
              <button
                type="button"
                disabled={isSettling}
                onClick={handleConfirmSettlement}
                className="w-1/2 py-2.5 bg-primary text-on-primary font-label-md text-label-md rounded-lg shadow-sm hover:opacity-95 transition-opacity font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSettling ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                    Settling...
                  </>
                ) : (
                  t("groups_settle_confirm_btn") || "Confirm Settlement"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 bg-on-background/25 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface rounded-xl shadow-2xl p-unit-xl relative border border-outline-variant/30 luminous-border">
            <button
              onClick={() => setShowCreateGroupModal(false)}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface focus:outline-none cursor-pointer"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold mb-4">
              {t("groups_create_modal_title") || "Create New Group"}
            </h3>
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block font-label-md text-label-md text-on-surface mb-1" htmlFor="groupName">
                  {t("groups_create_name_label") || "Group Name"}
                </label>
                <input
                  required
                  id="groupName"
                  type="text"
                  placeholder={t("groups_create_name_placeholder") || "e.g. Goa Trip 2026"}
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent font-body-sm text-body-sm"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-primary text-on-primary font-label-md text-label-md rounded-lg shadow-sm hover:opacity-95 transition-opacity mt-4 font-bold cursor-pointer"
              >
                {t("groups_create_btn") || "Create Group"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      {showAddExpenseModal && (
        <div className="fixed inset-0 bg-on-background/25 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-surface rounded-xl shadow-2xl p-unit-xl relative border border-outline-variant/30 luminous-border">
            <button
              onClick={() => setShowAddExpenseModal(false)}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface focus:outline-none cursor-pointer"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[24px]">receipt_long</span>
              </div>
              <div>
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                  {t("expenses_modal_add_title") || "Add Group Expense"}
                </h3>
                <p className="font-body-sm text-xs text-on-surface-variant">
                  Shared cost split equally among group members
                </p>
              </div>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-4">
              <div>
                <label className="block font-label-md text-label-md text-on-surface mb-1" htmlFor="expDesc">
                  {t("expenses_modal_notes_label") || "Description"}
                </label>
                <input
                  required
                  id="expDesc"
                  type="text"
                  placeholder="e.g. Dinner at Seaside"
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent font-body-sm text-body-sm"
                  value={newExpenseDesc}
                  onChange={(e) => setNewExpenseDesc(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-label-md text-label-md text-on-surface mb-1" htmlFor="expAmount">
                    {t("expenses_modal_amount_label") || "Total Amount (₹)"}
                  </label>
                  <input
                    required
                    id="expAmount"
                    type="number"
                    step="0.01"
                    placeholder="e.g. 1000"
                    className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent font-body-sm text-body-sm"
                    value={newExpenseAmount}
                    onChange={(e) => setNewExpenseAmount(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block font-label-md text-label-md text-on-surface mb-1" htmlFor="expPayer">
                    Paid By
                  </label>
                  <select
                    id="expPayer"
                    className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent font-body-sm text-body-sm"
                    value={newExpensePayerId || userId || ""}
                    onChange={(e) => setNewExpensePayerId(e.target.value)}
                  >
                    {groupMembers.map((m) => (
                      <option key={m.profileId} value={m.profileId}>
                        {m.name} {m.profileId === userId ? "(You)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Real-time Split Breakdown */}
              <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/30 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-on-surface flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary text-[16px]">call_split</span>
                    Split Equally ({selectedParticipantIds.length} of {groupMembers.length} members)
                  </span>
                  <button
                    type="button"
                    onClick={selectAllParticipants}
                    className="text-primary hover:underline text-[11px] font-medium"
                  >
                    Select All
                  </button>
                </div>

                {/* Participant checkboxes with calculated share */}
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {groupMembers.map((m) => {
                    const isChecked = selectedParticipantIds.includes(m.profileId);
                    const share = currentSplits.find((s) => s.profileId === m.profileId);
                    return (
                      <label
                        key={m.profileId}
                        className="flex items-center justify-between p-2 rounded-lg bg-surface hover:bg-surface-container transition-colors cursor-pointer text-xs border border-outline-variant/20"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleParticipant(m.profileId)}
                            className="rounded text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                          />
                          <span className="font-medium text-on-surface">
                            {m.name} {m.profileId === userId ? "(You)" : ""}
                          </span>
                        </div>
                        {isChecked && share ? (
                          <span className="font-bold text-primary">{formatCurrency(share.shareAmount)}</span>
                        ) : (
                          <span className="text-[11px] text-on-surface-variant">Excluded</span>
                        )}
                      </label>
                    );
                  })}
                </div>

                {/* Clear summary of who owes what */}
                {currentExpenseAmount > 0 && currentSplits.length > 0 && (
                  <div className="pt-2 border-t border-outline-variant/20 text-[11px] text-on-surface-variant leading-relaxed">
                    💡 Total <strong>{formatCurrency(currentExpenseAmount)}</strong> paid by{" "}
                    <strong>
                      {groupMembers.find((m) => m.profileId === (newExpensePayerId || userId))?.name || "Payer"}
                    </strong>
                    . Each participant&apos;s equal share is{" "}
                    <strong>{formatCurrency(currentSplits[0].shareAmount)}</strong>. Other members owe{" "}
                    <strong>{formatCurrency(currentSplits[0].shareAmount)}</strong> each.
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={selectedParticipantIds.length === 0 || !newExpenseAmount || parseFloat(newExpenseAmount) <= 0}
                className="w-full py-3 bg-primary text-on-primary font-label-md text-label-md rounded-lg shadow-sm hover:opacity-95 transition-opacity mt-4 font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t("expenses_modal_save") || "Add Expense"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <div className="fixed inset-0 bg-on-background/25 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface rounded-xl shadow-2xl p-unit-xl relative border border-outline-variant/30 luminous-border">
            <button
              onClick={() => setShowAddMemberModal(false)}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface focus:outline-none cursor-pointer"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold mb-4">
              {t("groups_add_member_title") || "Add Group Member"}
            </h3>
            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="block font-label-md text-label-md text-on-surface mb-1" htmlFor="memberEmail">
                  {t("groups_add_member_email_label") || "User Email Address"}
                </label>
                <input
                  required
                  id="memberEmail"
                  type="email"
                  placeholder="e.g. user@example.com"
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent font-body-sm text-body-sm"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-primary text-on-primary font-label-md text-label-md rounded-lg shadow-sm hover:opacity-95 transition-opacity mt-4 font-bold cursor-pointer"
              >
                {t("groups_add_member_btn") || "Add Member"}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
