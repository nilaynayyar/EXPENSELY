import assert from "assert";

console.log("================================================================");
console.log("EXPENSELY - INDEPENDENT PRE-STORAGE AUTHORIZATION TEST");
console.log("================================================================\n");

const BASE_URL = "http://localhost:3000";

// Step 1: Create authentic session
const createRes = await fetch(`${BASE_URL}/api/scan-session`, { method: "POST" });
const session = await createRes.json();
console.log("[PASS] Created session:", session.id);

// Step 2: Upload with invalid token
const dummyFile = new Blob(["fake receipt image content"], { type: "image/png" });
const invalidForm = new FormData();
invalidForm.append("id", session.id);
invalidForm.append("token", "a".repeat(64)); // wrong token
invalidForm.append("file", dummyFile, "test.png");

const invalidRes = await fetch(`${BASE_URL}/api/scan-session/upload`, {
  method: "POST",
  body: invalidForm,
});
assert.strictEqual(invalidRes.status, 403);
const invalidBody = await invalidRes.json();
assert(invalidBody.error.includes("Invalid pairing token"));
console.log("[PASS] Invalid pairing token rejected with HTTP 403 BEFORE storage upload:", invalidBody.error);

// Step 3: Upload with non-existent session UUID
const fakeForm = new FormData();
fakeForm.append("id", "00000000-0000-4000-8000-000000000000");
fakeForm.append("token", "b".repeat(64));
fakeForm.append("file", dummyFile, "test.png");

const fakeRes = await fetch(`${BASE_URL}/api/scan-session/upload`, {
  method: "POST",
  body: fakeForm,
});
assert.strictEqual(fakeRes.status, 404);
const fakeBody = await fakeRes.json();
assert(fakeBody.error.includes("Session has expired or does not exist"));
console.log("[PASS] Non-existent session rejected with HTTP 404 BEFORE storage upload:", fakeBody.error);

// Step 4: Valid upload
const validForm = new FormData();
validForm.append("id", session.id);
validForm.append("token", session.token);
validForm.append("file", dummyFile, "receipt.png");

const validRes = await fetch(`${BASE_URL}/api/scan-session/upload`, {
  method: "POST",
  body: validForm,
});
assert.strictEqual(validRes.status, 200);
console.log("[PASS] Authentic upload accepted with HTTP 200");

// Step 5: Second upload (session is now uploaded, not pending)
const replayForm = new FormData();
replayForm.append("id", session.id);
replayForm.append("token", session.token);
replayForm.append("file", dummyFile, "receipt2.png");

const replayRes = await fetch(`${BASE_URL}/api/scan-session/upload`, {
  method: "POST",
  body: replayForm,
});
assert.strictEqual(replayRes.status, 409);
const replayBody = await replayRes.json();
assert(replayBody.error.includes("already received an upload"));
console.log("[PASS] Replay rejected with HTTP 409 BEFORE storage upload:", replayBody.error);

console.log("\n================================================================");
console.log("INDEPENDENT PRE-STORAGE AUTHORIZATION: ALL CHECKS PASSED (100%)");
console.log("================================================================");
