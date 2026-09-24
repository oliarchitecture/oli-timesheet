import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getWeekDays } from "@/lib/utils";
import { canEditTimesheet, effectiveStatus, statusLabel } from "@/lib/timesheet-status";
import { lockedDaysForWeek, toDayKey, type PeriodRange } from "@/lib/period-weeks";

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

  const { entries, periodId } = await req.json() as {
    entries: {
      projectId: string;
      phase: string;
      date: string;
      hours: number;
      absenceCode?: string | null;
      notes?: string | null;
    }[];
    periodId?: string | null;
  };

  const isAdmin = session.user.role === "ADMIN";
  const weekDays = getWeekDays(timesheet.weekStartDate);

  // Every period of this employee that the week touches. A Sun–Sat week can straddle two
  // of them, and only one can be its parent — so the period the caller is editing from is
  // what decides which days may be written, not whichever one happens to own the row.
  const overlappingPeriods: PeriodRange[] = await db.reportPeriod.findMany({
    where: {
      employeeId: timesheet.employeeId,
      startDate: { lte: weekDays[6] },
      endDate: { gte: weekDays[0] },
    },
    select: { id: true, status: true, startDate: true, endDate: true },
  });

  // Trust the caller's periodId only after confirming it is one of their own overlapping
  // periods; otherwise fall back to the period that owns the row.
  const viewingPeriod =
    overlappingPeriods.find((p) => p.id === periodId) ??
    overlappingPeriods.find((p) => p.id === timesheet.reportPeriodId) ??
    null;

  if (!canEditTimesheet({ weekStatus: timesheet.status, periodStatus: viewingPeriod?.status ?? null, isAdmin })) {
    const status = effectiveStatus(timesheet.status, viewingPeriod?.status ?? null);
    return NextResponse.json(
      { error: `This timesheet is locked (${statusLabel[status] ?? status}) and can't be edited.` },
      { status: 400 }
    );
  }

  // Days outside the dates this period covers. Recomputed here rather than trusted from the
  // payload, so a client cannot reach into the neighbouring timesheet's half of the week.
  const lockedDates = [...lockedDaysForWeek({ weekStart: timesheet.weekStartDate, viewing: viewingPeriod })]
    .map(([key]) => new Date(`${key}T00:00:00.000Z`));
  const lockedDayKeys = new Set(lockedDates.map(toDayKey));

  const activeEntries = entries.filter(
    (e) => (e.hours > 0 || e.absenceCode) && !lockedDayKeys.has(toDayKey(e.date))
  );

  // Replace this week's entries, but leave the locked days untouched — they belong to the
  // other timesheet sharing this week and are not the caller's to rewrite.
  // Uses interactive transaction to avoid race conditions between concurrent saves.
  await db.$transaction(async (tx) => {
    await tx.timesheetEntry.deleteMany({
      where: {
        timesheetWeekId: id,
        ...(lockedDates.length > 0 ? { date: { notIn: lockedDates } } : {}),
      },
    });
    if (activeEntries.length > 0) {
      await tx.timesheetEntry.createMany({
        data: activeEntries.map((e) => ({
          timesheetWeekId: id,
          projectId: e.projectId,
          phase: e.phase,
          date: new Date(e.date),
          hours: e.hours,
          absenceCode: e.absenceCode ?? null,
          notes: e.notes ?? null,
        })),
        skipDuplicates: true,
      });
    }
  });

  const updated = await db.timesheetWeek.update({
    where: { id },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json(updated);
}
