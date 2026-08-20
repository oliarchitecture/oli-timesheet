import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { year, balances } = await req.json() as {
    year: number;
    balances: { type: string; totalDays: number; usedDays: number }[];
  };

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
