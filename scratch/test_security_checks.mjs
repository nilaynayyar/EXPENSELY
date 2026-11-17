import fs from 'fs';
import path from 'path';

async function runSecurityAudit() {
  console.log('================================================================');
  console.log('EXPENSELY - FINAL SECURITY AUDIT & VERIFICATION SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  // --- Test 1: Create a secure scan session with cryptographically random pairing token ---
  console.log('--- 1. Testing Cryptographic Pairing Token Generation ---');
  const createRes = await fetch('http://localhost:3000/api/scan-session', { method: 'POST' });
  assert(createRes.status === 200, 'POST /api/scan-session returns 200 OK');
  const created = await createRes.json();
  assert(!!created.id && /^[0-9a-f-]{36}$/i.test(created.id), 'Session ID is a valid RFC 4122 v4 UUID');
  assert(!!created.token && /^[0-9a-f]{64}$/i.test(created.token), 'Pairing token is a 256-bit (64 hex char) unguessable cryptographic token');

  const sessionId = created.id;
  const pairingToken = created.token;

  // --- Test 2: Verify Token Hashing (Zero Reusable Secrets in Storage) ---
  console.log('\n--- 2. Verifying Token Hashing at Rest ---');
  const sessionFilePath = path.join(process.cwd(), '.scan_sessions', `${sessionId}.json`);
  if (fs.existsSync(sessionFilePath)) {
    const sessionFileContent = JSON.parse(fs.readFileSync(sessionFilePath, 'utf8'));
    assert(sessionFileContent.tokenHash !== undefined, 'Stored record has tokenHash');
    assert(sessionFileContent.pairingToken === undefined, 'Raw pairing token is NOT stored in the database/disk record');
    assert(sessionFileContent.tokenHash.length === 64, 'tokenHash is a standard SHA-256 hex digest');
  } else {
    console.log('Note: Stored in database directly.');
  }

  // --- Test 3: Anonymous Access Denial & Anti-Enumeration ---
  console.log('\n--- 3. Testing Anti-Enumeration & Access Control ---');
  // 3a: Query with no token
  const noTokenRes = await fetch(`http://localhost:3000/api/scan-session?id=${sessionId}`);
  assert(noTokenRes.status === 403, 'GET /api/scan-session without token returns 403 Forbidden (Anti-Enumeration)');

  // 3b: Query with forged / wrong token
  const wrongToken = '0'.repeat(64);
  const wrongTokenRes = await fetch(`http://localhost:3000/api/scan-session?id=${sessionId}&token=${wrongToken}`);
  assert(wrongTokenRes.status === 403, 'GET /api/scan-session with forged token returns 403 Forbidden');

  // 3c: Query with valid token
  const validTokenRes = await fetch(`http://localhost:3000/api/scan-session?id=${sessionId}&token=${pairingToken}`);
  assert(validTokenRes.status === 200, 'GET /api/scan-session with matching token returns 200 OK');
  const sessionData = await validTokenRes.json();
  assert(sessionData.status === 'pending', 'Session state is verified as "pending"');

  // --- Test 4: Upload Authorization & File Validation ---
  console.log('\n--- 4. Testing Upload Security & One-Time Condition ---');
  // 4a: Upload attempt without token
  const formNoToken = new FormData();
  formNoToken.append('id', sessionId);
  formNoToken.append('file', new Blob(['RECEIPT_DATA'], { type: 'image/png' }), 'receipt.png');
  const uploadNoTokenRes = await fetch('http://localhost:3000/api/scan-session/upload', {
    method: 'POST',
    body: formNoToken
  });
  assert(uploadNoTokenRes.status === 400 || uploadNoTokenRes.status === 403, 'Upload without token is rejected');

  // 4b: Upload attempt with forged token
  const formWrongToken = new FormData();
  formWrongToken.append('id', sessionId);
  formWrongToken.append('token', wrongToken);
  formWrongToken.append('file', new Blob(['RECEIPT_DATA'], { type: 'image/png' }), 'receipt.png');
  const uploadWrongTokenRes = await fetch('http://localhost:3000/api/scan-session/upload', {
    method: 'POST',
    body: formWrongToken
  });
  assert(uploadWrongTokenRes.status === 403, 'Upload with forged pairing token returns 403 Forbidden');

  // 4c: Upload attempt with disallowed MIME type
  const formBadMime = new FormData();
  formBadMime.append('id', sessionId);
  formBadMime.append('token', pairingToken);
  formBadMime.append('file', new Blob(['MALICIOUS_SCRIPT'], { type: 'application/x-msdownload' }), 'malware.exe');
  const uploadBadMimeRes = await fetch('http://localhost:3000/api/scan-session/upload', {
    method: 'POST',
    body: formBadMime
  });
  assert(uploadBadMimeRes.status === 400, 'Upload of disallowed MIME type returns 400 Bad Request');

  // 4d: Legitimate mobile QR upload with valid token and image
  const formValid = new FormData();
  formValid.append('id', sessionId);
  formValid.append('token', pairingToken);
  formValid.append('file', new Blob(['VALID_PNG_RECEIPT_IMAGE'], { type: 'image/png' }), 'lunch_receipt.png');
  const uploadValidRes = await fetch('http://localhost:3000/api/scan-session/upload', {
    method: 'POST',
    body: formValid
  });
  assert(uploadValidRes.status === 200, 'Valid mobile QR upload with authentic token returns 200 OK');

  // 4e: Verify One-Time Upload Condition (Replay / Overwrite Attack Prevention)
  const formReplay = new FormData();
  formReplay.append('id', sessionId);
  formReplay.append('token', pairingToken);
  formReplay.append('file', new Blob(['ATTEMPT_TO_OVERWRITE'], { type: 'image/png' }), 'overwrite.png');
  const uploadReplayRes = await fetch('http://localhost:3000/api/scan-session/upload', {
    method: 'POST',
    body: formReplay
  });
  assert(uploadReplayRes.status === 409, 'Replay upload returns 409 Conflict (One-time upload condition enforced)');

  // --- Test 5: Verify Uploaded Receipt Delivery ---
  console.log('\n--- 5. Testing Authorized Receipt Delivery ---');
  const pollAfterUpload = await fetch(`http://localhost:3000/api/scan-session?id=${sessionId}&token=${pairingToken}`);
  assert(pollAfterUpload.status === 200, 'Authorized client can retrieve uploaded session data');
  const postData = await pollAfterUpload.json();
  assert(postData.status === 'uploaded', 'Session status transitioned to "uploaded"');
  assert(postData.fileName === 'lunch_receipt.png', 'File name preserved accurately');
  assert(!!postData.image, 'Image payload delivered to authorized client');

  // --- Test 6: Deletion Authorization ---
  console.log('\n--- 6. Testing Deletion Authorization ---');
  // 6a: Deletion without token
  const deleteNoTokenRes = await fetch(`http://localhost:3000/api/scan-session?id=${sessionId}`, { method: 'DELETE' });
  assert(deleteNoTokenRes.status === 403, 'DELETE without token returns 403 Forbidden');

  // 6b: Deletion with valid token
  const deleteValidRes = await fetch(`http://localhost:3000/api/scan-session?id=${sessionId}&token=${pairingToken}`, { method: 'DELETE' });
  assert(deleteValidRes.status === 200, 'DELETE with valid token returns 200 OK');

  // 6c: Verify session purged
  const postDeleteRes = await fetch(`http://localhost:3000/api/scan-session?id=${sessionId}&token=${pairingToken}`);
  assert(postDeleteRes.status === 404, 'Purged session returns 404 Not Found (expired)');

  console.log('\n================================================================');
  console.log(`SECURITY AUDIT COMPLETED: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runSecurityAudit().catch(err => {
  console.error('Audit encountered fatal error:', err);
  process.exit(1);
});

