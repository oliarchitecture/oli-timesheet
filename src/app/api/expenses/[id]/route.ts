import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

async function getReport(id: string, userId: string, isAdmin: boolean) {
  const report = await db.expenseReport.findUnique({
    where: { id },
    include: {
      employee: { select: { id: true, name: true, email: true, title: true } },
      reviewer: { select: { id: true, name: true } },
      items: { include: { project: { select: { id: true, name: true } } }, orderBy: { date: "asc" } },
      documents: { orderBy: { uploadedAt: "asc" } },
    },
  });
  if (!report) return null;
  if (!isAdmin && report.employeeId !== userId) return null;
  return report;
}

// GET /api/expenses/[id]
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const report = await getReport(id, session.user.id, session.user.role === "ADMIN");
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(report);
}

// PUT /api/expenses/[id] — save draft
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const report = await db.expenseReport.findUnique({ where: { id } });
  if (!report || report.employeeId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (report.status !== "DRAFT") {
    return NextResponse.json({ error: "Only DRAFT reports can be edited" }, { status: 400 });
  }

  const body = await req.json();
  const { items, advanceAmount, notes } = body;

  // Replace all items
  await db.expenseItem.deleteMany({ where: { expenseReportId: id } });
  if (items && items.length > 0) {
    await db.expenseItem.createMany({
      data: items.map((item: {
        projectId: string;
        date: string;
        category: string;
        otherDescription?: string;
        description: string;
        amount: number;
      }) => ({
        expenseReportId: id,
        projectId: item.projectId,
        date: new Date(item.date),
        category: item.category,
        otherDescription: item.otherDescription ?? null,
        description: item.description,
        amount: Number(item.amount),
      })),
    });
  }

  const updated = await db.expenseReport.update({
    where: { id },
    data: {
      advanceAmount: advanceAmount != null ? Number(advanceAmount) : 0,
      notes: notes ?? null,
    },
  });

  return NextResponse.json(updated);
}

// DELETE /api/expenses/[id]
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const report = await db.expenseReport.findUnique({ where: { id } });
  if (!report || report.employeeId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (report.status !== "DRAFT") {
    return NextResponse.json({ error: "Only DRAFT reports can be deleted" }, { status: 400 });
  }

  await db.expenseReport.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
