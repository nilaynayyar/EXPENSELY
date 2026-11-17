import assert from "node:assert";
import {
  calculateEqualSplits,
  computeGroupBalances,
  simplifyDebts,
} from "../lib/group-calculations.ts";

console.log("===============================================================================");
console.log("EXPENSELY — SUITE OF 10 COMPREHENSIVE GROUP SPLITTING & SETTLEMENT TESTS");
console.log("===============================================================================\n");

let passed = 0;
let total = 10;

function runTest(name, fn) {
  try {
    fn();
    passed++;
    console.log(`[PASS] Test ${passed}: ${name}`);
  } catch (err) {
    console.error(`[FAIL] Test: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// -----------------------------------------------------------------------------
// Test 1: Two members, one expense
// Member A pays ₹1,000. Member B owes ₹500 (NEVER the full ₹1,000).
// -----------------------------------------------------------------------------
runTest("Two members, one expense (Member A pays ₹1,000)", () => {
  const members = [
    { profileId: "user-a", name: "Member A" },
    { profileId: "user-b", name: "Member B" },
  ];
  const expenses = [
    { id: "exp-1", payer_id: "user-a", amount: 1000 },
  ];

  const balances = computeGroupBalances(members, expenses);
  const balA = balances.find((b) => b.profileId === "user-a");
  const balB = balances.find((b) => b.profileId === "user-b");

  assert.strictEqual(balA.totalPaid, 1000, "Member A total paid should be 1000");
  assert.strictEqual(balA.totalShare, 500, "Member A total share should be 500");
  assert.strictEqual(balA.netBalance, 500, "Member A should be owed +500");
  assert.strictEqual(balA.status, "gets_back");

  assert.strictEqual(balB.totalPaid, 0, "Member B total paid should be 0");
  assert.strictEqual(balB.totalShare, 500, "Member B total share should be 500");
  assert.strictEqual(balB.netBalance, -500, "Member B owes -500 (NOT full 1000!)");
  assert.strictEqual(balB.status, "owes");

  const transfers = simplifyDebts(balances);
  assert.strictEqual(transfers.length, 1);
  assert.strictEqual(transfers[0].fromId, "user-b");
  assert.strictEqual(transfers[0].toId, "user-a");
  assert.strictEqual(transfers[0].amount, 500);
});

// -----------------------------------------------------------------------------
// Test 2: Two members, multiple expenses paid by different members
// Dinner (A: 1000), Taxi (B: 400), Groceries (A: 600) -> Total 2000.
// A paid 1600, B paid 400. Share is 1000 each. A gets back 600, B owes 600.
// -----------------------------------------------------------------------------
runTest("Two members, multiple expenses paid by different members", () => {
  const members = [
    { profileId: "user-a", name: "Member A" },
    { profileId: "user-b", name: "Member B" },
  ];
  const expenses = [
    { id: "exp-1", payer_id: "user-a", amount: 1000, description: "Dinner" },
    { id: "exp-2", payer_id: "user-b", amount: 400, description: "Taxi" },
    { id: "exp-3", payer_id: "user-a", amount: 600, description: "Groceries" },
  ];

  const balances = computeGroupBalances(members, expenses);
  const balA = balances.find((b) => b.profileId === "user-a");
  const balB = balances.find((b) => b.profileId === "user-b");

  assert.strictEqual(balA.totalPaid, 1600);
  assert.strictEqual(balA.totalShare, 1000);
  assert.strictEqual(balA.netBalance, 600);
  assert.strictEqual(balA.status, "gets_back");

  assert.strictEqual(balB.totalPaid, 400);
  assert.strictEqual(balB.totalShare, 1000);
  assert.strictEqual(balB.netBalance, -600);
  assert.strictEqual(balB.status, "owes");

  const transfers = simplifyDebts(balances);
  assert.strictEqual(transfers.length, 1);
  assert.strictEqual(transfers[0].fromId, "user-b");
  assert.strictEqual(transfers[0].toId, "user-a");
  assert.strictEqual(transfers[0].amount, 600);
});

// -----------------------------------------------------------------------------
// Test 3: Three members with equal splitting
// Dinner ₹900 paid by Member A -> ₹300 each.
// B owes A ₹300, C owes A ₹300.
// -----------------------------------------------------------------------------
runTest("Three members with equal splitting", () => {
  const members = [
    { profileId: "user-a", name: "Member A" },
    { profileId: "user-b", name: "Member B" },
    { profileId: "user-c", name: "Member C" },
  ];
  const expenses = [
    { id: "exp-1", payer_id: "user-a", amount: 900 },
  ];

  const balances = computeGroupBalances(members, expenses);
  const balA = balances.find((b) => b.profileId === "user-a");
  const balB = balances.find((b) => b.profileId === "user-b");
  const balC = balances.find((b) => b.profileId === "user-c");

  assert.strictEqual(balA.netBalance, 600);
  assert.strictEqual(balB.netBalance, -300);
  assert.strictEqual(balC.netBalance, -300);

  const transfers = simplifyDebts(balances);
  assert.strictEqual(transfers.length, 2);
  const sumTransfers = transfers.reduce((acc, t) => acc + t.amount, 0);
  assert.strictEqual(sumTransfers, 600);
});

// -----------------------------------------------------------------------------
// Test 4: Four members with equal splitting
// Expense ₹1,200 paid by Member A. Each share = ₹300.
// Expense ₹400 paid by Member B. Each share = ₹100.
// Cumulative: A paid 1200, B paid 400, C paid 0, D paid 0.
// Total share = 400 each.
// Balances: A: +800, B: 0, C: -400, D: -400.
// -----------------------------------------------------------------------------
runTest("Four members with equal splitting", () => {
  const members = [
    { profileId: "user-a", name: "Member A" },
    { profileId: "user-b", name: "Member B" },
    { profileId: "user-c", name: "Member C" },
    { profileId: "user-d", name: "Member D" },
  ];
  const expenses = [
    { id: "exp-1", payer_id: "user-a", amount: 1200 },
    { id: "exp-2", payer_id: "user-b", amount: 400 },
  ];

  const balances = computeGroupBalances(members, expenses);
  const balA = balances.find((b) => b.profileId === "user-a");
  const balB = balances.find((b) => b.profileId === "user-b");
  const balC = balances.find((b) => b.profileId === "user-c");
  const balD = balances.find((b) => b.profileId === "user-d");

  assert.strictEqual(balA.totalPaid, 1200);
  assert.strictEqual(balA.totalShare, 400);
  assert.strictEqual(balA.netBalance, 800);

  assert.strictEqual(balB.totalPaid, 400);
  assert.strictEqual(balB.totalShare, 400);
  assert.strictEqual(balB.netBalance, 0);
  assert.strictEqual(balB.status, "settled");

  assert.strictEqual(balC.totalPaid, 0);
  assert.strictEqual(balC.totalShare, 400);
  assert.strictEqual(balC.netBalance, -400);

  assert.strictEqual(balD.totalPaid, 0);
  assert.strictEqual(balD.totalShare, 400);
  assert.strictEqual(balD.netBalance, -400);

  const transfers = simplifyDebts(balances);
  assert.strictEqual(transfers.length, 2);
  assert.strictEqual(transfers.every((t) => t.toId === "user-a"), true);
});

// -----------------------------------------------------------------------------
// Test 5: Expenses with amounts that do not divide evenly (Paise rounding)
// ₹100 split 3 ways -> 33.34, 33.33, 33.33. Sum === 100.00 EXACTLY.
// -----------------------------------------------------------------------------
runTest("Expenses with amounts that do not divide evenly (Paise rounding)", () => {
  const splits = calculateEqualSplits(100, ["p1", "p2", "p3"]);
  assert.strictEqual(splits.length, 3);
  assert.strictEqual(splits[0].shareAmount, 33.34);
  assert.strictEqual(splits[1].shareAmount, 33.33);
  assert.strictEqual(splits[2].shareAmount, 33.33);

  const sum = splits.reduce((acc, s) => acc + s.shareAmount, 0);
  assert.strictEqual(Math.round(sum * 100), 10000, "Sum of shares must equal original expense amount in paise");

  // Also test 1000 paise / 7
  const splits7 = calculateEqualSplits(10, ["1", "2", "3", "4", "5", "6", "7"]);
  const sum7 = splits7.reduce((acc, s) => acc + s.shareAmount, 0);
  assert.strictEqual(Math.round(sum7 * 100), 1000);
});

// -----------------------------------------------------------------------------
// Test 6: Multiple members paying different expenses
// Member A pays 500, Member B pays 300, Member C pays 200. Total 1000.
// Equal share = 333.34, 333.33, 333.33.
// -----------------------------------------------------------------------------
runTest("Multiple members paying different expenses", () => {
  const members = [
    { profileId: "user-a", name: "Member A" },
    { profileId: "user-b", name: "Member B" },
    { profileId: "user-c", name: "Member C" },
  ];
  const expenses = [
    { id: "e1", payer_id: "user-a", amount: 500 },
    { id: "e2", payer_id: "user-b", amount: 300 },
    { id: "e3", payer_id: "user-c", amount: 200 },
  ];

  const balances = computeGroupBalances(members, expenses);
  const balA = balances.find((b) => b.profileId === "user-a");
  const balB = balances.find((b) => b.profileId === "user-b");
  const balC = balances.find((b) => b.profileId === "user-c");

  const sumNet = balA.netBalance + balB.netBalance + balC.netBalance;
  assert.strictEqual(Math.abs(sumNet) < 0.001, true, "Conservation of money: sum of net balances must be 0");
  assert.strictEqual(balA.netBalance > 0, true);
  assert.strictEqual(balC.netBalance < 0, true);
});

// -----------------------------------------------------------------------------
// Test 7: Partial settlements
// A pays 1000 for A and B. B owes 500. B pays partial settlement of 200 to A.
// B now owes 300. A is owed 300.
// -----------------------------------------------------------------------------
runTest("Partial settlements", () => {
  const members = [
    { profileId: "user-a", name: "Member A" },
    { profileId: "user-b", name: "Member B" },
  ];
  const expenses = [
    { id: "e1", payer_id: "user-a", amount: 1000 },
  ];
  const settlements = [
    { from_profile_id: "user-b", to_profile_id: "user-a", amount: 200 },
  ];

  const balances = computeGroupBalances(members, expenses, settlements);
  const balA = balances.find((b) => b.profileId === "user-a");
  const balB = balances.find((b) => b.profileId === "user-b");

  assert.strictEqual(balA.netBalance, 300, "A should now only be owed 300 after 200 partial settlement");
  assert.strictEqual(balB.netBalance, -300, "B should now only owe 300 after 200 partial settlement");

  const transfers = simplifyDebts(balances);
  assert.strictEqual(transfers.length, 1);
  assert.strictEqual(transfers[0].amount, 300);
});

// -----------------------------------------------------------------------------
// Test 8: Fully settled groups
// A pays 1000 for A and B. B settles 500.
// All net balances must be 0, simplifyDebts must return empty array.
// -----------------------------------------------------------------------------
runTest("Fully settled groups", () => {
  const members = [
    { profileId: "user-a", name: "Member A" },
    { profileId: "user-b", name: "Member B" },
  ];
  const expenses = [
    { id: "e1", payer_id: "user-a", amount: 1000 },
  ];
  const settlements = [
    { from_profile_id: "user-b", to_profile_id: "user-a", amount: 500 },
  ];

  const balances = computeGroupBalances(members, expenses, settlements);
  const balA = balances.find((b) => b.profileId === "user-a");
  const balB = balances.find((b) => b.profileId === "user-b");

  assert.strictEqual(balA.netBalance, 0);
  assert.strictEqual(balA.status, "settled");
  assert.strictEqual(balB.netBalance, 0);
  assert.strictEqual(balB.status, "settled");

  const transfers = simplifyDebts(balances);
  assert.strictEqual(transfers.length, 0, "No transfers needed for fully settled group");
});

// -----------------------------------------------------------------------------
// Test 9: Adding a new expense after an earlier settlement
// A pays 1000. B settles 500 (both at 0).
// Then B pays 400 for Taxi (share 200 each).
// A now owes B 200! B is owed 200!
// -----------------------------------------------------------------------------
runTest("Adding a new expense after an earlier settlement", () => {
  const members = [
    { profileId: "user-a", name: "Member A" },
    { profileId: "user-b", name: "Member B" },
  ];
  const expenses = [
    { id: "e1", payer_id: "user-a", amount: 1000, description: "Dinner" },
    { id: "e2", payer_id: "user-b", amount: 400, description: "Taxi" },
  ];
  const settlements = [
    { from_profile_id: "user-b", to_profile_id: "user-a", amount: 500 },
  ];

  const balances = computeGroupBalances(members, expenses, settlements);
  const balA = balances.find((b) => b.profileId === "user-a");
  const balB = balances.find((b) => b.profileId === "user-b");

  assert.strictEqual(balA.netBalance, -200, "A should now owe 200 to B");
  assert.strictEqual(balA.status, "owes");

  assert.strictEqual(balB.netBalance, 200, "B should now be owed 200 from A");
  assert.strictEqual(balB.status, "gets_back");

  const transfers = simplifyDebts(balances);
  assert.strictEqual(transfers.length, 1);
  assert.strictEqual(transfers[0].fromId, "user-a");
  assert.strictEqual(transfers[0].toId, "user-b");
  assert.strictEqual(transfers[0].amount, 200);
});

// -----------------------------------------------------------------------------
// Test 10: Preventing duplicate settlements / Idempotent handling
// Deduplication of participants & handling zero/invalid expense inputs
// -----------------------------------------------------------------------------
runTest("Edge cases: duplicate participant IDs, zero amount, negative amount", () => {
  // Deduplication check
  const splitsWithDupes = calculateEqualSplits(600, ["u1", "u2", "u1"]);
  assert.strictEqual(splitsWithDupes.length, 2, "Duplicate participant IDs must be deduplicated");
  assert.strictEqual(splitsWithDupes[0].shareAmount, 300);
  assert.strictEqual(splitsWithDupes[1].shareAmount, 300);

  // Zero / negative amounts check
  assert.deepStrictEqual(calculateEqualSplits(0, ["u1"]), []);
  assert.deepStrictEqual(calculateEqualSplits(-100, ["u1"]), []);
  assert.deepStrictEqual(calculateEqualSplits(100, []), []);

  // Balancing dummy rows (description: "All balances settled", amount: 0) are ignored
  const members = [{ profileId: "u1", name: "U1" }];
  const dummyExpenses = [{ id: "d1", payer_id: "u1", amount: 0, description: "All balances settled" }];
  const bal = computeGroupBalances(members, dummyExpenses);
  assert.strictEqual(bal[0].totalPaid, 0);
  assert.strictEqual(bal[0].netBalance, 0);
});

console.log(`\n===============================================================================`);
console.log(`ALL ${passed}/${total} UNIT TESTS PASSED SUCCESSFULLY!`);
console.log(`===============================================================================\n`);
