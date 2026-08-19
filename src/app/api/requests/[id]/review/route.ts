import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifyEmployeeDecision } from "@/lib/email";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { status, comment } = await req.json() as {
    status: "APPROVED" | "REJECTED";
    comment?: string;
  };

  if (status !== "APPROVED" && status !== "REJECTED") {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  if (status === "REJECTED" && !comment?.trim()) {
    return NextResponse.json({ error: "A comment is required" }, { status: 400 });
  }

  const request = await db.generalRequest.findUnique({
    where: { id },
    include: { employee: { select: { name: true, email: true } } },
  });
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (request.status !== "PENDING") {
    return NextResponse.json({ error: "Already reviewed" }, { status: 400 });
  }

  const updated = await db.generalRequest.update({
    where: { id },
    data: {
      status,
      reviewedById: session.user.id,
      reviewComment: comment ?? null,
      reviewedAt: new Date(),
    },
  });

  // Fire-and-forget: notify employee
  const decisionMap = { APPROVED: "approved", REJECTED: "rejected" } as const;
  void notifyEmployeeDecision(
    request.employee.email, request.employee.name, "request",
    decisionMap[status], comment, "/requests"
  );

  return NextResponse.json(updated);
}
