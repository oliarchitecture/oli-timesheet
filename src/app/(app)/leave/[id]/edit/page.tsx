import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { LeaveRequestForm, type DayEntry, type LeaveType } from "@/components/leave/LeaveRequestForm";

export default async function EditLeaveRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const request = await db.leaveRequest.findUnique({
    where: { id },
    include: { days: { orderBy: { date: "asc" } } },
  });

  if (!request || request.employeeId !== session.user.id) notFound();
  if (request.status !== "REVISION_REQUESTED") redirect("/leave");

  const initialDays: DayEntry[] = request.days.map((d) => ({
    date: d.date.toISOString().slice(0, 10),
    type: d.type as LeaveType,
    halfDay: d.halfDay,
    reason: d.reason ?? "",
  }));

  return <LeaveRequestForm mode="edit" leaveId={id} initialDays={initialDays} />;
}
