import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { TimesheetFilters } from "./TimesheetFilters";
import type { TimesheetWeek } from "@prisma/client";

const statusVariant: Record<string, "success" | "warning" | "secondary" | "destructive"> = {
  SUBMITTED: "warning",
  APPROVED: "success",
  REJECTED: "destructive",
  REVISION_REQUESTED: "warning",
};

const statusLabel: Record<string, string> = {
  SUBMITTED: "SUBMITTED",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  REVISION_REQUESTED: "Revision Requested",
};

export default async function AdminTimesheetsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; employeeId?: string; year?: string; month?: string; view?: string }>;
}) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") redirect("/dashboard");

  const { status, employeeId, year, month, view } = await searchParams;
  const showPeriods = view === "periods";

  // Build date range filter from year/month
  let dateFilter = {};
  if (year || month) {
    const y = year ? parseInt(year) : new Date().getFullYear();
    const m = month ? parseInt(month) - 1 : undefined;
    if (m !== undefined) {
      const start = new Date(Date.UTC(y, m, 1));
      const end = new Date(Date.UTC(y, m + 1, 0));
      dateFilter = showPeriods
        ? { startDate: { gte: start, lte: end } }
        : { weekStartDate: { gte: start, lte: end } };
    } else {
      const start = new Date(Date.UTC(y, 0, 1));
      const end = new Date(Date.UTC(y, 11, 31));
      dateFilter = showPeriods
        ? { startDate: { gte: start, lte: end } }
        : { weekStartDate: { gte: start, lte: end } };
    }
  }

  // Periods view
  if (showPeriods) {
    const periods = await db.reportPeriod.findMany({
      where: {
        status: status ? { equals: status as "SUBMITTED" | "APPROVED" | "REJECTED" | "REVISION_REQUESTED" } : { not: "DRAFT" },
        ...(employeeId ? { employeeId } : {}),
        ...dateFilter,
      },
      include: {
        employee: { select: { name: true } },
        weeks: { include: { entries: { select: { hours: true } } } },
      },
      orderBy: [{ startDate: "desc" }, { status: "asc" }],
    });

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">All Timesheets</h2>
          <p className="text-sm text-neutral-500 mt-0.5">{periods.length} period{periods.length !== 1 ? "s" : ""}</p>
        </div>

        <div className="flex gap-2">
          <Link href="/admin/timesheets" className="px-3 py-1.5 text-sm rounded-md border border-neutral-200 text-neutral-600 hover:bg-neutral-50">By Week</Link>
          <span className="px-3 py-1.5 text-sm rounded-md bg-primary-500 text-white">By Period</span>
        </div>

        <TimesheetFilters currentYear={year ?? ""} currentMonth={month ?? ""} currentStatus={status ?? ""} />

        <Card>
          <CardContent className="p-0">
            {periods.length === 0 ? (
              <p className="text-sm text-neutral-500 text-center py-10">No periods found.</p>
            ) : (
              <div className="divide-y divide-neutral-100">
                {periods.map((p) => {
                  const totalHours = p.weeks.flatMap((w) => w.entries).reduce((s, e) => s + e.hours, 0);
                  return (
                    <Link
                      key={p.id}
                      href={`/admin/report-periods/${p.id}`}
                      className="flex items-center justify-between px-6 py-4 hover:bg-neutral-50 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium text-neutral-800">{p.employee.name}</p>
                        <p className="text-xs text-neutral-500">
                          {formatDate(p.startDate)} – {formatDate(p.endDate)} · {p.weeks.length} weeks · {totalHours}h
                          {p.submittedAt ? ` · Submitted ${formatDate(p.submittedAt)}` : ""}
                        </p>
                      </div>
                      <Badge variant={statusVariant[p.status] ?? "secondary"}>
                        {statusLabel[p.status] ?? p.status}
                      </Badge>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Default: weeks view
  const timesheets = await db.timesheetWeek.findMany({
    where: {
      status: status ? status as "SUBMITTED" | "APPROVED" | "REJECTED" : { not: "DRAFT" },
      ...(employeeId ? { employeeId } : {}),
      ...dateFilter,
    },
    include: {
      employee: { select: { name: true, email: true } },
      entries: true,
    },
    orderBy: [{ weekStartDate: "desc" }, { status: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-neutral-900">All Timesheets</h2>
        <p className="text-sm text-neutral-500 mt-0.5">{timesheets.length} timesheet{timesheets.length !== 1 ? "s" : ""}</p>
      </div>

      <div className="flex gap-2">
        <span className="px-3 py-1.5 text-sm rounded-md bg-primary-500 text-white">By Week</span>
        <Link href="/admin/timesheets?view=periods" className="px-3 py-1.5 text-sm rounded-md border border-neutral-200 text-neutral-600 hover:bg-neutral-50">By Period</Link>
      </div>

      <TimesheetFilters
        currentYear={year ?? ""}
        currentMonth={month ?? ""}
        currentStatus={status ?? ""}
      />

      <Card>
        <CardContent className="p-0">
          {timesheets.length === 0 ? (
            <p className="text-sm text-neutral-500 text-center py-10">No timesheets found.</p>
          ) : (
            <div className="divide-y divide-neutral-100">
              {timesheets.map((ts: TimesheetWeek & { employee: { name: string; email: string }; entries: { hours: number }[] }) => {
                const totalHours = ts.entries.reduce((sum: number, e: { hours: number }) => sum + e.hours, 0);
                return (
                  <Link
                    key={ts.id}
                    href={`/admin/timesheets/${ts.id}`}
                    className="flex items-center justify-between px-6 py-4 hover:bg-neutral-50 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-neutral-800">{ts.employee.name}</p>
                      <p className="text-xs text-neutral-500">
                        Week of {formatDate(ts.weekStartDate)} · {totalHours}h logged
                        {ts.submittedAt ? ` · Submitted ${formatDate(ts.submittedAt)}` : ""}
                      </p>
                    </div>
                    <Badge variant={statusVariant[ts.status] ?? "secondary"}>
                      {statusLabel[ts.status] ?? ts.status}
                    </Badge>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
