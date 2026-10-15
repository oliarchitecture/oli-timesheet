import { db } from "@/lib/db";
import { computePtoEntitlement, type PtoEntitlement } from "@/lib/leave-utils";

/** One leave type's numbers for the current work year, with where each came from. */
export interface PtoLine {
  total: number;
  used: number;
  /** What the policy formula / approved requests give, before any admin override. */
  autoTotal: number;
  autoUsed: number;
  totalOverridden: boolean;
  usedOverridden: boolean;
}

export interface PtoMismatch {
  date: Date;
  message: string;
}

export interface PtoSummary {
  entitlement: PtoEntitlement;
  /** First day of the current work year and the first day of the next one (exclusive end). */
  cycleStart: Date;
  cycleEnd: Date;
  vacation: PtoLine;
  sick: PtoLine;
  /** Days where the timesheet disagrees with approved PTO, up to today. */
  mismatches: PtoMismatch[];
}

function addYearsUTC(date: Date, years: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear() + years, date.getUTCMonth(), date.getUTCDate()));
}

const TYPE_LABEL: Record<string, string> = {
  VACATION: "Vacation", SICK: "Sick", COMP_DAY: "Comp Day", PERSONAL: "Personal", OTHER: "Other",
};

/** The timesheet absence code an approved PTO day should show up as. */
function expectedCode(type: string, halfDay: boolean): string {
  if (halfDay) return "H/D";
  if (type === "SICK") return "S";
  if (type === "COMP_DAY") return "C";
  return "V"; // Vacation, Personal and Other all pre-fill as V
}

// Codes that mean "time off taken from a PTO balance". H (holiday), B (business trip) and
// R (bereavement) are not, so they never need a matching request.
const PTO_CODES = new Set(["V", "S", "C", "H/D"]);

function dayLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

/**
 * Vacation and Sick balances for an employee's current work year — the year runs from their
 * start-date anniversary to the next one, so balances renew on that day with no admin action.
 * Used days come from approved PTO requests in the work year; totals come from the OLI policy
 * formula. Either can be overridden by an admin for that work year, and the override wins.
 * Returns null for anyone without a start date (no work year to measure).
 */
export async function getPtoSummary(
  employeeId: string,
  startDate: Date | null,
  asOf: Date = new Date()
): Promise<PtoSummary | null> {
  if (!startDate) return null;

  const entitlement = computePtoEntitlement(startDate, asOf);
  const cycleEnd = entitlement.nextRenewalDate;
  const cycleStart = addYearsUTC(cycleEnd, -1);
  const today = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()));
  // Timesheet comparison runs through today (exclusive end is tomorrow), never past the work year.
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const checkUntil = tomorrow < cycleEnd ? tomorrow : cycleEnd;

  const [approvedDays, overrides, timesheetEntries] = await Promise.all([
    db.leaveRequestDay.findMany({
      where: {
        date: { gte: cycleStart, lt: cycleEnd },
        leaveRequest: { employeeId, status: "APPROVED" },
      },
      select: { date: true, type: true, halfDay: true },
    }),
    db.ptoOverride.findMany({ where: { employeeId, cycleStart } }),
    db.timesheetEntry.findMany({
      where: {
        timesheetWeek: { employeeId },
        date: { gte: cycleStart, lt: checkUntil },
        absenceCode: { not: null },
      },
      select: { date: true, absenceCode: true },
    }),
  ]);

  const usedOf = (type: string) =>
    approvedDays.filter((d) => d.type === type).reduce((sum, d) => sum + (d.halfDay ? 0.5 : 1), 0);

  function line(type: "VACATION" | "SICK", autoTotal: number): PtoLine {
    const o = overrides.find((x) => x.type === type);
    const autoUsed = usedOf(type);
    return {
      total: o?.totalDays ?? autoTotal,
      used: o?.usedDays ?? autoUsed,
      autoTotal,
      autoUsed,
      totalOverridden: o?.totalDays != null,
      usedOverridden: o?.usedDays != null,
    };
  }

  // Compare approved PTO with what the timesheet says, day by day, up to today.
  const codesByDay = new Map<string, string[]>();
  for (const e of timesheetEntries) {
    const key = e.date.toISOString().slice(0, 10);
    codesByDay.set(key, [...(codesByDay.get(key) ?? []), e.absenceCode!]);
  }
  const mismatches: PtoMismatch[] = [];
  const approvedKeys = new Set<string>();
  for (const d of approvedDays) {
    if (d.date >= checkUntil) continue;
    const key = d.date.toISOString().slice(0, 10);
    approvedKeys.add(key);
    const want = expectedCode(d.type, d.halfDay);
    const codes = codesByDay.get(key) ?? [];
    if (codes.includes(want)) continue;
    const label = `${TYPE_LABEL[d.type] ?? d.type}${d.halfDay ? " (half day)" : ""}`;
    const found = codes.find((c) => PTO_CODES.has(c));
    mismatches.push({
      date: d.date,
      message: found
        ? `${dayLabel(d.date)}: approved as ${label}, but your timesheet shows ${found}.`
        : `${dayLabel(d.date)}: approved as ${label}, but your timesheet shows you worked.`,
    });
  }
  for (const [key, codes] of codesByDay) {
    if (approvedKeys.has(key)) continue;
    const code = codes.find((c) => PTO_CODES.has(c));
    if (!code) continue;
    const date = new Date(`${key}T00:00:00.000Z`);
    mismatches.push({
      date,
      message: `${dayLabel(date)}: your timesheet shows ${code}, but there is no approved PTO request for that day.`,
    });
  }
  mismatches.sort((a, b) => a.date.getTime() - b.date.getTime());

  return {
    entitlement,
    cycleStart,
    cycleEnd,
    vacation: line("VACATION", entitlement.vacationTotal),
    sick: line("SICK", entitlement.sickTotal),
    mismatches,
  };
}
