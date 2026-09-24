import { getWeekDays, getWeekStart } from "@/lib/utils";
import { type TimesheetStatus } from "@/lib/timesheet-status";

/**
 * Pure helpers describing how reporting periods and Sun–Sat weeks line up.
 *
 * Weeks are never split: a week row owns its seven days and is attached to exactly one
 * period (`TimesheetWeek.reportPeriodId`, unique per employee + week start). Periods,
 * however, are arbitrary ranges that usually follow calendar months, so a boundary week
 * straddles two of them. The period that did not claim the week *borrows* it, and the
 * days inside are locked or opened individually — see `lockedDaysForWeek`.
 *
 * No database imports here: this module is used by client components as well.
 */

/** A period as far as week/day arithmetic is concerned. */
export interface PeriodRange {
  id: string;
  status: TimesheetStatus;
  startDate: Date;
  endDate: Date;
}

/** Normalises a date or ISO string to a `YYYY-MM-DD` key for day-level lookups. */
export function toDayKey(date: Date | string): string {
  return new Date(date).toISOString().slice(0, 10);
}

/** Every Sunday whose week overlaps `[start, end]`, in ascending order. */
export function weekStartsForRange(start: Date | string, end: Date | string): Date[] {
  const last = getWeekStart(new Date(end));
  const cur = getWeekStart(new Date(start));
  const starts: Date[] = [];
  while (cur <= last) {
    starts.push(new Date(cur));
    cur.setUTCDate(cur.getUTCDate() + 7);
  }
  return starts;
}

/** How many weeks a period spans, counting boundary weeks it shares with a neighbour. */
export function weekCountForRange(start: Date | string, end: Date | string): number {
  return weekStartsForRange(start, end).length;
}

/**
 * The period covering `day`, if any.
 *
 * Newer periods cannot overlap, but older data predates that guard and does contain
 * duplicates of the same range, so pass `periods` with the timesheet being viewed first:
 * a period always wins its own days, and a stray duplicate can never lock them.
 */
export function ownerPeriodForDay(day: Date, periods: PeriodRange[]): PeriodRange | null {
  const t = day.getTime();
  return (
    periods.find((p) => t >= p.startDate.getTime() && t <= p.endDate.getTime()) ?? null
  );
}

/**
 * Days of `weekStart` that must stay read-only while this week is shown inside `viewing`.
 *
 * The rule is simply the dates the employee picked for the period: every day inside
 * `[viewing.startDate, viewing.endDate]` is theirs to fill in, everything else in the week
 * belongs to a neighbouring timesheet and is shown read-only. `neighbours` is only used to
 * name that other timesheet in the UI.
 *
 * Passing no `viewing` period (a standalone week, outside any period) locks nothing.
 */
export function lockedDaysForWeek({
  weekStart,
  viewing,
  neighbours = [],
}: {
  weekStart: Date;
  viewing: PeriodRange | null;
  neighbours?: PeriodRange[];
}): Map<string, PeriodRange | null> {
  const locked = new Map<string, PeriodRange | null>();
  if (!viewing) return locked;

  for (const day of getWeekDays(weekStart)) {
    const t = day.getTime();
    const inPeriod = t >= viewing.startDate.getTime() && t <= viewing.endDate.getTime();
    if (inPeriod) continue;
    locked.set(toDayKey(day), ownerPeriodForDay(day, neighbours));
  }

  return locked;
}
