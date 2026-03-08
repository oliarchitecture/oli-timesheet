# OLI Architecture — Employee Management Application
## Project Plan & Technical Specification

**Prepared for:** OLI Architecture
**Date:** March 2026
**Status:** Proposed

---

## 1. Overview

OLI Architecture needs an internal web application to manage employees, track time, handle leave requests, and generate reports. The application will be:

- **Browser-based** — employees open it in Chrome/Safari/Edge; nothing to install on their computers
- **Professionally branded** with the OLI Architecture logo and color palette
- **Role-based** — Admin (manager) and Employee access levels
- **Easy to maintain** — updates deploy automatically; data is viewable in a spreadsheet-like dashboard

---

## 2. Features

### 2.1 Authentication & Access Control
- Secure email + password login
- Two roles:
  - **Admin** — full access; can manage employees, approve timesheets and leave, manage projects
  - **Employee** — can view own profile, submit timesheets, request leave

### 2.2 Dashboard
- Current week's hours summary per employee
- Pending items requiring Admin approval (timesheets, leave requests)
- Active project count
- Quick-access navigation

### 2.3 Employee Directory
| Field | Description |
|---|---|
| Full name | |
| Job title / role | |
| Email address | |
| Phone number | |
| Start date | |
| Profile photo | |
| Status | Active / Inactive |

- Admin can add, edit, and deactivate employees
- Employees can update their own contact info and photo

### 2.4 Project List
A simple reference list used to categorize timesheet entries.

| Field | Description |
|---|---|
| Project name | |
| Client name | |
| Project code | e.g. OLI-2024-001 |
| Status | Active / Completed / On Hold |

### 2.5 Timesheets
- **Weekly grid view** — rows = projects, columns = days (Mon–Sun)
- Enter hours per project per day, with optional notes
- Save as draft, then submit for approval
- **Admin workflow:** review submitted timesheets → Approve or Reject with a comment
- **Exports:** Download as PDF (printable) or Excel spreadsheet

### 2.6 Leave Requests
- Leave types: Vacation, Sick, Personal, Other
- Employee submits: start date, end date, reason
- **Admin workflow:** Approve or Reject with a comment
- Leave balance tracking (configurable annual allowances per employee)
- Calendar view showing who is off on which days

### 2.7 Reports & Exports
| Report | Description |
|---|---|
| Hours by Employee | Total hours per employee for a date range |
| Hours by Project | Total hours per project for a date range |
| Leave Summary | Leave taken and remaining balances |

All reports exportable to PDF and Excel.

---

## 3. Technology Stack

All technology choices are made with one priority: **ease of long-term maintenance for a non-technical team.**

| Component | Technology | Why chosen |
|---|---|---|
| Web framework | **Next.js** (React) | Industry standard; excellent documentation; large support community |
| Language | **TypeScript** | Catches errors before they reach users; makes future updates safer |
| Database | **PostgreSQL via Supabase** | Free tier; Supabase provides a visual dashboard to browse/edit data; automatic backups |
| Database access | **Prisma ORM** | Database changes managed through simple migration files |
| Authentication | **NextAuth.js** | Secure session management; easy to configure |
| UI components | **shadcn/ui** | Polished, professional components used by thousands of production apps |
| Styling | **Tailwind CSS** | Brand colors and fonts defined in a single configuration file |
| PDF export | **react-pdf** | Generates printable PDF documents |
| Excel export | **xlsx** | Generates Excel spreadsheets |
| Hosting | **Vercel** (free) | Connects to GitHub; auto-deploys when code changes are pushed |

---

## 4. How Maintenance Works

This is designed so that day-to-day operation requires **no technical knowledge:**

| Task | How it works |
|---|---|
| Update the app (new features, bug fixes) | A developer updates the code and pushes to GitHub → Vercel auto-deploys in ~2 minutes |
| View or edit raw data | Log into Supabase dashboard (looks like Google Sheets) |
| Backups | Supabase handles this automatically |
| Change brand colors | Edit one line in `tailwind.config.ts` |
| Add a new employee | Use the Admin panel inside the app |
| Change someone's role or deactivate them | Use the Admin panel inside the app |

---

## 5. Infrastructure & Accounts Required

| Service | Cost | Purpose |
|---|---|---|
| [GitHub](https://github.com) | Free | Stores the code; triggers auto-deployment |
| [Supabase](https://supabase.com) | Free | Database + file storage (employee photos) |
| [Vercel](https://vercel.com) | Free | Hosts the web application |

**Total monthly cost: $0** (all free tiers are sufficient for a 1–10 person team)

Optional: Connect a custom domain (e.g. `app.oliarchitecture.com`) — typically $10–15/year through any domain registrar.

---

## 6. Database Structure

```
Employee
  ├── id, name, email, passwordHash
  ├── role (ADMIN | EMPLOYEE)
  ├── title, phone, startDate, photoUrl
  └── isActive

Project
  ├── id, name, clientName, code
  ├── status (ACTIVE | COMPLETED | ON_HOLD)
  └── createdAt

TimesheetWeek
  ├── id, employeeId, weekStartDate
  ├── status (DRAFT | SUBMITTED | APPROVED | REJECTED)
  ├── reviewedById, reviewComment
  └── submittedAt, reviewedAt

TimesheetEntry
  ├── id, timesheetWeekId, projectId
  ├── date, hours, notes
  └── (links a week to project hours per day)

LeaveRequest
  ├── id, employeeId
  ├── type (VACATION | SICK | PERSONAL | OTHER)
  ├── startDate, endDate, reason
  ├── status (PENDING | APPROVED | REJECTED)
  └── reviewedById, reviewComment, createdAt

LeaveBalance
  ├── id, employeeId, year, type
  └── totalDays, usedDays
```

---

## 7. Application Structure (File Layout)

```
oli-employee-management/
├── .env.local                  ← Database URL, auth secret (private)
├── prisma/
│   └── schema.prisma           ← Database schema (single source of truth)
├── public/
│   └── logo.png                ← OLI Architecture logo
├── src/
│   ├── app/                    ← Application pages
│   │   ├── login/              ← Login page with OLI branding
│   │   ├── dashboard/          ← Home after login
│   │   ├── employees/          ← Directory + profiles
│   │   ├── projects/           ← Project list
│   │   ├── timesheets/         ← Weekly timesheets
│   │   ├── leave/              ← Leave requests
│   │   └── reports/            ← Reporting + exports
│   ├── components/             ← Reusable UI pieces (header, sidebar, etc.)
│   └── lib/
│       ├── auth.ts             ← Authentication configuration
│       ├── db.ts               ← Database client
│       └── utils.ts            ← Shared utilities
├── tailwind.config.ts          ← Brand colors defined here
└── package.json                ← Dependencies list
```

---

## 8. Branding

- OLI Architecture logo placed in `public/logo.png` — appears in the sidebar navigation and login page
- A professional color palette will be derived from the logo
- Design aesthetic: clean lines, neutral tones, generous white space — fitting for an architecture firm
- The entire color theme is defined in **one file** (`tailwind.config.ts`) and can be updated in minutes

---

## 9. Implementation Phases

### Phase 1 — Foundation (~1–2 days)
- Project setup with all dependencies
- Database schema created and deployed to Supabase
- Login page with OLI Architecture branding
- Navigation layout (sidebar with logo, header)
- Vercel deployment connected to GitHub

**Deliverable:** Branded login page accessible via Vercel URL

---

### Phase 2 — Employee Directory (~1–2 days)
- Employee list page with search
- Individual employee profile page
- Admin: add new employee, edit details, deactivate
- Profile photo upload

**Deliverable:** Full employee directory, Admin can manage the team

---

### Phase 3 — Projects (~half a day)
- Project list with status indicators
- Admin: create, edit, archive projects
- Used as reference data for timesheets

**Deliverable:** Project list ready for linking to timesheets

---

### Phase 4 — Timesheets (~2–3 days)
- Weekly grid view (projects × days)
- Enter hours, save draft, submit for review
- Admin approval/rejection workflow with comments
- PDF export (printable timesheet)
- Excel export

**Deliverable:** Full timesheet workflow from entry to approval to export

---

### Phase 5 — Leave Requests (~1–2 days)
- Leave request form (type, dates, reason)
- Admin approval/rejection with comments
- Leave balance display per employee
- Calendar view (who is off, when)

**Deliverable:** Full leave management workflow

---

### Phase 6 — Reports & Final Polish (~1–2 days)
- Reports page with filters (employee, project, date range)
- Export all reports to PDF and Excel
- Final branding review
- Responsive layout check (works on laptop screens)
- End-to-end testing

**Deliverable:** Complete, polished application ready for full team use

---

## 10. One-Time Setup Steps (for reference)

1. Create a free account on [GitHub](https://github.com)
2. Create a free account on [Supabase](https://supabase.com) → get a database connection URL
3. Create a free account on [Vercel](https://vercel.com) → connect to the GitHub repository
4. Add the Supabase connection URL to Vercel's environment settings
5. *(Optional)* Connect a custom domain

After this one-time setup, the developer pushes code and everything deploys automatically.

---

## 11. What Is Needed to Begin

1. **OLI Architecture logo file** (PNG or SVG preferred) — to derive brand colors and apply to the login screen and navigation
2. **Approval of this plan** — to confirm scope before development begins

---

*This document was prepared as a development plan for internal use by OLI Architecture.*
