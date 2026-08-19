import { LeaveType } from "@prisma/client";

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

/** Hours for a timesheet entry: 4 for half-day, 8 for full day. */
export function hoursForDay(halfDay: boolean): number {
  return halfDay ? 4 : 8;
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
