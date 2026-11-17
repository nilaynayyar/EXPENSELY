import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envContent.split(/\r?\n/).forEach(line => {
  const eq = line.indexOf('=');
  if (eq > 0) env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim().replace(/^"|"$/g, '');
});

const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
  console.log('Checking Supabase tables...\n');
  const tables = [
    'categories',
    'profiles',
    'expenses',
    'budgets',
    'groups',
    'group_members',
    'group_expenses',
    'group_settlements',
    'bug_reports',
    'scan_sessions'
  ];

  for (const t of tables) {
    const { error } = await client.from(t).select('*').limit(1);
    if (error) {
      console.log(`❌ Table [${t}]: ${error.message} (code: ${error.code})`);
    } else {
      console.log(`✅ Table [${t}]: Ready & accessible`);
    }
  }
}

check();

