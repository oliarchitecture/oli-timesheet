import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// PATCH /api/profile/period-defaults - save default period start day
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { defaultPeriodStartDay } = body as { defaultPeriodStartDay: number | null };

  if (defaultPeriodStartDay !== null) {
    if (!Number.isInteger(defaultPeriodStartDay) || defaultPeriodStartDay < 1 || defaultPeriodStartDay > 31) {
      return NextResponse.json({ error: "defaultPeriodStartDay must be an integer between 1 and 31" }, { status: 400 });
    }
  }

  const updated = await db.employee.update({
    where: { id: session.user.id },
    data: { defaultPeriodStartDay },
    select: { defaultPeriodStartDay: true },
  });

  return NextResponse.json(updated);
}
