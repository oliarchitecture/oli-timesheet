import { NextResponse, after } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifyAdminsOfPtoDayWorked } from "@/lib/email";

// POST — the employee reports they worked a day of their approved PTO. The approved request
// is left as it is; a note is added to it, the day stops counting against the balance, and
// admins are told.
export async function POST(_req: Request, { params }: { params: Promise<{ dayId: string }> }) {
  const { dayId } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const day = await db.leaveRequestDay.findUnique({
    where: { id: dayId },
    include: { leaveRequest: { include: { employee: { select: { name: true } } } } },
  });
  if (!day) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (day.leaveRequest.employeeId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (day.leaveRequest.status !== "APPROVED") {
    return NextResponse.json({ error: "Only days of an approved request can be reported as worked." }, { status: 400 });
  }
  if (day.date.toISOString().slice(0, 10) > new Date().toISOString().slice(0, 10)) {
    return NextResponse.json({ error: "This day hasn't happened yet." }, { status: 400 });
  }

  await db.leaveWorkedDay.upsert({
    where: { leaveRequestId_date: { leaveRequestId: day.leaveRequestId, date: day.date } },
    update: {},
    create: { leaveRequestId: day.leaveRequestId, date: day.date },
  });

  const employeeName = day.leaveRequest.employee.name;
  const label = day.date.toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  });
  after(async () => {
    await notifyAdminsOfPtoDayWorked(employeeName, label, `/admin/leave/${day.leaveRequestId}`);
  });

  return NextResponse.json({ ok: true });
}
