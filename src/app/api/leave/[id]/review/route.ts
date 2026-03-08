import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

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
    status: "APPROVED" | "REJECTED";
    comment?: string;
  };

  const request = await db.leaveRequest.findUnique({ where: { id } });
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

  // If approved, deduct from leave balance
  if (status === "APPROVED") {
    const start = new Date(request.startDate);
    const end = new Date(request.endDate);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const year = start.getFullYear();

    await db.leaveBalance.upsert({
      where: {
        employeeId_year_type: {
          employeeId: request.employeeId,
          year,
          type: request.type,
        },
      },
      update: { usedDays: { increment: days } },
      create: {
        employeeId: request.employeeId,
        year,
        type: request.type,
        totalDays: 20, // default; admin can adjust later
        usedDays: days,
      },
    });
  }

  return NextResponse.json(updated);
}
