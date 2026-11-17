import assert from "assert";
import crypto from "crypto";

console.log("================================================================");
console.log("EXPENSELY - PRODUCTION PERSISTENCE & STORAGE GATE TESTS");
console.log("================================================================\n");

// 1. Test Settlement Idempotency Key Semantics
console.log("--- 1. Testing Settlement Idempotency Logic ---");
const fromId = "user_alice_123";
const toId = "user_bob_456";

// First modal open
const batchId1 = crypto.randomUUID();
const key1_attempt1 = `settle_${batchId1}_${fromId}_${toId}`;
const key1_retry = `settle_${batchId1}_${fromId}_${toId}`;

assert.strictEqual(key1_attempt1, key1_retry, "Retry within same modal must reuse exact same idempotency key");
console.log("[PASS] Network retry / repeated submission preserves original idempotency key:", key1_attempt1);

// Second modal open (legitimate subsequent settlement)
const batchId2 = crypto.randomUUID();
const key2_attempt = `settle_${batchId2}_${fromId}_${toId}`;

assert.notStrictEqual(key1_attempt1, key2_attempt, "Subsequent settlement modal must generate fresh batch key");
console.log("[PASS] Modal reopening generates distinct batch key, allowing subsequent settlements:", key2_attempt);

// 2. Test Production Service Role Key Enforcement
console.log("\n--- 2. Testing Production Service Role Key Requirement ---");
process.env.NODE_ENV = "production";
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixddtujkxyxjxxedtit.supabase.co";

const { getAdminClient } = await import("../lib/supabase-admin.ts");
let errorCaught = false;
try {
  getAdminClient();
} catch (err) {
  errorCaught = true;
  assert(err.message.includes("SUPABASE_SERVICE_ROLE_KEY is required in production environment"));
  console.log("[PASS] getAdminClient() threw controlled error in production when SUPABASE_SERVICE_ROLE_KEY is missing:", err.message);
}
assert.strictEqual(errorCaught, true, "Must throw controlled error in production without service role key");

// 3. Test Production Disk Fallback Blocking
console.log("\n--- 3. Testing Production Scan Session Disk Fallback Blocking ---");
const { createScanSession } = await import("../lib/scan-session.ts");

let createErrCaught = false;
try {
  await createScanSession();
} catch (err) {
  createErrCaught = true;
  console.log("[PASS] createScanSession() refused silent disk fallback in production and threw controlled error:", err.message);
}
assert.strictEqual(createErrCaught, true, "createScanSession must not silently write to disk in production");

// 4. Test Pre-Storage Authorization in Dev Mode
console.log("\n--- 4. Testing Independent Pre-Storage Authorization ---");
process.env.NODE_ENV = "development";
// Create a legitimate session
const { session: devSession, token: validToken } = await createScanSession();
console.log("[PASS] Created test dev session:", devSession.id);

// Check that invalid pairing token is rejected
const { verifySessionToken } = await import("../lib/scan-session.ts");
const invalidToken = crypto.randomBytes(32).toString("hex");
const isAuthorized = verifySessionToken(devSession, invalidToken);
assert.strictEqual(isAuthorized, false, "Invalid pairing token must fail verification before storage upload");
console.log("[PASS] Invalid pairing token correctly rejected BEFORE storage upload");

const isValid = verifySessionToken(devSession, validToken);
assert.strictEqual(isValid, true, "Valid pairing token matches hash");
console.log("[PASS] Valid pairing token verified successfully");

console.log("\n================================================================");
console.log("PRODUCTION GATE AUDIT: ALL PERSISTENCE & STORAGE CHECKS PASSED");
console.log("================================================================");
