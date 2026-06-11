"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { useLanguage } from "@/components/LanguageProvider";

type Group = {
  id: string;
  name: string;
  members: number;
  icon: string;
  iconBg: string;
  iconColor: string;
};

export default function GroupsPage() {
  const { language } = useLanguage();
  const translations: Record<string, string> = {
    "English (US)": "Group Expenses",
    "English (UK)": "Group Expenses",
    "Hindi": "समूह के खर्च",
    "Spanish": "Gastos del Grupo",
    "French": "Dépenses de Groupe",
  };
  const pageTitle = translations[language] || translations["English (US)"];

  const [activeGroup, setActiveGroup] = useState<string>("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [balances, setBalances] = useState<{profileId: string, name: string, paid: number, balance: number}[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [newExpenseDesc, setNewExpenseDesc] = useState("");
  const [newExpenseAmount, setNewExpenseAmount] = useState("");
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState("");

  const fetchData = useCallback(async () => {
    const supabase = createClient();
    setError(null);
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) { console.error('[Groups] Session error:', sessionError); setError("Authentication error. Please sign in again."); return; }
    if (!session) return;
    setUserId(session.user.id);

    // Fetch groups where user is a member
    const { data: memberGroups, error: memberError } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('profile_id', session.user.id);

    if (memberError) { console.error('[Groups] group_members fetch error:', memberError); setError("Failed to fetch group membership."); return; }
    if (!memberGroups || memberGroups.length === 0) {
      setGroups([]);
      return;
    }
    
    const groupIds = memberGroups.map(mg => mg.group_id);
    
    // Fetch group details and count members properly
    const { data: groupsData, error: groupsError } = await supabase
      .from('groups')
      .select('*, group_members(profile_id)')
      .in('id', groupIds);

    if (groupsError) { console.error('[Groups] groups fetch error:', groupsError); setError("Failed to fetch group details."); return; }

    if (groupsData && groupsData.length > 0) {
      const formattedGroups = groupsData.map((g: any, i: number) => ({
        id: g.id,
        name: g.name,
        members: g.group_members?.length || 0,
        icon: g.icon || "group",
        iconBg: g.icon_bg || ['bg-secondary-container', 'bg-tertiary-container', 'bg-surface-variant'][i % 3],
        iconColor: g.icon_color || ['text-on-secondary-container', 'text-on-tertiary-container', 'text-on-surface'][i % 3]
      }));
      setGroups(formattedGroups);
      if (!activeGroup && formattedGroups.length > 0) {
        setActiveGroup(formattedGroups[0].id);
      }
    } else {
      setGroups([]);
    }
  }, [activeGroup]);

  const fetchExpenses = useCallback(async () => {
    if (!activeGroup || !userId) return;
    const supabase = createClient();
    // Correctly join profiles on payer_id
    const { data: exps, error: expsError } = await supabase
      .from('group_expenses')
      .select('*, profiles(full_name)')
      .eq('group_id', activeGroup)
      .order('date', { ascending: false });

    if (expsError) { console.error('[Groups] group_expenses fetch error:', expsError); setError("Failed to fetch expenses."); return; }

    const { data: membersData, error: memError } = await supabase
      .from('group_members')
      .select('profile_id, profiles(full_name)')
      .eq('group_id', activeGroup);

    if (exps) {
      setExpenses(exps.map((e: any) => ({
        id: e.id,
        date: new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        description: e.description,
        paidBy: e.profiles?.full_name || 'Unknown',
        amount: `₹${Number(e.amount).toLocaleString()}`,
        isYou: e.payer_id === userId
      })));
    }

    if (!memError && membersData) {
      const totalMembers = membersData.length;
      let totalSpent = 0;
      const paidByProfile: Record<string, number> = {};
      
      membersData.forEach(m => {
        paidByProfile[m.profile_id] = 0;
      });
      // TODO: Move heavy client-side settlement math to a Supabase RPC or Postgres View for production scalability.
      (exps || []).forEach(e => {
        const amt = Number(e.amount);
        totalSpent += amt;
        if (paidByProfile[e.payer_id] !== undefined) {
          paidByProfile[e.payer_id] += amt;
        } else {
          paidByProfile[e.payer_id] = amt;
        }
      });
      
      const equalShare = totalMembers > 0 ? totalSpent / totalMembers : 0;
      
      const newBalances = membersData.map(m => {
        const paid = paidByProfile[m.profile_id] || 0;
        const bal = paid - equalShare;
        return {
          profileId: m.profile_id,
          name: (m.profiles as any)?.full_name || 'Unknown',
          paid: paid,
          balance: bal
        };
      });
      
      setBalances(newBalances);
    } else {
      setBalances([]);
    }
  }, [activeGroup, userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || !userId) return;

    const supabase = createClient();
    const { data: newGroup, error: insertError } = await supabase
      .from('groups')
      .insert([{
        name: newGroupName.trim(),
        created_by: userId,
        icon: "diversity_3",
        icon_bg: 'bg-primary-container',
        icon_color: 'text-on-primary-container'
      }])
      .select()
      .single();

    if (insertError) {
      alert("Failed to create group: " + insertError.message);
      return;
    }

    // Insert current user into group_members
    const { error: memberError } = await supabase
      .from('group_members')
      .insert([{
        group_id: newGroup.id,
        profile_id: userId
      }]);

    if (memberError) {
      console.error("Failed to add member:", memberError);
      alert("Failed to add member: " + memberError.message);
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

    const supabase = createClient();
    const { error: insertError } = await supabase
      .from('group_expenses')
      .insert([{
        group_id: activeGroup,
        payer_id: userId,
        description: newExpenseDesc.trim(),
        amount: amount,
        date: new Date().toISOString().split("T")[0]
      }]);

    if (insertError) {
      alert("Failed to add expense: " + insertError.message);
      return;
    }

    setShowAddExpenseModal(false);
    setNewExpenseDesc("");
    setNewExpenseAmount("");
    fetchExpenses();
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberEmail.trim() || !activeGroup) return;

    const supabase = createClient();
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', newMemberEmail.trim().toLowerCase());
      
    if (profileError || !profiles || profiles.length === 0) {
      alert("No user found with that email address.");
      return;
    }
    
    const memberId = profiles[0].id;
    const { error: insertError } = await supabase
      .from('group_members')
      .insert([{
        group_id: activeGroup,
        profile_id: memberId
      }]);
      
    if (insertError) {
      alert("Failed to add member. They might already be in the group.");
      return;
    }
    
    setShowAddMemberModal(false);
    setNewMemberEmail("");
    fetchData();
    fetchExpenses();
  };


  return (
    <main className="flex-1 p-unit-lg md:p-margin-page pb-32 max-w-[1440px] mx-auto w-full relative">
      {error && (
        <div className="mb-4 p-4 bg-error-container text-on-error-container rounded-lg border border-error/50 flex items-center justify-between">
          <p className="font-body-md text-[14px] font-medium">{error}</p>
          <button onClick={() => setError(null)} className="material-symbols-outlined text-[20px] hover:opacity-80">close</button>
        </div>
      )}
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-unit-md mb-unit-xl">
        <div>
          <h2 className="font-headline-lg-mobile md:font-headline-lg text-[28px] md:text-[32px] leading-[36px] md:leading-[40px] font-semibold text-on-surface">
            {pageTitle}
          </h2>
          <p className="font-body-md text-[16px] leading-[24px] text-on-surface-variant mt-unit-xs">
            Manage shared costs and settle up easily.
          </p>
        </div>
        <button 
          onClick={() => setShowCreateGroupModal(true)}
          className="hidden md:flex items-center justify-center bg-primary-container text-on-primary-container px-unit-lg py-unit-sm rounded-lg font-label-md text-[14px] hover:opacity-90 transition-opacity cursor-pointer"
        >
          <span className="material-symbols-outlined mr-2 text-sm">add</span>
          Create New Group
        </button>
      </div>

      {/* Bento Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-unit-lg">
        {/* Left Column */}
        <div className="lg:col-span-4 space-y-unit-lg">
          {/* Active Groups */}
          <div className="glass-card rounded-xl p-unit-md ambient-shadow">
            <h3 className="font-headline-sm text-[20px] font-semibold text-on-surface mb-unit-md">
              Active Groups
            </h3>
            <div className="space-y-2">
              {groups.length === 0 && (
                <div className="text-sm text-on-surface-variant p-2">You have not joined any groups.</div>
              )}
              {groups.map((group) => (
                <div
                  key={group.id}
                  onClick={() => setActiveGroup(group.id)}
                  className={`flex items-center justify-between p-unit-sm rounded-lg cursor-pointer transition-all ${
                    activeGroup === group.id
                      ? "bg-surface-container border border-primary/20"
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
                      <div className="font-label-md text-[14px] text-on-surface">{group.name}</div>
                      <div className="font-label-sm text-[12px] text-on-surface-variant">
                        {group.members} members
                      </div>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-on-surface-variant text-sm">
                    chevron_right
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Settlement Summary */}
          <div
            className="glass-card rounded-xl p-unit-lg relative overflow-hidden border-t-2 border-t-tertiary ambient-shadow"
          >
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-tertiary/10 rounded-full blur-2xl" />
            <div className="flex items-center space-x-unit-sm mb-unit-md">
              <span className="material-symbols-outlined text-tertiary">account_balance</span>
              <h3 className="font-headline-sm text-[20px] font-semibold text-on-surface">Settlement</h3>
            </div>
            <div className="space-y-unit-md">
              {!activeGroup && (
                <div className="text-sm text-on-surface-variant">Select a group to view settlement.</div>
              )}
              {activeGroup && balances.length === 0 && (
                <div className="text-sm text-on-surface-variant">No members found.</div>
              )}
              {balances.map(b => (
                <div key={b.profileId} className="flex justify-between items-center">
                  <div className="flex items-center space-x-unit-sm">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[12px] ${
                      b.balance >= 0 
                        ? 'bg-secondary-container text-on-secondary-container' 
                        : 'bg-error/10 text-error'
                    }`}>
                      {b.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-body-sm text-[14px] text-on-surface">
                        {b.name} {b.profileId === userId ? '(You)' : ''}
                      </span>
                      <span className="font-label-sm text-[10px] text-on-surface-variant">
                        Paid: ₹{b.paid.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <span className={`font-label-md text-[14px] ${b.balance >= 0 ? 'text-primary' : 'text-error'}`}>
                    {b.balance >= 0 ? '+' : ''}₹{b.balance.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            <button className="w-full mt-unit-lg py-unit-sm border border-outline-variant text-on-surface hover:bg-surface-container-lowest font-label-md text-[14px] rounded-lg transition-colors">
              Settle All Balances
            </button>
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
                {groups.find((g) => g.id === activeGroup)?.name || "Select a group"}
              </h3>
              {activeGroup && (
                <div className="flex items-center mt-2 space-x-2">
                  <span className="font-label-sm text-[12px] text-on-surface-variant">
                    {groups.find((g) => g.id === activeGroup)?.members} members
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
                  <th className="font-label-sm text-[12px] text-on-surface-variant pb-unit-sm uppercase tracking-wider font-normal">
                    Date
                  </th>
                  <th className="font-label-sm text-[12px] text-on-surface-variant pb-unit-sm uppercase tracking-wider font-normal">
                    Description
                  </th>
                  <th className="font-label-sm text-[12px] text-on-surface-variant pb-unit-sm uppercase tracking-wider font-normal hidden sm:table-cell">
                    Paid By
                  </th>
                  <th className="font-label-sm text-[12px] text-on-surface-variant pb-unit-sm uppercase tracking-wider font-normal text-right">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {!activeGroup && (
                  <tr><td colSpan={4} className="py-4 text-center text-sm text-on-surface-variant">Select or create a group to view expenses.</td></tr>
                )}
                {activeGroup && expenses.length === 0 && (
                  <tr><td colSpan={4} className="py-4 text-center text-sm text-on-surface-variant">No expenses found for this group.</td></tr>
                )}
                {expenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-surface-container-lowest transition-colors group">
                    <td className="py-unit-md font-body-sm text-[14px] text-on-surface-variant">
                      {expense.date}
                    </td>
                    <td className="py-unit-md">
                      <div className="font-body-md text-[16px] text-on-surface">{expense.description}</div>
                      <div className="font-label-sm text-[12px] text-on-surface-variant sm:hidden">
                        Paid by {expense.paidBy}
                      </div>
                    </td>
                    <td className="py-unit-md hidden sm:table-cell">
                      <div className="flex items-center space-x-2">
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
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
                    <td className="py-unit-md text-right font-label-md text-[14px] text-on-surface">
                      {expense.amount}
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
        className="md:hidden fixed bottom-6 right-6 bg-primary-container text-on-primary-container w-14 h-14 rounded-full shadow-lg flex items-center justify-center hover:scale-105 transition-transform z-50 cursor-pointer"
      >
        <span className="material-symbols-outlined text-2xl">group_add</span>
      </button>

      {/* Create Group Modal */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 bg-on-background/25 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface rounded-xl shadow-2xl p-unit-xl relative border border-outline-variant/30">
            <button
              onClick={() => setShowCreateGroupModal(false)}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface focus:outline-none"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold mb-4">Create New Group</h3>
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block font-label-md text-label-md text-on-surface mb-1" htmlFor="groupName">
                  Group Name
                </label>
                <input
                  required
                  id="groupName"
                  type="text"
                  placeholder="e.g. Goa Trip 2026"
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent font-body-sm text-body-sm"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-primary text-on-primary font-label-md text-label-md rounded-lg shadow-sm hover:opacity-95 transition-opacity mt-4 font-bold"
              >
                Create Group
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      {showAddExpenseModal && (
        <div className="fixed inset-0 bg-on-background/25 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface rounded-xl shadow-2xl p-unit-xl relative border border-outline-variant/30">
            <button
              onClick={() => setShowAddExpenseModal(false)}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface focus:outline-none"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold mb-4">Add Group Expense</h3>
            <form onSubmit={handleAddExpense} className="space-y-4">
              <div>
                <label className="block font-label-md text-label-md text-on-surface mb-1" htmlFor="expDesc">
                  Description
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
              <div>
                <label className="block font-label-md text-label-md text-on-surface mb-1" htmlFor="expAmount">
                  Amount (₹)
                </label>
                <input
                  required
                  id="expAmount"
                  type="number"
                  placeholder="e.g. 1500"
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent font-body-sm text-body-sm"
                  value={newExpenseAmount}
                  onChange={(e) => setNewExpenseAmount(e.target.value)}
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-primary text-on-primary font-label-md text-label-md rounded-lg shadow-sm hover:opacity-95 transition-opacity mt-4 font-bold cursor-pointer"
              >
                Add Expense
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <div className="fixed inset-0 bg-on-background/25 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface rounded-xl shadow-2xl p-unit-xl relative border border-outline-variant/30">
            <button
              onClick={() => setShowAddMemberModal(false)}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface focus:outline-none cursor-pointer"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold mb-4">Add Group Member</h3>
            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="block font-label-md text-label-md text-on-surface mb-1" htmlFor="memberEmail">
                  User Email Address
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
                Add Member
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
