import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * POST /api/admin/renew-leave-balances
 * Admin-only. Resets leave balances for a new year based on years of service.
 * Body: { employeeId?: string; year: number }
 * If employeeId is omitted, renews all active employees.
 *
 * Allotment per OLI policy (OLI2025_OfficeGuidelines):
 *   Year 0 (first year, <1 year):  10 vacation + 5 sick
 *   Year 1–4:                      10 + 1/yr vacation (max 15) + 5 sick, +1/yr
 *   Year 5+:                       15 vacation + 7 sick
 * Employees also accrue +1 vacation day per year of service, capped at 15.
 */

function getAllotment(startDate: Date | null, targetYear: number): Record<string, number> {
  if (!startDate) {
    return { VACATION: 10, SICK: 5, PERSONAL: 0, COMP_DAY: 0 };
  }
  const yearsOfService = targetYear - startDate.getUTCFullYear();
  if (yearsOfService < 1) {
    return { VACATION: 10, SICK: 5, PERSONAL: 0, COMP_DAY: 0 };
  }
  // +1 vacation day per year of service, capped at 15
  const vacationDays = Math.min(10 + yearsOfService, 15);
  const sickDays = yearsOfService >= 5 ? 7 : 5;
  return { VACATION: vacationDays, SICK: sickDays, PERSONAL: 5, COMP_DAY: 0 };
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { employeeId, year } = await req.json() as { employeeId?: string; year: number };
  if (!year || typeof year !== "number") {
    return NextResponse.json({ error: "year is required" }, { status: 400 });
  }

  const employees = employeeId
    ? await db.employee.findMany({ where: { id: employeeId }, select: { id: true, startDate: true } })
    : await db.employee.findMany({ where: { isActive: true }, select: { id: true, startDate: true } });

  const leaveTypes = ["VACATION", "SICK", "PERSONAL", "COMP_DAY"] as const;
  const results: string[] = [];

  for (const emp of employees) {
    const allotment = getAllotment(emp.startDate, year);
    for (const leaveType of leaveTypes) {
      await db.leaveBalance.upsert({
        where: { employeeId_year_type: { employeeId: emp.id, year, type: leaveType } },
        update: { usedDays: 0, totalDays: allotment[leaveType] },
        create: {
          employeeId: emp.id,
          year,
          type: leaveType,
          totalDays: allotment[leaveType],
          usedDays: 0,
        },
      });
    }
    results.push(emp.id);
  }

  return NextResponse.json({ renewed: results.length, employeeIds: results });
}
