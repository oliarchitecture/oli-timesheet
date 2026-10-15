import { NextResponse, after } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifyAdminsOfPtoDayRemoval, notifyEmployeePtoDayRemoval } from "@/lib/email";

function dayLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

async function loadDay(dayId: string) {
  return db.leaveRequestDay.findUnique({
    where: { id: dayId },
    include: { leaveRequest: { include: { employee: { select: { name: true, email: true } } } } },
  });
}

// POST — the employee says they worked this approved PTO day and asks for it to be taken off.
export async function POST(_req: Request, { params }: { params: Promise<{ dayId: string }> }) {
  const { dayId } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const day = await loadDay(dayId);
  if (!day) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (day.leaveRequest.employeeId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (day.leaveRequest.status !== "APPROVED") {
    return NextResponse.json({ error: "Only days of an approved request can be changed this way." }, { status: 400 });
  }
  const today = new Date();
  if (day.date.toISOString().slice(0, 10) > today.toISOString().slice(0, 10)) {
    return NextResponse.json({ error: "This day hasn't happened yet." }, { status: 400 });
  }
  if (day.removalRequestedAt) {
    return NextResponse.json({ error: "Already sent to your admin." }, { status: 400 });
  }

  await db.leaveRequestDay.update({ where: { id: dayId }, data: { removalRequestedAt: new Date() } });

  const employeeName = day.leaveRequest.employee.name;
  const label = dayLabel(day.date);
  after(async () => {
    await notifyAdminsOfPtoDayRemoval(employeeName, label, `/admin/leave/${day.leaveRequestId}`);
  });

  return NextResponse.json({ ok: true });
}

// PATCH — an admin approves (the day is taken off the request) or declines (it stays).
export async function PATCH(req: Request, { params }: { params: Promise<{ dayId: string }> }) {
  const { dayId } = await params;
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { decision } = await req.json() as { decision: "approve" | "decline" };
  if (decision !== "approve" && decision !== "decline") {
    return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
  }

  const day = await loadDay(dayId);
  if (!day) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!day.removalRequestedAt) {
    return NextResponse.json({ error: "No change was requested for this day." }, { status: 400 });
  }

  const request = day.leaveRequest;
  let requestDeleted = false;
  if (decision === "decline") {
    await db.leaveRequestDay.update({ where: { id: dayId }, data: { removalRequestedAt: null } });
  } else {
    await db.$transaction(async (tx) => {
      await tx.leaveRequestDay.delete({ where: { id: dayId } });
      const remaining = await tx.leaveRequestDay.findMany({
        where: { leaveRequestId: request.id },
        orderBy: { date: "asc" },
      });
      if (remaining.length === 0) {
        await tx.leaveRequest.delete({ where: { id: request.id } });
        requestDeleted = true;
      } else {
        const types = new Set(remaining.map((d) => d.type));
        await tx.leaveRequest.update({
          where: { id: request.id },
          data: {
            startDate: remaining[0].date,
            endDate: remaining[remaining.length - 1].date,
            type: types.size === 1 ? remaining[0].type : "MIXED",
          },
        });
      }
      // Comp days are still tracked on the yearly balance row that approval added to.
      if (day.type === "COMP_DAY") {
        const year = new Date(request.startDate).getFullYear();
        const balance = await tx.leaveBalance.findUnique({
          where: { employeeId_year_type: { employeeId: request.employeeId, year, type: "COMP_DAY" } },
        });
        if (balance) {
          await tx.leaveBalance.update({
            where: { id: balance.id },
            data: { usedDays: Math.max(0, balance.usedDays - (day.halfDay ? 0.5 : 1)) },
          });
        }
      }
    });
  }

  const { email, name } = request.employee;
  const label = dayLabel(day.date);
  after(async () => {
    await notifyEmployeePtoDayRemoval(email, name, label, decision === "approve");
  });

  // requestDeleted: that was the request's only day, so the whole request is gone.
  return NextResponse.json({ ok: true, requestDeleted });
}
