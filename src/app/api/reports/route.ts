import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPtoSummary } from "@/lib/pto-balance.server";

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

    // Vacation, Sick and Comp Day follow each person's work year (see getPtoSummary); the
    // yearly rows still hold Personal and Other.
    const rows: { employee: string; type: string; year: number | string; total_days: number; used_days: number; remaining: number }[] =
      balances
        .filter((b) => b.type !== "VACATION" && b.type !== "SICK" && b.type !== "COMP_DAY")
        .map((b) => ({
          employee: b.employee.name,
          type: b.type,
          year: b.year,
          total_days: b.totalDays,
          used_days: b.usedDays,
          remaining: b.totalDays - b.usedDays,
        }));

    const employees = await db.employee.findMany({
      where: { isActive: true, ...(employeeId ? { id: employeeId } : {}) },
      select: { id: true, name: true, startDate: true },
    });
    for (const emp of employees) {
      const pto = await getPtoSummary(emp.id, emp.startDate);
      if (!pto) continue;
      const workYear = `${pto.cycleStart.toISOString().slice(0, 10)} – ${new Date(pto.cycleEnd.getTime() - 86400000).toISOString().slice(0, 10)}`;
      for (const [type, line] of [["VACATION", pto.vacation], ["SICK", pto.sick], ["COMP_DAY", pto.comp]] as const) {
        rows.push({
          employee: emp.name,
          type,
          year: workYear,
          total_days: line.total,
          used_days: line.used,
          remaining: line.total - line.used,
        });
      }
    }
    rows.sort((a, b) => a.employee.localeCompare(b.employee) || a.type.localeCompare(b.type));

    return NextResponse.json({ rows });
  }

  if (type === "hours-by-phase") {
    const entries = await db.timesheetEntry.findMany({
      where: {
        ...(dateFilter ? { timesheetWeek: { weekStartDate: dateFilter } } : {}),
        ...(employeeId ? { timesheetWeek: { employeeId } } : {}),
      },
      include: {
        project: { select: { name: true } },
        timesheetWeek: { select: { employeeId: true, status: true } },
      },
    });

    const map = new Map<string, { project: string; phase: string; total_hours: number; employees: Set<string> }>();
    for (const e of entries) {
      const key = `${e.projectId}|${e.phase ?? ""}`;
      if (!map.has(key)) {
        map.set(key, { project: e.project.name, phase: e.phase ?? "(no phase)", total_hours: 0, employees: new Set() });
      }
      const row = map.get(key)!;
      row.total_hours += e.hours;
      row.employees.add(e.timesheetWeek.employeeId);
    }

    const rows = Array.from(map.values())
      .filter((r) => r.total_hours > 0)
      .sort((a, b) => a.project.localeCompare(b.project) || a.phase.localeCompare(b.phase))
      .map(({ employees, ...r }) => ({ ...r, contributors: employees.size }));

    return NextResponse.json({ rows });
  }

  return NextResponse.json({ error: "Unknown report type" }, { status: 400 });
}
