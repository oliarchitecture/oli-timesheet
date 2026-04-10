import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// POST /api/report-periods/[id]/submit - submit all weeks in the period
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const period = await db.reportPeriod.findUnique({
    where: { id },
    include: { weeks: true },
  });

  if (!period) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (period.employeeId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (period.status !== "DRAFT") {
    return NextResponse.json({ error: "Period is not in DRAFT status" }, { status: 400 });
  }

  const now = new Date();

  await db.$transaction(async (tx) => {
    // Submit all DRAFT weeks
    await tx.timesheetWeek.updateMany({
      where: { reportPeriodId: id, status: "DRAFT" },
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

  return NextResponse.json(updated);
}
