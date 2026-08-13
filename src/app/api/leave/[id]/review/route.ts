import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getWeekStart } from "@/lib/utils";
import { absenceCodeForDay, hoursForDay } from "@/lib/leave-utils";
import { notifyEmployeeDecision } from "@/lib/email";

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
    status: "APPROVED" | "REJECTED" | "REVISION_REQUESTED";
    comment?: string;
  };

  if (status !== "APPROVED" && status !== "REJECTED" && status !== "REVISION_REQUESTED") {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  if ((status === "REJECTED" || status === "REVISION_REQUESTED") && !comment?.trim()) {
    return NextResponse.json({ error: "A comment is required" }, { status: 400 });
  }

  const request = await db.leaveRequest.findUnique({
    where: { id },
    include: { days: true, employee: { select: { name: true, email: true } } },
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
    // Group days by their individual type and sum days per type
    const daysByType = new Map<string, number>();
    for (const d of request.days) {
      const amount = d.halfDay ? 0.5 : 1.0;
      daysByType.set(d.type, (daysByType.get(d.type) ?? 0) + amount);
    }
    const year = new Date(request.startDate).getFullYear();

    for (const [type, totalDays] of daysByType) {
      await db.leaveBalance.upsert({
        where: {
          employeeId_year_type: {
            employeeId: request.employeeId,
            year,
            type: type as typeof request.type,
          },
        },
        update: { usedDays: { increment: totalDays } },
        create: {
          employeeId: request.employeeId,
          year,
          type: type as typeof request.type,
          totalDays: 20,
          usedDays: totalDays,
        },
      });
    }

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
            absenceCode: absenceCodeForDay(day.type, day.halfDay),
          },
          create: {
            timesheetWeekId: week.id,
            projectId: officeAdminProject.id,
            phase: "",
            date: new Date(day.date),
            hours: hoursForDay(day.halfDay),
            absenceCode: absenceCodeForDay(day.type, day.halfDay),
          },
        });
      }
    }
  }

  // Fire-and-forget: notify employee
  const decisionMap = { APPROVED: "approved", REJECTED: "rejected", REVISION_REQUESTED: "revision" } as const;
  void notifyEmployeeDecision(
    request.employee.email, request.employee.name, "pto",
    decisionMap[status], comment, "/leave"
  );

  return NextResponse.json(updated);
}
