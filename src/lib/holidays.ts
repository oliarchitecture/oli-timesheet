/**
 * US Federal Holidays utility.
 * All dates are normalized to UTC midnight (matching the app's date convention).
 */

export interface FederalHoliday {
  date: Date;
  name: string;
}

/** Returns the Nth occurrence of a weekday in a given month/year (1-based, UTC). */
function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
  // month is 0-based (0=Jan)
  const d = new Date(Date.UTC(year, month, 1));
  let count = 0;
  while (d.getUTCMonth() === month) {
    if (d.getUTCDay() === weekday) {
      count++;
      if (count === n) return new Date(d);
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  throw new Error(`No ${n}th weekday ${weekday} in ${month}/${year}`);
}

/** Returns the last occurrence of a weekday in a given month/year (UTC). */
function lastWeekdayOfMonth(year: number, month: number, weekday: number): Date {
  // Start from the last day of the month
  const d = new Date(Date.UTC(year, month + 1, 0));
  while (d.getUTCDay() !== weekday) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return d;
}

/**
 * Apply US federal holiday observance rules:
 * - Saturday → previous Friday
 * - Sunday → following Monday
 */
function observed(date: Date): Date {
  const day = date.getUTCDay();
  if (day === 6) {
    const d = new Date(date);
    d.setUTCDate(d.getUTCDate() - 1);
    return d;
  }
  if (day === 0) {
    const d = new Date(date);
    d.setUTCDate(d.getUTCDate() + 1);
    return d;
  }
  return date;
}

/** Returns the list of US federal holidays for a given year, UTC midnight. */
export function getFederalHolidays(year: number): FederalHoliday[] {
  const thanksgiving = nthWeekdayOfMonth(year, 10, 4, 4); // 4th Thursday of November
  const dayAfterThanksgiving = new Date(thanksgiving);
  dayAfterThanksgiving.setUTCDate(dayAfterThanksgiving.getUTCDate() + 1);

  return [
    { name: "New Year's Day",           date: observed(new Date(Date.UTC(year, 0, 1))) },
    { name: "MLK Day",                   date: nthWeekdayOfMonth(year, 0, 1, 3) },       // 3rd Mon Jan
    { name: "Presidents' Day",           date: nthWeekdayOfMonth(year, 1, 1, 3) },       // 3rd Mon Feb
    { name: "Memorial Day",              date: lastWeekdayOfMonth(year, 4, 1) },          // last Mon May
    { name: "Juneteenth",                date: observed(new Date(Date.UTC(year, 5, 19))) },
    { name: "Independence Day",          date: observed(new Date(Date.UTC(year, 6, 4))) },
    { name: "Labor Day",                 date: nthWeekdayOfMonth(year, 8, 1, 1) },       // 1st Mon Sep
    { name: "Columbus Day",              date: nthWeekdayOfMonth(year, 9, 1, 2) },       // 2nd Mon Oct
    { name: "Thanksgiving",              date: thanksgiving },
    { name: "Day After Thanksgiving",    date: dayAfterThanksgiving },
    { name: "Christmas Day",             date: observed(new Date(Date.UTC(year, 11, 25))) },
  ];
}

/** Returns true if the given UTC date falls on a federal holiday. */
export function isFederalHoliday(date: Date): boolean {
  return getFederalHolidays(date.getUTCFullYear()).some((h) => isSameUTCDay(h.date, date));
}

export function isSameUTCDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}
