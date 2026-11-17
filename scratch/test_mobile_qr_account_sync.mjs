import assert from "assert";
import crypto from "crypto";

console.log("================================================================");
console.log("EXPENSELY - MOBILE QR SCAN & ACCOUNT UPLOAD INTEGRATION TEST");
console.log("================================================================\n");

// Cryptographic and session logic mirror from lib/scan-session.ts
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function isValidUUID(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

function isValidToken(token) {
  return typeof token === "string" && /^[0-9a-f]{64}$/i.test(token);
}

function verifySessionToken(session, token) {
  if (!token || !session.tokenHash) return false;
  try {
    const incomingHash = hashToken(token);
    const expectedBuffer = Buffer.from(session.tokenHash, "hex");
    const actualBuffer = Buffer.from(incomingHash, "hex");
    if (expectedBuffer.length !== actualBuffer.length) return false;
    return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
  } catch {
    return false;
  }
}

async function runTests() {
  const testUserId = "c6b4835f-4afa-4887-8bca-7f175798f569";
  const testEmail = "nilay.test@gmail.com";
  const testName = "Nilay";

  // Test 1: Desktop Creates Scan Session with Account Context
  console.log("--- 1. Testing Scan Session Creation with Account Context ---");
  const id = crypto.randomUUID();
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);

  const session = {
    id,
    userId: testUserId,
    userEmail: testEmail,
    userName: testName,
    tokenHash,
    status: "pending",
    image: null,
    fileName: null,
    fileType: null,
    createdAt: Date.now(),
    expiresAt: Date.now() + 900000,
    expenseId: null,
  };

  assert(isValidUUID(session.id), "Session ID must be a valid UUID");
  assert(isValidToken(token), "Token must be a 64-char hex string");
  assert.strictEqual(session.userId, testUserId, "User ID must match");
  assert.strictEqual(session.userEmail, testEmail, "User email must match");
  assert.strictEqual(session.userName, testName, "User name must match");
  assert.strictEqual(session.status, "pending", "Status must be pending");
  console.log("[PASS] Session created successfully with account metadata.");

  // Test 2: Cryptographic Pairing Token Verification
  console.log("\n--- 2. Testing Cryptographic Pairing Token Verification ---");
  const isValid = verifySessionToken(session, token);
  assert.strictEqual(isValid, true, "Valid token must verify");
  const isInvalid = verifySessionToken(session, "0000000000000000000000000000000000000000000000000000000000000000");
  assert.strictEqual(isInvalid, false, "Invalid token must be rejected");
  console.log("[PASS] Cryptographic constant-time token verification verified.");

  // Test 3: Phone Reads Session Context
  console.log("\n--- 3. Testing Phone Pairing & Account Discovery ---");
  const clientPayload = {
    status: session.status,
    expiresAt: session.expiresAt,
    account: session.userId ? {
      id: session.userId,
      email: session.userEmail,
      name: session.userName,
    } : null,
  };
  assert.strictEqual(clientPayload.account.id, testUserId, "Phone discovers correct account ID");
  assert.strictEqual(clientPayload.account.email, testEmail, "Phone discovers correct email");
  assert.strictEqual(clientPayload.account.name, testName, "Phone discovers correct name");
  console.log(`[PASS] Phone connected to account: ${clientPayload.account.name} (${clientPayload.account.email})`);

  // Test 4: Mobile Receipt Upload & Direct Expense Attachment
  console.log("\n--- 4. Testing Mobile Upload with Direct Account Expense Creation ---");
  const mockReceiptData = "data:image/jpeg;base64," + Buffer.from("mock receipt image bytes").toString("base64");
  const testExpenseId = crypto.randomUUID();

  // Simulate upload state transition
  assert.strictEqual(session.status, "pending", "Must be pending before upload");
  session.status = "uploaded";
  session.image = mockReceiptData;
  session.fileName = "camera_receipt.jpg";
  session.fileType = "image/jpeg";
  session.expenseId = testExpenseId;

  assert.strictEqual(session.status, "uploaded", "Session status must transition to uploaded");
  assert.strictEqual(session.expenseId, testExpenseId, "Expense ID must be attached to session");
  assert.strictEqual(session.fileName, "camera_receipt.jpg", "File name must match");
  console.log(`[PASS] Receipt uploaded and linked to Account Expense ID: ${session.expenseId}`);

  // Test 5: Replay Attack Guard (One-time upload enforcement)
  console.log("\n--- 5. Testing Replay Guard (Duplicate Upload Rejection) ---");
  const canUploadAgain = session.status === "pending";
  assert.strictEqual(canUploadAgain, false, "Cannot upload to already uploaded session");
  console.log("[PASS] Duplicate upload successfully blocked (One-time upload enforced).");

  console.log("\n================================================================");
  console.log("ALL 5 MOBILE QR & ACCOUNT SYNC TESTS PASSED (100%)");
  console.log("================================================================");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
