import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { StatusProgress } from "@/components/timesheet/StatusProgress";
import { TimesheetGrid } from "@/components/timesheet/TimesheetGrid";
import { ReviewActions } from "@/components/timesheet/ReviewActions";
import { formatDate, getWeekDays } from "@/lib/utils";
import { Calendar } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";

const statusVariant: Record<string, "success" | "warning" | "secondary" | "destructive"> = {
  DRAFT: "secondary",
  SUBMITTED: "warning",
  APPROVED: "success",
  REJECTED: "destructive",
};

export default async function AdminTimesheetReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") redirect("/dashboard");

  const timesheet = await db.timesheetWeek.findUnique({
    where: { id },
    include: {
      employee: { select: { name: true, email: true, title: true } },
      reviewer: { select: { name: true } },
      entries: {
        include: { project: { select: { name: true } } },
        orderBy: { date: "asc" },
      },
    },
  });

  if (!timesheet) notFound();

  const projects = await db.project.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
  });

  const weekDays = getWeekDays(timesheet.weekStartDate);
  const weekEnd = weekDays[6];

  const rowTotals: { name: string; phase: string; hours: number }[] = [];
  for (const e of timesheet.entries) {
    const project = projects.find((p) => p.id === e.projectId);
    if (!project) continue;
    const existing = rowTotals.find((r) => r.name === project.name && r.phase === e.phase);
    if (existing) existing.hours += e.hours;
    else rowTotals.push({ name: project.name, phase: e.phase, hours: e.hours });
  }
  const projectTotals = rowTotals.filter((r) => r.hours > 0);

  const totalHours = timesheet.entries.reduce((sum, e) => sum + e.hours, 0);

  const entryData = timesheet.entries.map((e) => ({
    projectId: e.projectId,
    phase: e.phase,
    date: e.date.toISOString(),
    hours: e.hours,
    absenceCode: e.absenceCode,
    notes: e.notes,
  }));

  return (
    <div className="space-y-6 max-w-5xl">
      <BackButton />
      {/* Header */}
      <div className="bg-white rounded-lg border border-neutral-200 p-5">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-semibold text-neutral-900">{timesheet.employee.name}</h2>
              <Badge variant={statusVariant[timesheet.status] ?? "secondary"}>{timesheet.status}</Badge>
            </div>
            <p className="text-sm text-neutral-500">{timesheet.employee.title} · {timesheet.employee.email}</p>
            <div className="flex items-center gap-1.5 text-sm text-neutral-500 mt-1">
              <Calendar className="h-3.5 w-3.5" />
              <span>{formatDate(timesheet.weekStartDate)} – {formatDate(weekEnd)}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-3">
            <StatusProgress status={timesheet.status as "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED"} />
            {timesheet.status === "SUBMITTED" && (
              <ReviewActions
                timesheetId={id}
                status="SUBMITTED"
              />
            )}
            {(timesheet.status === "APPROVED" || timesheet.status === "REJECTED") && (
              <p className="text-sm text-neutral-500">
                {timesheet.status === "APPROVED" ? "Approved" : "Rejected"} by {timesheet.reviewer?.name} on {formatDate(timesheet.reviewedAt!)}
              </p>
            )}
          </div>
        </div>
        {timesheet.reviewComment && (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800">
            <span className="font-medium">Review comment:</span> {timesheet.reviewComment}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg border border-neutral-200 p-5">
        <Tabs defaultValue="work">
          <TabsList>
            <TabsTrigger value="work">Work</TabsTrigger>
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="work">
            <TimesheetGrid
              timesheetId={id}
              weekStart={timesheet.weekStartDate}
              projects={projects}
              entries={entryData}
              status={timesheet.status as "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED"}
              isAdmin={true}
              lastSaved={timesheet.updatedAt}
            />
          </TabsContent>

          <TabsContent value="summary">
            <div className="space-y-2">
              {projectTotals.length === 0 ? (
                <p className="text-sm text-neutral-500 py-4">No hours logged.</p>
              ) : (
                <>
                  {projectTotals.map((p, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-neutral-100">
                      <div>
                        <span className="text-sm text-neutral-700">{p.name}</span>
                        {p.phase && <span className="ml-2 text-xs text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded">{p.phase}</span>}
                      </div>
                      <span className="text-sm font-semibold text-neutral-900">{p.hours}h</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between py-2 font-semibold">
                    <span className="text-sm">Total</span>
                    <span className="text-sm text-primary-600">{totalHours}h</span>
                  </div>
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="history">
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-neutral-100">
                <span className="text-neutral-500">Created</span>
                <span>{formatDate(timesheet.createdAt)}</span>
              </div>
              {timesheet.submittedAt && (
                <div className="flex justify-between py-2 border-b border-neutral-100">
                  <span className="text-neutral-500">Submitted</span>
                  <span>{formatDate(timesheet.submittedAt)}</span>
                </div>
              )}
              {timesheet.reviewedAt && (
                <div className="flex justify-between py-2 border-b border-neutral-100">
                  <span className="text-neutral-500">Reviewed by</span>
                  <span>{timesheet.reviewer?.name} · {formatDate(timesheet.reviewedAt)}</span>
                </div>
              )}
              {timesheet.reviewComment && (
                <div className="py-2">
                  <span className="text-neutral-500 block mb-1">Comment</span>
                  <p className="bg-neutral-50 rounded p-2 border border-neutral-200">{timesheet.reviewComment}</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
