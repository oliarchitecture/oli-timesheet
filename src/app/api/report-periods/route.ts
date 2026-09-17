import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getWeekStart } from "@/lib/utils";
import { isSameUTCDay } from "@/lib/holidays";
import { absenceCodeForDay, hoursForDay } from "@/lib/leave-utils";

// POST /api/report-periods - create a new reporting period
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { startDate, endDate } = body as { startDate: string; endDate: string };

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "startDate and endDate are required" }, { status: 400 });
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return NextResponse.json({ error: "Invalid dates" }, { status: 400 });
  }

  // End must be more than 7 days after start
  const diffMs = end.getTime() - start.getTime();
  if (diffMs <= 7 * 24 * 60 * 60 * 1000) {
    return NextResponse.json({ error: "End date must be more than 7 days after start date" }, { status: 400 });
  }

  // One period per range. Without this an employee who feels stuck on an existing period
  // can create a duplicate covering the same dates, which then competes with it for the
  // same week rows and leaves both looking broken.
  const overlapping = await db.reportPeriod.findFirst({
    where: {
      employeeId: session.user.id,
      startDate: { lte: end },
      endDate: { gte: start },
    },
    orderBy: { startDate: "asc" },
  });
  if (overlapping) {
    return NextResponse.json(
      {
        error:
          `You already have a timesheet for ${overlapping.startDate.toISOString().slice(0, 10)} – ` +
          `${overlapping.endDate.toISOString().slice(0, 10)}. Open that one instead of creating a new one.`,
        periodId: overlapping.id,
      },
      { status: 409 }
    );
  }

  // Compute all week-start dates (Sundays) that overlap the range
  const firstWeekStart = getWeekStart(start);
  const lastWeekStart = getWeekStart(end);

  const weekStarts: Date[] = [];
  const cur = new Date(firstWeekStart);
  while (cur <= lastWeekStart) {
    weekStarts.push(new Date(cur));
    cur.setUTCDate(cur.getUTCDate() + 7);
  }

  // Create the period record
  const newPeriod = await db.reportPeriod.create({
    data: {
      employeeId: session.user.id,
      startDate: start,
      endDate: end,
    },
  });

  // Attach a TimesheetWeek for every week overlapping the range.
  //
  // A week can only have one parent period, but weeks run Sun–Sat while periods are
  // arbitrary ranges, so a boundary week can overlap two periods. If that week was already
  // submitted or approved under the earlier period we leave it there — pulling it across
  // would either reopen reviewed hours or (worse) drag its lock into this new period and
  // leave the employee unable to edit. Anything still in progress moves over and is reset
  // to DRAFT so it matches the period it now belongs to.
  for (const weekStart of weekStarts) {
    const existing = await db.timesheetWeek.findUnique({
      where: {
        employeeId_weekStartDate: { employeeId: session.user.id, weekStartDate: weekStart },
      },
      select: { id: true, status: true },
    });

    if (!existing) {
      await db.timesheetWeek.create({
        data: {
          employeeId: session.user.id,
          weekStartDate: weekStart,
          reportPeriodId: newPeriod.id,
        },
      });
      continue;
    }

    if (existing.status === "SUBMITTED" || existing.status === "APPROVED") continue;

    await db.timesheetWeek.update({
      where: { id: existing.id },
      data: { reportPeriodId: newPeriod.id, status: "DRAFT", submittedAt: null },
    });
  }

  // Pre-fill approved PTO into the newly-created weeks
  const [approvedLeaves, officeAdminProject] = await Promise.all([
    db.leaveRequest.findMany({
      where: {
        employeeId: session.user.id,
        status: "APPROVED",
        startDate: { lte: end },
        endDate: { gte: start },
      },
      include: { days: true },
    }),
    db.project.findFirst({ where: { name: "001_Office Admin" } }),
  ]);

  if (officeAdminProject && approvedLeaves.length > 0) {
    const weeks = await db.timesheetWeek.findMany({
      where: { reportPeriodId: newPeriod.id },
      select: { id: true, weekStartDate: true },
    });

    for (const leave of approvedLeaves) {
      for (const day of leave.days) {
        const dayDate = new Date(day.date);
        const weekStart = getWeekStart(dayDate);
        const week = weeks.find((w) => isSameUTCDay(w.weekStartDate, weekStart));
        if (!week) continue;

        await db.timesheetEntry.upsert({
          where: {
            timesheetWeekId_projectId_phase_date: {
              timesheetWeekId: week.id,
              projectId: officeAdminProject.id,
              phase: "",
              date: dayDate,
            },
          },
          update: {
            hours: hoursForDay(day.halfDay),
            absenceCode: absenceCodeForDay(leave.type, day.halfDay),
          },
          create: {
            timesheetWeekId: week.id,
            projectId: officeAdminProject.id,
            phase: "",
            date: dayDate,
            hours: hoursForDay(day.halfDay),
            absenceCode: absenceCodeForDay(leave.type, day.halfDay),
          },
        });
      }
    }
  }

  // Fetch the period with its weeks in a fresh query
  const period = await db.reportPeriod.findUnique({
    where: { id: newPeriod.id },
    include: { weeks: { orderBy: { weekStartDate: "asc" } } },
  });

  return NextResponse.json(period, { status: 201 });
}

// GET /api/report-periods - list periods for current user
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const where = session.user.role === "ADMIN" ? {} : { employeeId: session.user.id };

  const periods = await db.reportPeriod.findMany({
    where,
    include: {
      employee: { select: { name: true, email: true } },
      weeks: {
        include: { entries: true },
        orderBy: { weekStartDate: "asc" },
      },
    },
    orderBy: { startDate: "desc" },
  });

  return NextResponse.json(periods);
}
