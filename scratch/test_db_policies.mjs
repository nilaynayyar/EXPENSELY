import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envContent.split(/\r?\n/).forEach(line => {
  const eq = line.indexOf('=');
  if (eq > 0) env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim().replace(/^"|"$/g, '');
});

const anonClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function testPostgrestAnonAccess() {
  console.log('Testing PostgREST anonymous client access restrictions...\n');

  // 1. Test scan_sessions
  const { data: scanData, error: scanErr } = await anonClient.from('scan_sessions').select('*');
  console.log('1. Anonymous scan_sessions select:', scanData ? `Exposed ${scanData.length} records!` : `Protected (${scanErr?.message})`);

  // 2. Test bug_reports
  const { data: bugData, error: bugErr } = await anonClient.from('bug_reports').select('*');
  console.log('2. Anonymous bug_reports select:', bugData ? `Exposed ${bugData.length} records!` : `Protected (${bugErr?.message})`);

  // 3. Test group_settlements
  const { data: setlData, error: setlErr } = await anonClient.from('group_settlements').select('*');
  console.log('3. Anonymous group_settlements select:', setlData ? `Exposed ${setlData.length} records!` : `Protected (${setlErr?.message})`);

  // 4. Test expenses
  const { data: expData, error: expErr } = await anonClient.from('expenses').select('*');
  console.log('4. Anonymous expenses select:', expData ? `Exposed ${expData.length} records!` : `Protected (${expErr?.message})`);
}

testPostgrestAnonAccess();

