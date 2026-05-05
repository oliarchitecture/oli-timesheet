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
    status: "APPROVED" | "REJECTED" | "REVISION_REQUESTED";
    comment?: string;
  };

  const timesheet = await db.timesheetWeek.findUnique({ where: { id } });
  if (!timesheet) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (timesheet.status !== "SUBMITTED") {
    return NextResponse.json({ error: "Can only review SUBMITTED timesheets" }, { status: 400 });
  }

  // Weeks that belong to a period should be reviewed at the period level
  if (timesheet.reportPeriodId) {
    return NextResponse.json(
      { error: "This week belongs to a period. Review the period instead." },
      { status: 400 }
    );
  }

  const now = new Date();
  let updateData: Record<string, unknown>;

  if (status === "APPROVED") {
    updateData = { status: "APPROVED", reviewedById: session.user.id, reviewComment: comment ?? null, reviewedAt: now };
  } else if (status === "REJECTED") {
    updateData = { status: "REJECTED", reviewedById: session.user.id, reviewComment: comment ?? null, reviewedAt: now };
  } else if (status === "REVISION_REQUESTED") {
    // Return to DRAFT for employee to re-edit
    updateData = { status: "DRAFT", submittedAt: null, reviewedById: session.user.id, reviewComment: comment ?? null, reviewedAt: now };
  } else {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const updated = await db.timesheetWeek.update({ where: { id }, data: updateData });

  return NextResponse.json(updated);
}
