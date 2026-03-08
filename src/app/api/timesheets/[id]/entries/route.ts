import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// PUT /api/timesheets/[id]/entries - save timesheet entries
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const timesheet = await db.timesheetWeek.findUnique({ where: { id } });
  if (!timesheet) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only the owner can save (unless admin)
  if (timesheet.employeeId !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Can only save DRAFT timesheets
  if (timesheet.status !== "DRAFT") {
    return NextResponse.json({ error: "Cannot edit a submitted timesheet" }, { status: 400 });
  }

  const { entries } = await req.json() as {
    entries: { projectId: string; date: string; hours: number; notes?: string }[];
  };

  // Upsert all entries
  await db.$transaction(
    entries
      .filter((e) => e.hours > 0)
      .map((e) =>
        db.timesheetEntry.upsert({
          where: {
            timesheetWeekId_projectId_date: {
              timesheetWeekId: id,
              projectId: e.projectId,
              date: new Date(e.date),
            },
          },
          update: { hours: e.hours, notes: e.notes ?? null },
          create: {
            timesheetWeekId: id,
            projectId: e.projectId,
            date: new Date(e.date),
            hours: e.hours,
            notes: e.notes ?? null,
          },
        })
      )
  );

  // Delete zero-hour entries
  const zeroEntries = entries.filter((e) => e.hours === 0);
  if (zeroEntries.length > 0) {
    await db.$transaction(
      zeroEntries.map((e) =>
        db.timesheetEntry.deleteMany({
          where: {
            timesheetWeekId: id,
            projectId: e.projectId,
            date: new Date(e.date),
          },
        })
      )
    );
  }

  // Update updatedAt
  const updated = await db.timesheetWeek.update({
    where: { id },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json(updated);
}
