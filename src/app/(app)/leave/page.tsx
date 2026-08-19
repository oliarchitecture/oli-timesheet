import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, CalendarDays, Printer } from "lucide-react";
import { formatDate, formatDateSlash } from "@/lib/utils";
import { computePtoEntitlement } from "@/lib/leave-utils";
import { getFederalHolidays } from "@/lib/holidays";
import { DeletePTOButton } from "@/components/leave/DeletePTOButton";

const statusVariant: Record<string, "success" | "warning" | "secondary" | "destructive"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "destructive",
  REVISION_REQUESTED: "warning",
};

const statusLabel: Record<string, string> = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  REVISION_REQUESTED: "Revision Requested",
};

const leaveTypeLabel: Record<string, string> = {
  VACATION: "Vacation",
  SICK: "Sick",
  PERSONAL: "Personal / Non-Paid Time",
  COMP_DAY: "Comp Day",
  OTHER: "Other",
  MIXED: "Mixed",
};

export default async function PTOPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [requests, balances, employee] = await Promise.all([
    db.leaveRequest.findMany({
      where: { employeeId: session.user.id },
      include: { days: { orderBy: { date: "asc" } } },
      orderBy: { createdAt: "desc" },
    }),
    db.leaveBalance.findMany({
      where: { employeeId: session.user.id, year: new Date().getFullYear() },
    }),
    db.employee.findUnique({ where: { id: session.user.id }, select: { startDate: true } }),
  ]);

  const entitlement = employee?.startDate ? computePtoEntitlement(employee.startDate) : null;
  const vacationUsed = balances.find((b) => b.type === "VACATION")?.usedDays ?? 0;
  const sickUsed = balances.find((b) => b.type === "SICK")?.usedDays ?? 0;
  const holidayCount = getFederalHolidays(new Date().getFullYear()).length;
  const compDayBalance = balances.find((b) => b.type === "COMP_DAY");

  // Stretch tiles to fill the row (matching the PTO Requests card width below)
  // regardless of whether there are 2, 3, or 4 of them.
  const tileCount = 1 + (entitlement ? (entitlement.combined ? 1 : 2) : 0) + (compDayBalance ? 1 : 0);
  const balanceGridClass =
    tileCount >= 4 ? "grid grid-cols-2 sm:grid-cols-4 gap-3" :
    tileCount === 3 ? "grid grid-cols-2 sm:grid-cols-3 gap-3" :
    tileCount === 2 ? "grid grid-cols-2 gap-3" :
    "grid grid-cols-1 gap-3";

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
      <div className={balanceGridClass}>
        <div className="rounded-xl border bg-orange-50 border-orange-200 text-orange-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CalendarDays className="h-4 w-4 opacity-70" />
            <p className="text-xs font-medium">Holiday</p>
          </div>
          <p className="text-3xl font-bold">{holidayCount}</p>
          <p className="text-xs opacity-70 mt-0.5">paid holidays per OLI guidelines</p>
        </div>

        {entitlement && (
          entitlement.combined ? (
            <div className="rounded-xl border bg-sky-50 border-sky-200 text-sky-700 p-4">
              <div className="flex items-center gap-2 mb-2">
                <CalendarDays className="h-4 w-4 opacity-70" />
                <p className="text-xs font-medium">Vacation + Sick</p>
              </div>
              <div className="flex items-baseline gap-2 flex-wrap">
                <p className="text-3xl font-bold">
                  {entitlement.combinedTotal - (vacationUsed + sickUsed)}
                </p>
                <p className="text-xs opacity-70">remaining days out of {entitlement.combinedTotal} days</p>
              </div>
              <p className="text-xs opacity-70 mt-0.5">
                {entitlement.nextRenewalTotal} days to be renewed on {formatDateSlash(entitlement.nextRenewalDate)}
              </p>
              <p className="text-xs opacity-60 mt-1">
                {vacationUsed} vacation used · {sickUsed} sick used
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-xl border bg-sky-50 border-sky-200 text-sky-700 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CalendarDays className="h-4 w-4 opacity-70" />
                  <p className="text-xs font-medium">Vacation</p>
                </div>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <p className="text-3xl font-bold">{entitlement.vacationTotal - vacationUsed}</p>
                  <p className="text-xs opacity-70">remaining days out of {entitlement.vacationTotal} days</p>
                </div>
                <p className="text-xs opacity-70 mt-0.5">
                  {entitlement.nextVacationTotal} days to be renewed on {formatDateSlash(entitlement.nextRenewalDate)}
                </p>
                {vacationUsed > 0 && <p className="text-xs opacity-60 mt-1">{vacationUsed} used</p>}
              </div>
              <div className="rounded-xl border bg-blue-50 border-blue-200 text-blue-700 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CalendarDays className="h-4 w-4 opacity-70" />
                  <p className="text-xs font-medium">Sick</p>
                </div>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <p className="text-3xl font-bold">{entitlement.sickTotal - sickUsed}</p>
                  <p className="text-xs opacity-70">remaining days out of {entitlement.sickTotal} days</p>
                </div>
                <p className="text-xs opacity-70 mt-0.5">
                  {entitlement.nextSickTotal} days to be renewed on {formatDateSlash(entitlement.nextRenewalDate)}
                </p>
                {sickUsed > 0 && <p className="text-xs opacity-60 mt-1">{sickUsed} used</p>}
              </div>
            </>
          )
        )}

        {compDayBalance && (
          <div className="rounded-xl border bg-rose-50 border-rose-200 text-rose-700 p-4">
            <div className="flex items-center gap-2 mb-2">
              <CalendarDays className="h-4 w-4 opacity-70" />
              <p className="text-xs font-medium">Comp Day</p>
            </div>
            <div className="flex items-baseline gap-2 flex-wrap">
              <p className="text-3xl font-bold">{compDayBalance.totalDays - compDayBalance.usedDays}</p>
              <p className="text-xs opacity-70">remaining days out of {compDayBalance.totalDays} days</p>
            </div>
            {compDayBalance.usedDays > 0 && (
              <p className="text-xs opacity-60 mt-1">{compDayBalance.usedDays} used</p>
            )}
          </div>
        )}
      </div>

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
                      <Badge variant={statusVariant[lr.status] ?? "secondary"}>{statusLabel[lr.status] ?? lr.status}</Badge>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/print/leave/${lr.id}`} target="_blank">
                          <Printer className="h-3.5 w-3.5" />
                          Print
                        </Link>
                      </Button>
                      {lr.status === "PENDING" && <DeletePTOButton requestId={lr.id} />}
                      {lr.status === "REVISION_REQUESTED" && (
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/leave/${lr.id}/edit`}>Edit &amp; Resubmit</Link>
                        </Button>
                      )}
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
