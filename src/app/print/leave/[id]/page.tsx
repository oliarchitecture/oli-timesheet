import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { PrintButton } from "@/components/leave/PrintButton";

const leaveTypeLabel: Record<string, string> = {
  VACATION: "Vacation",
  SICK: "Sick",
  PERSONAL: "Personal / Non-Paid Time",
  COMP_DAY: "Comp Day",
  OTHER: "Other",
  MIXED: "Mixed",
};

const statusLabel: Record<string, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  REVISION_REQUESTED: "Revision Requested",
};

export default async function PrintLeaveRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const request = await db.leaveRequest.findUnique({
    where: { id },
    include: {
      days: { orderBy: { date: "asc" } },
      employee: { select: { id: true, name: true, title: true } },
    },
  });

  if (!request) notFound();
  if (request.employeeId !== session.user.id && session.user.role !== "ADMIN") {
    redirect("/leave");
  }

  const totalDays = request.days.reduce((sum, d) => sum + (d.halfDay ? 0.5 : 1), 0);

  return (
    <div className="max-w-2xl mx-auto p-10 print:p-0">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">PTO Request</h1>
          <p className="text-sm text-neutral-500 mt-1">OLI Architecture — Employee Portal</p>
        </div>
        <PrintButton />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8 text-sm">
        <div>
          <p className="text-neutral-500">Employee</p>
          <p className="font-medium text-neutral-900">{request.employee.name}</p>
          {request.employee.title && (
            <p className="text-neutral-600">{request.employee.title}</p>
          )}
        </div>
        <div>
          <p className="text-neutral-500">Status</p>
          <p className="font-medium text-neutral-900">{statusLabel[request.status] ?? request.status}</p>
        </div>
        <div>
          <p className="text-neutral-500">Date Range</p>
          <p className="font-medium text-neutral-900">
            {formatDate(request.startDate)} – {formatDate(request.endDate)}
          </p>
        </div>
        <div>
          <p className="text-neutral-500">Total Days</p>
          <p className="font-medium text-neutral-900">{totalDays}</p>
        </div>
      </div>

      <table className="w-full text-sm border-collapse mb-8">
        <thead>
          <tr className="border-b border-neutral-300">
            <th className="text-left py-2 font-medium text-neutral-600">Date</th>
            <th className="text-left py-2 font-medium text-neutral-600">Type</th>
            <th className="text-left py-2 font-medium text-neutral-600">Duration</th>
            <th className="text-left py-2 font-medium text-neutral-600">Reason</th>
          </tr>
        </thead>
        <tbody>
          {request.days.map((day) => (
            <tr key={day.id} className="border-b border-neutral-100">
              <td className="py-2">{formatDate(day.date)}</td>
              <td className="py-2">{leaveTypeLabel[day.type] ?? day.type}</td>
              <td className="py-2">{day.halfDay ? "Half Day" : "Full Day"}</td>
              <td className="py-2">{day.reason ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {request.reviewComment && (
        <div className="mb-8 text-sm">
          <p className="text-neutral-500">Reviewer Comment</p>
          <p className="text-neutral-900">{request.reviewComment}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-8 mt-16 text-sm">
        <div>
          <div className="border-t border-neutral-400 pt-1">Employee Signature</div>
        </div>
        <div>
          <div className="border-t border-neutral-400 pt-1">Date</div>
        </div>
      </div>
    </div>
  );
}
