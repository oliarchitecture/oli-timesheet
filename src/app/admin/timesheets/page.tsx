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
};

export default async function AdminTimesheetsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; employeeId?: string; year?: string; month?: string }>;
}) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") redirect("/dashboard");

  const { status, employeeId, year, month } = await searchParams;

  // Build date range filter from year/month
  let dateFilter = {};
  if (year || month) {
    const y = year ? parseInt(year) : new Date().getFullYear();
    const m = month ? parseInt(month) - 1 : undefined;
    if (m !== undefined) {
      const start = new Date(Date.UTC(y, m, 1));
      const end = new Date(Date.UTC(y, m + 1, 0));
      dateFilter = { weekStartDate: { gte: start, lte: end } };
    } else {
      const start = new Date(Date.UTC(y, 0, 1));
      const end = new Date(Date.UTC(y, 11, 31));
      dateFilter = { weekStartDate: { gte: start, lte: end } };
    }
  }

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
                    <Badge variant={statusVariant[ts.status] ?? "secondary"}>{ts.status}</Badge>
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
