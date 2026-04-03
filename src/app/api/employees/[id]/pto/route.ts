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
    balances: { type: string; totalDays: number }[];
  };

  const results = await Promise.all(
    balances.map((b) =>
      db.leaveBalance.upsert({
        where: { employeeId_year_type: { employeeId: id, year, type: b.type as "VACATION" | "SICK" | "PERSONAL" | "OTHER" } },
        update: { totalDays: b.totalDays },
        create: { employeeId: id, year, type: b.type as "VACATION" | "SICK" | "PERSONAL" | "OTHER", totalDays: b.totalDays },
      })
    )
  );

  return NextResponse.json(results);
}
