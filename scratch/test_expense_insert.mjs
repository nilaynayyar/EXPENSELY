import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://fixddtujkxyxjxxedtit.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpeGRkdHVqa3h5eGp4eGVkdGl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNTY5NjYsImV4cCI6MjA5NjYzMjk2Nn0._Izg14d9rQV110sQzivMK1hPwUM4IR3lT20EUqhO4X4";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testInsert() {
  const { data, error } = await supabase.from('expenses').insert([{
    user_id: 'c6b4835f-4afa-4887-8bca-7f175798f569',
    store: 'Test Store',
    amount: 100,
    date: '2026-11-17',
    status: 'Pending'
  }]);
  console.log("Insert with anon:", { data, error });
}

testInsert().catch(console.error);
