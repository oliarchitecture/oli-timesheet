import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { RequestReviewActions } from "./RequestReviewActions";
import { BackButton } from "@/components/ui/back-button";
import { RequestNotesThread } from "@/components/requests/RequestNotesThread";
import { CloseRequestButton } from "@/components/requests/CloseRequestButton";

const statusVariant: Record<string, "success" | "warning" | "secondary" | "destructive"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "destructive",
};

export default async function AdminRequestReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") redirect("/dashboard");

  const request = await db.generalRequest.findUnique({
    where: { id },
    include: {
      employee: { select: { name: true, email: true, title: true } },
      reviewer: { select: { name: true } },
      notes: { include: { author: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
    },
  });

  if (!request) notFound();

  return (
    <div className="space-y-6 max-w-xl">
      <BackButton />
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-neutral-900">Request</h2>
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
              <p className="text-xs text-neutral-500 mb-0.5">Submitted</p>
              <p className="font-medium text-neutral-800">{formatDate(request.createdAt)}</p>
            </div>
          </div>

          <div>
            <p className="text-xs text-neutral-500 mb-0.5">Subject</p>
            <p className="font-medium text-neutral-800">{request.subject}</p>
          </div>

          <div>
            <p className="text-xs text-neutral-500 mb-1">Note</p>
            <p className="text-sm text-neutral-700 bg-neutral-50 rounded p-3 border border-neutral-200 whitespace-pre-wrap">
              {request.note}
            </p>
          </div>

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
              <RequestReviewActions requestId={id} />
            </div>
          )}

          {(request.status === "APPROVED" || request.status === "REJECTED") && (
            <p className="text-sm text-neutral-500">
              {request.status === "APPROVED" ? "Approved" : "Rejected"} by{" "}
              {request.reviewer?.name} on {formatDate(request.reviewedAt!)}
            </p>
          )}

          <div className="pt-4 border-t border-neutral-100">
            <RequestNotesThread
              requestId={id}
              notes={request.notes}
              currentUserId={session.user.id}
              closed={request.notesClosed}
            />
            {!request.notesClosed && (
              <div className="pt-3">
                <CloseRequestButton requestId={id} />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
