import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Calendar, Plus, ChevronRight } from "lucide-react";
import { getWeekStart, formatDate } from "@/lib/utils";
import type { TimesheetWeek } from "@prisma/client";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const today = new Date();
  const weekStart = getWeekStart(today);

  // Fetch current week timesheet
  const currentTimesheet = await db.timesheetWeek.findUnique({
    where: {
      employeeId_weekStartDate: {
        employeeId: session.user.id,
        weekStartDate: weekStart,
      },
    },
    include: {
      entries: true,
    },
  });

  // Total hours this week
  const weekHours = currentTimesheet?.entries.reduce((sum: number, e: { hours: number }) => sum + e.hours, 0) ?? 0;

  // Recent timesheets
  const recentTimesheets = await db.timesheetWeek.findMany({
    where: { employeeId: session.user.id },
    orderBy: { weekStartDate: "desc" },
    take: 5,
  });

  // Pending leave requests
  const pendingLeave = await db.leaveRequest.count({
    where: { employeeId: session.user.id, status: "PENDING" },
  });

  const statusColors: Record<string, "success" | "warning" | "info" | "destructive" | "secondary"> = {
    DRAFT: "secondary",
    SUBMITTED: "warning",
    APPROVED: "success",
    REJECTED: "destructive",
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-neutral-900">
          Welcome back, {session.user.name?.split(" ")[0]}
        </h2>
        <p className="text-sm text-neutral-500 mt-0.5">
          Week of {formatDate(weekStart)}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-50 rounded-lg">
                <Clock className="h-5 w-5 text-primary-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">{weekHours}h</p>
                <p className="text-xs text-neutral-500">Hours this week</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-50 rounded-lg">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">
                  {currentTimesheet?.status ?? "—"}
                </p>
                <p className="text-xs text-neutral-500">This week&apos;s timesheet</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">{pendingLeave}</p>
                <p className="text-xs text-neutral-500">Pending leave requests</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="flex gap-3 flex-wrap">
        <Button asChild>
          <Link href={`/timesheets/${currentTimesheet?.id ?? "new"}`}>
            <Clock className="h-4 w-4" />
            {currentTimesheet ? "View This Week" : "Start This Week's Timesheet"}
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/leave/new">
            <Plus className="h-4 w-4" />
            Request Leave
          </Link>
        </Button>
      </div>

      {/* Recent timesheets */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>Recent Timesheets</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/timesheets">
                View all <ChevronRight className="h-3 w-3" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {recentTimesheets.length === 0 ? (
            <p className="text-sm text-neutral-500 text-center py-4">
              No timesheets yet.{" "}
              <Link href="/timesheets" className="text-primary-600 hover:underline">
                Create your first one
              </Link>
            </p>
          ) : (
            <div className="divide-y divide-neutral-100">
              {recentTimesheets.map((ts: TimesheetWeek) => (
                <Link
                  key={ts.id}
                  href={`/timesheets/${ts.id}`}
                  className="flex items-center justify-between py-3 hover:bg-neutral-50 -mx-2 px-2 rounded transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-neutral-800">
                      Week of {formatDate(ts.weekStartDate)}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {ts.submittedAt
                        ? `Submitted ${formatDate(ts.submittedAt)}`
                        : "Not submitted yet"}
                    </p>
                  </div>
                  <Badge variant={statusColors[ts.status] ?? "secondary"}>
                    {ts.status}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
