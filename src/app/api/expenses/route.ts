import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/expenses — list reports for current user (or all if admin + ?all=true)
export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const all = searchParams.get("all") === "true";
  const statusFilter = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (!all || session.user.role !== "ADMIN") {
    where.employeeId = session.user.id;
  }
  if (statusFilter) {
    where.status = statusFilter;
  }

  const reports = await db.expenseReport.findMany({
    where,
    include: {
      employee: { select: { id: true, name: true, email: true } },
      items: { select: { amount: true } },
      _count: { select: { documents: true } },
    },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });

  const result = reports.map((r) => ({
    ...r,
    total: r.items.reduce((sum, i) => sum + i.amount, 0),
    items: undefined,
  }));

  return NextResponse.json(result);
}

// POST /api/expenses — create a new expense report
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const month = Number(body.month);
  const year = Number(body.year);

  if (!month || !year || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid month or year" }, { status: 400 });
  }

  const existing = await db.expenseReport.findUnique({
    where: { employeeId_month_year: { employeeId: session.user.id, month, year } },
  });
  if (existing) {
    return NextResponse.json({ error: "Report already exists for this month" }, { status: 409 });
  }

  const report = await db.expenseReport.create({
    data: { employeeId: session.user.id, month, year },
  });

  return NextResponse.json(report, { status: 201 });
}
