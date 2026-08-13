import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifyEmployeeDecision } from "@/lib/email";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  const report = await db.expenseReport.findUnique({
    where: { id },
    include: { employee: { select: { name: true, email: true } } },
  });
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (report.status !== "SUBMITTED") {
    return NextResponse.json({ error: "Only SUBMITTED reports can be reviewed" }, { status: 400 });
  }

  const body = await req.json();
  const { action, reviewComment } = body;
  if (action !== "APPROVE" && action !== "REJECT" && action !== "REVISION_REQUESTED") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
  if ((action === "REJECT" || action === "REVISION_REQUESTED") && !reviewComment?.trim()) {
    return NextResponse.json({ error: "A comment is required" }, { status: 400 });
  }

  const statusMap = { APPROVE: "APPROVED", REJECT: "REJECTED", REVISION_REQUESTED: "REVISION_REQUESTED" } as const;
  const updated = await db.expenseReport.update({
    where: { id },
    data: {
      status: statusMap[action as keyof typeof statusMap],
      reviewedById: session.user.id,
      reviewComment: reviewComment ?? null,
      reviewedAt: new Date(),
    },
  });

  // Fire-and-forget: notify employee
  const decisionMap = { APPROVE: "approved", REJECT: "rejected", REVISION_REQUESTED: "revision" } as const;
  void notifyEmployeeDecision(
    report.employee.email, report.employee.name, "expense",
    decisionMap[action as keyof typeof decisionMap], reviewComment, `/expenses/${id}`
  );

  return NextResponse.json(updated);
}
