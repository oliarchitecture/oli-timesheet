import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "hours-by-employee";
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const employeeId = searchParams.get("employeeId");

  const dateFilter = startDate && endDate
    ? { gte: new Date(startDate), lte: new Date(endDate) }
    : undefined;

  if (type === "hours-by-employee") {
    const employees = await db.employee.findMany({
      where: {
        isActive: true,
        ...(employeeId ? { id: employeeId } : {}),
      },
      select: {
        id: true,
        name: true,
        timesheets: {
          where: dateFilter ? { weekStartDate: dateFilter } : {},
          include: { entries: true },
        },
      },
    });

    const rows = employees.map((emp) => ({
      employee: emp.name,
      total_hours: emp.timesheets
        .flatMap((t) => t.entries)
        .reduce((sum, e) => sum + e.hours, 0),
      approved_timesheets: emp.timesheets.filter((t) => t.status === "APPROVED").length,
      pending_timesheets: emp.timesheets.filter((t) => t.status === "SUBMITTED").length,
    }));

    return NextResponse.json({ rows });
  }

  if (type === "hours-by-project") {
    const projects = await db.project.findMany({
      select: {
        id: true,
        name: true,
        clientName: true,
        entries: {
          where: dateFilter
            ? { timesheetWeek: { weekStartDate: dateFilter } }
            : {},
          include: { timesheetWeek: { select: { employeeId: true } } },
        },
      },
    });

    const rows = projects
      .map((p) => ({
        project: p.name,
        client: p.clientName ?? "—",
        total_hours: p.entries.reduce((sum, e) => sum + e.hours, 0),
        contributors: new Set(p.entries.map((e) => e.timesheetWeek.employeeId)).size,
      }))
      .filter((r) => r.total_hours > 0);

    return NextResponse.json({ rows });
  }

  if (type === "leave-summary") {
    const year = startDate ? new Date(startDate).getFullYear() : new Date().getFullYear();
    const balances = await db.leaveBalance.findMany({
      where: {
        year,
        ...(employeeId ? { employeeId } : {}),
      },
      include: { employee: { select: { name: true } } },
    });

    const rows = balances.map((b) => ({
      employee: b.employee.name,
      type: b.type,
      year: b.year,
      total_days: b.totalDays,
      used_days: b.usedDays,
      remaining: b.totalDays - b.usedDays,
    }));

    return NextResponse.json({ rows });
  }

  return NextResponse.json({ error: "Unknown report type" }, { status: 400 });
}
