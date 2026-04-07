import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSignedUrl } from "@/lib/supabase-storage";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, docId } = await params;

  const report = await db.expenseReport.findUnique({ where: { id } });
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Employee can only access their own; admin can access all
  if (session.user.role !== "ADMIN" && report.employeeId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const doc = await db.expenseDocument.findUnique({ where: { id: docId } });
  if (!doc || doc.expenseReportId !== id) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const url = await getSignedUrl(doc.fileUrl, 300);
  return NextResponse.json({ url });
}
