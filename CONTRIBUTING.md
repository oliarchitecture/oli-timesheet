# Contributing to OLI Employee Portal

This document covers how to set up your development environment, the conventions used in this codebase, and the process for making changes.

---

## Development Setup

Follow the [Getting Started](README.md#getting-started) steps in the README to get a local environment running.

A few things to keep in mind:

- **`NEXTAUTH_URL` must be `http://localhost:3000`** when running locally. The production value lives in the Vercel dashboard and should not be committed.
- **Do not commit `.env.local`** — it contains real credentials. It is already in `.gitignore`.
- The dev server and `npm run build` cannot run at the same time on Windows — the dev server holds the Prisma DLL. Stop the dev server before building.

---

## Making Schema Changes

1. Edit `prisma/schema.prisma`
2. Run `npx prisma db push` to apply changes to your local/dev database (this also regenerates the Prisma Client)
3. If the change affects the seed data, update `prisma/seed.ts`
4. Verify the build still passes: `npx next build`

> Migrations are not used — we use `prisma db push` (schema push). This means schema changes are applied directly. Be careful with destructive changes (dropping columns/tables) on the shared Supabase database.

---

## Code Conventions

### File & Folder Structure

- **Employee pages:** `src/app/(app)/[feature]/`
- **Admin pages:** `src/app/admin/[feature]/`
- **API routes:** `src/app/api/[resource]/[id]/[action]/route.ts`
- **Shared components:** `src/components/ui/` (generic), `src/components/[feature]/` (feature-specific)
- **Utilities/helpers:** `src/lib/`

### Pages

- **Server components by default** — fetch data directly with Prisma at the top of the page.
- Use `"use client"` only when the component needs interactivity (state, event handlers, browser APIs).
- Complex interactive sections are split into a separate client component (e.g., `ExpenseForm.tsx`, `TimesheetGrid.tsx`) that receives data as props from a server page.

### API Routes

- Every route handler checks authentication first via `await auth()`.
- Admin-only routes check `session.user.role !== "ADMIN"` and return 403.
- Employees can only access their own records — always validate `record.employeeId === session.user.id`.
- Return `NextResponse.json({ error: "..." }, { status: N })` for errors.

### UI Components

- All UI primitives are in `src/components/ui/` and were created manually (the shadcn CLI has TTY issues on Windows).
- Use existing components (Button, Badge, Card, Dialog, etc.) rather than writing raw HTML elements for common patterns.
- Icons come from `lucide-react`.
- Do not add inline styles — use Tailwind utility classes.

### Tailwind

- The project uses **Tailwind CSS v4** with `@import "tailwindcss"` syntax (not the v3 `@tailwind` directives).
- Brand color: `primary-*` (warm gold, defined in `src/app/globals.css`).
- Neutral grays: `neutral-*`.

---

## Adding a New Feature

A typical feature (e.g., a new employee-facing section) involves:

1. **Prisma schema** — add models/fields to `prisma/schema.prisma`, then `npx prisma db push`
2. **API routes** — add route handlers under `src/app/api/[resource]/`
3. **Employee page** — add pages under `src/app/(app)/[feature]/`
4. **Admin page** (if needed) — add pages under `src/app/admin/[feature]/`
5. **Sidebar** — add nav items to both `employeeNav` and `adminNav` in `src/components/layout/Sidebar.tsx`
6. **Dashboard** — add a stat card and/or recent-activity card to `src/app/(app)/dashboard/page.tsx` and `src/app/admin/page.tsx`

---

## File Uploads

Receipts and other documents are stored in **Supabase Storage** in the `expense-receipts` bucket (private).

- Use the helpers in `src/lib/supabase-storage.ts`: `uploadReceipt`, `deleteReceipt`, `downloadReceipt`, `getSignedUrl`.
- File paths follow the pattern: `{employeeId}/{reportId}/{timestamp}_{filename}`
- Signed URLs expire after 5 minutes — generate them on demand, not in advance.
- The bucket must be set to **private** in the Supabase dashboard.

---

## Before Pushing

1. Run `npx next build` and confirm it passes with zero TypeScript errors.
2. Test the affected flows manually in the browser against the local dev server.
3. Restore `NEXTAUTH_URL` to the production value in Vercel (not in `.env.local`) before the change goes live.

---

## Deployment

Pushes to `main` automatically trigger a Vercel deployment. There is no staging environment — test thoroughly locally before merging to `main`.

Production environment variables are managed in the **Vercel dashboard**, not in any committed file.
