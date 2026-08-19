import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifyAdminNewSubmission } from "@/lib/email";

// GET /api/requests - list requests for current user (or all for admin)
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const requests = await db.generalRequest.findMany({
    where: session.user.role === "ADMIN" ? {} : { employeeId: session.user.id },
    include: {
      employee: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(requests);
}

// POST /api/requests - submit a new general request/comment
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { subject, note } = await req.json() as { subject: string; note: string };

  if (!subject?.trim() || !note?.trim()) {
    return NextResponse.json({ error: "Subject and note are required" }, { status: 400 });
  }

  const request = await db.generalRequest.create({
    data: {
      employeeId: session.user.id,
      subject: subject.trim(),
      note: note.trim(),
    },
  });

  // Fire-and-forget: notify Hiroshi Okamoto specifically
  db.employee.findUnique({ where: { email: "okamoto@oliarch.com" }, select: { name: true, email: true } })
    .then((hiroshi) => {
      if (!hiroshi) return;
      void notifyAdminNewSubmission(hiroshi.email, hiroshi.name, "request", session.user.name ?? "An employee", `/admin/requests/${request.id}`);
    })
    .catch(() => {});

  return NextResponse.json(request, { status: 201 });
}
