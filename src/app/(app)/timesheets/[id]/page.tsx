import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { StatusProgress } from "@/components/timesheet/StatusProgress";
import { TimesheetGrid } from "@/components/timesheet/TimesheetGrid";
import { formatDate, formatDateShort, getWeekDays } from "@/lib/utils";
import { Calendar } from "lucide-react";

const statusVariant: Record<string, "success" | "warning" | "secondary" | "destructive"> = {
  DRAFT: "secondary",
  SUBMITTED: "warning",
  APPROVED: "success",
  REJECTED: "destructive",
};

export default async function TimesheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const timesheet = await db.timesheetWeek.findUnique({
    where: { id },
    include: {
      employee: { select: { name: true, email: true } },
      reviewer: { select: { name: true } },
      entries: {
        include: { project: { select: { name: true } } },
        orderBy: { date: "asc" },
      },
    },
  });

  if (!timesheet) notFound();
  if (timesheet.employeeId !== session.user.id && session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const projects = await db.project.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
  });

  const weekDays = getWeekDays(timesheet.weekStartDate);
  const weekEnd = weekDays[6];

  // Summary: total hours per project
  const projectTotals = projects.map((p) => ({
    name: p.name,
    hours: timesheet.entries
      .filter((e) => e.projectId === p.id)
      .reduce((sum, e) => sum + e.hours, 0),
  })).filter((p) => p.hours > 0);

  const totalHours = timesheet.entries.reduce((sum, e) => sum + e.hours, 0);

  const entryData = timesheet.entries.map((e) => ({
    projectId: e.projectId,
    date: e.date.toISOString(),
    hours: e.hours,
    notes: e.notes,
  }));

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="bg-white rounded-lg border border-neutral-200 p-5">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-semibold text-neutral-900">
                {timesheet.employee.name}
              </h2>
              <Badge variant={statusVariant[timesheet.status] ?? "secondary"}>
                {timesheet.status}
              </Badge>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-neutral-500">
              <Calendar className="h-3.5 w-3.5" />
              <span>
                {formatDate(timesheet.weekStartDate)} – {formatDate(weekEnd)}
              </span>
            </div>
            {timesheet.reviewComment && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800">
                <span className="font-medium">Review comment:</span> {timesheet.reviewComment}
              </div>
            )}
          </div>
          <StatusProgress status={timesheet.status as "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED"} />
        </div>
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
              isAdmin={session.user.role === "ADMIN"}
              lastSaved={timesheet.updatedAt}
            />
          </TabsContent>

          <TabsContent value="summary">
            <div className="space-y-3">
              {projectTotals.length === 0 ? (
                <p className="text-sm text-neutral-500 py-4">No hours logged yet.</p>
              ) : (
                <>
                  {projectTotals.map((p) => (
                    <div key={p.name} className="flex items-center justify-between py-2 border-b border-neutral-100">
                      <span className="text-sm text-neutral-700">{p.name}</span>
                      <span className="text-sm font-semibold text-neutral-900">{p.hours}h</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between py-2 font-semibold">
                    <span className="text-sm text-neutral-900">Total</span>
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
                <span className="text-neutral-800">{formatDate(timesheet.createdAt)}</span>
              </div>
              {timesheet.submittedAt && (
                <div className="flex justify-between py-2 border-b border-neutral-100">
                  <span className="text-neutral-500">Submitted</span>
                  <span className="text-neutral-800">{formatDate(timesheet.submittedAt)}</span>
                </div>
              )}
              {timesheet.reviewedAt && (
                <div className="flex justify-between py-2 border-b border-neutral-100">
                  <span className="text-neutral-500">
                    {timesheet.status === "APPROVED" ? "Approved" : "Reviewed"} by
                  </span>
                  <span className="text-neutral-800">
                    {timesheet.reviewer?.name ?? "—"} · {formatDate(timesheet.reviewedAt)}
                  </span>
                </div>
              )}
              {timesheet.reviewComment && (
                <div className="py-2">
                  <span className="text-neutral-500 block mb-1">Review comment</span>
                  <p className="text-neutral-800 bg-neutral-50 rounded p-2 border border-neutral-200">
                    {timesheet.reviewComment}
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
