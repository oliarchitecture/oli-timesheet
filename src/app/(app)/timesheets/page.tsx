import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { NewPeriodButton } from "@/components/timesheet/NewPeriodButton";
import { DeletePeriodButton } from "@/components/timesheet/DeletePeriodButton";

const statusVariant: Record<string, "success" | "warning" | "secondary" | "destructive"> = {
  DRAFT: "secondary",
  SUBMITTED: "warning",
  APPROVED: "success",
  REJECTED: "destructive",
};

export default async function TimesheetsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [periods, employee] = await Promise.all([
    db.reportPeriod.findMany({
      where: { employeeId: session.user.id },
      orderBy: { startDate: "desc" },
      include: {
        weeks: { include: { entries: { select: { hours: true } } } },
      },
    }),
    db.employee.findUnique({
      where: { id: session.user.id },
      select: { defaultPeriodStartDay: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">My Timesheets</h2>
          <p className="text-sm text-neutral-500 mt-0.5">Track and submit your timesheets</p>
        </div>
        <NewPeriodButton defaultPeriodStartDay={employee?.defaultPeriodStartDay ?? null} />
      </div>

      <Card>
        <CardContent className="p-0">
          {periods.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-neutral-500 text-sm">No timesheets yet.</p>
              <p className="text-neutral-400 text-xs mt-1">Use the &ldquo;New Timesheet&rdquo; button above to get started.</p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {periods.map((period) => {
                const totalHours = period.weeks.reduce(
                  (sum, w) => sum + w.entries.reduce((s, e) => s + e.hours, 0),
                  0
                );
                const weekCount = period.weeks.length;
                return (
                  <div key={period.id} className="flex items-center gap-2 px-6 py-4 hover:bg-neutral-50 transition-colors">
                    <Link href={`/timesheets/period/${period.id}`} className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-800">
                        {formatDate(period.startDate)} – {formatDate(period.endDate)}
                      </p>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        {weekCount} week{weekCount !== 1 ? "s" : ""}
                        {totalHours > 0 ? ` · ${totalHours}h logged` : " · No hours logged"}
                        {period.submittedAt ? ` · Submitted ${formatDate(period.submittedAt)}` : ""}
                      </p>
                    </Link>
                    <Badge variant={statusVariant[period.status] ?? "secondary"}>{period.status}</Badge>
                    {period.status === "DRAFT" && (
                      <DeletePeriodButton periodId={period.id} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
