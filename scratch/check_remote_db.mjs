import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://fixddtujkxyxjxxedtit.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpeGRkdHVqa3h5eGp4eGVkdGl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNTY5NjYsImV4cCI6MjA5NjYzMjk2Nn0._Izg14d9rQV110sQzivMK1hPwUM4IR3lT20EUqhO4X4";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function inspectDatabase() {
  console.log("=== INSPECTING REMOTE DATABASE ===");
  
  // 1. Check scan_sessions
  const { data: scanSessions, error: scanErr } = await supabase
    .from('scan_sessions')
    .select('*')
    .limit(1);
  console.log("scan_sessions:", { data: scanSessions, error: scanErr });

  // 2. Check group_settlements
  const { data: settlements, error: settleErr } = await supabase
    .from('group_settlements')
    .select('*')
    .limit(1);
  console.log("group_settlements:", { data: settlements, error: settleErr });

  // 3. Check groups
  const { data: groups, error: groupsErr } = await supabase
    .from('groups')
    .select('*')
    .limit(1);
  console.log("groups:", { data: groups, error: groupsErr });

  // 4. Check expenses
  const { data: expenses, error: expErr } = await supabase
    .from('expenses')
    .select('*')
    .limit(1);
  console.log("expenses:", { data: expenses, error: expErr });
}

inspectDatabase().catch(console.error);
