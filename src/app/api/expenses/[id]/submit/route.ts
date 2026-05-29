import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifyAdminNewSubmission } from "@/lib/email";

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
  if (report.status !== "DRAFT") {
    return NextResponse.json({ error: "Only DRAFT reports can be submitted" }, { status: 400 });
  }
  if (report.items.length === 0) {
    return NextResponse.json({ error: "Cannot submit an empty report" }, { status: 400 });
  }

  const updated = await db.expenseReport.update({
    where: { id },
    data: { status: "SUBMITTED", submittedAt: new Date() },
  });

  // Fire-and-forget: notify all admins
  db.employee.findMany({ where: { role: "ADMIN", isActive: true }, select: { name: true, email: true } })
    .then((admins) => {
      for (const admin of admins) {
        void notifyAdminNewSubmission(admin.email, admin.name, "expense", session.user.name ?? "An employee", `/admin/expenses/${id}`);
      }
    })
    .catch(() => {});

  return NextResponse.json(updated);
}
