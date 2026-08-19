import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import type { LeaveRequest, LeaveRequestDay } from "@prisma/client";

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

function buildIcs({
  uid,
  summary,
  startDate,
  endDateExclusive,
  attendeeEmails,
}: {
  uid: string;
  summary: string;
  startDate: Date;
  endDateExclusive: Date;
  attendeeEmails: string[];
}): string {
  const dtstamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//OLI Architecture//Employee Portal//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${toIcsDate(startDate)}`,
    `DTEND;VALUE=DATE:${toIcsDate(endDateExclusive)}`,
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

export async function sendPtoCalendarInvite(
  leaveRequest: LeaveRequest & { days: LeaveRequestDay[] },
  employee: { name: string; email: string }
) {
  try {
    const hasHalfDay = leaveRequest.days.some((d) => d.halfDay);
    const summary = `${initialsFor(employee.name)} Out${hasHalfDay ? " (Half Day)" : ""}`;
    const uid = `leave-${leaveRequest.id}@oliarch.com`;

    // ICS all-day DTEND is exclusive, so bump the last day by one.
    const endDateExclusive = addDays(new Date(leaveRequest.endDate), 1);

    const ics = buildIcs({
      uid,
      summary,
      startDate: new Date(leaveRequest.startDate),
      endDateExclusive,
      attendeeEmails: [employee.email, CC_EMAIL],
    });

    const sent = await sendEmail(
      employee.email,
      summary,
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
    if (!sent) return;

    await db.leaveRequest.update({
      where: { id: leaveRequest.id },
      data: { calendarInviteUid: uid },
    });
  } catch (err) {
    console.error("[calendar-invite] Failed to send:", err);
  }
}
