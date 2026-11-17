import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envContent.split(/\r?\n/).forEach(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx !== -1) {
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[key] = val;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log('\n--- 1. Testing Test Account Sign In / Sign Up ---');
  const email = 'expensely_qa_tester@gmail.com';
  const password = 'TestPassword123!';

  let { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.log('Sign in result:', error.message, '- attempting signup...');
    const signUpRes = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: 'QA Test User' }
      }
    });
    if (signUpRes.error) {
      console.log('Sign up result:', signUpRes.error.message);
    } else {
      console.log('Sign up successful! User ID:', signUpRes.data.user?.id);
      console.log('User identities:', signUpRes.data.user?.identities);
      data = signUpRes.data;
    }
  } else {
    console.log('Sign in successful! User ID:', data.user.id);
  }

  console.log('\n--- 2. Direct Supabase Query Verification with Authenticated User ---');
  if (data?.session) {
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${data.session.access_token}`
        }
      }
    });

    console.log('a) Querying expenses table...');
    const { data: exp, error: expErr } = await authClient.from('expenses').select('*').limit(5);
    console.log('Expenses:', exp ? `Count = ${exp.length}` : 'Error: ' + expErr?.message);

    console.log('b) Querying categories table...');
    const { data: cat, error: catErr } = await authClient.from('categories').select('*').limit(5);
    console.log('Categories:', cat ? `Count = ${cat.length}` : 'Error: ' + catErr?.message);

    console.log('c) Querying budgets table...');
    const { data: bud, error: budErr } = await authClient.from('budgets').select('*').limit(5);
    console.log('Budgets:', bud ? `Count = ${bud.length}` : 'Error: ' + budErr?.message);

    console.log('d) Querying groups table...');
    const { data: grp, error: grpErr } = await authClient.from('groups').select('*').limit(5);
    console.log('Groups:', grp ? `Count = ${grp.length}` : 'Error: ' + grpErr?.message);

    console.log('\n--- 3. Testing Expense CRUD Lifecycle ---');
    const { data: newExp, error: insertErr } = await authClient
      .from('expenses')
      .insert({
        user_id: data.user.id,
        store_name: 'QA Verification Grocery',
        amount: 85.50,
        expense_date: new Date().toISOString().split('T')[0],
        status: 'verified'
      })
      .select()
      .single();
    
    if (insertErr) {
      console.log('Insert test expense error:', insertErr.message);
    } else {
      console.log('Created test expense:', newExp.id, newExp.store_name, newExp.amount);

      const { data: updatedExp, error: updateErr } = await authClient
        .from('expenses')
        .update({ amount: 92.00, store_name: 'QA Grocery Updated' })
        .eq('id', newExp.id)
        .select()
        .single();
      
      if (updateErr) {
        console.log('Update expense error:', updateErr.message);
      } else {
        console.log('Updated test expense:', updatedExp.id, updatedExp.store_name, updatedExp.amount);
      }

      const { error: deleteErr } = await authClient
        .from('expenses')
        .delete()
        .eq('id', newExp.id);
      
      console.log('Delete test expense result:', deleteErr ? deleteErr.message : 'Successfully deleted');
    }
  } else {
    console.log('No active session returned (likely email confirmation required).');
  }
}

run().catch(console.error);
