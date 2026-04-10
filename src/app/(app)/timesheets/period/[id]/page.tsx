import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { BackButton } from "@/components/ui/back-button";
import { PeriodView } from "@/components/timesheet/PeriodView";
import { DeletePeriodButton } from "@/components/timesheet/DeletePeriodButton";

export default async function PeriodPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const period = await db.reportPeriod.findUnique({
    where: { id },
    include: {
      employee: { select: { name: true } },
      weeks: {
        include: { entries: { orderBy: { date: "asc" } } },
        orderBy: { weekStartDate: "asc" },
      },
    },
  });

  if (!period) notFound();
  if (period.employeeId !== session.user.id && session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const projects = await db.project.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
  });

  const weeksData = period.weeks.map((w) => ({
    id: w.id,
    weekStartDate: w.weekStartDate.toISOString(),
    status: w.status as "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED",
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
        status={period.status as "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED"}
        weeks={weeksData}
        projects={projects}
        isAdmin={session.user.role === "ADMIN"}
      />
    </div>
  );
}
