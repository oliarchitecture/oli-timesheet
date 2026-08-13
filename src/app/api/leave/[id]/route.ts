import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifyAdminNewSubmission } from "@/lib/email";

const VALID_TYPES = ["VACATION", "SICK", "PERSONAL", "OTHER", "COMP_DAY"] as const;
type ValidLeaveType = typeof VALID_TYPES[number];

// PUT /api/leave/[id] — employee edits and resubmits a request that had revision requested
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const request = await db.leaveRequest.findUnique({ where: { id } });
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (request.employeeId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (request.status !== "REVISION_REQUESTED") {
    return NextResponse.json({ error: "Only requests with a revision requested can be edited" }, { status: 400 });
  }

  const { days } = await req.json() as {
    days: { date: string; type: string; halfDay: boolean; reason?: string }[];
  };

  if (!Array.isArray(days) || days.length === 0) {
    return NextResponse.json({ error: "At least one working day is required" }, { status: 400 });
  }
  for (const d of days) {
    if (!d.date || !VALID_TYPES.includes(d.type as ValidLeaveType)) {
      return NextResponse.json({ error: "Each day requires a valid date and leave type" }, { status: 400 });
    }
  }

  const dates = days.map((d) => d.date).sort();
  const startDate = dates[0];
  const endDate = dates[dates.length - 1];
  const distinctTypes = new Set(days.map((d) => d.type));
  const requestType = distinctTypes.size === 1 ? (days[0].type as ValidLeaveType) : "MIXED";

  const updated = await db.$transaction(async (tx) => {
    await tx.leaveRequestDay.deleteMany({ where: { leaveRequestId: id } });
    await tx.leaveRequestDay.createMany({
      data: days.map((d) => ({
        leaveRequestId: id,
        date: new Date(d.date),
        type: d.type as ValidLeaveType,
        halfDay: d.halfDay === true,
        reason: d.reason ?? null,
      })),
    });
    return tx.leaveRequest.update({
      where: { id },
      data: {
        type: requestType,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: "PENDING",
      },
    });
  });

  // Fire-and-forget: notify admins of resubmission
  db.employee.findMany({ where: { role: "ADMIN", isActive: true }, select: { name: true, email: true } })
    .then((admins) => {
      for (const admin of admins) {
        void notifyAdminNewSubmission(admin.email, admin.name, "pto", session.user.name ?? "An employee", `/admin/leave/${id}`);
      }
    })
    .catch(() => {});

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const request = await db.leaveRequest.findUnique({ where: { id } });
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (request.employeeId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (request.status !== "PENDING") {
    return NextResponse.json({ error: "Only pending PTO requests can be deleted" }, { status: 400 });
  }

  await db.leaveRequest.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
