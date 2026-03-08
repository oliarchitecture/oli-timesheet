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

  if (timesheet.employeeId !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (timesheet.status !== "DRAFT") {
    return NextResponse.json({ error: "Cannot edit a submitted timesheet" }, { status: 400 });
  }

  const { entries } = await req.json() as {
    entries: {
      projectId: string;
      phase: string;
      date: string;
      hours: number;
      absenceCode?: string | null;
      notes?: string | null;
    }[];
  };

  const activeEntries = entries.filter((e) => e.hours > 0 || e.absenceCode);
  const emptyEntries = entries.filter((e) => e.hours === 0 && !e.absenceCode);

  // Upsert active entries
  if (activeEntries.length > 0) {
    await db.$transaction(
      activeEntries.map((e) =>
        db.timesheetEntry.upsert({
          where: {
            timesheetWeekId_projectId_phase_date: {
              timesheetWeekId: id,
              projectId: e.projectId,
              phase: e.phase,
              date: new Date(e.date),
            },
          },
          update: {
            hours: e.hours,
            absenceCode: e.absenceCode ?? null,
            notes: e.notes ?? null,
          },
          create: {
            timesheetWeekId: id,
            projectId: e.projectId,
            phase: e.phase,
            date: new Date(e.date),
            hours: e.hours,
            absenceCode: e.absenceCode ?? null,
            notes: e.notes ?? null,
          },
        })
      )
    );
  }

  // Delete entries that were cleared
  if (emptyEntries.length > 0) {
    await db.$transaction(
      emptyEntries.map((e) =>
        db.timesheetEntry.deleteMany({
          where: {
            timesheetWeekId: id,
            projectId: e.projectId,
            phase: e.phase,
            date: new Date(e.date),
          },
        })
      )
    );
  }

  const updated = await db.timesheetWeek.update({
    where: { id },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json(updated);
}
