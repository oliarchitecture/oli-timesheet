import { LeaveType, HalfDayPeriod } from "@prisma/client";
import { formatDate } from "@/lib/utils";

/**
 * The stored half of the day for a leave day: only a half day can carry one, and anything
 * unrecognised becomes null — the same "half day, side unknown" state older requests have.
 */
export function halfDayPeriodFor(halfDay: boolean, period: unknown): HalfDayPeriod | null {
  if (!halfDay) return null;
  return period === "MORNING" || period === "AFTERNOON" ? period : null;
}

const DAY_KIND_LABEL: Record<LeaveType, string> = {
  VACATION: "Vacation", SICK: "Sick", COMP_DAY: "Comp", PERSONAL: "Personal", OTHER: "Other", MIXED: "PTO",
};

/**
 * The note shown on an approved request for a day the employee reported working, e.g.
 * "Sep 14, 2026 was reported by the employee as a work day instead of a Vacation (V) day as
 * approved. Reported on Oct 15, 2026."
 */
export function workedDayNote(
  date: Date,
  approvedDay: { type: LeaveType; halfDay: boolean } | undefined,
  reportedAt: Date
): string {
  const kind = approvedDay
    ? approvedDay.halfDay
      ? `a half day off (${absenceCodeForDay(approvedDay.type, true)})`
      : `a ${DAY_KIND_LABEL[approvedDay.type]} (${absenceCodeForDay(approvedDay.type, false)}) day`
    : "a PTO day";
  return `${formatDate(date)} was reported by the employee as a work day instead of ${kind} as approved. Reported on ${formatDate(reportedAt)}.`;
}

/** "Full Day", "Half Day (AM)", "Half Day (PM)", or plain "Half Day" for older requests. */
export function dayPortionLabel(halfDay: boolean, period: HalfDayPeriod | null): string {
  if (!halfDay) return "Full Day";
  if (period === "MORNING") return "Half Day (AM)";
  if (period === "AFTERNOON") return "Half Day (PM)";
  return "Half Day";
}

const LEAVE_TYPE_TO_ABSENCE_CODE: Record<LeaveType, string> = {
  VACATION: "V",
  SICK: "S",
  COMP_DAY: "C",
  PERSONAL: "V", // no dedicated code; treat as Vacation
  OTHER: "V",    // fallback
  MIXED: "V",    // request-level summary value only; never set on an individual day
};

/** Returns "H/D" for half-day entries, otherwise the leave-type absence code. */
export function absenceCodeForDay(type: LeaveType, halfDay: boolean): string {
  return halfDay ? "H/D" : LEAVE_TYPE_TO_ABSENCE_CODE[type];
}

/**
 * Hours recorded on a timesheet for a day of approved leave: always 0.
 *
 * The absence code (V, S, H/D…) is what marks the day as time off; the hours column counts
 * worked hours only. Picking an absence code by hand in the grid has always set 0 hours, so
 * pre-filled PTO has to match — otherwise approved leave silently added 8h to 001_Office
 * Admin while the same day entered manually added none. The cell stays editable either way,
 * so an employee can still type hours against a partially worked day.
 */
export function hoursForDay(_halfDay: boolean): number {
  return 0;
}

export interface PtoEntitlement {
  /** Whether Vacation and Sick have merged into one pool (true from the 1-year anniversary on) */
  combined: boolean;
  vacationTotal: number;
  sickTotal: number;
  combinedTotal: number;
  /** The employee's next hire-date anniversary — when the balance renews */
  nextRenewalDate: Date;
  /** Total allotment (Vacation + Sick) that will be in effect after the next renewal */
  nextRenewalTotal: number;
  /** Vacation-only allotment after the next renewal (only meaningful before combining) */
  nextVacationTotal: number;
  /** Sick-only allotment after the next renewal — always 5, sick never grows */
  nextSickTotal: number;
}

function fullYearsSince(startDate: Date, asOf: Date): number {
  let years = asOf.getUTCFullYear() - startDate.getUTCFullYear();
  const anniversaryThisYear = new Date(Date.UTC(asOf.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
  if (asOf < anniversaryThisYear) years--;
  return Math.max(0, years);
}

function nextAnniversary(startDate: Date, asOf: Date): Date {
  const thisYearAnniversary = new Date(Date.UTC(asOf.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
  if (thisYearAnniversary > asOf) return thisYearAnniversary;
  return new Date(Date.UTC(asOf.getUTCFullYear() + 1, startDate.getUTCMonth(), startDate.getUTCDate()));
}

/**
 * OLI PTO policy: 10 Vacation + 5 Sick days starting at hire date, tracked separately
 * for the first year. From the 1-year anniversary on, Vacation and Sick combine into
 * one pool, gaining +1 vacation day per year of service up to a 15-day vacation cap
 * (so the combined pool grows from 15 to a max of 20 days).
 */
export function computePtoEntitlement(startDate: Date, asOf: Date = new Date()): PtoEntitlement {
  const yearsOfService = fullYearsSince(startDate, asOf);
  const combined = yearsOfService >= 1;
  const vacationTotal = combined ? Math.min(10 + yearsOfService, 15) : 10;
  const sickTotal = 5;

  const nextRenewalDate = nextAnniversary(startDate, asOf);
  const nextYearsOfService = yearsOfService + 1;
  const nextVacationTotal = Math.min(10 + nextYearsOfService, 15);

  return {
    combined,
    vacationTotal,
    sickTotal,
    combinedTotal: vacationTotal + sickTotal,
    nextRenewalDate,
    nextRenewalTotal: nextVacationTotal + sickTotal,
    nextVacationTotal,
    nextSickTotal: sickTotal,
  };
}
