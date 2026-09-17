/**
 * Repair script: unlock timesheet weeks whose status drifted out of sync with the
 * reporting period they belong to.
 *
 * Symptom this fixes: an employee is told their timesheet was returned for revision,
 * opens it, and finds the hour cells read-only with only a Submit button available.
 * That happens when the period is DRAFT / REVISION_REQUESTED (so it looks editable and
 * submittable) while one or more of its week rows are still SUBMITTED / APPROVED /
 * REJECTED (so the grid and the save endpoint lock them).
 *
 * SAFETY: this script only ever writes TimesheetWeek.status and .submittedAt.
 * It performs no deletes of any kind, never touches TimesheetEntry (the actual logged
 * hours), and never modifies a period that is SUBMITTED, APPROVED or REJECTED.
 *
 * Usage:
 *   npx tsx scripts/fix-stuck-timesheets.ts            # audit only, writes nothing
 *   npx tsx scripts/fix-stuck-timesheets.ts --apply    # perform the repair
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

/** Periods that the employee is expected to be able to edit. */
const EDITABLE_PERIOD_STATUSES = ["DRAFT", "REVISION_REQUESTED"] as const;

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function main() {
  const apply = process.argv.includes("--apply");

  // Weeks sitting inside an editable period but carrying a locked status of their own.
  const stuck = await db.timesheetWeek.findMany({
    where: {
      status: { not: "DRAFT" },
      reportPeriod: { status: { in: [...EDITABLE_PERIOD_STATUSES] } },
    },
    include: {
      employee: { select: { name: true, email: true } },
      reportPeriod: { select: { id: true, status: true, startDate: true, endDate: true } },
      _count: { select: { entries: true } },
    },
    orderBy: [{ employeeId: "asc" }, { weekStartDate: "asc" }],
  });

  if (stuck.length === 0) {
    console.log("No stuck timesheet weeks found. Nothing to do.");
    return;
  }

  console.log(
    `Found ${stuck.length} stuck week(s) — employee cannot edit these despite the period being open:\n`
  );

  for (const w of stuck) {
    const p = w.reportPeriod!;
    console.log(
      `  ${w.employee.name.padEnd(22)} period ${fmt(p.startDate)}–${fmt(p.endDate)} ` +
        `[${p.status}]  week ${fmt(w.weekStartDate)} is ${w.status}  ` +
        `(${w._count.entries} entr${w._count.entries === 1 ? "y" : "ies"}, all preserved)`
    );
  }

  if (!apply) {
    console.log(
      `\nAudit only — nothing was written. Re-run with --apply to set these ${stuck.length} ` +
        `week(s) to DRAFT so the employees can edit their hours.\n` +
        `No timesheet entries are deleted or changed by the repair.`
    );
    return;
  }

  console.log(`\nApplying repair to ${stuck.length} week(s)...`);

  const result = await db.timesheetWeek.updateMany({
    where: { id: { in: stuck.map((w) => w.id) } },
    data: { status: "DRAFT", submittedAt: null },
  });

  console.log(`Unlocked ${result.count} week(s). Logged hours are untouched.`);
  console.log("Re-run without --apply to confirm the audit now reports zero.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
