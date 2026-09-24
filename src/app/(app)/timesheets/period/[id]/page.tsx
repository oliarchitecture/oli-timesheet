import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { BackButton } from "@/components/ui/back-button";
import { PeriodView } from "@/components/timesheet/PeriodView";
import { DeletePeriodButton } from "@/components/timesheet/DeletePeriodButton";
import { loadPeriodWeeks, toWeekData } from "@/lib/period-weeks.server";

export default async function PeriodPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const period = await db.reportPeriod.findUnique({
    where: { id },
    include: { employee: { select: { name: true } } },
  });

  if (!period) notFound();
  if (period.employeeId !== session.user.id && session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const [projects, weeks] = await Promise.all([
    db.project.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
    loadPeriodWeeks(period.employeeId, period),
  ]);

  const officeAdminProject = projects.find((p) => p.name === "001_Office Admin");
  const rowOrderData = period.rowOrder as Array<{ projectId: string; phase: string }> | null;

  const weeksData = weeks.map(toWeekData);

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <BackButton />
        {period.status === "DRAFT" && session.user.role !== "ADMIN" && (
          <DeletePeriodButton periodId={id} />
        )}
      </div>

      <div>
        <h2 className="text-xl font-semibold text-neutral-900">{period.employee.name}</h2>
        <p className="text-sm text-neutral-500 mt-0.5">Timesheet</p>
      </div>

      <PeriodView
        periodId={id}
        startDate={period.startDate.toISOString()}
        endDate={period.endDate.toISOString()}
        status={period.status as "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "REVISION_REQUESTED"}
        reviewComment={period.reviewComment}
        weeks={weeksData}
        projects={projects}
        isAdmin={session.user.role === "ADMIN"}
        officeAdminProjectId={officeAdminProject?.id ?? null}
        rowOrder={rowOrderData}
      />
    </div>
  );
}
