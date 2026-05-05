import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { LeaveReviewActions } from "./LeaveReviewActions";
import { BackButton } from "@/components/ui/back-button";

const statusVariant: Record<string, "success" | "warning" | "secondary" | "destructive"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "destructive",
};

const leaveTypeLabel: Record<string, string> = {
  VACATION: "Vacation",
  SICK: "Sick",
  PERSONAL: "Personal / Non-Paid Time",
  COMP_DAY: "Comp Day",
  OTHER: "Other",
};

export default async function AdminLeaveReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") redirect("/dashboard");

  const request = await db.leaveRequest.findUnique({
    where: { id },
    include: {
      employee: { select: { name: true, email: true, title: true } },
      reviewer: { select: { name: true } },
      days: { orderBy: { date: "asc" } },
    },
  });

  if (!request) notFound();

  const numDays = request.days.reduce((sum, d) => sum + (d.halfDay ? 0.5 : 1.0), 0);

  return (
    <div className="space-y-6 max-w-xl">
      <BackButton />
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-neutral-900">PTO Request</h2>
        <Badge variant={statusVariant[request.status] ?? "secondary"}>{request.status}</Badge>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-neutral-500 mb-0.5">Employee</p>
              <p className="font-medium text-neutral-800">{request.employee.name}</p>
              <p className="text-neutral-500">{request.employee.title}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500 mb-0.5">Leave Type</p>
              <p className="font-medium text-neutral-800">{leaveTypeLabel[request.type]}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500 mb-0.5">Dates</p>
              <p className="font-medium text-neutral-800">
                {formatDate(request.startDate)} – {formatDate(request.endDate)}
              </p>
              <p className="text-neutral-500">{numDays} working day{numDays !== 1 ? "s" : ""}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500 mb-0.5">Submitted</p>
              <p className="font-medium text-neutral-800">{formatDate(request.createdAt)}</p>
            </div>
          </div>

          {/* Per-day breakdown */}
          {request.days.length > 0 && (
            <div>
              <p className="text-xs text-neutral-500 mb-2">Day Breakdown</p>
              <div className="rounded-lg border border-neutral-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 border-b border-neutral-200">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-medium text-neutral-500">Date</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-neutral-500">Type</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-neutral-500">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {request.days.map((d) => (
                      <tr key={d.id}>
                        <td className="px-3 py-2 text-neutral-700 font-medium whitespace-nowrap">
                          {new Date(d.date).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            timeZone: "UTC",
                          })}
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={d.halfDay ? "secondary" : "outline"}>
                            {d.halfDay ? "Half Day" : "Full Day"}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-neutral-500 text-xs">{d.reason ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {request.reviewComment && (
            <div>
              <p className="text-xs text-neutral-500 mb-0.5">Review Comment</p>
              <p className="text-sm text-neutral-700 bg-amber-50 rounded p-3 border border-amber-200">
                {request.reviewComment}
              </p>
            </div>
          )}

          {request.status === "PENDING" && (
            <div className="pt-2">
              <LeaveReviewActions leaveId={id} />
            </div>
          )}

          {request.status !== "PENDING" && (
            <p className="text-sm text-neutral-500">
              {request.status === "APPROVED" ? "Approved" : "Rejected"} by{" "}
              {request.reviewer?.name} on {formatDate(request.reviewedAt!)}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
