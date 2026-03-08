import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { formatDate, daysBetween } from "@/lib/utils";
import type { LeaveRequest } from "@prisma/client";

const statusVariant: Record<string, "success" | "warning" | "secondary" | "destructive"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "destructive",
};

const leaveTypeLabel: Record<string, string> = {
  VACATION: "Vacation",
  SICK: "Sick",
  PERSONAL: "Personal",
  OTHER: "Other",
};

export default async function LeavePage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [requests, balances] = await Promise.all([
    db.leaveRequest.findMany({
      where: { employeeId: session.user.id },
      orderBy: { createdAt: "desc" },
    }),
    db.leaveBalance.findMany({
      where: { employeeId: session.user.id, year: new Date().getFullYear() },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">My Leave</h2>
          <p className="text-sm text-neutral-500 mt-0.5">Manage leave requests and view balances</p>
        </div>
        <Button asChild>
          <Link href="/leave/new">
            <Plus className="h-4 w-4" />
            Request Leave
          </Link>
        </Button>
      </div>

      {/* Balances */}
      {balances.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {balances.map((b) => (
            <Card key={b.id}>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-neutral-500 capitalize">{b.type.toLowerCase()}</p>
                <p className="text-xl font-bold text-neutral-900 mt-0.5">{b.totalDays - b.usedDays}</p>
                <p className="text-xs text-neutral-400">of {b.totalDays} days remaining</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Requests */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Leave Requests</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {requests.length === 0 ? (
            <p className="text-sm text-neutral-500 text-center py-8">No leave requests yet.</p>
          ) : (
            <div className="divide-y divide-neutral-100">
              {requests.map((lr: LeaveRequest) => (
                <div key={lr.id} className="flex items-center justify-between px-6 py-4">
                  <div>
                    <p className="text-sm font-medium text-neutral-800">
                      {leaveTypeLabel[lr.type]} · {daysBetween(lr.startDate, lr.endDate)} day{daysBetween(lr.startDate, lr.endDate) !== 1 ? "s" : ""}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {formatDate(lr.startDate)} – {formatDate(lr.endDate)}
                      {lr.reason ? ` · ${lr.reason}` : ""}
                    </p>
                    {lr.reviewComment && (
                      <p className="text-xs text-amber-700 mt-0.5">Comment: {lr.reviewComment}</p>
                    )}
                  </div>
                  <Badge variant={statusVariant[lr.status] ?? "secondary"}>{lr.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
