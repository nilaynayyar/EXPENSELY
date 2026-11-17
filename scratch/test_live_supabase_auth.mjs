import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://fixddtujkxyxjxxedtit.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpeGRkdHVqa3h5eGp4eGVkdGl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNTY5NjYsImV4cCI6MjA5NjYzMjk2Nn0._Izg14d9rQV110sQzivMK1hPwUM4IR3lT20EUqhO4X4";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testAuth() {
  console.log("=== TESTING LIVE SUPABASE AUTHENTICATION ===");

  // 1. Test incorrect password on dummy account
  console.log("\n[Test 1] Testing invalid credentials...");
  const invalidLogin = await supabase.auth.signInWithPassword({
    email: "nonexistent.user.test12345@gmail.com",
    password: "WrongPassword999!"
  });
  console.log("Invalid login result:", {
    error: invalidLogin.error?.message,
    status: invalidLogin.error?.status
  });

  // 2. Test signup with test email to check email sending / rate limit / custom SMTP
  const testEmail = `expensely.test.${Date.now()}@gmail.com`;
  console.log(`\n[Test 2] Testing signup with new email: ${testEmail}...`);
  const signupRes = await supabase.auth.signUp({
    email: testEmail,
    password: "SecurePassword123!",
    options: {
      emailRedirectTo: "http://localhost:3000/auth/callback"
    }
  });
  console.log("Signup response:", {
    user: signupRes.data?.user ? {
      id: signupRes.data.user.id,
      email: signupRes.data.user.email,
      confirmed_at: signupRes.data.user.confirmed_at,
      identities: signupRes.data.user.identities?.length
    } : null,
    session: signupRes.data?.session,
    error: signupRes.error ? {
      message: signupRes.error.message,
      status: signupRes.error.status
    } : null
  });

  // 3. Test resend confirmation email
  console.log(`\n[Test 3] Testing resend confirmation for: ${testEmail}...`);
  const resendRes = await supabase.auth.resend({
    type: 'signup',
    email: testEmail,
    options: {
      emailRedirectTo: "http://localhost:3000/auth/callback"
    }
  });
  console.log("Resend response:", {
    data: resendRes.data,
    error: resendRes.error ? {
      message: resendRes.error.message,
      status: resendRes.error.status
    } : null
  });

  // 4. Test sign in with the unconfirmed account
  console.log(`\n[Test 4] Testing signin with unconfirmed account: ${testEmail}...`);
  const unconfirmedSignIn = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: "SecurePassword123!"
  });
  console.log("Unconfirmed account signin response:", {
    user: unconfirmedSignIn.data?.user ? "User returned" : null,
    session: unconfirmedSignIn.data?.session ? "Session returned" : null,
    error: unconfirmedSignIn.error ? {
      message: unconfirmedSignIn.error.message,
      status: unconfirmedSignIn.error.status
    } : null
  });
}

testAuth().catch(console.error);
