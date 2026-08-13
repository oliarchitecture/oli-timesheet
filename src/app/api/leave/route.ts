import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifyAdminNewSubmission } from "@/lib/email";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const requests = await db.leaveRequest.findMany({
    where: session.user.role === "ADMIN" ? {} : { employeeId: session.user.id },
    include: {
      employee: { select: { name: true } },
      days: { orderBy: { date: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(requests);
}

const VALID_TYPES = ["VACATION", "SICK", "PERSONAL", "OTHER", "COMP_DAY"] as const;
type ValidLeaveType = typeof VALID_TYPES[number];

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const request = await db.$transaction(async (tx) => {
    const parent = await tx.leaveRequest.create({
      data: {
        employeeId: session.user.id,
        type: requestType,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      },
    });
    await tx.leaveRequestDay.createMany({
      data: days.map((d) => ({
        leaveRequestId: parent.id,
        date: new Date(d.date),
        type: d.type as ValidLeaveType,
        halfDay: d.halfDay === true,
        reason: d.reason ?? null,
      })),
    });
    return parent;
  });

  // Fire-and-forget: notify all admins
  db.employee.findMany({ where: { role: "ADMIN", isActive: true }, select: { name: true, email: true } })
    .then((admins) => {
      for (const admin of admins) {
        void notifyAdminNewSubmission(admin.email, admin.name, "pto", session.user.name ?? "An employee", `/admin/leave/${request.id}`);
      }
    })
    .catch(() => {});

  return NextResponse.json(request, { status: 201 });
}
