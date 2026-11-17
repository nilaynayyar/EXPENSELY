async function testConcurrency() {
  console.log('Testing atomic upload transition under concurrent race condition...');

  // 1. Create a session
  const createRes = await fetch('http://localhost:3000/api/scan-session', { method: 'POST' });
  const { id, token } = await createRes.json();
  console.log('Created test session:', id);

  // 2. Fire 5 concurrent uploads simultaneously using Promise.all
  console.log('Firing 5 simultaneous uploads to /api/scan-session/upload...');
  const uploads = Array.from({ length: 5 }, (_, i) => {
    const form = new FormData();
    form.append('id', id);
    form.append('token', token);
    form.append('file', new Blob([`CONCURRENT_PAYLOAD_${i}`], { type: 'image/png' }), `receipt_${i}.png`);
    return fetch('http://localhost:3000/api/scan-session/upload', {
      method: 'POST',
      body: form,
    }).then(async (res) => ({ index: i, status: res.status, body: await res.json() }));
  });

  const results = await Promise.all(uploads);
  console.log('\nResults of 5 concurrent requests:');
  let successCount = 0;
  let conflictCount = 0;

  results.forEach(r => {
    console.log(`Request #${r.index} -> HTTP ${r.status}:`, r.body);
    if (r.status === 200) successCount++;
    if (r.status === 409) conflictCount++;
  });

  console.log(`\nSummary: ${successCount} Succeeded (200), ${conflictCount} Rejected (409 Conflict)`);
  if (successCount === 1 && conflictCount === 4) {
    console.log('✅ PASS: Atomic upload condition successfully enforced! Zero race conditions.');
  } else {
    console.error('❌ FAIL: Concurrency violation detected.');
    process.exit(1);
  }
}

testConcurrency().catch(console.error);
