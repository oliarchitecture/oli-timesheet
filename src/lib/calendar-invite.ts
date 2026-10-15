import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { getFederalHolidays, isSameUTCDay } from "@/lib/holidays";
import type { HalfDayPeriod, LeaveRequest, LeaveRequestDay } from "@prisma/client";

const CC_EMAIL = process.env.CALENDAR_INVITE_CC_EMAIL ?? "contacts@oliarch.com";
const ORGANIZER_EMAIL = process.env.EMAIL_FROM?.match(/<(.+)>/)?.[1] ?? "no-reply@oliarch.com";
const ORGANIZER_NAME = "OLI Architecture Office";

/** "Alex Klein" -> "AK", "Cher" -> "CH" */
function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function toIcsDate(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function foldLine(line: string): string {
  // RFC 5545 requires lines to be folded at 75 octets
  if (line.length <= 75) return line;
  let result = line.slice(0, 75);
  let rest = line.slice(75);
  while (rest.length > 0) {
    result += "\r\n " + rest.slice(0, 74);
    rest = rest.slice(74);
  }
  return result;
}

/** Office hours for each half of the day, in office (New York) time. Full day is 9:30–18:30 with a 1h lunch. */
const HALF_DAY_HOURS: Record<HalfDayPeriod, { start: string; end: string; label: string }> = {
  MORNING: { start: "093000", end: "133000", label: "AM" },
  AFTERNOON: { start: "143000", end: "183000", label: "PM" },
};

const OFFICE_TZID = "America/New_York";

// US Eastern rules (DST from the 2nd Sunday of March to the 1st Sunday of November).
const OFFICE_VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  `TZID:${OFFICE_TZID}`,
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:-0500",
  "TZOFFSETTO:-0400",
  "TZNAME:EDT",
  "DTSTART:19700308T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:-0400",
  "TZOFFSETTO:-0500",
  "TZNAME:EST",
  "DTSTART:19701101T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

type EventTime =
  | { allDay: { start: Date; endExclusive: Date } }
  | { timed: { date: Date; start: string; end: string } };

function buildIcs({
  uid,
  summary,
  time,
  attendeeEmails,
}: {
  uid: string;
  summary: string;
  time: EventTime;
  attendeeEmails: string[];
}): string {
  const dtstamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const timeLines =
    "allDay" in time
      ? [
          `DTSTART;VALUE=DATE:${toIcsDate(time.allDay.start)}`,
          `DTEND;VALUE=DATE:${toIcsDate(time.allDay.endExclusive)}`,
        ]
      : [
          `DTSTART;TZID=${OFFICE_TZID}:${toIcsDate(time.timed.date)}T${time.timed.start}`,
          `DTEND;TZID=${OFFICE_TZID}:${toIcsDate(time.timed.date)}T${time.timed.end}`,
        ];
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//OLI Architecture//Employee Portal//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    ...("timed" in time ? OFFICE_VTIMEZONE : []),
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    ...timeLines,
    foldLine(`SUMMARY:${summary}`),
    foldLine(`ORGANIZER;CN=${ORGANIZER_NAME}:mailto:${ORGANIZER_EMAIL}`),
    ...attendeeEmails.map((email) =>
      foldLine(`ATTENDEE;RSVP=TRUE;PARTSTAT=NEEDS-ACTION:mailto:${email}`)
    ),
    "STATUS:CONFIRMED",
    "TRANSP:TRANSPARENT",
    "SEQUENCE:0",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n");
}

/** The workday after `date`, skipping weekends and federal holidays (the days the PTO form leaves out). */
function nextWorkday(date: Date): Date {
  let d = addDays(date, 1);
  for (;;) {
    const dow = d.getUTCDay();
    const isHoliday = getFederalHolidays(d.getUTCFullYear()).some((h) => isSameUTCDay(h.date, d));
    if (dow !== 0 && dow !== 6 && !isHoliday) return d;
    d = addDays(d, 1);
  }
}

/**
 * Splits a request's days into calendar events. A single all-day event can't say which half of a
 * day someone is out, so: each run of back-to-back full days is one all-day event, each half day
 * with a chosen morning/afternoon is a timed event, and a half day without one (older requests)
 * stays an all-day "(Half Day)" event as before.
 */
function buildInviteBlocks(
  days: LeaveRequestDay[],
  initials: string
): { summary: string; time: EventTime }[] {
  const sorted = [...days].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const blocks: { summary: string; time: EventTime }[] = [];
  let run: { start: Date; end: Date } | null = null;

  const flushRun = () => {
    if (!run) return;
    blocks.push({
      summary: `${initials} Out`,
      // ICS all-day DTEND is exclusive, so bump the last day by one.
      time: { allDay: { start: run.start, endExclusive: addDays(run.end, 1) } },
    });
    run = null;
  };

  for (const day of sorted) {
    const date = new Date(day.date);
    if (!day.halfDay) {
      if (run && isSameUTCDay(nextWorkday(run.end), date)) {
        run.end = date;
      } else {
        flushRun();
        run = { start: date, end: date };
      }
      continue;
    }
    flushRun();
    if (day.halfDayPeriod) {
      const hours = HALF_DAY_HOURS[day.halfDayPeriod];
      blocks.push({
        summary: `${initials} Out (${hours.label})`,
        time: { timed: { date, start: hours.start, end: hours.end } },
      });
    } else {
      blocks.push({
        summary: `${initials} Out (Half Day)`,
        time: { allDay: { start: date, endExclusive: addDays(date, 1) } },
      });
    }
  }
  flushRun();
  return blocks;
}

export async function sendPtoCalendarInvite(
  leaveRequest: LeaveRequest & { days: LeaveRequestDay[] },
  employee: { name: string; email: string }
) {
  try {
    const blocks = buildInviteBlocks(leaveRequest.days, initialsFor(employee.name));
    const sentUids: string[] = [];

    // One email per event: calendar clients only reliably import the first event of a
    // METHOD:REQUEST file, so a request with mixed full and half days sends several invites.
    for (const [i, block] of blocks.entries()) {
      const uid = blocks.length === 1
        ? `leave-${leaveRequest.id}@oliarch.com`
        : `leave-${leaveRequest.id}-${i + 1}@oliarch.com`;

      const ics = buildIcs({
        uid,
        summary: block.summary,
        time: block.time,
        attendeeEmails: [employee.email, CC_EMAIL],
      });

      const sent = await sendEmail(
        employee.email,
        block.summary,
        `<p>Your approved PTO has been added as a calendar invite — accept it to add it to your calendar.</p>`,
        [
          {
            filename: "invite.ics",
            content: Buffer.from(ics, "utf-8").toString("base64"),
            contentType: "text/calendar; method=REQUEST",
          },
        ],
        CC_EMAIL
      );
      if (sent) sentUids.push(uid);
    }
    if (sentUids.length === 0) return;

    await db.leaveRequest.update({
      where: { id: leaveRequest.id },
      data: { calendarInviteUid: sentUids.join(",") },
    });
  } catch (err) {
    console.error("[calendar-invite] Failed to send:", err);
  }
}
