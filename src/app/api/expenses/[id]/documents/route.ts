import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { uploadReceipt } from "@/lib/supabase-storage";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const report = await db.expenseReport.findUnique({ where: { id } });
  if (!report || report.employeeId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (report.status !== "DRAFT") {
    return NextResponse.json({ error: "Cannot upload to a submitted report" }, { status: 400 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File exceeds 10 MB limit" }, { status: 413 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${session.user.id}/${id}/${Date.now()}_${safeName}`;

  await uploadReceipt(path, buffer, file.type);

  const doc = await db.expenseDocument.create({
    data: {
      expenseReportId: id,
      fileName: file.name,
      fileUrl: path,
      fileSize: file.size,
      mimeType: file.type,
    },
  });

  return NextResponse.json(doc, { status: 201 });
}
