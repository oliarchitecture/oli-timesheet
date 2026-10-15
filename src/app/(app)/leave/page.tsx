import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, CalendarDays, Printer, AlertTriangle } from "lucide-react";
import { formatDate, formatDateSlash } from "@/lib/utils";
import { getPtoSummary } from "@/lib/pto-balance.server";
import { workedDayNote } from "@/lib/leave-utils";
import { getFederalHolidays } from "@/lib/holidays";
import { DeletePTOButton } from "@/components/leave/DeletePTOButton";
import { WorkedDayButton } from "@/components/leave/WorkedDayButton";

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
      include: { days: { orderBy: { date: "asc" } }, workedDays: { orderBy: { date: "asc" } } },
      orderBy: { createdAt: "desc" },
    }),
    db.leaveBalance.findMany({
      where: { employeeId: session.user.id, year: new Date().getFullYear() },
    }),
    db.employee.findUnique({ where: { id: session.user.id }, select: { startDate: true } }),
  ]);

  // Vacation, Sick and Comp Day run on the employee's work year (start-date anniversary to anniversary).
  const pto = await getPtoSummary(session.user.id, employee?.startDate ?? null);
  const entitlement = pto?.entitlement ?? null;
  const vacationTotal = pto?.vacation.total ?? 0;
  const vacationUsed = pto?.vacation.used ?? 0;
  const sickTotal = pto?.sick.total ?? 0;
  const sickUsed = pto?.sick.used ?? 0;
  const combinedTotal = vacationTotal + sickTotal;
  const holidayCount = getFederalHolidays(new Date().getFullYear()).length;
  // Without a start date there is no work year, so Comp Day falls back to the yearly row.
  const yearlyComp = balances.find((b) => b.type === "COMP_DAY");
  const compTotal = pto ? pto.comp.total : yearlyComp?.totalDays ?? 0;
  const compUsed = pto ? pto.comp.used : yearlyComp?.usedDays ?? 0;
  const workYear = pto
    ? `${formatDate(pto.cycleStart)} – ${formatDate(new Date(pto.cycleEnd.getTime() - 86400000))}`
    : null;

  // Stretch tiles to fill the row (matching the PTO Requests card width below)
  // regardless of whether there are 3 or 4 of them.
  const tileCount = 2 + (entitlement ? (entitlement.combined ? 1 : 2) : 0);
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
          {workYear && <p className="text-sm font-semibold text-neutral-700 mt-2">Work year {workYear}</p>}
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
                  {combinedTotal - (vacationUsed + sickUsed)}
                </p>
                <p className="text-xs opacity-70">remaining days out of {combinedTotal} days</p>
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
                  <p className="text-3xl font-bold">{vacationTotal - vacationUsed}</p>
                  <p className="text-xs opacity-70">remaining days out of {vacationTotal} days</p>
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
                  <p className="text-3xl font-bold">{sickTotal - sickUsed}</p>
                  <p className="text-xs opacity-70">remaining days out of {sickTotal} days</p>
                </div>
                <p className="text-xs opacity-70 mt-0.5">
                  {entitlement.nextSickTotal} days to be renewed on {formatDateSlash(entitlement.nextRenewalDate)}
                </p>
                {sickUsed > 0 && <p className="text-xs opacity-60 mt-1">{sickUsed} used</p>}
              </div>
            </>
          )
        )}

        <div className="rounded-xl border bg-rose-50 border-rose-200 text-rose-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CalendarDays className="h-4 w-4 opacity-70" />
            <p className="text-xs font-medium">Comp Day</p>
          </div>
          <div className="flex items-baseline gap-2 flex-wrap">
            <p className="text-3xl font-bold">{compTotal - compUsed}</p>
            <p className="text-xs opacity-70">remaining days out of {compTotal} days</p>
          </div>
          {compUsed > 0 && <p className="text-xs opacity-60 mt-1">{compUsed} used</p>}
        </div>
      </div>

      {pto && pto.mismatches.length > 0 && (
        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium">Your timesheet doesn&apos;t match your approved PTO</p>
            <ul className="space-y-0.5">
              {pto.mismatches.map((m) => (
                <li key={m.date.toISOString()} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>{m.message}</span>
                  {m.kind === "worked" && m.dayId && <WorkedDayButton dayId={m.dayId} />}
                </li>
              ))}
            </ul>
            <p className="text-xs text-amber-700">
              Your balance counts approved PTO requests. If you worked an approved day, click &ldquo;I worked this day&rdquo;: a note
              is added, the day will not count, and your admin will receive an email notification. Otherwise, check your
              timesheet for that day.
            </p>
          </div>
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
                      {lr.workedDays.map((w) => (
                        <p key={w.id} className="text-xs text-amber-700 mt-0.5">
                          <span className="font-bold">NOTE:</span>{" "}
                          {workedDayNote(w.date, lr.days.find((d) => d.date.getTime() === w.date.getTime()), w.createdAt)}
                        </p>
                      ))}
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
