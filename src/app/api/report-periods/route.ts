import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getWeekStart } from "@/lib/utils";

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

  // Compute all week-start Mondays that overlap the range
  const firstMonday = getWeekStart(start);
  const lastMonday = getWeekStart(end);

  const mondays: Date[] = [];
  const cur = new Date(firstMonday);
  while (cur <= lastMonday) {
    mondays.push(new Date(cur));
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

  // Upsert a TimesheetWeek for every Monday overlapping the range
  for (const monday of mondays) {
    await db.timesheetWeek.upsert({
      where: {
        employeeId_weekStartDate: {
          employeeId: session.user.id,
          weekStartDate: monday,
        },
      },
      update: { reportPeriodId: newPeriod.id },
      create: {
        employeeId: session.user.id,
        weekStartDate: monday,
        reportPeriodId: newPeriod.id,
      },
    });
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
