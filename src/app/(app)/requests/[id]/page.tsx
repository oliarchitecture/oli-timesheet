import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { BackButton } from "@/components/ui/back-button";
import { RequestNotesThread } from "@/components/requests/RequestNotesThread";

const statusVariant: Record<string, "success" | "warning" | "secondary" | "destructive"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "destructive",
};

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const request = await db.generalRequest.findUnique({
    where: { id },
    include: {
      reviewer: { select: { name: true } },
      notes: { include: { author: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
    },
  });

  if (!request) notFound();
  if (request.employeeId !== session.user.id) redirect("/requests");

  return (
    <div className="space-y-6 max-w-xl">
      <BackButton />
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-neutral-900">Request</h2>
        <Badge variant={statusVariant[request.status] ?? "secondary"}>{request.status}</Badge>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div>
            <p className="text-xs text-neutral-500 mb-0.5">Submitted</p>
            <p className="font-medium text-neutral-800">{formatDate(request.createdAt)}</p>
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
              <p className="text-xs text-neutral-500 mb-0.5">Admin Comment</p>
              <p className="text-sm text-neutral-700 bg-amber-50 rounded p-3 border border-amber-200">
                {request.reviewComment}
              </p>
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
