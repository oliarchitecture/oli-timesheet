import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const requests = await db.leaveRequest.findMany({
    where: session.user.role === "ADMIN" ? {} : { employeeId: session.user.id },
    include: { employee: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(requests);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type, startDate, endDate, reason } = await req.json() as {
    type: string; startDate: string; endDate: string; reason?: string;
  };

  if (!type || !startDate || !endDate) {
    return NextResponse.json({ error: "Type, start date, and end date are required" }, { status: 400 });
  }

  const request = await db.leaveRequest.create({
    data: {
      employeeId: session.user.id,
      type: type as "VACATION" | "SICK" | "PERSONAL" | "OTHER",
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      reason: reason ?? null,
    },
  });

  return NextResponse.json(request, { status: 201 });
}
