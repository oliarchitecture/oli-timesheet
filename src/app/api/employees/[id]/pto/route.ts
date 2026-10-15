import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { year, balances, workYear } = await req.json() as {
    year: number;
    balances: { type: string; totalDays: number; usedDays: number }[];
    /** Vacation/Sick/Comp Day for the employee's current work year; null fields mean "automatic". */
    workYear?: {
      cycleStart: string;
      lines: { type: string; totalDays: number | null; usedDays: number | null }[];
    } | null;
  };

  if (workYear) {
    const cycleStart = new Date(workYear.cycleStart);
    if (isNaN(cycleStart.getTime())) {
      return NextResponse.json({ error: "Invalid work year" }, { status: 400 });
    }
    const asNumber = (v: unknown) => (typeof v === "number" && isFinite(v) && v >= 0 ? v : null);
    for (const line of workYear.lines) {
      if (line.type !== "VACATION" && line.type !== "SICK" && line.type !== "COMP_DAY") continue;
      const type: "VACATION" | "SICK" | "COMP_DAY" = line.type;
      const totalDays = asNumber(line.totalDays);
      const usedDays = asNumber(line.usedDays);
      const where = { employeeId_cycleStart_type: { employeeId: id, cycleStart, type } };
      if (totalDays === null && usedDays === null) {
        // Back to fully automatic: nothing to store.
        await db.ptoOverride.deleteMany({ where: { employeeId: id, cycleStart, type } });
      } else {
        await db.ptoOverride.upsert({
          where,
          update: { totalDays, usedDays },
          create: { employeeId: id, cycleStart, type, totalDays, usedDays },
        });
      }
    }
  }

  const results = await Promise.all(
    balances.map((b) =>
      db.leaveBalance.upsert({
        where: { employeeId_year_type: { employeeId: id, year, type: b.type as "VACATION" | "SICK" | "PERSONAL" | "OTHER" | "COMP_DAY" } },
        update: { totalDays: b.totalDays, usedDays: b.usedDays },
        create: { employeeId: id, year, type: b.type as "VACATION" | "SICK" | "PERSONAL" | "OTHER" | "COMP_DAY", totalDays: b.totalDays, usedDays: b.usedDays },
      })
    )
  );

  return NextResponse.json(results);
}
