import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { deleteReceipt } from "@/lib/supabase-storage";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, docId } = await params;

  const report = await db.expenseReport.findUnique({ where: { id } });
  if (!report || report.employeeId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (report.status !== "DRAFT") {
    return NextResponse.json({ error: "Cannot delete from a submitted report" }, { status: 400 });
  }

  const doc = await db.expenseDocument.findUnique({ where: { id: docId } });
  if (!doc || doc.expenseReportId !== id) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  await deleteReceipt(doc.fileUrl);
  await db.expenseDocument.delete({ where: { id: docId } });

  return NextResponse.json({ ok: true });
}
