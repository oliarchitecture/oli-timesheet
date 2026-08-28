# OLI Timesheet — Supabase billing decision & hosting plan

*Written 2026-08-26, executed 2026-08-28. Prompted by an in-platform Supabase notice about Sept 7 billing — which the dashboard later disproved: the org is on Free with the spend cap on, so no charge is possible.*

**Status: executed 2026-08-28.** Option A shipped — keep-alive cron, backup workflow, and this document. Option B remains documented below as the fallback if the 500 MB ceiling ever comes into view.

---

## Context

Supabase notified that the free trial ends and billing begins Sept 7. The app uses Supabase for exactly two things, both shallow: hosted Postgres (via Prisma only — no RLS, no extensions, no Supabase-specific SQL) and the private `expense-receipts` bucket (four functions in `src/lib/supabase-storage.ts`). Supabase Auth is unused — `auth.users` is empty; login is NextAuth against our own `Employee` table.

**This is live production.** 11 employees, 45 real OLI projects, data from March 2026 through Aug 25, 2026.

### Verified state (read-only inspection, 2026-08-26)

| | | vs Supabase Free limit |
|---|---|---|
| Database | **13 MB**, PostgreSQL 17.6, aws us-west-2 | 500 MB → **2.6% used** |
| Storage | **11 MB**, 15 objects | 1 GB → **1.1% used** |
| Egress | negligible (11 internal users) | 5 GB/mo |
| Rows | 525 TimesheetEntry · 91 TimesheetWeek · 45 Project · 28 LeaveBalance · 27 ExpenseItem · 18 ReportPeriod · 13 LeaveRequestDay · 11 Employee · 6 ExpenseReport · 6 ExpenseDocument · 4 LeaveRequest | |

Also found: only **6 of 15** storage objects are referenced by an `ExpenseDocument` row (~6.7 MB); 9 are orphans from re-uploaded drafts. All `Employee.photoUrl` are NULL, so the `**.supabase.co` entry in `next.config.ts` is dead config.

---

## Recommendation: Option A — stay on Supabase Free

I originally recommended migrating. **The inspection changed my mind:** you're using 2.6% of the free database allowance and 1.1% of the free storage allowance. Migrating a live payroll-adjacent system to dodge a bill you don't actually owe is risk without return.

> **Correction (2026-08-26, after seeing the billing dashboard):** the `OLI Architecture` org is **already on the Free Plan with the spend cap enabled**. That combination means Supabase *cannot* charge the account — the spend cap trades overage billing for degraded service (read-only / unresponsive) if quota is exceeded. So there is no downgrade to perform, and the migration is not merely unnecessary but answers a problem that doesn't exist.
>
> The Sept 7 notice therefore needs identifying before anything else — most likely a Pro trial that has already lapsed into this Free state (self-resolved), or a notice belonging to a **different organization** on the same account. Worth confirming the `qrrzcwutprywgxlzogaa` project actually sits in this org via the org switcher top-left.

| | **A — Supabase Free** | **B — Neon + Vercel Blob** |
|---|---|---|
| Effort | ~1 hour, no code migration | Several hours + a cutover window |
| Risk to live data | none | real (mitigated, not zero) |
| Ceiling | 500 MB DB / 1 GB files | 0.5 GB DB / 1 GB files |
| Idle behavior | **pauses after 7 days idle, manual resume** | scales to zero, **auto-resumes** |
| Automatic backups | ✗ none | ✗ none on free tier |
| Cost | $0 | $0 |

Option B's one real advantage is idle behavior — Neon resumes itself, Supabase needs a dashboard click. Option A closes that gap with a daily keep-alive cron. **Backups are missing on both** and must be solved either way — that's the actual production gap here, not the hosting provider.

Keep Option B (documented in full below) as the fallback for if you ever approach 500 MB.

---

## Option A — Stay on Supabase Free (recommended)

### A1. Identify the Sept 7 notice — then do nothing about billing *(you, dashboard)*
**No action needed on billing.** The org is on Free with the spend cap on, so no downgrade is possible and no charge can land. The notice was an **in-platform notification**, not an email — so it is almost certainly either stale (a trial that already lapsed into the current Free state) or scoped to a different organization.

Two low-effort confirmations, neither blocking:
- Open the notifications panel (bell icon, top-right of the Supabase dashboard) and screenshot the Sept 7 item. I'll identify it definitively. If it's gone, it was stale.
- Use the org switcher (top-left, beside `OLI Architecture`) to check for **other organizations** on the account, and confirm this org has **at most 2 active projects**. Free allows two; extras must be paused, and paused ones don't count. Exceeding that is one of the few ways to degrade service on Free.

Everything below is worth doing regardless of what that notification turns out to say.

### A2. Prevent the 7-day pause *(I build, you deploy)*
Supabase pauses a Free project after ~7 days of low database activity. "A few user requests to the database each day" is enough to prevent it. Your 11 employees generate that on any normal week — the risk is holiday gaps and quiet stretches between timesheet cycles.

Insurance is a daily keep-alive:
- New route `src/app/api/cron/keepalive/route.ts` — a trivial `SELECT 1` through Prisma, guarded by the same `CRON_SECRET` bearer check already used in `src/app/api/cron/timesheet-reminders/route.ts`.
- Add to `vercel.json`: `{ "path": "/api/cron/keepalive", "schedule": "0 6 * * *" }`.
- Vercel allows 100 crons per project on every plan; Hobby restricts frequency to **once per day**, which this respects exactly. Timing on Hobby is guaranteed only within the hour — irrelevant here.

### A3. Set up backups — the real gap *(I build, you add one secret)*
Supabase Free has **no automatic backups and no PITR**. For live HR/timesheet data that is the one genuinely unacceptable gap, and it is not fixed by switching providers.

**Decided:** a scheduled **GitHub Actions** workflow (`.github/workflows/backup.yml`) in the existing repo, running every 3 days:
1. `pg_dump --format=custom` the database (~13 MB) using `DIRECT_URL` from a repo secret.
2. Mirror the 15 storage objects out of the `expense-receipts` bucket.
3. Upload both as a single workflow artifact, `retention-days: 90`.
4. Support `workflow_dispatch` so it can be run on demand.

Every 3 days rather than weekly means it also doubles as a second keep-alive, independent of Vercel.

Two gotchas I'll account for: scheduled GitHub Actions **auto-disable after 60 days without repo activity** — which is why the Vercel cron in A2 stays the *primary* keep-alive and this is only the backstop; and 90-day artifact expiry means this is disaster recovery, not an archive. If you later want indefinite history, the same workflow can push dumps to a private backup repo instead — a one-line change to the final step.

*You provide:* a `SUPABASE_DB_URL` repo secret holding `DIRECT_URL`, and `SUPABASE_SERVICE_ROLE_KEY` for the bucket mirror (Settings → Secrets and variables → Actions). I write the workflow.

### A4. Verify
- Supabase dashboard shows plan = Free, no payment due.
- Trigger the keepalive route manually with the `CRON_SECRET` and confirm 200.
- Run the backup workflow via `workflow_dispatch` and confirm the artifact contains a restorable dump.
- Re-check usage against limits in 30 days.

### Optional cleanups (say the word)
- Delete the 9 orphaned storage objects (~4.3 MB). I'll hand you the list first; nothing gets deleted without your say-so.
- Drop the dead `**.supabase.co` block from `next.config.ts`.
- **Pre-existing bug:** uploads between 4.5 MB and the advertised 10 MB cap already fail on Vercel — that's the serverless request-body limit, and `documents/route.ts` advertises 10 MB. Nobody has hit it (largest file is 3.35 MB). Fix is lowering `MAX_SIZE` to an honest 4.5 MB or moving to client uploads.

---

## Option B — Migrate to Neon + Vercel Private Blob (fallback)

Kept documented in case you outgrow Free or want to leave regardless. **No credit card required anywhere** — Cloudflare R2 was considered and rejected because it demands a payment method even on its free tier.

- **Database → [Neon](https://neon.tech).** 0.5 GB + 100 CU-hours/month, no card, never expires, commercial use allowed. Pooled/direct endpoints map 1:1 onto the existing `DATABASE_URL`/`DIRECT_URL` split, so **`prisma/schema.prisma` is unchanged**. Pick region **AWS us-east-1** — Vercel functions default to `iad1`, so it's *lower* latency than today's us-west-2.
- **Files → [Vercel Private Blob](https://vercel.com/docs/vercel-blob/private-storage).** GA on all plans, no new account or card since you're already on Vercel. 1 GB + 10 GB transfer/month. Preserves today's security model exactly — private store, no public URL, short-lived signed URLs. Because `ExpenseDocument.fileUrl` stores a **relative path**, uploading with `addRandomSuffix: false` keeps all 6 rows valid: **no DB rewriting, no frontend change**.

**Steps.** (1) Archive all 15 objects locally. (2) Write `scripts/migrate-to-neon.ts` — `prisma db push` to create the schema, then copy rows in FK-safe order (Employee → Project → ReportPeriod → TimesheetWeek → TimesheetEntry → LeaveRequest → LeaveRequestDay → LeaveBalance → ExpenseReport → ExpenseItem → ExpenseDocument → GeneralRequest → RequestNote → PasswordResetToken), truncating Neon first so it's idempotent, then print a per-table count comparison. At ~800 rows this beats `pg_dump` — nothing to install, and it re-runs cleanly. (3) Write the file-copy script → `put()` with `access: 'private'`, `addRandomSuffix: false`. (4) Rehearse both while the app still points at Supabase. (5) Rewrite `src/lib/supabase-storage.ts` → `src/lib/receipt-storage.ts` on `@vercel/blob` (>= 2.3), keeping all four signatures identical — `put` / `del` / `get` / `issueSignedToken`+`presignUrl` — so the four import sites change by path only. (6) Verify locally against the full checklist. (7) Cutover in a low-traffic window: re-run both scripts *for real*, you swap the Vercel env vars, redeploy, smoke test, then pause Supabase.

**Do not change `NEXTAUTH_SECRET`** — it logs out every employee.

**Rollback:** revert env vars, redeploy. Supabase sits paused-but-intact — ~2 minutes.

---

## Verification checklist (Option B only)

- [ ] Per-table row counts match Supabase ↔ Neon (all 14 tables)
- [ ] All 15 objects in Blob with byte-identical sizes
- [ ] `npm run build` clean, zero `supabase` references in `src/`
- [ ] Admin + employee login both work (proves `passwordHash` survived)
- [ ] All 6 referenced receipts download
- [ ] Upload + delete round-trips
- [ ] Expense PDF export embeds receipts
- [ ] Production smoke test passes **before** Supabase is paused
