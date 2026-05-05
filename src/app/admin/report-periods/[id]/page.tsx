import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { PeriodReviewActions } from "@/components/timesheet/PeriodReviewActions";
import { PeriodView } from "@/components/timesheet/PeriodView";
import { formatDate } from "@/lib/utils";
import { BackButton } from "@/components/ui/back-button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { AdminDeletePeriodButton } from "@/components/timesheet/AdminDeletePeriodButton";

const statusVariant: Record<string, "success" | "warning" | "secondary" | "destructive"> = {
  DRAFT: "secondary",
  SUBMITTED: "warning",
  APPROVED: "success",
  REJECTED: "destructive",
  REVISION_REQUESTED: "warning",
};

const statusLabel: Record<string, string> = {
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  REVISION_REQUESTED: "Revision Requested",
};

export default async function AdminPeriodReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") redirect("/dashboard");

  const period = await db.reportPeriod.findUnique({
    where: { id },
    include: {
      employee: { select: { name: true, email: true, title: true } },
      reviewer: { select: { name: true } },
      weeks: {
        include: { entries: { orderBy: { date: "asc" } } },
        orderBy: { weekStartDate: "asc" },
      },
    },
  });

  if (!period) notFound();

  const projects = await db.project.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
  });

  const officeAdminProject = projects.find((p) => p.name === "001_Office Admin");
  const rowOrderData = period.rowOrder as Array<{ projectId: string; phase: string }> | null;

  const weeksData = period.weeks.map((w) => ({
    id: w.id,
    weekStartDate: w.weekStartDate.toISOString(),
    status: w.status as "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "REVISION_REQUESTED",
    updatedAt: w.updatedAt.toISOString(),
    entries: w.entries.map((e) => ({
      projectId: e.projectId,
      phase: e.phase,
      date: e.date.toISOString(),
      hours: e.hours,
      absenceCode: e.absenceCode,
      notes: e.notes,
    })),
  }));

  const totalHours = period.weeks.flatMap((w) => w.entries).reduce((s, e) => s + e.hours, 0);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <BackButton />
        <AdminDeletePeriodButton periodId={id} />
      </div>

      {/* Header */}
      <div className="bg-white rounded-lg border border-neutral-200 p-5">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-semibold text-neutral-900">{period.employee.name}</h2>
              <Badge variant={statusVariant[period.status] ?? "secondary"}>
                {statusLabel[period.status] ?? period.status}
              </Badge>
            </div>
            <p className="text-sm text-neutral-500">{period.employee.title} · {period.employee.email}</p>
            <p className="text-sm text-neutral-500 mt-0.5">
              {formatDate(period.startDate)} – {formatDate(period.endDate)} · {period.weeks.length} weeks · {totalHours}h total
            </p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <PeriodReviewActions periodId={id} status={period.status} />
            {(period.status === "APPROVED" || period.status === "REJECTED") && period.reviewer && (
              <p className="text-sm text-neutral-500 text-right">
                {period.status === "APPROVED" ? "Approved" : "Rejected"} by {period.reviewer.name}
                {period.reviewedAt ? ` on ${formatDate(period.reviewedAt)}` : ""}
              </p>
            )}
          </div>
        </div>
        {period.reviewComment && (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800">
            <span className="font-medium">Review comment:</span> {period.reviewComment}
          </div>
        )}
      </div>

      {/* Period weeks (read-only view) */}
      <PeriodView
        periodId={id}
        startDate={period.startDate.toISOString()}
        endDate={period.endDate.toISOString()}
        status={period.status as "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "REVISION_REQUESTED"}
        reviewComment={period.reviewComment}
        weeks={weeksData}
        projects={projects}
        isAdmin={true}
        officeAdminProjectId={officeAdminProject?.id ?? null}
        rowOrder={rowOrderData}
      />
    </div>
  );
}
