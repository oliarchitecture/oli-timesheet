# OLI Architecture — Employee Portal

Internal HR and timesheet management app for OLI Architecture. Employees can submit timesheets, request PTO, and file monthly expense reports. Admins review and approve submissions, manage employees and projects, and export reports.

---

## Features

### Employees
- **Timesheets** — Weekly timesheet grid with project/phase tracking and absence codes (Vacation, Sick, Holiday, etc.)
- **PTO Requests** — Submit and track paid time-off requests; view remaining balances per category
- **Expense Reports** — Monthly expense reports with line items (project, category, description, amount), receipt uploads, and advance tracking
- **Dashboard** — At-a-glance view of current week hours, pending requests, and recent activity

### Admins
- **Review & Approve** — Approve or reject timesheets, PTO requests, and expense reports with comments
- **Export** — Download expense reports as a ZIP containing a formatted Excel file and all uploaded receipts
- **Employee Management** — Create and manage employee accounts, roles, and PTO balances
- **Project Management** — Manage active/completed projects used across timesheets and expenses
- **Reports** — Export timesheet data to Excel

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Components | Radix UI primitives + shadcn/ui (manually created) |
| ORM | Prisma v6 |
| Database | PostgreSQL via Supabase |
| Auth | NextAuth v5 (beta) — email/password, JWT sessions |
| File Storage | Supabase Storage |
| Excel Export | xlsx |
| ZIP Export | jszip |

---

## Project Structure

```
src/
├── app/
│   ├── (app)/              # Employee-facing routes (dashboard, timesheets, leave, expenses, profile)
│   ├── (auth)/             # Login page
│   ├── admin/              # Admin routes (dashboard, employees, projects, timesheets, leave, expenses, reports)
│   └── api/                # REST API route handlers
├── components/
│   ├── layout/             # Sidebar, Header
│   ├── timesheet/          # TimesheetGrid, ReviewActions, StatusProgress
│   ├── leave/              # DeletePTOButton
│   └── ui/                 # Button, Card, Badge, Dialog, Input, Label, Select, Tabs, etc.
├── lib/
│   ├── auth.ts             # NextAuth configuration
│   ├── db.ts               # Prisma singleton
│   ├── utils.ts            # Date helpers (getWeekStart, formatDate, daysBetween)
│   └── supabase-storage.ts # Supabase Storage upload/download/sign helpers
prisma/
└── schema.prisma           # Database schema
```

---

## Database Schema

| Model | Description |
|---|---|
| `Employee` | User accounts with role (ADMIN / EMPLOYEE) |
| `Project` | Projects referenced in timesheets and expense reports |
| `TimesheetWeek` | One record per employee per week; status: DRAFT → SUBMITTED → APPROVED / REJECTED |
| `TimesheetEntry` | Individual daily entries (project, phase, hours, absence code) |
| `LeaveRequest` | PTO requests; status: PENDING → APPROVED / REJECTED |
| `LeaveBalance` | Tracks total and used days per employee, year, and leave type |
| `ExpenseReport` | Monthly expense report; status: DRAFT → SUBMITTED → APPROVED / REJECTED |
| `ExpenseItem` | Line items on an expense report (project, category, description, amount) |
| `ExpenseDocument` | Uploaded receipts stored in Supabase Storage |

---

## Getting Started

### Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) project with:
  - A PostgreSQL database
  - A private storage bucket named `expense-receipts`

### 1. Clone and install

```bash
git clone https://github.com/oliarchitecture/oli-timesheet.git
cd oli-timesheet
npm install
```

### 2. Configure environment

Copy the example env file and fill in your values:

```bash
cp .env.local.example .env.local
```

| Variable | Description |
|---|---|
| `DATABASE_URL` | Supabase pooler connection string (port 6543) |
| `DIRECT_URL` | Supabase direct connection string (port 5432) |
| `NEXTAUTH_SECRET` | Random secret — generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `http://localhost:3000` for local dev; your Vercel URL in production |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side storage access) |

### 3. Set up the database

```bash
npx prisma db push
npm run db:seed
```

The seed creates a default admin account:
- **Email:** `admin@oli.com`
- **Password:** `password123`

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> **Important:** When switching between local dev and production, update `NEXTAUTH_URL` accordingly. The Vercel deployment uses its own env vars set in the Vercel dashboard — `.env.local` is never deployed.

---

## Deployment (Vercel)

1. Push to GitHub
2. Import the repo in [Vercel](https://vercel.com)
3. Add all environment variables from `.env.local` in the Vercel dashboard, setting `NEXTAUTH_URL` to your production URL
4. Deploy — the build step runs `prisma generate && next build` automatically

---

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Generate Prisma client and build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run db:push` | Push schema changes to the database |
| `npm run db:seed` | Seed the database with initial data |
| `npm run db:studio` | Open Prisma Studio (database browser) |

---

## Role-Based Access

| Feature | Employee | Admin |
|---|---|---|
| View own timesheets / submit | ✅ | — |
| View all timesheets / review | — | ✅ |
| Submit PTO requests | ✅ | — |
| Review PTO requests | — | ✅ |
| Submit expense reports / upload receipts | ✅ | — |
| Review expense reports / export ZIP | — | ✅ |
| Manage employees and projects | — | ✅ |
| View reports | — | ✅ |

Route protection is enforced in `src/middleware.ts` (redirects unauthenticated users) and in each page/API route (role checks).
