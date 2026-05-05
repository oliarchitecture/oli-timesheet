import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, CalendarDays } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { DeletePTOButton } from "@/components/leave/DeletePTOButton";

const statusVariant: Record<string, "success" | "warning" | "secondary" | "destructive"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "destructive",
};

const leaveTypeLabel: Record<string, string> = {
  VACATION: "Vacation",
  SICK: "Sick",
  PERSONAL: "Personal / Non-Paid Time",
  COMP_DAY: "Comp Day",
  OTHER: "Other",
};

const leaveTypeColor: Record<string, string> = {
  VACATION: "bg-sky-50 border-sky-200 text-sky-700",
  SICK: "bg-blue-50 border-blue-200 text-blue-700",
  PERSONAL: "bg-purple-50 border-purple-200 text-purple-700",
  OTHER: "bg-neutral-50 border-neutral-200 text-neutral-700",
};

export default async function PTOPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [requests, balances] = await Promise.all([
    db.leaveRequest.findMany({
      where: { employeeId: session.user.id },
      include: { days: { orderBy: { date: "asc" } } },
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
          <h2 className="text-xl font-semibold text-neutral-900">My PTO</h2>
          <p className="text-sm text-neutral-500 mt-0.5">Manage PTO requests and view balances</p>
        </div>
        <Button asChild>
          <Link href="/leave/new">
            <Plus className="h-4 w-4" />
            Request PTO
          </Link>
        </Button>
      </div>

      {/* PTO Balances */}
      {balances.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {balances.map((b) => {
            const remaining = b.totalDays - b.usedDays;
            return (
              <div
                key={b.id}
                className={`rounded-xl border p-4 ${leaveTypeColor[b.type] ?? "bg-neutral-50 border-neutral-200 text-neutral-700"}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <CalendarDays className="h-4 w-4 opacity-70" />
                  <p className="text-xs font-medium capitalize">{b.type === "PERSONAL" ? "Comp" : b.type.toLowerCase()}</p>
                </div>
                <p className="text-3xl font-bold">{remaining}</p>
                <p className="text-xs opacity-70 mt-0.5">of {b.totalDays} days remaining</p>
                {b.usedDays > 0 && (
                  <p className="text-xs opacity-60 mt-1">{b.usedDays} used</p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-6 py-5">
          <p className="text-sm text-neutral-500">No PTO balances set up yet. Contact your administrator.</p>
        </div>
      )}

      {/* PTO Requests */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>PTO Requests</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {requests.length === 0 ? (
            <p className="text-sm text-neutral-500 text-center py-8">No PTO requests yet.</p>
          ) : (
            <div className="divide-y divide-neutral-100">
              {requests.map((lr) => {
                const numDays = lr.days.reduce((sum, d) => sum + (d.halfDay ? 0.5 : 1.0), 0);
                return (
                  <div key={lr.id} className="flex items-center justify-between px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-neutral-800">
                        {leaveTypeLabel[lr.type] ?? lr.type}
                        {" · "}
                        {numDays} day{numDays !== 1 ? "s" : ""}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {formatDate(lr.startDate)} – {formatDate(lr.endDate)}
                      </p>
                      {lr.reviewComment && (
                        <p className="text-xs text-amber-700 mt-0.5">Comment: {lr.reviewComment}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={statusVariant[lr.status] ?? "secondary"}>{lr.status}</Badge>
                      {lr.status === "PENDING" && <DeletePTOButton requestId={lr.id} />}
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
