import { NextResponse, after } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifyAdminsOfSubmission } from "@/lib/email";

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

  // Runs after the response is sent, but still inside the function's lifetime.
  const employeeName = session.user.name ?? "An employee";
  after(async () => {
    await notifyAdminsOfSubmission("request", employeeName, `/admin/requests/${request.id}`);
  });

  return NextResponse.json(request, { status: 201 });
}
