async function testLifecycle() {
  console.log('1. Creating a new scan session via POST /api/scan-session...');
  let createRes = await fetch('http://localhost:3000/api/scan-session', {
    method: 'POST'
  });
  console.log('Create session status:', createRes.status);
  const created = await createRes.json();
  console.log('Created session:', created);

  const sessionId = created.id;

  console.log('\n2. Polling session before upload...');
  let initialPoll = await fetch('http://localhost:3000/api/scan-session?id=' + sessionId);
  console.log('Initial Poll status:', initialPoll.status, await initialPoll.json());

  console.log('\n3. Simulating mobile file upload to /api/scan-session/upload...');
  const formData = new FormData();
  formData.append('id', sessionId);
  const dummyBlob = new Blob(['FAKE_RECEIPT_IMAGE_CONTENT'], { type: 'image/png' });
  formData.append('file', dummyBlob, 'receipt_lunch.png');

  let uploadRes = await fetch('http://localhost:3000/api/scan-session/upload', {
    method: 'POST',
    body: formData
  });
  console.log('Upload POST status:', uploadRes.status, await uploadRes.json());

  console.log('\n4. Polling session after upload...');
  let postPoll = await fetch('http://localhost:3000/api/scan-session?id=' + sessionId);
  const pollData = await postPoll.json();
  console.log('Post-upload Poll status:', postPoll.status);
  console.log('Result:', {
    status: pollData.status,
    fileName: pollData.fileName,
    fileType: pollData.fileType,
    hasImageData: !!pollData.image
  });

  console.log('\n5. Consuming / deleting session via DELETE /api/scan-session?id=' + sessionId);
  let deleteRes = await fetch('http://localhost:3000/api/scan-session?id=' + sessionId, {
    method: 'DELETE'
  });
  console.log('Delete status:', deleteRes.status, await deleteRes.json());

  console.log('\n6. Checking session status after deletion...');
  let finalPoll = await fetch('http://localhost:3000/api/scan-session?id=' + sessionId);
  console.log('Final Poll status (expect 404):', finalPoll.status, await finalPoll.json());
}

testLifecycle().catch(console.error);
