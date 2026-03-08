import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// POST /api/timesheets/[id]/review - admin approves or rejects
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { status, comment } = await req.json() as {
    status: "APPROVED" | "REJECTED";
    comment?: string;
  };

  const timesheet = await db.timesheetWeek.findUnique({ where: { id } });
  if (!timesheet) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (timesheet.status !== "SUBMITTED") {
    return NextResponse.json({ error: "Can only review SUBMITTED timesheets" }, { status: 400 });
  }

  const updated = await db.timesheetWeek.update({
    where: { id },
    data: {
      status,
      reviewedById: session.user.id,
      reviewComment: comment ?? null,
      reviewedAt: new Date(),
      // If rejected, reset to DRAFT so employee can re-edit
      ...(status === "REJECTED" ? { status: "DRAFT", submittedAt: null } : {}),
    },
  });

  return NextResponse.json(updated);
}
