import { NextResponse, after } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifyAdminsOfSubmission } from "@/lib/email";
import { canSubmitTimesheet, type TimesheetStatus } from "@/lib/timesheet-status";

// POST /api/report-periods/[id]/submit - submit all weeks in the period
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const period = await db.reportPeriod.findUnique({
    where: { id },
    include: { weeks: true, employee: { select: { name: true } } },
  });

  if (!period) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (period.employeeId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canSubmitTimesheet(period.status as TimesheetStatus)) {
    return NextResponse.json({ error: "Period is not in a submittable status" }, { status: 400 });
  }

  const now = new Date();

  await db.$transaction(async (tx) => {
    // Submit every week in the period. Filtering by status would silently skip weeks
    // whose status drifted, leaving the period SUBMITTED with locked weeks inside it.
    await tx.timesheetWeek.updateMany({
      where: { reportPeriodId: id },
      data: { status: "SUBMITTED", submittedAt: now },
    });

    // Update period status
    await tx.reportPeriod.update({
      where: { id },
      data: { status: "SUBMITTED", submittedAt: now },
    });
  });

  const updated = await db.reportPeriod.findUnique({
    where: { id },
    include: {
      weeks: {
        include: { entries: { orderBy: { date: "asc" } } },
        orderBy: { weekStartDate: "asc" },
      },
    },
  });

  // Notify admins after the response is sent. `after` keeps the serverless function alive
  // for this work; a bare un-awaited promise is discarded when the response returns.
  const employeeName = period.employee.name;
  after(async () => {
    await notifyAdminsOfSubmission("timesheet", employeeName, `/admin/report-periods/${id}`);
  });

  return NextResponse.json(updated);
}
