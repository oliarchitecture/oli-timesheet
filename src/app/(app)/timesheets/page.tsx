import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { formatDate, getWeekStart } from "@/lib/utils";
import { DeleteTimesheetButton } from "@/components/timesheet/DeleteTimesheetButton";
import type { TimesheetWeek } from "@prisma/client";

const statusVariant: Record<string, "success" | "warning" | "secondary" | "destructive"> = {
  DRAFT: "secondary",
  SUBMITTED: "warning",
  APPROVED: "success",
  REJECTED: "destructive",
};

export default async function TimesheetsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const timesheets = await db.timesheetWeek.findMany({
    where: { employeeId: session.user.id },
    orderBy: { weekStartDate: "desc" },
    include: { entries: true },
  });

  const today = new Date();
  const thisWeekStart = getWeekStart(today);
  const hasThisWeek = timesheets.some(
    (t) => t.weekStartDate.toISOString().slice(0, 10) === thisWeekStart.toISOString().slice(0, 10)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">My Timesheets</h2>
          <p className="text-sm text-neutral-500 mt-0.5">Track and submit your weekly hours</p>
        </div>
        {!hasThisWeek && (
          <Button asChild>
            <Link href="/timesheets/new">
              <Plus className="h-4 w-4" />
              This Week
            </Link>
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {timesheets.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-neutral-500 text-sm">No timesheets yet.</p>
              <Button asChild className="mt-3">
                <Link href="/timesheets/new">
                  <Plus className="h-4 w-4" />
                  Create Your First Timesheet
                </Link>
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {timesheets.map((ts: TimesheetWeek & { entries: { hours: number }[] }) => {
                const totalHours = ts.entries.reduce((sum: number, e: { hours: number }) => sum + e.hours, 0);
                const weekEnd = new Date(ts.weekStartDate);
                weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
                return (
                  <div key={ts.id} className="flex items-center justify-between px-6 py-4 hover:bg-neutral-50 transition-colors">
                    <Link href={`/timesheets/${ts.id}`} className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-800">
                        Week of {formatDate(ts.weekStartDate)} – {formatDate(weekEnd)}
                      </p>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        {totalHours > 0 ? `${totalHours}h logged` : "No hours logged"}
                        {ts.submittedAt ? ` · Submitted ${formatDate(ts.submittedAt)}` : ""}
                        {ts.reviewedAt ? ` · Reviewed ${formatDate(ts.reviewedAt)}` : ""}
                      </p>
                    </Link>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={statusVariant[ts.status] ?? "secondary"}>{ts.status}</Badge>
                      {ts.status === "DRAFT" && <DeleteTimesheetButton timesheetId={ts.id} />}
                    </div>
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
