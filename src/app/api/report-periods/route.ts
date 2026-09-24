import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getWeekStart } from "@/lib/utils";
import { weekStartsForRange } from "@/lib/period-weeks";
import { loadPeriodWeeks } from "@/lib/period-weeks.server";
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
  const weekStarts = weekStartsForRange(start, end);

  // Create the period record
  const newPeriod = await db.reportPeriod.create({
    data: {
      employeeId: session.user.id,
      startDate: start,
      endDate: end,
    },
  });

  // Make sure a TimesheetWeek exists for every week overlapping the range.
  //
  // A week can only have one parent period, but weeks run Sun–Sat while periods follow
  // calendar months, so a boundary week overlaps two of them. Ownership goes to whichever
  // period got there first and stays put — this period simply borrows the week and edits
  // its own days (see loadPeriodWeeks / lockedDaysForWeek). Re-parenting it here used to
  // make the week disappear from the earlier period and reset its status along the way.
  for (const weekStart of weekStarts) {
    const existing = await db.timesheetWeek.findUnique({
      where: {
        employeeId_weekStartDate: { employeeId: session.user.id, weekStartDate: weekStart },
      },
      select: { id: true, reportPeriodId: true },
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

    // Unattached weeks (created by the current-week upsert or by PTO approval) have no
    // period to lose, so this one adopts them.
    if (existing.reportPeriodId === null) {
      await db.timesheetWeek.update({
        where: { id: existing.id },
        data: { reportPeriodId: newPeriod.id },
      });
    }
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
    // Includes boundary weeks this period borrows, so PTO falling in the first or last
    // partial week still gets pre-filled.
    const weeks = await loadPeriodWeeks(session.user.id, newPeriod);

    for (const leave of approvedLeaves) {
      for (const day of leave.days) {
        const dayDate = new Date(day.date);
        // Only this period's own days — the rest of a shared week belongs to its neighbour.
        if (dayDate < start || dayDate > end) continue;
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
