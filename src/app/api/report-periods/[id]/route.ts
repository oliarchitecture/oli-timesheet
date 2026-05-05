import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/report-periods/[id]
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const period = await db.reportPeriod.findUnique({
    where: { id },
    include: {
      employee: { select: { name: true, email: true } },
      weeks: {
        include: {
          entries: { orderBy: { date: "asc" } },
        },
        orderBy: { weekStartDate: "asc" },
      },
    },
  });

  if (!period) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (period.employeeId !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(period);
}

// DELETE /api/report-periods/[id]
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const period = await db.reportPeriod.findUnique({
    where: { id },
    select: { employeeId: true, status: true },
  });

  if (!period) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const isAdmin = session.user.role === "ADMIN";
  if (!isAdmin && period.employeeId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!isAdmin && period.status !== "DRAFT") {
    return NextResponse.json({ error: "Only draft periods can be deleted" }, { status: 400 });
  }

  if (isAdmin && period.status !== "DRAFT") {
    // Admin deleting a non-draft: unlink weeks but keep their data
    await db.timesheetWeek.updateMany({
      where: { reportPeriodId: id },
      data: { reportPeriodId: null },
    });
  } else {
    // Deleting a draft: remove weeks and entries entirely so re-creation starts fresh
    const weeks = await db.timesheetWeek.findMany({
      where: { reportPeriodId: id },
      select: { id: true },
    });
    const weekIds = weeks.map((w) => w.id);
    await db.timesheetEntry.deleteMany({ where: { timesheetWeekId: { in: weekIds } } });
    await db.timesheetWeek.deleteMany({ where: { id: { in: weekIds } } });
  }

  await db.reportPeriod.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
