import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Clock, Calendar, FolderKanban, ChevronRight } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { TimesheetWeek, Employee, LeaveRequest } from "@prisma/client";

export default async function AdminDashboardPage() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") redirect("/dashboard");

  const [
    pendingTimesheets,
    pendingLeave,
    activeProjects,
    activeEmployees,
  ] = await Promise.all([
    db.timesheetWeek.findMany({
      where: { status: "SUBMITTED" },
      include: { employee: { select: { name: true, email: true } } },
      orderBy: { submittedAt: "asc" },
      take: 10,
    }),
    db.leaveRequest.findMany({
      where: { status: "PENDING" },
      include: { employee: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
      take: 10,
    }),
    db.project.count({ where: { status: "ACTIVE" } }),
    db.employee.count({ where: { isActive: true } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-neutral-900">Admin Dashboard</h2>
        <p className="text-sm text-neutral-500 mt-0.5">Overview and pending actions</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-50 rounded-lg">
                <Clock className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">{pendingTimesheets.length}</p>
                <p className="text-xs text-neutral-500">Timesheets pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Calendar className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">{pendingLeave.length}</p>
                <p className="text-xs text-neutral-500">Leave requests pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <FolderKanban className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">{activeProjects}</p>
                <p className="text-xs text-neutral-500">Active projects</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 rounded-lg">
                <Users className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">{activeEmployees}</p>
                <p className="text-xs text-neutral-500">Active employees</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending timesheets */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle>Pending Timesheets</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/admin/timesheets?status=SUBMITTED">
                  View all <ChevronRight className="h-3 w-3" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {pendingTimesheets.length === 0 ? (
              <p className="text-sm text-neutral-500 text-center py-6">No pending timesheets.</p>
            ) : (
              <div className="divide-y divide-neutral-100">
                {pendingTimesheets.map((ts: TimesheetWeek & { employee: { name: string; email: string } }) => (
                  <Link
                    key={ts.id}
                    href={`/admin/timesheets/${ts.id}`}
                    className="flex items-center justify-between px-5 py-3 hover:bg-neutral-50 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-neutral-800">{ts.employee.name}</p>
                      <p className="text-xs text-neutral-500">Week of {formatDate(ts.weekStartDate)}</p>
                    </div>
                    <Badge variant="warning">Review</Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending leave */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle>Pending Leave Requests</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/admin/leave">
                  View all <ChevronRight className="h-3 w-3" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {pendingLeave.length === 0 ? (
              <p className="text-sm text-neutral-500 text-center py-6">No pending leave requests.</p>
            ) : (
              <div className="divide-y divide-neutral-100">
                {pendingLeave.map((lr: LeaveRequest & { employee: { name: string } }) => (
                  <Link
                    key={lr.id}
                    href={`/admin/leave/${lr.id}`}
                    className="flex items-center justify-between px-5 py-3 hover:bg-neutral-50 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-neutral-800">{lr.employee.name}</p>
                      <p className="text-xs text-neutral-500">
                        {lr.type} · {formatDate(lr.startDate)} – {formatDate(lr.endDate)}
                      </p>
                    </div>
                    <Badge variant="warning">Review</Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
