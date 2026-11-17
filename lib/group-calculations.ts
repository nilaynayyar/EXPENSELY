/**
 * EXPENSELY — Core Group Expense Splitting & Settlement Calculations
 *
 * Implements Splitwise-style equal cost sharing, per-expense individual shares,
 * integer-paise precision to prevent floating-point drift, and debt simplification.
 */

export interface ParticipantShare {
  profileId: string;
  shareAmount: number; // In currency units (e.g. rupees)
  sharePaise: number;  // In integer paise/cents
}

export interface GroupMemberInput {
  profileId: string;
  name: string;
}

export interface ExpenseSplitInput {
  profile_id: string;
  share_amount: number;
}

export interface GroupExpenseInput {
  id: string;
  payer_id: string;
  amount: number;
  description?: string;
  date?: string;
  splits?: ExpenseSplitInput[];
}

export interface GroupSettlementInput {
  id?: string;
  from_profile_id: string;
  to_profile_id: string;
  amount: number;
  settled_at?: string;
}

export interface MemberBalanceDetail {
  profileId: string;
  name: string;
  totalPaid: number;          // Total paid for purchases/bills
  totalShare: number;         // Total consumption/share liability
  settlementsPaid: number;    // Direct repayments sent to peers
  settlementsReceived: number;// Direct repayments received from peers
  netBalance: number;         // (totalPaid - totalShare) + (settlementsPaid - settlementsReceived)
  status: "owes" | "gets_back" | "settled";
}

export interface SettlementTransfer {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amount: number;
}

/**
 * Calculates equal cost shares across participants using integer paise arithmetic.
 * Any indivisible remainder paise (e.g. 1000 paise / 3 = 333 r 1) is distributed
 * deterministically across the first remainder participants so that:
 * SUM(shares) === totalAmount EXACTLY.
 */
export function calculateEqualSplits(
  totalAmount: number,
  participantIds: string[]
): ParticipantShare[] {
  if (!participantIds || participantIds.length === 0 || totalAmount <= 0) {
    return [];
  }

  // Deduplicate participant IDs while preserving order
  const uniqueIds = Array.from(new Set(participantIds));
  const N = uniqueIds.length;
  if (N === 0) return [];

  // Convert to integer paise (1 Rupee = 100 Paise)
  const totalPaise = Math.round(totalAmount * 100);
  const basePaise = Math.floor(totalPaise / N);
  const remainderPaise = totalPaise % N;

  const shares: ParticipantShare[] = [];
  let checksumPaise = 0;

  for (let i = 0; i < N; i++) {
    // Give 1 extra paise to the first `remainderPaise` participants
    const sharePaise = i < remainderPaise ? basePaise + 1 : basePaise;
    checksumPaise += sharePaise;
    shares.push({
      profileId: uniqueIds[i],
      shareAmount: sharePaise / 100,
      sharePaise,
    });
  }

  // Safety check: assert exact preservation of money
  if (checksumPaise !== totalPaise) {
    throw new Error(
      `[calculateEqualSplits] Invariant violation: checksum ${checksumPaise} != total ${totalPaise}`
    );
  }

  return shares;
}

/**
 * Computes net balances for all members across all group expenses and settlements.
 *
 * Formula for each member:
 * Net Balance = (Total Paid For Expenses - Total Expense Share)
 *             + (Total Settlements Paid - Total Settlements Received)
 *
 * Positive Net Balance = Member has paid more than their share -> Member should receive money.
 * Negative Net Balance = Member has paid less than their share -> Member owes money.
 * Zero Net Balance     = Member is fully settled.
 */
export function computeGroupBalances(
  members: GroupMemberInput[],
  expenses: GroupExpenseInput[],
  settlements: GroupSettlementInput[] = []
): MemberBalanceDetail[] {
  if (!members || members.length === 0) return [];

  const memberIds = members.map((m) => m.profileId);
  const memberMap = new Map<string, string>();
  members.forEach((m) => memberMap.set(m.profileId, m.name || "Member"));

  // Track all metrics in integer paise for precision
  const totalPaidPaise: Record<string, number> = {};
  const totalSharePaise: Record<string, number> = {};
  const settlementsPaidPaise: Record<string, number> = {};
  const settlementsReceivedPaise: Record<string, number> = {};

  memberIds.forEach((id) => {
    totalPaidPaise[id] = 0;
    totalSharePaise[id] = 0;
    settlementsPaidPaise[id] = 0;
    settlementsReceivedPaise[id] = 0;
  });

  // 1. Process Expenses
  for (const exp of expenses || []) {
    const rawAmt = Number(exp.amount);
    // Ignore invalid, non-positive, or legacy balancing placeholder rows
    if (isNaN(rawAmt) || rawAmt <= 0) continue;
    if (exp.description && exp.description.toLowerCase().includes("all balances settled")) {
      continue;
    }

    const amtPaise = Math.round(rawAmt * 100);

    // Credit payer
    if (totalPaidPaise[exp.payer_id] !== undefined) {
      totalPaidPaise[exp.payer_id] += amtPaise;
    }

    // Debit participants based on shares
    if (Array.isArray(exp.splits) && exp.splits.length > 0) {
      // Use explicit split records
      for (const split of exp.splits) {
        const splitPaise = Math.round(Number(split.share_amount) * 100);
        if (totalSharePaise[split.profile_id] !== undefined) {
          totalSharePaise[split.profile_id] += splitPaise;
        }
      }
    } else {
      // Legacy historical fallback: reconstruct equal shares among current group members
      const equalSplits = calculateEqualSplits(rawAmt, memberIds);
      for (const split of equalSplits) {
        if (totalSharePaise[split.profileId] !== undefined) {
          totalSharePaise[split.profileId] += split.sharePaise;
        }
      }
    }
  }

  // 2. Process Settlements
  for (const set of settlements || []) {
    const rawAmt = Number(set.amount);
    if (isNaN(rawAmt) || rawAmt <= 0) continue;
    const amtPaise = Math.round(rawAmt * 100);

    // The person who paid a settlement reduces their debt (credits their net balance)
    if (settlementsPaidPaise[set.from_profile_id] !== undefined) {
      settlementsPaidPaise[set.from_profile_id] += amtPaise;
    }

    // The person who received a settlement reduces what they are owed (debits their net balance)
    if (settlementsReceivedPaise[set.to_profile_id] !== undefined) {
      settlementsReceivedPaise[set.to_profile_id] += amtPaise;
    }
  }

  // 3. Assemble Final Member Balances
  return members.map((m) => {
    const paidPaise = totalPaidPaise[m.profileId] || 0;
    const sharePaise = totalSharePaise[m.profileId] || 0;
    const sPaidPaise = settlementsPaidPaise[m.profileId] || 0;
    const sRecPaise = settlementsReceivedPaise[m.profileId] || 0;

    const netPaise = (paidPaise - sharePaise) + (sPaidPaise - sRecPaise);
    const netBalance = netPaise / 100;

    let status: "owes" | "gets_back" | "settled" = "settled";
    if (netPaise > 0) {
      status = "gets_back";
    } else if (netPaise < 0) {
      status = "owes";
    }

    return {
      profileId: m.profileId,
      name: m.name || "Member",
      totalPaid: paidPaise / 100,
      totalShare: sharePaise / 100,
      settlementsPaid: sPaidPaise / 100,
      settlementsReceived: sRecPaise / 100,
      netBalance,
      status,
    };
  });
}

/**
 * Simplifies mutual debts into the minimum necessary peer-to-peer settlement transfers
 * using a greedy matching algorithm operating on integer paise.
 */
export function simplifyDebts(
  balances: MemberBalanceDetail[]
): SettlementTransfer[] {
  interface Party {
    id: string;
    name: string;
    paise: number;
  }

  const debtors: Party[] = [];
  const creditors: Party[] = [];

  balances.forEach((b) => {
    const paise = Math.round(b.netBalance * 100);
    if (paise < 0) {
      debtors.push({ id: b.profileId, name: b.name, paise: Math.abs(paise) });
    } else if (paise > 0) {
      creditors.push({ id: b.profileId, name: b.name, paise });
    }
  });

  const transfers: SettlementTransfer[] = [];
  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];
    const settlePaise = Math.min(debtor.paise, creditor.paise);

    if (settlePaise > 0) {
      transfers.push({
        fromId: debtor.id,
        fromName: debtor.name,
        toId: creditor.id,
        toName: creditor.name,
        amount: settlePaise / 100,
      });
    }

    debtor.paise -= settlePaise;
    creditor.paise -= settlePaise;

    if (debtor.paise === 0) dIdx++;
    if (creditor.paise === 0) cIdx++;
  }

  return transfers;
}
