import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const period = await db.reportPeriod.findUnique({ where: { id }, select: { employeeId: true } });
  if (!period) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner = period.employeeId === session.user.id;
  const isAdmin = session.user.role === "ADMIN";
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { rowOrder } = await req.json() as { rowOrder: Array<{ projectId: string; phase: string }> };

  await db.reportPeriod.update({
    where: { id },
    data: { rowOrder: rowOrder ?? [] },
  });

  return NextResponse.json({ ok: true });
}
