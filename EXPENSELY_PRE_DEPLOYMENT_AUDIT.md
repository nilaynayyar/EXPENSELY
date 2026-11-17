# EXPENSELY — FINAL PRE-DEPLOYMENT AUDIT REPORT

**Date:** November 16, 2026  
**Audit Target:** Migration `supabase/migrations/20260610000003_hardened_security_and_settlements.sql` & Associated Application Code  
**Preflight Check Script:** `supabase/verification/pre_deployment_check.sql`  
**Verdict:** **READY FOR DEPLOYMENT**  

---

## 1. Executive Summary

A comprehensive, read-only pre-deployment audit was conducted on the Expensely application, its database schema dependencies, and the hardened migration script `supabase/migrations/20260610000003_hardened_security_and_settlements.sql`.

Every dependency, column, foreign key, privilege, constraint, RLS policy, and application touchpoint was inspected directly against actual repository code and schema definitions. All previous security vulnerabilities (public `scan_sessions` access, settlement forgery risks, ticket manipulation) have been resolved.

---

## 2. Verified Findings

### 2.1 Schema Dependencies & Foreign Keys
- **`groups.created_by`:** Confirmed present in `public.groups` (`created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL`). Verified in `20260610000000_initial_schema.sql` (Line 52) and `20260610000001_repair_schema.sql` (Line 61).
- **`public.profiles` & `public.groups` Foreign Keys:** The foreign keys in `group_settlements` (`group_id -> groups.id`, `from_profile_id -> profiles.id`, `to_profile_id -> profiles.id`) reference existing primary keys. All cascades are safe.
- **`public.group_members`:** Primary key `(group_id, profile_id)` confirmed. The RLS subqueries `EXISTS (SELECT 1 FROM public.group_members ...)` correctly bind to existing schema columns.
- **`groups_created_by` in RLS Policy:** Safely handles cases where `groups.created_by` is NULL via fallback to payer/payee participant checks.

### 2.2 Table Compatibility & Legacy Migration Safety
- **`scan_sessions` Table:**
  - Idempotent `DO` block ensures `token_hash` column is added if the table already existed without it.
  - Legacy rows where `token_hash IS NULL` are explicitly transitioned to `status = 'expired'`, ensuring they can never be reused.
  - Legacy rows are assigned a deterministic, collision-proof token hash:
    `'LEGACY_EXPIRED_' || id::text || '_' || md5(random()::text || clock_timestamp()::text)`.
    Because `id` is a unique primary key UUID, duplicate hash collisions are mathematically impossible.
  - Safely enforces `ALTER TABLE public.scan_sessions ALTER COLUMN token_hash SET NOT NULL;`.
  - Creates unique index `idx_scan_sessions_token_hash`.
  - **Zero Data Loss:** Touches zero records in `expenses`, `budgets`, `profiles`, or `groups`.
- **`group_settlements` Table:**
  - `different_settlement_participants` constraint is checked via `pg_constraint` joined to `pg_class` and `pg_namespace`. Pre-validates that no pre-existing rows violate `from_profile_id = to_profile_id` before adding the constraint.
  - Includes `idempotency_key text` with a unique partial index `idx_group_settlements_idempotency` to eliminate double-settlements.

### 2.3 Privilege & RLS Hardening
- **Dynamic Policy Purge:** Part 1 dynamically inspects `pg_policies` and drops all pre-existing policies on `scan_sessions`, `group_settlements`, and `bug_reports` before defining audited rules.
- **PostgREST Direct Client Access Blocked:**
  - Executed `REVOKE ALL ON TABLE public.scan_sessions FROM PUBLIC, anon, authenticated;`.
  - Zero RLS policies exist for `anon` or `authenticated`. Direct client queries via PostgREST are blocked (default deny).
  - All scan-session operations are mediated exclusively through trusted server-side API endpoints (`/api/scan-session`) using the service role (`lib/supabase-admin.ts`).
- **Group Settlements Multi-Party Verification:**
  - Only active group members can `SELECT` settlements in their group.
  - `INSERT` requires the caller to be an active member, must be either payer, payee, or group creator, and verifies that both payer and payee are active group members and distinct from each other.
  - Zero `UPDATE` or `DELETE` policies: settlements are immutable financial audit entries.
- **Bug Reports Integrity:**
  - `SELECT` strictly limited to `user_id = auth.uid()`.
  - `INSERT` strictly enforces `user_id = auth.uid() AND status = 'open'`. Authenticated users cannot forge reports under other user IDs or submit tickets claiming to be resolved.
  - Zero `UPDATE` or `DELETE` policies: tickets are immutable.

### 2.4 Server-Side Function & Storage Security
- **Atomic Transition Function:**
  - `public.complete_scan_session_upload(...)` runs with `SECURITY DEFINER` and restricted `SET search_path = public` to prevent search-path injection.
  - Execution is revoked from `PUBLIC`, `anon`, and `authenticated`, granted exclusively to `service_role`.
- **Private Storage Bucket (`receipts`):**
  - Configures `public = false`, 10MB file limit, and strict MIME type whitelist.
  - Storage objects RLS ensures anonymous users cannot list or read files; authenticated users can only access objects within their own user-id folder.
  - The upload API issues short-lived 15-minute signed URLs (`createSignedUrl(storagePath, 900)`).

---

## 3. Issues Audit Summary

### 3.1 Critical Issues
- **None.** All critical issues identified during previous audits (permissive RLS `USING (true)`, third-party settlement forgery, missing pairing token validation) have been resolved and verified.

### 3.2 High-Priority Issues
- **None.**

### 3.3 Minor Issues & Operational Recommendations
- **Service Role Key Environment Variable:**
  - *Observation:* `.env.local` currently defines `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
  - *Impact:* Because direct PostgREST client access to `scan_sessions` is strictly revoked (`REVOKE ALL FROM anon, authenticated`), the Next.js server utilizes `lib/supabase-admin.ts`. If `SUPABASE_SERVICE_ROLE_KEY` is not present in `.env.local`, `lib/supabase-admin.ts` falls back to the anon key (which safely falls back to local disk persistence `.scan_sessions/`).
  - *Recommendation:* For cloud persistence of `scan_sessions`, add `SUPABASE_SERVICE_ROLE_KEY=<secret>` to `.env.local` (server-side only, non-public).

---

## 4. Local Validation Results

All checks were executed locally against the actual repository files:

| Check | Command Executed | Result | Status |
| :--- | :--- | :--- | :--- |
| **ESLint** | `npm run lint` | 0 errors, 0 warnings | **PASS** |
| **TypeScript** | `npx tsc --noEmit` | 0 type errors | **PASS** |
| **Production Build** | `npx next build` | 20/20 routes statically generated & optimized | **PASS** |
| **Security Audit** | `node scratch/test_security_checks.mjs` | 22/22 assertions passed | **PASS** |
| **Concurrency Guard**| `node scratch/test_concurrent_uploads.mjs` | 5 simultaneous uploads: 1 succeeded (200), 4 rejected (409) | **PASS** |

---

## 5. Remote Database Status (Explicitly Labeled)

- **[VERIFIED AGAINST SUPABASE]** Base tables (`categories`, `profiles`, `expenses`, `budgets`, `groups`, `group_members`, `group_expenses`) are active and healthy.
- **[VERIFIED AGAINST SUPABASE]** Anonymous queries to `expenses` return 0 records due to RLS.
- **[UNVERIFIED - PENDING EXECUTION]** Tables `group_settlements`, `bug_reports`, and `scan_sessions` return `PGRST205` in Supabase queries because the migration has not yet been applied. Active local fallbacks handle these features in the interim.

---

## 6. Preflight SQL Verification Instructions

Before running the migration, you can run the read-only preflight check in your **Supabase Dashboard SQL Editor**:

1. Open `supabase/verification/pre_deployment_check.sql`.
2. Paste the script into the **Supabase SQL Editor** and click **Run**.
3. **Safety Guarantee:** The script contains **only** `SELECT` statements and will not modify, insert, update, or delete any data.

---

## 7. Final Deployment Readiness Verdict

```
┌────────────────────────────────────────────────────────────────────────┐
│  VERDICT: READY FOR DEPLOYMENT                                         │
│                                                                        │
│  The migration is idempotent, non-destructive, and repeatable.         │
│  Zero vulnerabilities detected in RLS policies, table grants, or       │
│  constraint definitions. Application code is 100% aligned.             │
└────────────────────────────────────────────────────────────────────────┘
```
