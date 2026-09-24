import { db } from "@/lib/db";
import { weekStartsForRange } from "@/lib/period-weeks";

const weekInclude = {
  entries: { orderBy: { date: "asc" } },
  reportPeriod: {
    select: { id: true, status: true, startDate: true, endDate: true },
  },
} as const;

export type PeriodWeek = Awaited<ReturnType<typeof loadPeriodWeeks>>[number];

/**
 * Every week that belongs in `period` — the ones it owns plus any boundary week it shares
 * with a neighbouring period.
 *
 * A week row can only carry one `reportPeriodId`, so the period that was created second
 * never gets the shared week attached to it. Selecting by week start as well as ownership
 * is what lets both timesheets show it; `lockedDaysForWeek` then decides which days each
 * of them may edit.
 */
export async function loadPeriodWeeks(
  employeeId: string,
  period: { id: string; startDate: Date; endDate: Date }
) {
  const weekStarts = weekStartsForRange(period.startDate, period.endDate);

  return db.timesheetWeek.findMany({
    where: {
      employeeId,
      OR: [
        // Always include what this period owns, even a legacy Monday-start week that the
        // Sunday scan below would miss.
        { reportPeriodId: period.id },
        { weekStartDate: { in: weekStarts } },
      ],
    },
    include: weekInclude,
    orderBy: { weekStartDate: "asc" },
  });
}

/** Serialises a loaded week into the shape `PeriodView` expects. */
export function toWeekData(week: PeriodWeek) {
  return {
    id: week.id,
    weekStartDate: week.weekStartDate.toISOString(),
    status: week.status,
    updatedAt: week.updatedAt.toISOString(),
    entries: week.entries.map((e) => ({
      projectId: e.projectId,
      phase: e.phase,
      date: e.date.toISOString(),
      hours: e.hours,
      absenceCode: e.absenceCode,
      notes: e.notes,
    })),
    owner: week.reportPeriod
      ? {
          id: week.reportPeriod.id,
          status: week.reportPeriod.status,
          startDate: week.reportPeriod.startDate.toISOString(),
          endDate: week.reportPeriod.endDate.toISOString(),
        }
      : null,
  };
}
