import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const requests = await db.leaveRequest.findMany({
    where: session.user.role === "ADMIN" ? {} : { employeeId: session.user.id },
    include: {
      employee: { select: { name: true } },
      days: { orderBy: { date: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(requests);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type, startDate, endDate, days } = await req.json() as {
    type: string;
    startDate: string;
    endDate: string;
    days: { date: string; halfDay: boolean; reason?: string }[];
  };

  if (!type || !startDate || !endDate) {
    return NextResponse.json({ error: "Type, start date, and end date are required" }, { status: 400 });
  }
  if (!Array.isArray(days) || days.length === 0) {
    return NextResponse.json({ error: "At least one working day is required" }, { status: 400 });
  }

  const validTypes = ["VACATION", "SICK", "PERSONAL", "OTHER", "COMP_DAY"] as const;
  if (!validTypes.includes(type as typeof validTypes[number])) {
    return NextResponse.json({ error: "Invalid leave type" }, { status: 400 });
  }

  const request = await db.$transaction(async (tx) => {
    const parent = await tx.leaveRequest.create({
      data: {
        employeeId: session.user.id,
        type: type as "VACATION" | "SICK" | "PERSONAL" | "OTHER" | "COMP_DAY",
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      },
    });
    await tx.leaveRequestDay.createMany({
      data: days.map((d) => ({
        leaveRequestId: parent.id,
        date: new Date(d.date),
        halfDay: d.halfDay === true,
        reason: d.reason ?? null,
      })),
    });
    return parent;
  });

  return NextResponse.json(request, { status: 201 });
}
