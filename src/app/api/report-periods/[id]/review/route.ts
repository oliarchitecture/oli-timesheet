import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * POST /api/report-periods/[id]/review
 * Admin-only. Approve, request revision, or reject a whole period.
 *
 * APPROVED          → period + all weeks → APPROVED
 * REVISION_REQUESTED → period → DRAFT, all SUBMITTED weeks → DRAFT (employee re-edits)
 * REJECTED          → period → REJECTED (final, no revert)
 */
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

  const period = await db.reportPeriod.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!period) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (period.status !== "SUBMITTED") {
    return NextResponse.json({ error: "Can only review SUBMITTED periods" }, { status: 400 });
  }

  const now = new Date();
  const reviewer = session.user.id;

  if (status === "APPROVED") {
    await db.$transaction([
      db.timesheetWeek.updateMany({
        where: { reportPeriodId: id },
        data: { status: "APPROVED", reviewedById: reviewer, reviewedAt: now },
      }),
      db.reportPeriod.update({
        where: { id },
        data: { status: "APPROVED", reviewedById: reviewer, reviewedAt: now, reviewComment: comment ?? null },
      }),
    ]);
  } else if (status === "REVISION_REQUESTED") {
    await db.$transaction([
      // Revert all SUBMITTED weeks to DRAFT so employee can edit again
      db.timesheetWeek.updateMany({
        where: { reportPeriodId: id, status: "SUBMITTED" },
        data: { status: "DRAFT", submittedAt: null },
      }),
      db.reportPeriod.update({
        where: { id },
        data: {
          status: "REVISION_REQUESTED",
          reviewedById: reviewer,
          reviewedAt: now,
          reviewComment: comment ?? null,
          submittedAt: null,
        },
      }),
    ]);
  } else if (status === "REJECTED") {
    await db.reportPeriod.update({
      where: { id },
      data: { status: "REJECTED", reviewedById: reviewer, reviewedAt: now, reviewComment: comment ?? null },
    });
  } else {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
