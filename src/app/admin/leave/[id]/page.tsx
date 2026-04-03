import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, daysBetween } from "@/lib/utils";
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
  PERSONAL: "Personal",
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
    },
  });

  if (!request) notFound();

  const numDays = daysBetween(request.startDate, request.endDate);

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
              <p className="text-neutral-500">{numDays} day{numDays !== 1 ? "s" : ""}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500 mb-0.5">Submitted</p>
              <p className="font-medium text-neutral-800">{formatDate(request.createdAt)}</p>
            </div>
          </div>

          {request.reason && (
            <div>
              <p className="text-xs text-neutral-500 mb-0.5">Reason</p>
              <p className="text-sm text-neutral-700 bg-neutral-50 rounded p-3 border border-neutral-200">
                {request.reason}
              </p>
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
