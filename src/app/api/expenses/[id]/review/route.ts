import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  const report = await db.expenseReport.findUnique({ where: { id } });
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (report.status !== "SUBMITTED") {
    return NextResponse.json({ error: "Only SUBMITTED reports can be reviewed" }, { status: 400 });
  }

  const body = await req.json();
  const { action, reviewComment } = body;
  if (action !== "APPROVE" && action !== "REJECT") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
  if (action === "REJECT" && !reviewComment?.trim()) {
    return NextResponse.json({ error: "Rejection comment is required" }, { status: 400 });
  }

  const updated = await db.expenseReport.update({
    where: { id },
    data: {
      status: action === "APPROVE" ? "APPROVED" : "REJECTED",
      reviewedById: session.user.id,
      reviewComment: reviewComment ?? null,
      reviewedAt: new Date(),
    },
  });

  return NextResponse.json(updated);
}
