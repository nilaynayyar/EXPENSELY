# EXPENSELY — PRODUCTION DEPLOYMENT GATE REPORT

**Audit & Assessment Date:** November 16, 2026  
**Target Migration:** `supabase/migrations/20260610000003_hardened_security_and_settlements.sql`  
**Supabase Project Ref:** `fixddtujkxyxjxxedtit` (`https://fixddtujkxyxjxxedtit.supabase.co`)  
**Target Branch:** `main`  
**Final Production Verdict:** **APPROVED FOR PRODUCTION MIGRATION**

---

## 1. Executive Summary & Production Gate Verdict

Following the completion of the pre-deployment audit, a targeted security gate review was conducted to resolve critical production edge cases before any SQL execution on the remote database. 

Three key architectural hardening updates were implemented and verified:
1. **Independent Pre-Storage Authorization:** Because Supabase service-role credentials bypass Storage Row Level Security, `/api/scan-session/upload` was refactored to independently verify session existence, pairing token cryptographic authenticity (`timingSafeEqual`), session TTL expiration, and `'pending'` state **BEFORE** transmitting any bytes to Supabase Storage.
2. **Production Persistence Control:** Local disk persistence (`.scan_sessions/`) has been strictly blocked in production (`process.env.NODE_ENV === "production"`). When `SUPABASE_SERVICE_ROLE_KEY` is absent in production, the application now returns a controlled `HTTP 500` JSON error rather than falling back silently to disk or anon credentials. Disk persistence is preserved exclusively for development environments.
3. **Settlement Idempotency Lock:** Added an `isSettling` UI lock to the settlement modal to eliminate concurrent double-clicks, while maintaining batch UUID scoping (`settle_${batchId}_${fromId}_${toId}`) so retries reuse the key without duplicate debits, and subsequent settlements generate fresh keys.

### Final Verdict: **APPROVED FOR PRODUCTION MIGRATION**
*(All required pre-deployment fixes have been applied, compiled, and validated across local test suites with 100% pass rates).*

---

## 2. Migration History & CLI Synchronization

### A. Remote Migration Status
- Probing of the remote database confirmed that relation `public.scan_sessions`, `public.group_settlements`, and `public.bug_reports` currently return `PGRST205` ("Could not find the table in public schema").
- Migration `20260610000003` is **NOT** recorded on the remote database.

### B. Supabase CLI Project Reference
- **Project Reference:** `fixddtujkxyxjxxedtit`
- **Dashboard URL:** `https://supabase.com/dashboard/project/fixddtujkxyxjxxedtit`
- **API URL:** `https://fixddtujkxyxjxxedtit.supabase.co`

### C. Safest Deployment Procedure (Zero History Collisions)
To ensure seamless synchronization whether deploying via the Supabase Dashboard SQL Editor or the Supabase CLI:

1. **Integrated Migration Tracking:**
   Migration file `20260610000003_hardened_security_and_settlements.sql` includes **Part 7: Migration History Synchronization**:
   ```sql
   DO $$
   BEGIN
     IF EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations'
     ) THEN
       INSERT INTO supabase_migrations.schema_migrations (version)
       VALUES ('20260610000003')
       ON CONFLICT (version) DO NOTHING;
     END IF;
   END $$;
   ```
2. **If Deploying via Supabase CLI in the future:**
   If the migration is executed manually in the Dashboard SQL Editor, synchronize the local CLI state with:
   ```bash
   supabase migration repair --status applied 20260610000003
   ```
   This prevents subsequent `supabase db push` operations from attempting to reapply the migration.

---

## 3. Service-Role Storage Security Audit

### Threat Model & Vulnerability Analysis
The mobile QR receipt scanner allows an unauthenticated mobile device on the local network to upload a receipt file to the companion desktop session. To store the image in a private Supabase Storage bucket (`receipts`), the server-side API route (`/api/scan-session/upload`) uses `getAdminClient()` (service-role).

> [!WARNING]
> Because Supabase service-role credentials completely bypass Storage Row Level Security, any service-role upload API route must act as its own independent authorization gateway. Uploading to storage before validating the session allows unauthorized callers to store arbitrary files in the private bucket.

### Implementation Verification (`app/api/scan-session/upload/route.ts`)
The upload route enforces a strict 6-stage authorization sequence:

```
[Incoming Request]
       │
       ▼
1. Input Syntax Validation (RFC 4122 UUID, 64-hex token, File presence, MIME check, 10MB limit)
       │
       ▼
2. Independent Session Verification (Query session via getScanSession(id) — 404 if absent/expired)
       │
       ▼
3. Pairing Token Authenticity (Constant-time timingSafeEqual verification — 403 if invalid)
       │
       ▼
4. One-Time State Verification (Check status === 'pending' — 409 if already uploaded)
       │
       ▼
5. Private Storage Upload (Scanned path: scan-sessions/${id}/${timestamp}-${filename}, 900s signed URL)
       │
       ▼
6. Atomic State Transition (complete_scan_session_upload RPC — removes uploaded storage file if 409 conflict)
```

**Automated Test Evidence (`scratch/test_pre_storage_auth.mjs`):**
- Invalid pairing token -> Rejected with `HTTP 403 Forbidden` without writing to storage.
- Non-existent session UUID -> Rejected with `HTTP 404 Not Found` without writing to storage.
- Already uploaded session -> Rejected with `HTTP 409 Conflict` without writing to storage.
- Valid session and token -> Accepted with `HTTP 200 OK`.

---

## 4. Production Persistence Controls

| Environment | Persistence Layer | Behavior on Missing Credentials |
|-------------|-------------------|---------------------------------|
| **Production** (`NODE_ENV === 'production'`) | **PostgreSQL Only** (`public.scan_sessions`) | **Controlled 500 Error:** Throws `[SupabaseAdmin] SUPABASE_SERVICE_ROLE_KEY is required in production environment`. Zero disk fallback permitted. |
| **Development** (`NODE_ENV !== 'production'`) | **Local Disk Fallback** (`.scan_sessions/`) | **Seamless Dev Prototyping:** Falls back to encrypted/hashed JSON files on local disk if Supabase is unconfigured. |

### Verified Code Protections:
- `lib/supabase-admin.ts`: In production, throws immediately if `SUPABASE_SERVICE_ROLE_KEY` is not defined. Never falls back to `NEXT_PUBLIC_SUPABASE_ANON_KEY` in production.
- `lib/scan-session.ts`: `createScanSession`, `getScanSession`, `updateScanSessionImage`, and `deleteScanSession` strictly route to Supabase in production. Zero file writes to `.scan_sessions/` occur in production.
- Probed endpoint verification: `POST http://localhost:3000/api/scan-session` under production mode returned controlled JSON:
  ```json
  {"error":"[SupabaseAdmin] SUPABASE_SERVICE_ROLE_KEY is required in production environment. Refusing to operate with unprivileged credentials."}
  ```

---

## 5. Settlement Idempotency & Concurrency Verification

### Frontend & Database Guarantees:
1. **Modal Scoping:** Opening the settlement modal generates an operation-scoped UUID:
   ```ts
   setSettlementBatchId(crypto.randomUUID());
   ```
2. **Retry Re-Use:** When a user retries following a network hiccup or timeout, `settlementBatchId` is preserved in state, producing the identical idempotency key:
   ```ts
   const idempotencyKey = `settle_${batchId}_${t.fromId}_${t.toId}`;
   ```
3. **Subsequent Settlements:** Closing and reopening the modal, or refreshing the page, generates a fresh `batchId`, allowing legitimate subsequent settlements on the same day between the same members.
4. **UI Double-Click Lock:** The "Confirm Settlement" button is disabled and displays a progress spinner (`isSettling`) while the settlement request is in flight.
5. **Database Constraint:** `idempotency_key text NOT NULL DEFAULT ('settle_' || gen_random_uuid()::text)` with unique index `idx_group_settlements_idempotency` ensures duplicate entries are rejected at the database engine level (no NULL bypass).

---

## 6. Rollback & Forward Repair Strategy

### A. Transactional Integrity
PostgreSQL DDL is transactional. If any error occurs while running `20260610000003_hardened_security_and_settlements.sql`, PostgreSQL rolls back the entire migration transaction automatically.

### B. Forward Repair Policy
> [!IMPORTANT]
> **Never drop security policies to restore application availability.**
> Dropping RLS policies removes authorization boundaries and exposes financial or session data to unauthenticated callers. If an unexpected edge case occurs in production, always issue a targeted **forward repair migration** that refines the policy expression rather than disabling RLS.

### C. Safe vs. Unsafe Operations
| Operation | Safety Classification | Protocol |
|-----------|-----------------------|----------|
| **Adjusting RLS Policy `USING` / `WITH CHECK`** | **SAFE** | Apply via forward repair `ALTER POLICY` or `CREATE OR REPLACE`. |
| **Updating Function Search Path** | **SAFE** | Apply via `CREATE OR REPLACE FUNCTION ... SET search_path`. |
| **Dropping Table `scan_sessions`** | **CONDITIONAL** | Ephemeral data (15-min TTL). Only affects active QR scanner uploads. |
| **Dropping Table `group_settlements`** | **CRITICAL RISK** | Irreversible data loss. Destroys member settlement history. Must never be dropped. |
| **Dropping Table `bug_reports`** | **CRITICAL RISK** | Irreversible data loss. Destroys submitted user bug reports. |

---

## 7. Exact Deployment Instructions

### Step 1: Pre-Deployment Prerequisite Check (Read-Only)
In the Supabase SQL Editor, run:
```sql
-- Run file: supabase/verification/pre_deployment_prerequisites.sql
-- Confirms base tables (groups, profiles, group_members) exist.
```

### Step 2: Execute Migration
In the Supabase SQL Editor, paste and execute:
```sql
-- Run file: supabase/migrations/20260610000003_hardened_security_and_settlements.sql
```

### Step 3: Post-Deployment Verification (Read-Only)
In the Supabase SQL Editor, run:
```sql
-- Run file: supabase/verification/post_deployment_verification.sql
-- Verifies:
-- 1. All 3 tables created
-- 2. token_hash NOT NULL with unique index
-- 3. idempotency_key NOT NULL with unique index
-- 4. RLS enabled on all tables
-- 5. Zero client access on scan_sessions (default-deny)
-- 6. No UPDATE/DELETE on settlements or bug reports
-- 7. complete_scan_session_upload search_path hardened
-- 8. Storage bucket receipts is private (public = false)
```

### Step 4: Configure Production Environment Variables
In your hosting platform (Vercel / Railway / Docker):
1. Add `SUPABASE_SERVICE_ROLE_KEY` = `<your-service-role-key-from-supabase-dashboard>`.
2. Ensure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set.
3. Deploy the application.

---

## 8. Verification Matrix

| Verification Check | Local Testing Status | Remote Supabase Status | Result |
|--------------------|----------------------|------------------------|--------|
| **Next.js Production Build** | 20/20 routes compiled cleanly | N/A | **PASS** |
| **TypeScript Strict Compiler** | 0 errors (`npx tsc --noEmit`) | N/A | **PASS** |
| **ESLint Code Quality** | 0 errors, 0 warnings (`npm run lint`) | N/A | **PASS** |
| **Pre-Storage Authorization Gate** | Tested 403, 404, 409 rejection | Pending Migration | **PASS** |
| **Production Persistence Lock** | Probed 500 error on missing key | Pending Migration | **PASS** |
| **Settlement Idempotency Retries** | Modal batch scoping verified | Pending Migration | **PASS** |
| **Concurrent Upload Atomicity** | 5 concurrent requests: 1 200, 4 409 | Pending Migration | **PASS** |
| **Cryptographic Token Generator** | 256-bit entropy verified | N/A | **PASS** |
| **Timing-Safe Token Comparison** | Constant-time buffer check verified | N/A | **PASS** |
| **Preflight Read-Only SQL Scripts** | 100% pure SELECT validated | Ready for Remote Run | **READY** |
| **Remote Database Migration** | Not executed (per instructions) | Ready for Remote Run | **READY** |
