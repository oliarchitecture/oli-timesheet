import { NextResponse, after } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifyAdminsOfSubmission } from "@/lib/email";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const report = await db.expenseReport.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!report || report.employeeId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (report.status !== "DRAFT" && report.status !== "REVISION_REQUESTED") {
    return NextResponse.json({ error: "Report is not in a submittable status" }, { status: 400 });
  }
  if (report.items.length === 0) {
    return NextResponse.json({ error: "Cannot submit an empty report" }, { status: 400 });
  }

  const updated = await db.expenseReport.update({
    where: { id },
    data: { status: "SUBMITTED", submittedAt: new Date() },
  });

  // Runs after the response is sent, but still inside the function's lifetime.
  const employeeName = session.user.name ?? "An employee";
  after(async () => {
    await notifyAdminsOfSubmission("expense", employeeName, `/admin/expenses/${id}`);
  });

  return NextResponse.json(updated);
}
