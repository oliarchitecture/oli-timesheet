import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getWeekStart } from "@/lib/utils";
import { absenceCodeForDay, hoursForDay } from "@/lib/leave-utils";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { status, comment } = await req.json() as {
    status: "APPROVED" | "REJECTED";
    comment?: string;
  };

  const request = await db.leaveRequest.findUnique({
    where: { id },
    include: { days: true },
  });
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (request.status !== "PENDING") {
    return NextResponse.json({ error: "Already reviewed" }, { status: 400 });
  }

  const updated = await db.leaveRequest.update({
    where: { id },
    data: {
      status,
      reviewedById: session.user.id,
      reviewComment: comment ?? null,
      reviewedAt: new Date(),
    },
  });

  if (status === "APPROVED") {
    // Calculate total days from per-day records
    const totalDays = request.days.reduce(
      (sum, d) => sum + (d.halfDay ? 0.5 : 1.0),
      0
    );
    const year = new Date(request.startDate).getFullYear();

    await db.leaveBalance.upsert({
      where: {
        employeeId_year_type: {
          employeeId: request.employeeId,
          year,
          type: request.type,
        },
      },
      update: { usedDays: { increment: totalDays } },
      create: {
        employeeId: request.employeeId,
        year,
        type: request.type,
        totalDays: 20,
        usedDays: totalDays,
      },
    });

    // Pre-fill any existing DRAFT timesheet weeks that overlap the approved leave days
    const officeAdminProject = await db.project.findFirst({
      where: { name: "001_Office Admin" },
    });

    if (officeAdminProject) {
      for (const day of request.days) {
        const weekStart = getWeekStart(new Date(day.date));
        const week = await db.timesheetWeek.findUnique({
          where: {
            employeeId_weekStartDate: {
              employeeId: request.employeeId,
              weekStartDate: weekStart,
            },
          },
        });
        if (!week || week.status !== "DRAFT") continue;

        await db.timesheetEntry.upsert({
          where: {
            timesheetWeekId_projectId_phase_date: {
              timesheetWeekId: week.id,
              projectId: officeAdminProject.id,
              phase: "",
              date: new Date(day.date),
            },
          },
          update: {
            hours: hoursForDay(day.halfDay),
            absenceCode: absenceCodeForDay(request.type, day.halfDay),
          },
          create: {
            timesheetWeekId: week.id,
            projectId: officeAdminProject.id,
            phase: "",
            date: new Date(day.date),
            hours: hoursForDay(day.halfDay),
            absenceCode: absenceCodeForDay(request.type, day.halfDay),
          },
        });
      }
    }
  }

  return NextResponse.json(updated);
}
