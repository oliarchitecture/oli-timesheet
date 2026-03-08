import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getWeekStart } from "@/lib/utils";

// GET /api/timesheets - list timesheets for current user (or all for admin)
export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get("employeeId");
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (session.user.role === "ADMIN") {
    if (employeeId) where.employeeId = employeeId;
    if (status) where.status = status;
  } else {
    where.employeeId = session.user.id;
  }

  const timesheets = await db.timesheetWeek.findMany({
    where,
    include: {
      employee: { select: { name: true, email: true } },
      entries: true,
    },
    orderBy: { weekStartDate: "desc" },
  });

  return NextResponse.json(timesheets);
}

// POST /api/timesheets - create or get current week's timesheet
export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const weekStart = getWeekStart(new Date());

  const timesheet = await db.timesheetWeek.upsert({
    where: {
      employeeId_weekStartDate: {
        employeeId: session.user.id,
        weekStartDate: weekStart,
      },
    },
    update: {},
    create: {
      employeeId: session.user.id,
      weekStartDate: weekStart,
    },
  });

  return NextResponse.json(timesheet);
}
